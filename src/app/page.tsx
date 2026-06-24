'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ProcessedEvent } from '@/types/conflict';
import { conflictDataService } from '@/services/conflictData';
import Sidebar from '@/components/Sidebar';
import EventModal from '@/components/EventModal';
import DataPanel from '@/components/DataPanel';
import { Loader2 } from 'lucide-react';

const ConflictMap = dynamic(() => import('@/components/ConflictMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )
});

type DataMode = 'war' | 'conflict';

export default function Home() {
  const [allEvents, setAllEvents] = useState<ProcessedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>('war');
  const [selectedYear, setSelectedYear] = useState(1600);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ProcessedEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ucdpEvents, setUcdpEvents] = useState<ProcessedEvent[]>([]);
  const [ucdpLoading, setUcdpLoading] = useState(false);
  const [ucdpAvailable, setUcdpAvailable] = useState(false);
  // 冲突模式柱体：累积所有已加载的 UCDP 事件（用于柱体随时间增长）
  const [conflictColumnEvents, setConflictColumnEvents] = useState<ProcessedEvent[]>([]);
  // 可视化图层独立开关
  const [showFlashes, setShowFlashes] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [showArcs, setShowArcs] = useState(false);
  const [showHexagons, setShowHexagons] = useState(false);
  const [useGpuScatter, setUseGpuScatter] = useState(false);
  const [useGreatCircle, setUseGreatCircle] = useState(false); // 默认用贝塞尔弧线

  // 用于追踪播放中的"待加载年份"（冲突模式异步用）  
  const playActiveRef = useRef(false);

  // 点击战役：高亮 + 弹窗；点击空白：清除全部
  const handleEventClick = useCallback((event: ProcessedEvent | null) => {
    setSelectedEvent(event);
    setShowModal(event !== null);
  }, []);

  // 模式相关的年份范围
  const yearRange = useMemo(() => {
    if (dataMode === 'conflict') return { min: 1989, max: 2025 };
    return { min: 1600, max: 1973 };
  }, [dataMode]);

  // 一次性全量加载本地 JSON（战争模式用）
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const events = await conflictDataService.loadAll();
        if (!cancelled) {
          setAllEvents(events);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setAllEvents([]);
        }
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // 预加载 UCDP manifest，判断是否有数据
  useEffect(() => {
    conflictDataService.loadUcdpManifest().then(m => {
      setUcdpAvailable(!!m && m.years.length > 0);
    });
  }, []);

  // 播放控制（必须在 handleDataModeChange 之前声明，避免 TDZ）
  const startPlay = useCallback(() => {
    playActiveRef.current = true;
    setIsPlaying(true);
  }, []);

  const stopPlay = useCallback(() => {
    playActiveRef.current = false;
    setIsPlaying(false);
  }, []);

  // 切换模式时重置年份和累积数据
  const handleDataModeChange = useCallback((mode: DataMode) => {
    setDataMode(mode);
    stopPlay();
    if (mode === 'war') {
      setSelectedYear(1600);
      setConflictColumnEvents([]);
    }
    else {
      setSelectedYear(1989);
      setUcdpEvents([]);
      setConflictColumnEvents([]);
    }
  }, [stopPlay]);

  // 冲突模式：按需加载 UCDP 数据
  useEffect(() => {
    if (dataMode !== 'conflict') {
      setUcdpEvents([]);
      setConflictColumnEvents([]);
      return;
    }
    // ★ 先清空，避免加载期间 FlashOverlay 用旧年数据重播
    setUcdpEvents([]);
    let cancelled = false;
    const loadUcdp = async () => {
      setUcdpLoading(true);
      const data = await conflictDataService.loadUcdpByYear(selectedYear);
      if (!cancelled) {
        setUcdpEvents(data);
        setUcdpLoading(false);
        // 累积到柱体数据（去重，用于随时间增长的柱体）
        if (data.length > 0) {
          setConflictColumnEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const newEvents = data.filter(e => !existingIds.has(e.id));
            return newEvents.length > 0 ? [...prev, ...newEvents] : prev;
          });
        }
      }
    };
    loadUcdp();
    return () => { cancelled = true; };
  }, [selectedYear, dataMode]);

  // 从全量事件中按年/世纪筛选
  const warYearEvents = useMemo(() => {
    return conflictDataService.filterByYearCentury(allEvents, selectedYear);
  }, [allEvents, selectedYear]);

  // 最终显示的事件列表
  const displayEvents = useMemo(() => {
    const base = dataMode === 'conflict' ? ucdpEvents : warYearEvents;
    return conflictDataService.filterEvents(base, {
      regions: selectedRegions.length > 0 ? selectedRegions : undefined
    });
  }, [dataMode, warYearEvents, ucdpEvents, selectedRegions]);

  // 动态总战役数（仅战争模式有意义）
  const totalWarCount = useMemo(() => allEvents.length, [allEvents]);

  // Animation — 计算下一个时间桶
  const animationNextYear = useCallback((current: number) => {
    const { min, max } = yearRange;
    if (dataMode === 'war') {
      // 规范化年份：对齐到 filterByYearCentury 所用的桶起点
      // （slider 无 step 限制，用户可能拖到 1601/1750 等非对齐值）
      let bucketStart: number;
      if (current < 1900) {
        bucketStart = Math.floor(current / 100) * 100;
      } else {
        bucketStart = Math.floor(current / 5) * 5;
      }
      const next = conflictDataService.getNextYear(bucketStart, max, min);
      return next ?? null; // null = 到终点了
    }
    return current >= max ? null : current + 1;
  }, [yearRange, dataMode]);

  // 闪点序列完成 → 推进到下一桶
  const handleSequenceComplete = useCallback(() => {
    if (!playActiveRef.current) return;
    const next = animationNextYear(selectedYear);
    if (next === null) {
      // 播放结束
      setIsPlaying(false);
      playActiveRef.current = false;
      return;
    }
    setSelectedYear(next);
  }, [selectedYear, animationNextYear]);

  // 保证回调引用的稳定性
  const onSequenceCompleteRef = useRef(handleSequenceComplete);
  onSequenceCompleteRef.current = handleSequenceComplete;
  const stableOnComplete = useCallback(() => {
    onSequenceCompleteRef.current();
  }, []);

  const toggleAnimation = useCallback(() => {
    if (isPlaying) {
      stopPlay();
    } else {
      startPlay();
    }
  }, [isPlaying, startPlay, stopPlay]);

  // 格式化年份显示
  const yearDisplay = useMemo(() =>
    conflictDataService.formatYearDisplay(selectedYear, dataMode),
    [selectedYear, dataMode]
  );

  // 标题行副文本
  const subTitleText = useMemo(() => {
    if (loading) return '加载中…';
    if (dataMode === 'conflict') {
      return `${selectedYear} 年 · ${displayEvents.length.toLocaleString()} 起冲突事件 · UCDP GED 1989–2025`;
    }
    return `${yearDisplay} · ${displayEvents.length} 场战役 · ${totalWarCount} 场历史战役 1600–1973`;
  }, [loading, dataMode, selectedYear, yearDisplay, displayEvents.length, totalWarCount]);

  return (
    <div className="h-[100dvh] bg-gray-900 relative overflow-hidden">
      {/* Title */}
      <div className="absolute top-2 md:top-6 left-0 right-0 z-20 pointer-events-none">
        <h1 className="text-xl md:text-5xl font-bold text-center tracking-tight">
          <span className={`bg-gradient-to-r bg-clip-text text-transparent ${
            dataMode === 'conflict'
              ? 'from-orange-400 via-red-500 to-purple-500'
              : 'from-red-400 via-orange-400 to-yellow-400'
          }`}>
            {dataMode === 'conflict' ? '冲突的伤痕' : '战争的形状'}
          </span>
        </h1>
        <p className="text-center text-gray-400 mt-0.5 text-[10px] md:text-sm">
          {subTitleText}
        </p>
      </div>

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <ConflictMap
          events={displayEvents}
          allEvents={allEvents}
          selectedYear={selectedYear}
          selectedRegions={selectedRegions}
          showHeatmap={showHeatmap}
          onEventClick={handleEventClick}
          selectedEvent={selectedEvent}
          isPlaying={isPlaying}
          dataMode={dataMode}
          onSequenceComplete={stableOnComplete}
          showFlashes={showFlashes}
          showColumns={showColumns}
          showArcs={showArcs}
          conflictColumnEvents={conflictColumnEvents}
          showHexagons={showHexagons}
          useGpuScatter={useGpuScatter}
          useGreatCircle={useGreatCircle}
        />
      </div>

      {/* Data load error */}
      {loadError && (
        <div className="absolute top-16 md:top-24 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-red-900/80 backdrop-blur-sm rounded-lg px-5 py-3 border border-red-700/50">
            <p className="text-red-200 text-sm font-medium">数据加载失败</p>
            <p className="text-red-400 text-xs mt-1">请确认 battle_events.json 已生成到 public/data/ 目录</p>
          </div>
        </div>
      )}

      {/* Loading indicator overlay (initial load only) */}
      {loading && (
        <div className="absolute top-16 md:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-white text-xs">正在加载历史战役数据…</span>
          </div>
        </div>
      )}

      {/* UCDP loading indicator */}
      {ucdpLoading && (
        <div className="absolute top-16 md:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            <span className="text-white text-xs">正在加载冲突事件数据…</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        events={displayEvents}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedRegions={selectedRegions}
        onRegionsChange={setSelectedRegions}
        showHeatmap={showHeatmap}
        onHeatmapToggle={() => setShowHeatmap(prev => !prev)}
        isPlaying={isPlaying}
        onPlayToggle={toggleAnimation}
        yearRange={yearRange}
        dataMode={dataMode}
        onDataModeChange={handleDataModeChange}
        ucdpAvailable={ucdpAvailable}
        showFlashes={showFlashes}
        onFlashesToggle={() => { setShowFlashes(prev => !prev); setUseGpuScatter(false); }}
        showColumns={showColumns}
        onColumnsToggle={() => setShowColumns(prev => !prev)}
        showArcs={showArcs}
        onArcsToggle={() => setShowArcs(prev => !prev)}
        showHexagons={showHexagons}
        onHexagonsToggle={() => setShowHexagons(prev => !prev)}
        useGpuScatter={useGpuScatter}
        onGpuScatterToggle={() => { setUseGpuScatter(prev => !prev); setShowFlashes(false); }}
        useGreatCircle={useGreatCircle}
        onGreatCircleToggle={() => setUseGreatCircle(prev => !prev)}
      />

      {/* Data Panel — 右侧数据看板 */}
      <DataPanel
        events={displayEvents}
        allEvents={allEvents}
        dataMode={dataMode}
      />

      {showModal && selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setShowModal(false)} />
      )}

      {/* Attribution — 避开右侧 DataPanel */}
      <div className="absolute bottom-16 md:bottom-4 right-2 md:right-[352px] z-20">
        <div className="bg-gray-900/70 rounded px-2 py-1">
          <p className="text-[9px] md:text-xs text-gray-500">
            {dataMode === 'conflict' ? 'UCDP GED 冲突事件数据集 1989–2025' : 'CDB90 · Wikipedia 历史战役 1600–1973'}
          </p>
        </div>
      </div>

      {/* Year overlay during animation — 3s 渐变退出，底部居中 */}
      {isPlaying && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            key={selectedYear}
            className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-2 year-fade"
          >
            <div className="text-xl md:text-3xl font-mono font-bold text-white text-center">{yearDisplay}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .year-fade {
          animation: yearFadeOut 3s ease-out forwards;
        }
        @keyframes yearFadeOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
