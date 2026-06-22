'use client';

import { useMemo, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer, ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { H3HexagonLayer, GreatCircleLayer } from '@deck.gl/geo-layers';
import { latLngToCell } from 'h3-js';
import { ProcessedEvent } from '@/types/conflict';
import { getBattleCountries } from '@/services/sideCountryMap';
import { CountryCentroid } from '@/services/countryCentroids';

interface ArcDatum {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  sourceColor: [number, number, number, number];
  targetColor: [number, number, number, number];
  width: number;
}

interface ColumnDatum {
  position: [number, number];
  elevation: number;
  fillColor: [number, number, number];
  casualties: number;
}

interface DeckGlOverlayProps {
  allEvents: ProcessedEvent[];
  yearEvents: ProcessedEvent[];
  selectedYear: number;
  mapRef: React.RefObject<maplibregl.Map | null>;
  isPlaying: boolean;
  showColumns: boolean;
  showArcs: boolean;
  centroids: Map<string, CountryCentroid> | undefined;
  dataMode: 'war' | 'conflict';
  conflictColumnEvents?: ProcessedEvent[];
  showHexagons?: boolean;
  useGpuScatter?: boolean;
  useGreatCircle?: boolean;
}

function getColumnColor(totalCasualties: number): [number, number, number] {
  const logVal = Math.log10(Math.max(totalCasualties, 1) + 1);
  const t = Math.min(logVal / 6, 1);
  return [
    Math.round(255 - 75 * t),
    Math.round(180 - 160 * t),
    Math.round(40 - 20 * t),
  ];
}

/** 柱体高度：对数再幂次放大，小战役可见、大战役一飞冲天 */
function getColumnElevation(casualties: number): number {
  const logVal = Math.log10(Math.max(casualties, 1) + 1);
  return Math.pow(logVal, 2.2) * 3000;
}

export default function DeckGlOverlay({
  allEvents,
  yearEvents,
  selectedYear,
  mapRef,
  isPlaying,
  showColumns,
  showArcs,
  centroids,
  dataMode,
  conflictColumnEvents,
  showHexagons = false,
  useGpuScatter = false,
  useGreatCircle = false,
}: DeckGlOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const rafHandleRef = useRef<number>(0);
  const pendingLayersRef = useRef<
    (ColumnLayer | ArcLayer | H3HexagonLayer | ScatterplotLayer | GreatCircleLayer)[] | null
  >(null);

  const columnSource = dataMode === 'conflict' ? (conflictColumnEvents ?? []) : allEvents;

  // ── 柱体数据 ──
  const columnData = useMemo((): ColumnDatum[] => {
    if (!showColumns) return [];
    const accum = new Map<string, { lng: number; lat: number; casualties: number }>();
    for (const e of columnSource) {
      if (e.year > selectedYear) continue;
      if (e.latitude == null || e.longitude == null) continue;
      const c = e.totalCasualties || 0;
      if (c <= 0) continue;
      const key = `${e.longitude.toFixed(4)},${e.latitude.toFixed(4)}`;
      const existing = accum.get(key);
      if (existing) existing.casualties += c;
      else accum.set(key, { lng: e.longitude, lat: e.latitude, casualties: c });
    }
    return Array.from(accum.values()).map(d => {
      const [r, g, b] = getColumnColor(d.casualties);
      return {
        position: [d.lng, d.lat] as [number, number],
        elevation: getColumnElevation(d.casualties),
        fillColor: [r, g, b] as [number, number, number],
        casualties: d.casualties,
      };
    });
  }, [columnSource, selectedYear, showColumns]);

  // ── 弧线数据 ──
  const arcData = useMemo((): ArcDatum[] => {
    if (!showArcs || !centroids || centroids.size === 0) return [];
    const result: ArcDatum[] = [];
    for (const e of yearEvents) {
      if (e.latitude == null || e.longitude == null) continue;
      const { countryA } = getBattleCountries(e.sideA, e.sideB, e.country);
      if (!countryA) continue;
      const centroid = centroids.get(countryA);
      if (!centroid) continue;
      const casualties = e.totalCasualties || 1;
      const alpha = Math.min(0.9, 0.3 + Math.log10(casualties + 1) * 0.12);
      result.push({
        sourcePosition: [centroid.lng, centroid.lat],
        targetPosition: [e.longitude!, e.latitude!],
        sourceColor: [255, 140, 40, Math.round(alpha * 255)],
        targetColor: [255, 80, 20, Math.round(alpha * 255)],
        width: Math.min(4, 1 + Math.log10(casualties + 1) * 0.6),
      });
    }
    return result;
  }, [yearEvents, centroids, showArcs]);

  // ── H3 六边形聚合数据 ──
  const H3_RESOLUTION = 3; // 分辨率 3 = 边长约 60km，适合洲际分布
  const hexagonData = useMemo(() => {
    if (!showHexagons) return [];
    const accum = new Map<string, { casualties: number }>();
    for (const e of columnSource) {
      if (e.year > selectedYear) continue;
      if (e.latitude == null || e.longitude == null) continue;
      const c = e.totalCasualties || 0;
      if (c <= 0) continue;
      const cell = latLngToCell(e.latitude, e.longitude, H3_RESOLUTION);
      const existing = accum.get(cell);
      if (existing) existing.casualties += c;
      else accum.set(cell, { casualties: c });
    }
    return Array.from(accum.entries()).map(([cell, val]) => ({
      hex: cell,
      casualties: val.casualties,
    }));
  }, [columnSource, selectedYear, showHexagons]);

  // ── GPU 散点数据（替换闪点动画）──
  const scatterData = useMemo((): {
    position: [number, number];
    size: number;
    color: [number, number, number];
    opacity: number;
  }[] => {
    if (!useGpuScatter) return [];
    return yearEvents
      .filter(e => e.latitude != null && e.longitude != null)
      .map(e => {
        const c = e.totalCasualties || 1;
        const logC = Math.log10(c + 1);
        const [r, g, b] = getColumnColor(c);
        return {
          position: [e.longitude!, e.latitude!] as [number, number],
          size: Math.max(1000, Math.min(30000, logC * 8000)),
          color: [r, g, b] as [number, number, number],
          opacity: Math.min(0.9, 0.3 + logC * 0.12),
        };
      });
  }, [yearEvents, useGpuScatter]);

  // ── 组装图层 ──
  const layers = useMemo(() => {
    const result: (
      ColumnLayer | ArcLayer | H3HexagonLayer | ScatterplotLayer | GreatCircleLayer
    )[] = [];

    // 柱体
    if (showColumns && columnData.length > 0) {
      result.push(
        new ColumnLayer<ColumnDatum>({
          id: 'casualty-columns',
          data: columnData,
          getPosition: (d) => d.position,
          getElevation: (d) => d.elevation,
          getFillColor: (d) => d.fillColor,
          radius: 15000,
          coverage: 0.7,
          extruded: true,
          pickable: false,
          opacity: 0.85,
          transitions: isPlaying
            ? { getElevation: { duration: 600, easing: (t: number) => t * (2 - t) } }
            : undefined,
        })
      );
    }

    // 弧线：大圆模式或普通模式
    if (showArcs && arcData.length > 0) {
      if (useGreatCircle) {
        result.push(
          new GreatCircleLayer<ArcDatum>({
            id: 'war-arcs',
            data: arcData,
            getSourcePosition: (d) => d.sourcePosition,
            getTargetPosition: (d) => d.targetPosition,
            getSourceColor: (d) => d.sourceColor,
            getTargetColor: (d) => d.targetColor,
            getWidth: (d) => d.width,
            pickable: false,
            opacity: 0.7,
          })
        );
      } else {
        result.push(
          new ArcLayer<ArcDatum>({
            id: 'war-arcs',
            data: arcData,
            getSourcePosition: (d) => d.sourcePosition,
            getTargetPosition: (d) => d.targetPosition,
            getSourceColor: (d) => d.sourceColor,
            getTargetColor: (d) => d.targetColor,
            getWidth: (d) => d.width,
            getHeight: 0.3,
            pickable: false,
            opacity: 0.7,
          })
        );
      }
    }

    // 六边形网格
    if (showHexagons && hexagonData.length > 0) {
      result.push(
        new H3HexagonLayer<{ hex: string; casualties: number }>({
          id: 'conflict-hexagons',
          data: hexagonData,
          getHexagon: (d) => d.hex,
          getElevation: (d) => getColumnElevation(d.casualties),
          getFillColor: (d) => {
            const [r, g, b] = getColumnColor(d.casualties);
            return [r, g, b, 200] as [number, number, number, number];
          },
          extruded: true,
          coverage: 1,
          pickable: false,
          opacity: 0.8,
          elevationScale: 1,
          transitions: isPlaying
            ? { getElevation: { duration: 600, easing: (t: number) => t * (2 - t) } }
            : undefined,
        })
      );
    }

    // GPU 散点
    if (useGpuScatter && scatterData.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'gpu-scatter',
          data: scatterData,
          getPosition: (d) => d.position,
          getRadius: (d) => d.size,
          getFillColor: (d) => [...d.color, Math.round(d.opacity * 255)] as [
            number, number, number, number,
          ],
          radiusMinPixels: 3,
          radiusMaxPixels: 30,
          pickable: false,
          opacity: 0.75,
          antialiasing: true,
        })
      );
    }

    return result;
  }, [
    columnData, arcData, hexagonData, scatterData,
    showColumns, showArcs, showHexagons, useGpuScatter, useGreatCircle, isPlaying,
  ]);

  const hasVisibleLayers = layers.length > 0;

  // ── MapboxOverlay 生命周期 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hasVisibleLayers && !overlayRef.current) {
      const overlay = new MapboxOverlay({ interleaved: false, layers });
      map.addControl(overlay);
      overlayRef.current = overlay;
    } else if (!hasVisibleLayers && overlayRef.current) {
      cancelAnimationFrame(rafHandleRef.current);
      map.removeControl(overlayRef.current);
      overlayRef.current = null;
    }
    return () => {
      cancelAnimationFrame(rafHandleRef.current);
      if (overlayRef.current) {
        map.removeControl(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [hasVisibleLayers, mapRef]);

  const applyLayers = useCallback(() => {
    rafHandleRef.current = 0;
    if (overlayRef.current && pendingLayersRef.current) {
      overlayRef.current.setProps({ layers: pendingLayersRef.current });
    }
  }, []);

  useEffect(() => {
    if (!overlayRef.current || !hasVisibleLayers) return;
    pendingLayersRef.current = layers;
    if (rafHandleRef.current === 0) {
      rafHandleRef.current = requestAnimationFrame(applyLayers);
    }
  }, [layers, hasVisibleLayers, applyLayers]);

  return null;
}
