'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ProcessedEvent } from '@/types/conflict';
import { conflictDataService } from '@/services/conflictData';
import { getBattleCountries } from '@/services/sideCountryMap';
import { computeCentroidsSync, CountryCentroid } from '@/services/countryCentroids';
import { withBasePath } from '@/lib/basePath';
import FlashOverlay from './FlashOverlay';
import DeckGlOverlay from './DeckGlOverlay';
import ArcFlowOverlay from './ArcFlowOverlay';

interface ConflictMapProps {
  events: ProcessedEvent[];
  allEvents: ProcessedEvent[];
  selectedYear: number;
  selectedRegions: string[];
  showHeatmap: boolean;
  onEventClick: (event: ProcessedEvent | null) => void;
  selectedEvent: ProcessedEvent | null;
  isPlaying?: boolean;
  dataMode?: 'war' | 'conflict';
  onSequenceComplete?: () => void;
  showFlashes?: boolean;
  showColumns?: boolean;
  showArcs?: boolean;
  /** 冲突模式下的累积事件，供柱体随时间增长 */
  conflictColumnEvents?: ProcessedEvent[];
  showHexagons?: boolean;
  useGpuScatter?: boolean;
  useGreatCircle?: boolean;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const COUNTRIES_URL = withBasePath('/data/countries.json');

export default function ConflictMap({
  events,
  allEvents,
  selectedYear,
  selectedRegions,
  showHeatmap,
  onEventClick,
  selectedEvent,
  isPlaying = false,
  dataMode = 'war',
  onSequenceComplete,
  showFlashes = true,
  showColumns = false,
  showArcs = false,
  conflictColumnEvents,
  showHexagons = false,
  useGpuScatter = false,
  useGreatCircle = false,
}: ConflictMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // 保存原始国界数据（不含高亮），用于每次重置
  const countriesOriginal = useRef<GeoJSON.FeatureCollection | null>(null);
  // 国家质心（从 countries.json 同步计算，供弧线使用）
  const [centroids, setCentroids] = useState<Map<string, CountryCentroid> | undefined>(undefined);

  // Initialize map (once)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [20, 15],
      zoom: 1.5,
      attributionControl: false,
    });

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px'
    });

    m.on('load', () => {
      // ── 战役散点源 ──
      m.addSource('conflicts', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Heatmap layer (zoom-adaptive radius, weighted by total casualties)
      m.addLayer({
        id: 'conflicts-heat',
        type: 'heatmap',
        source: 'conflicts',
        layout: { visibility: 'none' },
        paint: {
          // 权重：用预计算的 heatWeight（UCDP 已 log 缩放）
          'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'heatWeight'],
            0, 0,
            50, 0.15,
            200, 0.45,
            500, 0.7,
            5000, 1,
            20000, 2,
            100000, 3
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 2],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, 'rgba(255,255,0,0.3)',
            0.35, 'rgba(255,140,0,0.5)',
            0.55, 'rgba(255,69,0,0.65)',
            0.75, 'rgba(255,0,0,0.8)',
            1, 'rgba(139,0,0,0.9)'
          ],
          // 半径随缩放自适应：远看大 blob 看分布，近看小点看细节
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 30,
            4, 15,
            8, 6,
            12, 3
          ],
          'heatmap-opacity': 0.75
        }
      });

      // Circle layer for scatter points (color by winner)
      m.addLayer({
        id: 'conflicts-points',
        type: 'circle',
        source: 'conflicts',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'source'], 'ucdp'], 4.5,
            ['interpolate', ['linear'], ['get', 'casualtyRate'],
              0, 3, 0.1, 6, 0.25, 10, 0.5, 16, 1, 22
            ]
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'source'], 'ucdp'],
            ['match', ['get', 'terrain'],
              'State-based conflict', '#f97316',
              'Non-state conflict', '#a855f7',
              'One-sided violence', '#ef4444',
              '#a855f7'
            ],
            ['match', ['get', 'winner'],
              'attacker', '#dc2680',
              'defender', '#3b82f6',
              'draw', '#facc15',
              '#6b7280'
            ]
          ],
          'circle-opacity': 0.75,
          'circle-stroke-width': 1,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'source'], 'ucdp'],
            ['match', ['get', 'terrain'],
              'State-based conflict', '#fb923c',
              'Non-state conflict', '#c084fc',
              'One-sided violence', '#f87171',
              '#c084fc'
            ],
            ['match', ['get', 'winner'],
              'attacker', '#ff4090',
              'defender', '#6090ff',
              'draw', '#ffe040',
              '#999'
            ]
          ],
          'circle-stroke-opacity': 0.9
        }
      });

      // ── 国界填充源与图层 ──
      // 首次加载 countries.json，保存原始副本
      fetch(COUNTRIES_URL)
        .then(r => r.json())
        .then((data: GeoJSON.FeatureCollection) => {
          // 确保所有 feature 默认 highlight = null
          data.features.forEach(f => { f.properties!.highlight = null; });
          countriesOriginal.current = JSON.parse(JSON.stringify(data));

          // 同步计算国家质心（用于弧线起点定位）
          setCentroids(computeCentroidsSync(JSON.parse(JSON.stringify(data))));

          m.addSource('countries', {
            type: 'geojson',
            data: data
          });

          // 国家填充层（放在点下方）
          m.addLayer({
            id: 'country-fill',
            type: 'fill',
            source: 'countries',
            paint: {
              'fill-color': [
                'match', ['get', 'highlight'],
                'attacker', 'rgba(220,38,38,0.5)',
                'defender', 'rgba(37,99,235,0.5)',
                'civil', 'rgba(124,58,237,0.35)',
                'rgba(0,0,0,0)'       // 默认全透明
              ],
              'fill-outline-color': 'rgba(255,255,255,0.08)',
            }
          });
        })
        .catch(err => console.warn('国界数据加载失败:', err));

      // ── Hover ──
      m.on('mouseenter', 'conflicts-points', (e) => {
        m.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0]) {
          const f = e.features[0];
          const p = f.properties!;
          const isUcdp = p.source === 'ucdp';
          const winnerLabel = isUcdp
            ? (p.terrain || '冲突事件')
            : (p.winner === 'attacker' ? '攻方胜' : p.winner === 'defender' ? '守方胜' : '平局');
          const winnerColor = isUcdp
            ? (p.terrain === 'State-based conflict' ? '#f97316' : p.terrain === 'One-sided violence' ? '#ef4444' : '#a855f7')
            : (p.winner === 'attacker' ? '#dc2680' : p.winner === 'defender' ? '#3b82f6' : '#facc15');
          popup.current!
            .setLngLat((f.geometry as any).coordinates)
            .setHTML(`
              <div style="color:#fff;font-size:12px;line-height:1.5">
                <strong>${p.name}</strong>
                <span style="color:${winnerColor};margin-left:6px">${winnerLabel}</span><br/>
                <span style="color:#aaa">${p.sideA} vs ${p.sideB}</span><br/>
                <span style="color:#aaa">${p.country} · ${p.date}</span><br/>
                <span style="color:#f87171">死亡：${Number(p.totalCasualties).toLocaleString()} 人</span>
                ${!isUcdp ? `<span style="color:#aaa;margin-left:8px">(${(Number(p.casualtyRate) * 100).toFixed(1)}%)</span>` : ''}
              </div>
            `)
            .addTo(m);
        }
      });

      m.on('mouseleave', 'conflicts-points', () => {
        m.getCanvas().style.cursor = '';
        popup.current!.remove();
      });

      // ── Click ──
      m.on('click', 'conflicts-points', (e) => {
        if (e.features && e.features[0]) {
          const p = e.features[0].properties!;
          onEventClick({
            id: p.id,
            name: p.name,
            war: p.war || '',
            warCn: p.warCn || '',
            sideA: p.sideA,
            sideB: p.sideB,
            latitude: p.lat,
            longitude: p.lng,
            date: p.date,
            year: p.year,
            winner: p.winner,
            region: p.region,
            country: p.country,
            attackerTroops: p.attackerTroops || 0,
            defenderTroops: p.defenderTroops || 0,
            totalTroops: p.totalTroops || 0,
            attackerCasualties: p.attackerCasualties || 0,
            defenderCasualties: p.defenderCasualties || 0,
            totalCasualties: p.totalCasualties || 0,
            casualtyRate: p.casualtyRate || 0,
            terrain: p.terrain || '',
            weather: p.weather || '',
            commanderA: p.commanderA || '',
            commanderB: p.commanderB || '',
            wikiUrl: p.wikiUrl || '',
            front: p.front || 0,
            depth: p.depth || 0,
            attackerAllies: p.attackerAllies || [],
            defenderAllies: p.defenderAllies || [],
            source: p.source || undefined,
          });
        }
      });

      // 点击地图空白处取消选中
      m.on('click', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['conflicts-points'] });
        if (features.length === 0) {
          onEventClick(null);
        }
      });

      setMapReady(true);
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // ── 更新战役散点数据 ──
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: events
        .filter(e => e.latitude != null && e.longitude != null)
        .map(e => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [e.longitude!, e.latitude!]
          },
          properties: {
            id: e.id,
            name: e.name,
            sideA: e.sideA,
            sideB: e.sideB,
            totalCasualties: e.totalCasualties,
            casualtyRate: e.casualtyRate,
            date: e.date,
            year: e.year,
            region: e.region,
            winner: e.winner,
            country: e.country,
            war: e.war,
            warCn: e.warCn,
            terrain: e.terrain,
            weather: e.weather,
            commanderA: e.commanderA,
            commanderB: e.commanderB,
            wikiUrl: e.wikiUrl,
            attackerTroops: e.attackerTroops,
            defenderTroops: e.defenderTroops,
            totalTroops: e.totalTroops,
            attackerCasualties: e.attackerCasualties,
            defenderCasualties: e.defenderCasualties,
            front: e.front,
            depth: e.depth,
            attackerAllies: e.attackerAllies || [],
            defenderAllies: e.defenderAllies || [],
            source: e.source || '',
            // 预计算热力图权重：UCDP 用 log 缩放保证可见
            heatWeight: (e.source === 'ucdp' && (e.totalCasualties || 0) > 0)
              ? Math.log10((e.totalCasualties || 1) + 1) * 180
              : (e.totalCasualties || 0),
            lat: e.latitude,
            lng: e.longitude
          }
        }))
    };

    const source = map.current.getSource('conflicts') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(geojson);
    }
  }, [events, mapReady]);

  // ── 国界高亮：当选中事件变化时更新国家填色 ──
  useEffect(() => {
    if (!map.current || !mapReady || !countriesOriginal.current) return;

    const source = map.current.getSource('countries') as maplibregl.GeoJSONSource;
    if (!source) return;

    // 深克隆原始数据
    const data: GeoJSON.FeatureCollection = JSON.parse(JSON.stringify(countriesOriginal.current));

    if (selectedEvent) {
      const { countryA, countryB, isCivil } = getBattleCountries(
        selectedEvent.sideA,
        selectedEvent.sideB,
        selectedEvent.country
      );

      if (isCivil) {
        // 内战：用一种中性色标记唯一国家
        data.features.forEach(f => {
          f.properties!.highlight = (f.properties!.name === countryA) ? 'civil' : null;
        });
      } else {
        // 国际战争：分别标记攻守方国家
        data.features.forEach(f => {
          const name = f.properties!.name;
          if (name === countryA) f.properties!.highlight = 'attacker';
          else if (name === countryB) f.properties!.highlight = 'defender';
          else f.properties!.highlight = null;
        });
      }
    } else {
      // 没有选中 → 全部取消高亮
      data.features.forEach(f => { f.properties!.highlight = null; });
    }

    source.setData(data);
  }, [selectedEvent, mapReady]);

  // ── 播放模式：隐藏静态图层，用闪点动画替代 ──
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;
    if (!m.isStyleLoaded()) return;
    if (isPlaying) {
      m.setLayoutProperty('conflicts-points', 'visibility', 'none');
      m.setLayoutProperty('conflicts-heat', 'visibility', 'none');
    } else {
      m.setLayoutProperty('conflicts-points', 'visibility', showHeatmap ? 'none' : 'visible');
      m.setLayoutProperty('conflicts-heat', 'visibility', showHeatmap ? 'visible' : 'none');
    }
  }, [isPlaying, showHeatmap, mapReady]);

  // ── Toggle heatmap vs points ──
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;
    if (!m.isStyleLoaded()) return;
    // play 模式中由上面 effect 接管，不重复操作
    if (isPlaying) return;
    m.setLayoutProperty('conflicts-heat', 'visibility', showHeatmap ? 'visible' : 'none');
    m.setLayoutProperty('conflicts-points', 'visibility', showHeatmap ? 'none' : 'visible');
  }, [showHeatmap, mapReady, isPlaying]);

  // ── 闪点动画所需的排序事件 ──
  const sortedEvents = useMemo(
    () => conflictDataService.sortEventsByDate(events),
    [events]
  );

  // ── 闪点序列完成回调（带 ref 避免闭包过期） ──
  const onCompleteRef = useRef(onSequenceComplete);
  onCompleteRef.current = onSequenceComplete;
  const handleSequenceComplete = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  // ── 点击战役 → 根据参战国边界动态放大到战区 ──
  useEffect(() => {
    if (!map.current || !mapReady || !selectedEvent) return;
    if (selectedEvent.latitude == null || selectedEvent.longitude == null) return;

    // 计算参战国的边界框
    const { countryA, countryB } = getBattleCountries(selectedEvent.sideA, selectedEvent.sideB, selectedEvent.country);
    const targetCountries = new Set([countryA, countryB].filter(Boolean) as string[]);

    let bounds: [number, number, number, number] | null = null; // [west, south, east, north]

    if (countriesOriginal.current && targetCountries.size > 0) {
      for (const feature of countriesOriginal.current.features) {
        if (targetCountries.has(feature.properties!.name)) {
          const geom = feature.geometry as GeoJSON.MultiPolygon;
          const coords = geom.coordinates;
          // 递归遍历 MultiPolygon 提取所有坐标计算 bbox
          function collectCoords(c: any) {
            if (typeof c[0] === 'number') {
              const [lon, lat] = c;
              if (bounds) {
                bounds[0] = Math.min(bounds[0], lon); // west
                bounds[1] = Math.min(bounds[1], lat); // south
                bounds[2] = Math.max(bounds[2], lon); // east
                bounds[3] = Math.max(bounds[3], lat); // north
              } else {
                bounds = [lon, lat, lon, lat];
              }
            } else {
              for (const item of c) collectCoords(item);
            }
          }
          collectCoords(coords);
        }
      }
    }

    if (bounds) {
      // fitBounds 带 padding，留出弹窗和侧栏空间
      map.current.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] as [[number, number], [number, number]],
        { padding: { top: 80, bottom: 80, left: 350, right: 80 }, maxZoom: 8, duration: 1800 }
      );
    } else {
      // 没有匹配到国家时回退到单点 zoom 7
      map.current.flyTo({
        center: [selectedEvent.longitude, selectedEvent.latitude],
        zoom: 7,
        speed: 0.8,
        curve: 1.2,
      });
    }
  }, [selectedEvent, mapReady]);

  // ── 相机俯角控制：柱体和弧线开启时倾斜 50°，六边形不改变俯角 ──
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !m.isStyleLoaded()) return;
    const needPitch = showColumns || showArcs;
    const targetPitch = needPitch ? 50 : 0;
    m.easeTo({ pitch: targetPitch, duration: 800 });
  }, [showColumns, showArcs, showHexagons, mapReady]);

  // 3D 图层需要：确保 Canvas 不阻止地图旋转/俯仰交互
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    if (showColumns || showArcs) {
      m.dragRotate.enable();
      m.touchZoomRotate.enableRotation();
    }
  }, [showColumns, showArcs, showHexagons, mapReady]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full absolute inset-0" />
      {showFlashes && !useGpuScatter && (
        <FlashOverlay
          events={sortedEvents}
          mapRef={map}
          isPlaying={isPlaying}
          dataMode={dataMode}
          onSequenceComplete={handleSequenceComplete}
        />
      )}
      <DeckGlOverlay
        allEvents={allEvents}
        yearEvents={events}
        selectedYear={selectedYear}
        selectedRegions={selectedRegions}
        mapRef={map}
        isPlaying={isPlaying}
        showColumns={showColumns}
        showArcs={showArcs}
        centroids={centroids}
        dataMode={dataMode}
        conflictColumnEvents={conflictColumnEvents}
        showHexagons={showHexagons}
        useGpuScatter={useGpuScatter}
        useGreatCircle={useGreatCircle}
      />
      {showArcs && (
        <ArcFlowOverlay
          yearEvents={events}
          mapRef={map}
          centroids={centroids}
          showArcs={showArcs}
          useGreatCircle={useGreatCircle}
        />
      )}
    </div>
  );
}
