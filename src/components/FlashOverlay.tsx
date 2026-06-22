'use client';

import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { ProcessedEvent } from '@/types/conflict';

/* ── 闪点粒子数据结构 ── */
interface FlashParticle {
  lng: number;
  lat: number;
  r: number; g: number; b: number; // 主色 RGB（0-255）
  size: number;    // 最大半径（px，DPR 缩放下按逻辑像素计算）
  bornAt: number;  // performance.now() 出生时间
  lifetime: number; // 生命周期 ms
}

/* ── 伤疤标记（仅存地理坐标，不存像素） ── */
interface ScarMark {
  lng: number;
  lat: number;
  r: number; g: number; b: number;
  size: number;
}

interface FlashOverlayProps {
  events: ProcessedEvent[];           // 已按 date 排序
  mapRef: React.RefObject<maplibregl.Map | null>;
  isPlaying: boolean;
  dataMode: 'war' | 'conflict';
  onSequenceComplete: () => void;
}

/* ── 常量 ── */
const FLASH_LIFETIME = 300;          // 每个闪点生命周期 ms
const TARGET_FLASHES_PER_SEC_WAR = 120;    // 历史战争模式目标闪点/秒（较慢）
const TARGET_FLASHES_PER_SEC_CONFLICT = 200; // 当代冲突模式目标闪点/秒（舒缓观赏）
const MIN_BUCKET_MS_WAR = 4000;       // 历史战争最少 4 秒
const MAX_BUCKET_MS = 20000;         // 最多 20 秒
const GLOW_RADIUS_MULT = 3.0;        // 光晕半径倍数（泛光扩散范围）
const CORE_EXPAND_FACTOR = 0.3;      // 闪点半径随生命周期膨胀系数

/* ── 伤疤层常量 ── */
const SCAR_ALPHA_WAR = 0.045;        // 战争模式伤疤 alpha（低频高覆盖）
const SCAR_ALPHA_CONFLICT = 0.012;   // 冲突模式伤疤 alpha（高频低覆盖防过曝）
const SCAR_RADIUS_SCALE = 1.3;       // 伤疤半径 ⨉ 闪点半径

/* ── 颜色映射（返回 [R,G,B] 元组，与图例一致） ── */
function getFlashRGB(event: ProcessedEvent, mode: 'war' | 'conflict'): [number, number, number] {
  if (mode === 'conflict') {
    switch (event.terrain) {
      case 'State-based conflict': return [249, 115, 22];  // orange
      case 'Non-state conflict':  return [168, 85, 247];   // purple
      case 'One-sided violence':  return [239, 68, 68];    // red
      default:                     return [168, 85, 247];
    }
  }
  switch (event.winner) {
    case 'attacker': return [220, 38, 128];   // pink-red
    case 'defender': return [59, 130, 246];   // blue
    case 'draw':     return [250, 204, 21];   // yellow
    default:         return [107, 114, 128];  // gray
  }
}

/** 闪点半径：按伤亡数的对数映射 2–14 px */
function getFlashSize(event: ProcessedEvent): number {
  const c = Math.max(event.totalCasualties || 1, 1);
  const s = Math.log10(c + 1) * 2.5;
  return Math.max(2, Math.min(14, s));
}

export default function FlashOverlay({
  events,
  mapRef,
  isPlaying,
  dataMode,
  onSequenceComplete,
}: FlashOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);         // 闪点层
  const scarCanvasRef = useRef<HTMLCanvasElement>(null);     // 伤疤累积层
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<FlashParticle[]>([]);
  const birthIndexRef = useRef(0);
  const bucketStartRef = useRef(0);
  const bucketDurationRef = useRef(0);
  const birthIntervalRef = useRef(0);

  // 伤疤层专属 ref
  const scarMarksRef = useRef<ScarMark[]>([]);               // 累积标记地理坐标数组（永不 clear）
  const scarDrawnIdxRef = useRef(0);                          // 已绘制到的索引（增量绘制游标）

  // 外部可变值用 ref 避免 effect 重跑
  const isPlayingRef = useRef(isPlaying);
  const onCompleteRef = useRef(onSequenceComplete);
  const dataModeRef = useRef(dataMode);
  isPlayingRef.current = isPlaying;
  onCompleteRef.current = onSequenceComplete;
  dataModeRef.current = dataMode;

  // 批次追踪：用 ref 持久化最新 events 避免 effect 重跑断流
  const eventsRef = useRef(events);
  const batchIdRef = useRef(0);         // 每当 events 变化 ++
  const processedBatchRef = useRef(-1);  // 已完成的最新批次
  const batchCompletedRef = useRef(false);

  // 检测 events 变化 → 更新批次号
  if (events !== eventsRef.current) {
    eventsRef.current = events;
    batchIdRef.current++;
  }

  /* ── 伤疤全量重绘（moveend / resize 后调用） ── */
  const redrawAllScars = useCallback(() => {
    const scarCanvas = scarCanvasRef.current;
    const map = mapRef.current;
    if (!scarCanvas || !map) return;
    const sctx = scarCanvas.getContext('2d');
    if (!sctx) return;

    const dpr = window.devicePixelRatio || 1;
    const marks = scarMarksRef.current;
    const alpha = dataModeRef.current === 'war' ? SCAR_ALPHA_WAR : SCAR_ALPHA_CONFLICT;

    // 清空后全量重绘
    sctx.clearRect(0, 0, scarCanvas.width, scarCanvas.height);
    sctx.globalCompositeOperation = 'lighter';

    for (const m of marks) {
      const pt = map.project([m.lng, m.lat]);
      const px = pt.x * dpr;
      const py = pt.y * dpr;
      const r = m.size * dpr * SCAR_RADIUS_SCALE;

      const grad = sctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha * 1.6})`);
      grad.addColorStop(0.35, `rgba(${m.r},${m.g},${m.b},${alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = grad;
      sctx.fillRect(px - r, py - r, r * 2, r * 2);
    }

    sctx.globalCompositeOperation = 'source-over';
    // 全量重绘后游标指向末尾，后续帧只画增量
    scarDrawnIdxRef.current = marks.length;
  }, [mapRef]);

  /* ── Canvas 尺寸同步到地图容器 ── */
  const syncCanvasSize = useCallback(() => {
    const map = mapRef.current;
    const flashCanvas = canvasRef.current;
    if (!map || !flashCanvas) return;
    const rect = map.getContainer().getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;

    // 闪点 canvas（始终同步）
    flashCanvas.width = rect.width * dpr;
    flashCanvas.height = rect.height * dpr;
    flashCanvas.style.width = `${rect.width}px`;
    flashCanvas.style.height = `${rect.height}px`;

    // 伤疤 canvas（仅战争模式存在）
    const scarCanvas = scarCanvasRef.current;
    if (scarCanvas) {
      const scarW = rect.width * dpr;
      const scarH = rect.height * dpr;
      const resized = scarCanvas.width !== scarW || scarCanvas.height !== scarH;
      scarCanvas.width = scarW;
      scarCanvas.height = scarH;
      scarCanvas.style.width = `${rect.width}px`;
      scarCanvas.style.height = `${rect.height}px`;
      if (resized) redrawAllScars();
    }
  }, [mapRef, redrawAllScars]);

  /* ── 连续播放动画：RAF 永不中断，无缝衔接批次 ── */
  useEffect(() => {
    if (!isPlaying) {
      // 完全停止
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      particlesRef.current = [];
      birthIndexRef.current = 0;
      processedBatchRef.current = -1;
      batchCompletedRef.current = false;

      // 清空伤疤层
      scarMarksRef.current = [];
      scarDrawnIdxRef.current = 0;
      const fc = canvasRef.current;
      if (fc) { const ctx = fc.getContext('2d'); if (ctx) ctx.clearRect(0, 0, fc.width, fc.height); }
      const sc = scarCanvasRef.current;
      if (sc) { const ctx = sc.getContext('2d'); if (ctx) ctx.clearRect(0, 0, sc.width, sc.height); }
      return;
    }

    // 播放中：如果没有 RAF 在跑，启动主循环
    if (rafRef.current) return; // 已在运行

    syncCanvasSize();
    let currentBatchId = -1;

    /** 启动当前批次播放 */
    const startBatch = () => {
      const evts = eventsRef.current;
      if (evts.length === 0) {
        // 异步加载中 → 短暂等待后重试，不退出 RAF
        rafRef.current = requestAnimationFrame(() => {
          if (!isPlayingRef.current) return;
          rafRef.current = 0;
          if (evts.length === 0) {
            // 仍无数据，继续等
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = 0;
              startBatch();
            });
          } else {
            startBatch();
          }
        });
        return;
      }

      // 初始化批次参数（模式自适应速度）
      currentBatchId = batchIdRef.current;
      birthIndexRef.current = 0;
      const isWar = dataModeRef.current === 'war';
      const fps = isWar ? TARGET_FLASHES_PER_SEC_WAR : TARGET_FLASHES_PER_SEC_CONFLICT;
      const minMs = isWar ? MIN_BUCKET_MS_WAR : 2000;
      const totalMs = Math.max(minMs, Math.min(MAX_BUCKET_MS, (evts.length / fps) * 1000));
      bucketDurationRef.current = totalMs;
      birthIntervalRef.current = totalMs / evts.length;
      bucketStartRef.current = performance.now();
      particlesRef.current = [];
      batchCompletedRef.current = false;

      // 启动帧循环
      rafRef.current = requestAnimationFrame(frameLoop);
    };

    const frameLoop = (now: number) => {
      if (!isPlayingRef.current) return;

      // 检查是否有新批次到达（events prop 已变）
      if (currentBatchId !== batchIdRef.current && !batchCompletedRef.current) {
        // 新批次到达但当前批次未播完 → 忽略，等当前播完
      }
      if (batchCompletedRef.current && currentBatchId !== batchIdRef.current) {
        // 当前批次已完成，新批次已到达 → 无缝切入新批次
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        startBatch();
        return;
      }

      const canvas = canvasRef.current;
      const map = mapRef.current;
      if (!canvas || !map) { rafRef.current = requestAnimationFrame(frameLoop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(frameLoop); return; }

      const evts = eventsRef.current;
      const elapsed = now - bucketStartRef.current;
      const dpr = window.devicePixelRatio || 1;
      const interval = birthIntervalRef.current;

      // 0) 每帧全量重绘伤疤（仅历史战争模式）——冲突模式数据量大，跳过伤疤累积以保性能
      if (dataModeRef.current === 'war') {
        const scarCanvas = scarCanvasRef.current;
        if (scarCanvas) {
          const sctx = scarCanvas.getContext('2d');
          if (sctx) {
            const marks = scarMarksRef.current;
            const alpha = SCAR_ALPHA_WAR;
            sctx.clearRect(0, 0, scarCanvas.width, scarCanvas.height);
            sctx.globalCompositeOperation = 'lighter';
            for (const m of marks) {
              const pt = map.project([m.lng, m.lat]);
              const px = pt.x * dpr;
              const py = pt.y * dpr;
              const r = m.size * dpr * SCAR_RADIUS_SCALE;
              const grad = sctx.createRadialGradient(px, py, 0, px, py, r);
              grad.addColorStop(0, `rgba(255,255,255,${alpha * 1.6})`);
              grad.addColorStop(0.35, `rgba(${m.r},${m.g},${m.b},${alpha})`);
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              sctx.fillStyle = grad;
              sctx.fillRect(px - r, py - r, r * 2, r * 2);
            }
            sctx.globalCompositeOperation = 'source-over';
            scarDrawnIdxRef.current = marks.length;
          }
        }
      }

      // 1) 生成新粒子 + 同步克隆伤疤标记
      while (birthIndexRef.current < evts.length && (birthIndexRef.current + 1) * interval <= elapsed) {
        const evt = evts[birthIndexRef.current];
        if (evt.latitude != null && evt.longitude != null) {
          const [r, g, b] = getFlashRGB(evt, dataModeRef.current);
          const sz = getFlashSize(evt);
          // 闪点粒子
          particlesRef.current.push({
            lng: evt.longitude,
            lat: evt.latitude,
            r, g, b,
            size: sz,
            bornAt: now,
            lifetime: FLASH_LIFETIME,
          });
          // 伤疤标记：仅历史战争模式累积（冲突模式数据量大，跳过以避免性能问题）
          if (dataModeRef.current === 'war') {
            scarMarksRef.current.push({ lng: evt.longitude, lat: evt.latitude, r, g, b, size: sz });
          }
        }
        birthIndexRef.current++;
      }

      // 2) 清空闪点画布并绘制存活闪点（原步骤 3，移除死代码步骤 2）
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const alive: FlashParticle[] = [];
      for (const p of particlesRef.current) {
        const age = now - p.bornAt;
        if (age >= p.lifetime) continue;
        alive.push(p);

        const progress = age / p.lifetime;
        const point = map.project([p.lng, p.lat]);
        const px = point.x * dpr;
        const py = point.y * dpr;
        const maxR = p.size * dpr * (1 + progress * CORE_EXPAND_FACTOR);

        let alpha: number;
        if (progress < 0.12) {
          alpha = progress / 0.12;
        } else if (progress < 0.25) {
          alpha = 1;
        } else {
          alpha = 1 - (progress - 0.25) / 0.75;
        }

        const glowR = maxR * GLOW_RADIUS_MULT;
        const glowGrad = ctx.createRadialGradient(px, py, maxR * 0.35, px, py, glowR);
        glowGrad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${0.5 * alpha})`);
        glowGrad.addColorStop(0.3, `rgba(${p.r},${p.g},${p.b},${0.2 * alpha})`);
        glowGrad.addColorStop(0.6, `rgba(${p.r},${p.g},${p.b},${0.06 * alpha})`);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(px - glowR, py - glowR, glowR * 2, glowR * 2);

        const mainGrad = ctx.createRadialGradient(px, py, 0, px, py, maxR);
        mainGrad.addColorStop(0, `rgba(255,255,255,${0.98 * alpha})`);
        mainGrad.addColorStop(0.08, `rgba(255,255,255,${0.75 * alpha})`);
        mainGrad.addColorStop(0.3, `rgba(${p.r},${p.g},${p.b},${0.9 * alpha})`);
        mainGrad.addColorStop(0.6, `rgba(${p.r},${p.g},${p.b},${0.4 * alpha})`);
        mainGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mainGrad;
        ctx.fillRect(px - maxR, py - maxR, maxR * 2, maxR * 2);
      }
      particlesRef.current = alive;

      // 4) 当前批次是否全部播完（全部出生 + 全部消亡）
      if (birthIndexRef.current >= evts.length && alive.length === 0) {
        batchCompletedRef.current = true;
        processedBatchRef.current = currentBatchId;
        // 通知父组件准备下一批数据
        onCompleteRef.current();
      }

      // 5) 如果批次已完成但新数据还没到 → 继续空跑几帧等待
      //    新数据到了会由下一帧的检测逻辑无缝切入
      rafRef.current = requestAnimationFrame(frameLoop);
    };

    startBatch();

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    };
  }, [isPlaying, syncCanvasSize, mapRef]);

  /* ── Map/窗口 resize 同步尺寸；moveend 兜底重绘（帧循环已覆盖每帧重绘） ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.on('resize', syncCanvasSize);
    map.on('moveend', redrawAllScars);
    window.addEventListener('resize', syncCanvasSize);
    return () => {
      map.off('resize', syncCanvasSize);
      map.off('moveend', redrawAllScars);
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [mapRef, syncCanvasSize, redrawAllScars]);

  if (!isPlaying) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* 伤疤累积层（仅历史战争模式） */}
      {dataMode === 'war' && (
        <canvas
          ref={scarCanvasRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {/* 闪点动画层（在上） */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
