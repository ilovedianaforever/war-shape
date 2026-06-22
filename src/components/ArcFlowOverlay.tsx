'use client';

import { useRef, useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { ProcessedEvent } from '@/types/conflict';
import { getBattleCountries } from '@/services/sideCountryMap';
import { CountryCentroid } from '@/services/countryCentroids';

/* ── 粒子状态（不存 React state，用 ref 纯 JS 驱动以避开支渲染抖动）── */
interface Particle {
  t: number;
  speed: number;
  size: number;
  r: number; g: number; b: number;
}

interface ArcPath {
  srcX: number; srcY: number;
  ctrlX: number; ctrlY: number;
  tgtX: number; tgtY: number;
  particles: Particle[];
  /** 大圆采样路径点（仅 greatCircle 模式用） */
  samplePts?: { x: number; y: number }[];
}

interface ArcGeoDatum {
  srcLng: number; srcLat: number;
  tgtLng: number; tgtLat: number;
  casualties: number;
}

interface ArcFlowOverlayProps {
  yearEvents: ProcessedEvent[];
  mapRef: React.RefObject<maplibregl.Map | null>;
  centroids: Map<string, CountryCentroid> | undefined;
  showArcs: boolean;
  useGreatCircle?: boolean;
}

const PARTICLES_PER_ARC = 2; // 减少粒子数，冲突模式下避免卡顿
const GREAT_CIRCLE_SAMPLES = 16; // 大圆采样点缩减（40→16），大幅减少 map.project 调用
const ARC_CURVE_HEIGHT = 0.4;

function colorFromCasualties(c: number): { r: number; g: number; b: number } {
  const logVal = Math.log10(Math.max(c, 1) + 1);
  const t = Math.min(logVal / 6, 1);
  return {
    r: Math.round(255 - 75 * t),
    g: Math.round(180 - 160 * t),
    b: Math.round(40 - 20 * t),
  };
}

export default function ArcFlowOverlay({
  yearEvents,
  mapRef,
  centroids,
  showArcs,
  useGreatCircle = false,
}: ArcFlowOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const pathsRef = useRef<ArcPath[]>([]);
  const arcGeoDataRef = useRef<ArcGeoDatum[]>([]);

  // ── 弧线地理数据（与 DeckGlOverlay 的 arcData 同源）──
  const arcGeoData = useMemo(() => {
    if (!showArcs || !centroids || centroids.size === 0) {
      arcGeoDataRef.current = [];
      return [];
    }
    const result: ArcGeoDatum[] = [];
    for (const e of yearEvents) {
      if (e.latitude == null || e.longitude == null) continue;
      const { countryA } = getBattleCountries(e.sideA, e.sideB, e.country);
      if (!countryA) continue;
      const centroid = centroids.get(countryA);
      if (!centroid) continue;
      result.push({
        srcLng: centroid.lng,
        srcLat: centroid.lat,
        tgtLng: e.longitude!,
        tgtLat: e.latitude!,
        casualties: e.totalCasualties || 1,
      });
    }
    arcGeoDataRef.current = result;
    return result;
  }, [yearEvents, centroids, showArcs]);

  // ── 大圆插值辅助函数：球面线性插值 ──
  const greatCircleSample = (
    lng1: number, lat1: number,
    lng2: number, lat2: number,
    numSamples: number,
    map: maplibregl.Map
  ): { x: number; y: number }[] => {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;

    const lat1r = toRad(lat1), lng1r = toRad(lng1);
    const lat2r = toRad(lat2), lng2r = toRad(lng2);

    const pts: { x: number; y: number }[] = [];
    const dpr = window.devicePixelRatio || 1;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      // 沿大圆的球面线性插值 (slerp)
      const delta = Math.acos(
        Math.sin(lat1r) * Math.sin(lat2r) +
        Math.cos(lat1r) * Math.cos(lat2r) * Math.cos(lng2r - lng1r)
      );
      const a = Math.sin((1 - t) * delta) / Math.sin(delta);
      const b = Math.sin(t * delta) / Math.sin(delta);
      const x = a * Math.cos(lat1r) * Math.cos(lng1r) + b * Math.cos(lat2r) * Math.cos(lng2r);
      const y = a * Math.cos(lat1r) * Math.sin(lng1r) + b * Math.cos(lat2r) * Math.sin(lng2r);
      const z = a * Math.sin(lat1r) + b * Math.sin(lat2r);
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lng = Math.atan2(y, x);
      const pt = map.project([toDeg(lng), toDeg(lat)]);
      pts.push({ x: pt.x * dpr, y: pt.y * dpr });
    }
    return pts;
  };

  // ── 将地理弧线投影到屏幕坐标，生成路径与粒子 ──
  const rebuildPaths = () => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const data = arcGeoDataRef.current;
    const newPaths: ArcPath[] = [];

    for (let i = 0; i < data.length; i++) {
      const geo = data[i];
      const src = map.project([geo.srcLng, geo.srcLat]);
      const tgt = map.project([geo.tgtLng, geo.tgtLat]);
      const sx = src.x * dpr;
      const sy = src.y * dpr;
      const tx = tgt.x * dpr;
      const ty = tgt.y * dpr;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) continue;

      let ctrlX: number, ctrlY: number, samplePts: { x: number; y: number }[] | undefined;

      if (useGreatCircle) {
        // 大圆模式：采样路径点
            samplePts = greatCircleSample(geo.srcLng, geo.srcLat, geo.tgtLng, geo.tgtLat, GREAT_CIRCLE_SAMPLES, map);
        // 控制点用中点（粒子的贝塞尔近似用采样点替代，这里保留兼容）
        ctrlX = (sx + tx) / 2;
        ctrlY = Math.min(sy, ty) - dist * 0.1;
      } else {
        // 贝塞尔模式：控制点始终向上弓（与 deck.gl ArcLayer 方向一致，避免镜像倒影）
        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;
        const arcHeight = dist * ARC_CURVE_HEIGHT;
        const perpX = -dy / dist;
        const perpY = dx / dist;
        ctrlX = midX + perpX * arcHeight;
        ctrlY = midY - Math.abs(perpY) * arcHeight;
      }

      const { r, g: gg, b } = colorFromCasualties(geo.casualties);
      const particles: Particle[] = [];
      for (let j = 0; j < PARTICLES_PER_ARC; j++) {
        particles.push({
          t: j / PARTICLES_PER_ARC,
          speed: 0.018 + Math.random() * 0.022,
          size: 1.8 + Math.random() * 2.5,
          r, g: gg, b,
        });
      }
      newPaths.push({ srcX: sx, srcY: sy, ctrlX, ctrlY, tgtX: tx, tgtY: ty, particles, samplePts });
    }

    pathsRef.current = newPaths;
  };

  // ── 动画帧循环 ──
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const paths = pathsRef.current;

    for (const p of paths) {
      const { srcX, srcY, ctrlX, ctrlY, tgtX, tgtY, particles, samplePts } = p;

      // 画淡色弧线底轨
      ctx.beginPath();
      if (samplePts && samplePts.length > 0) {
        // 大圆模式：沿采样点画折线
        ctx.moveTo(samplePts[0].x, samplePts[0].y);
        for (let k = 1; k < samplePts.length; k++) {
          ctx.lineTo(samplePts[k].x, samplePts[k].y);
        }
      } else {
        ctx.moveTo(srcX, srcY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tgtX, tgtY);
      }
      ctx.strokeStyle = 'rgba(255,140,40,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 画粒子
      for (const pt of particles) {
        let px: number, py: number;

        if (samplePts && samplePts.length > 0) {
          // 大圆模式：沿采样点插值
          const idx = pt.t * (samplePts.length - 1);
          const lo = Math.floor(idx);
          const hi = Math.min(lo + 1, samplePts.length - 1);
          const frac = idx - lo;
          px = samplePts[lo].x + (samplePts[hi].x - samplePts[lo].x) * frac;
          py = samplePts[lo].y + (samplePts[hi].y - samplePts[lo].y) * frac;
        } else {
          const t = pt.t;
          const it = 1 - t;
          px = it * it * srcX + 2 * it * t * ctrlX + t * t * tgtX;
          py = it * it * srcY + 2 * it * t * ctrlY + t * t * tgtY;
        }

        const r = pt.size * dpr;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 2.5);
        grad.addColorStop(0, `rgba(255,255,255,0.6)`);
        grad.addColorStop(0.25, `rgba(${pt.r},${pt.g},${pt.b},0.4)`);
        grad.addColorStop(0.6, `rgba(${pt.r},${pt.g},${pt.b},0.1)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - r * 2.5, py - r * 2.5, r * 5, r * 5);

        pt.t += pt.speed;
        if (pt.t >= 1) pt.t -= 1;
      }
    }

    animRef.current = requestAnimationFrame(animate);
  };

  // ── Canvas 同步 & 动画启停 ──
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const sync = () => {
      const rect = map.getContainer().getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      rebuildPaths();
    };

    sync();

    const onMove = () => rebuildPaths();
    map.on('move', onMove);
    map.on('resize', sync);

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      map.off('move', onMove);
      map.off('resize', sync);
    };
  }, [mapRef, showArcs]);

  // ── 数据变化时重建路径 ──
  useEffect(() => {
    rebuildPaths();
  }, [arcGeoData]);

  if (!showArcs) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
