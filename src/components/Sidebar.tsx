'use client';

import { useMemo } from 'react';
import { ProcessedEvent, ConflictStats } from '@/types/conflict';
import { conflictDataService } from '@/services/conflictData';
import {
  Play,
  Pause,
  BarChart3,
  Map,
  Calendar,
  Globe,
  Swords,
  Flame,
  Zap,
  Columns3,
  Route,
  Hexagon,
  Cpu,
  Orbit,
} from 'lucide-react';

type DataMode = 'war' | 'conflict';

interface SidebarProps {
  events: ProcessedEvent[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedRegions: string[];
  onRegionsChange: (regions: string[]) => void;
  showHeatmap: boolean;
  onHeatmapToggle: () => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  yearRange: { min: number; max: number };
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
  ucdpAvailable: boolean;
  showFlashes: boolean;
  onFlashesToggle: () => void;
  showColumns: boolean;
  onColumnsToggle: () => void;
  showArcs: boolean;
  onArcsToggle: () => void;
  showHexagons: boolean;
  onHexagonsToggle: () => void;
  useGpuScatter: boolean;
  onGpuScatterToggle: () => void;
  useGreatCircle: boolean;
  onGreatCircleToggle: () => void;
}

export default function Sidebar({
  events,
  selectedYear,
  onYearChange,
  selectedRegions,
  onRegionsChange,
  showHeatmap,
  onHeatmapToggle,
  isPlaying,
  onPlayToggle,
  yearRange,
  dataMode,
  onDataModeChange,
  ucdpAvailable,
  showFlashes,
  onFlashesToggle,
  showColumns,
  onColumnsToggle,
  showArcs,
  onArcsToggle,
  showHexagons,
  onHexagonsToggle,
  useGpuScatter,
  onGpuScatterToggle,
  useGreatCircle,
  onGreatCircleToggle,
}: SidebarProps) {
  const regions = conflictDataService.getRegions();

  const stats = useMemo(() => {
    return conflictDataService.calculateStats(events);
  }, [events]);

  const yearDisplay = useMemo(() =>
    conflictDataService.formatYearDisplay(selectedYear, dataMode),
    [selectedYear, dataMode]
  );

  const handleRegionToggle = (regionName: string) => {
    if (selectedRegions.includes(regionName)) {
      onRegionsChange(selectedRegions.filter(r => r !== regionName));
    } else {
      onRegionsChange([...selectedRegions, regionName]);
    }
  };

  const formatRate = (rate: number) => (rate * 100).toFixed(1) + '%';

  const isWarMode = dataMode === 'war';

  // Desktop sidebar
  const desktopSidebar = (
    <div className="hidden md:block fixed left-4 top-4 bottom-4 w-80 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl z-10 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">
            {isWarMode ? '战役观测台' : '冲突观测台'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isWarMode ? '探索 400 年人类战争的时空伤痕' : '追踪当代武装冲突的空间脉搏'}
          </p>
        </div>

        {/* Data Mode Toggle */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4" /> 数据模式
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => onDataModeChange('war')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                isWarMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              历史战争
            </button>
            <button
              onClick={() => onDataModeChange('conflict')}
              disabled={!ucdpAvailable}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                !ucdpAvailable
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : !isWarMode
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              当代冲突
            </button>
          </div>
          {!ucdpAvailable && (
            <p className="text-[10px] text-gray-500 mt-1.5">UCDP 冲突数据不可用</p>
          )}
        </div>

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 时间轴
            </h3>
            <button
              onClick={onPlayToggle}
              className={`p-2 rounded-lg ${isPlaying ? 'bg-red-600' : 'bg-green-600'}`}
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
            </button>
          </div>
          <div className="text-center text-white font-mono text-2xl mb-2">{yearDisplay}</div>
          <input
            type="range"
            min={yearRange.min}
            max={yearRange.max}
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{isWarMode ? '17世纪' : yearRange.min}</span>
            <span>{yearRange.max}</span>
          </div>
        </div>

        {/* Regions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4" /> 地区
            </h3>
            {selectedRegions.length > 0 && (
              <button onClick={() => onRegionsChange([])} className="text-xs text-red-400 hover:text-red-300">清除</button>
            )}
          </div>
          <div className="space-y-1.5">
            {regions.map(region => (
              <label key={region.name} className="flex items-center space-x-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region.name)}
                  onChange={() => handleRegionToggle(region.name)}
                  className="form-checkbox h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 rounded"
                />
                <span className="text-white text-sm">{region.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* View Mode */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Map className="w-4 h-4" /> 视图模式
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onHeatmapToggle}
              className={`flex-1 px-3 py-2 text-sm rounded-lg ${!showHeatmap ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              散点图
            </button>
            <button
              onClick={onHeatmapToggle}
              className={`flex-1 px-3 py-2 text-sm rounded-lg ${showHeatmap ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              热力图
            </button>
          </div>
        </div>

        {/* Visualization Layers */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4" /> 可视化图层
          </h3>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 py-1.5 px-3 rounded-lg bg-gray-800/50 transition-colors ${useGpuScatter ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/80'}`}>
              <input
                type="checkbox"
                checked={showFlashes}
                disabled={useGpuScatter}
                onChange={onFlashesToggle}
                className="form-checkbox h-4 w-4 text-yellow-500 bg-gray-700 border-gray-600 rounded"
              />
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm">闪点动画</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-1.5 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
              <input
                type="checkbox"
                checked={showColumns}
                onChange={onColumnsToggle}
                className="form-checkbox h-4 w-4 text-red-500 bg-gray-700 border-gray-600 rounded"
              />
              <Columns3 className="w-4 h-4 text-red-400" />
              <span className="text-white text-sm">伤亡柱体</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-1.5 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
              <input
                type="checkbox"
                checked={showArcs}
                onChange={onArcsToggle}
                className="form-checkbox h-4 w-4 text-orange-500 bg-gray-700 border-gray-600 rounded"
              />
              <Route className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm">流向弧线</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-1.5 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
              <input
                type="checkbox"
                checked={useGreatCircle}
                onChange={onGreatCircleToggle}
                className="form-checkbox h-4 w-4 text-cyan-500 bg-gray-700 border-gray-600 rounded"
              />
              <Orbit className="w-4 h-4 text-cyan-400" />
              <span className="text-white text-sm">大圆弧线</span>
            </label>
            <label className={`flex items-center gap-3 py-1.5 px-3 rounded-lg bg-gray-800/50 transition-colors ${showFlashes ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/80'}`}>
              <input
                type="checkbox"
                checked={useGpuScatter}
                disabled={showFlashes}
                onChange={onGpuScatterToggle}
                className="form-checkbox h-4 w-4 text-green-500 bg-gray-700 border-gray-600 rounded"
              />
              <Cpu className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm">GPU 散点</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-1.5 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
              <input
                type="checkbox"
                checked={showHexagons}
                onChange={onHexagonsToggle}
                className="form-checkbox h-4 w-4 text-purple-500 bg-gray-700 border-gray-600 rounded"
              />
              <Hexagon className="w-4 h-4 text-purple-400" />
              <span className="text-white text-sm">六边形网格</span>
            </label>
          </div>
        </div>

        {/* Stats */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> {isWarMode ? '战役统计' : '冲突统计'}
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-white font-mono text-lg">{stats.totalEvents.toLocaleString()}</div>
              <div className="text-gray-400 text-xs mt-1">{isWarMode ? '场战役' : '起事件'}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-red-400 font-mono text-lg">{stats.totalCasualties.toLocaleString()}</div>
              <div className="text-gray-400 text-xs mt-1">总死亡</div>
            </div>
            {isWarMode && (
              <>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-blue-400 font-mono text-lg">{stats.totalTroops.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs mt-1">总兵力</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-yellow-400 font-mono text-lg">{formatRate(stats.avgCasualtyRate)}</div>
                  <div className="text-gray-400 text-xs mt-1">伤亡率</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Battles / Top Events */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            {isWarMode ? '死亡最多的战役 (Top 5)' : '死亡最多的事件 (Top 5)'}
          </h3>
          <div className="space-y-2">
            {stats.topBattles.length > 0 ? stats.topBattles.map((battle, i) => (
              <div key={battle.name + '-' + i} className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-white text-sm font-medium mb-1 leading-tight">
                  {i + 1}. {battle.name}
                </div>
                <div className="text-xs text-gray-500 mb-1">{battle.war}</div>
                <div className="flex justify-between text-xs text-gray-400">
                  {isWarMode && <span>{battle.troops.toLocaleString()} 兵力</span>}
                  <span className="text-red-400">{battle.casualties.toLocaleString()} 死亡</span>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-xs">暂无数据</p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="pt-4 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-white mb-2">
            {isWarMode ? '胜负结果' : '冲突类型'}
          </h4>
          {isWarMode ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dc2680' }}></div>
                <span className="text-gray-300">攻方获胜</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                <span className="text-gray-300">守方获胜</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#facc15' }}></div>
                <span className="text-gray-300">平局 / 其他</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
                <span className="text-gray-300">国家间冲突</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#a855f7' }}></div>
                <span className="text-gray-300">非国家冲突</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                <span className="text-gray-300">单方面暴力</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <>{desktopSidebar}</>;
}
