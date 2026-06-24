'use client';

import { useMemo, useState, useEffect } from 'react';
import { ProcessedEvent } from '@/types/conflict';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, TrendingUp, MapPin, Users, Globe,
  BarChart3, AlertCircle,
} from 'lucide-react';

type DataMode = 'war' | 'conflict';

interface DataPanelProps {
  events: ProcessedEvent[];
  allEvents: ProcessedEvent[];
  dataMode: DataMode;
}

// 地区颜色映射
const REGION_COLORS: Record<string, string> = {
  Africa: '#f97316',
  'Middle East': '#eab308',
  Asia: '#3b82f6',
  Europe: '#8b5cf6',
  Americas: '#22c55e',
  Oceania: '#06b6d4',
};

// 暴力类型颜色
const VIOLENCE_COLORS: Record<string, string> = {
  '国家间冲突': '#f97316',
  '非国家冲突': '#a855f7',
  '单方面暴力': '#ef4444',
  '未知': '#6b7280',
};

// 胜负颜色
const WINNER_COLORS: Record<string, string> = {
  attacker: '#dc2680',
  defender: '#3b82f6',
  draw: '#facc15',
  unknown: '#6b7280',
};

const WINNER_LABELS: Record<string, string> = {
  attacker: '攻方获胜',
  defender: '守方获胜',
  draw: '平局/其他',
  unknown: '未知',
};

/** 从 typeOfViolence 字段提取暴力类型标签（带 terrain 回退兼容旧数据） */
function getViolenceLabel(typeOfViolence: string): string {
  if (!typeOfViolence || typeOfViolence === 'Unknown') return '未知';
  if (typeOfViolence.includes('State-based')) return '国家间冲突';
  if (typeOfViolence.includes('Non-state')) return '非国家冲突';
  if (typeOfViolence.includes('One-sided')) return '单方面暴力';
  return typeOfViolence;
}

interface RegionStat {
  region: string;
  events: number;
  deaths: number;
}

interface TypeStat {
  name: string;
  value: number;
  color: string;
}

interface CountryStat {
  country: string;
  events: number;
  deaths: number;
}

interface YearlyTrend {
  year: number;
  yearStr: string;
  deaths: number;
  events: number;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800/95 border border-gray-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-gray-200 text-xs font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function DataPanel({ events, allEvents, dataMode }: DataPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isWarMode = dataMode === 'war';

  // 延迟图表渲染，确保 CSS 布局已完成（避免 ResponsiveContainer 测量到 -1 尺寸）
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── 摘要卡片 ──
  const summary = useMemo(() => {
    const uniqueCountries = new Set(events.map(e => e.country).filter(Boolean));
    return {
      totalEvents: events.length,
      totalDeaths: events.reduce((s, e) => s + e.totalCasualties, 0),
      countries: uniqueCountries.size,
      avgCasualtyRate: events.length > 0
        ? events.reduce((s, e) => s + e.casualtyRate, 0) / events.length
        : 0,
    };
  }, [events]);

  // ── 地区柱状图 ──
  const regionStats: RegionStat[] = useMemo(() => {
    const map = new Map<string, { events: number; deaths: number }>();
    events.forEach(e => {
      if (!e.region) return;
      const prev = map.get(e.region) || { events: 0, deaths: 0 };
      prev.events += 1;
      prev.deaths += e.totalCasualties;
      map.set(e.region, prev);
    });
    const regions = ['Africa', 'Middle East', 'Asia', 'Europe', 'Americas', 'Oceania'];
    return regions
      .map(r => ({ region: r, events: map.get(r)?.events || 0, deaths: map.get(r)?.deaths || 0 }))
      .filter(r => r.events > 0)
      .sort((a, b) => b.deaths - a.deaths);
  }, [events]);

  // ── 冲突类型饼图 ──
  const typeStats: TypeStat[] = useMemo(() => {
    if (isWarMode) {
      const map = new Map<string, number>();
      events.forEach(e => {
        const key = e.winner || 'unknown';
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([key, count]) => ({
          name: WINNER_LABELS[key] || key,
          value: count,
          color: WINNER_COLORS[key] || '#6b7280',
        }))
        .sort((a, b) => b.value - a.value);
    }
    // 冲突模式：使用 typeOfViolence 字段展示暴力类型分布
    const map = new Map<string, number>();
    events.forEach(e => {
      const vt = e.typeOfViolence || e.terrain || 'Unknown';
      const label = getViolenceLabel(vt);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([key, count]) => ({
        name: key,
        value: count,
        color: VIOLENCE_COLORS[key] || '#6b7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [events, isWarMode]);

  // ── 年份死亡趋势（战争模式按世纪/五年段，冲突模式逐年）──
  const yearlyTrend: YearlyTrend[] = useMemo(() => {
    if (allEvents.length === 0) return [];
    const map = new Map<number, { deaths: number; events: number }>();
    allEvents.forEach(e => {
      let bucket: number;
      if (isWarMode) {
        if (e.year < 1900) {
          bucket = Math.floor(e.year / 100) * 100;
        } else {
          bucket = Math.floor(e.year / 5) * 5;
        }
      } else {
        bucket = e.year;
      }
      const prev = map.get(bucket) || { deaths: 0, events: 0 };
      prev.deaths += e.totalCasualties;
      prev.events += 1;
      map.set(bucket, prev);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, d]) => ({
        year,
        yearStr: isWarMode
          ? (year < 1900 ? `${Math.floor(year / 100) + 1}世纪` : `${year}-${year + 4}`)
          : `${year}`,
        deaths: d.deaths,
        events: d.events,
      }));
  }, [isWarMode, allEvents]);

  // ── 国家排行 Top 10 ──
  const countryRank: CountryStat[] = useMemo(() => {
    const map = new Map<string, { events: number; deaths: number }>();
    events.forEach(e => {
      if (!e.country) return;
      const prev = map.get(e.country) || { events: 0, deaths: 0 };
      prev.events += 1;
      prev.deaths += e.totalCasualties;
      map.set(e.country, prev);
    });
    return Array.from(map.entries())
      .map(([country, d]) => ({ country, events: d.events, deaths: d.deaths }))
      .sort((a, b) => b.deaths - a.deaths)
      .slice(0, 10);
  }, [events]);

  // ── 渲染 ──

  return (
    <>
      {/* 折叠/展开按钮 — 始终可见，提高 z-index 防止遮挡 */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={`fixed top-1/2 -translate-y-1/2 z-30 p-2 bg-gray-800/95 border border-gray-500 rounded-lg hover:bg-gray-700 hover:border-gray-400 transition-all shadow-lg ${
          collapsed ? 'right-2' : 'right-[340px]'
        }`}
        title={collapsed ? '展开数据看板' : '收起数据看板'}
      >
        {collapsed ? (
          <ChevronLeft className="w-5 h-5 text-gray-200" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-200" />
        )}
      </button>

      {/* 面板主体 */}
      <div className={`fixed right-2 top-2 bottom-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl z-10 transition-all duration-300 overflow-hidden ${
        collapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-[336px]'
      }`}>
        <div className="h-full overflow-y-auto p-4 space-y-4" style={{ width: 336 }}>
          {/* 标题 */}
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              {isWarMode ? '战役数据看板' : '冲突数据看板'}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {isWarMode ? '基于当前筛选的统计洞察' : '基于当前年份的统计洞察'}
            </p>
          </div>

          {/* 摘要卡片 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-white font-mono text-lg">{summary.totalEvents.toLocaleString()}</div>
              <div className="text-gray-400 text-[10px] mt-0.5">{isWarMode ? '场战役' : '起事件'}</div>
            </div>
            <div className="bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-red-400 font-mono text-lg">{summary.totalDeaths.toLocaleString()}</div>
              <div className="text-gray-400 text-[10px] mt-0.5">总死亡</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-blue-400 font-mono text-lg">{summary.countries.toLocaleString()}</div>
              <div className="text-gray-400 text-[10px] mt-0.5">涉及国家</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-yellow-400 font-mono text-lg">
                {summary.totalEvents > 0 
                  ? `${(summary.avgCasualtyRate * 100).toFixed(1)}%`
                  : '—'}
              </div>
              <div className="text-gray-400 text-[10px] mt-0.5">{isWarMode ? '平均伤亡率' : '平均死亡'}</div>
            </div>
          </div>

          {/* 地区柱状图 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-400" />
              地区分布
            </h3>
            {regionStats.length > 0 && mounted ? (
              <div className="bg-gray-800/30 rounded-lg p-2 h-[180px]">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <RechartsBarChart data={regionStats} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} />
                    <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} width={55} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="deaths" name="死亡" radius={[0, 4, 4, 0]} barSize={16}>
                      {regionStats.map((entry) => (
                        <Cell key={entry.region} fill={REGION_COLORS[entry.region] || '#6b7280'} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-800/20 rounded-lg h-[80px] flex items-center justify-center">
                <p className="text-gray-500 text-xs">{events.length === 0 ? '选择时间查看' : '暂无地区数据'}</p>
              </div>
            )}
          </div>

          {/* 类型分布（战争=胜负 / 冲突=暴力类型） */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              {isWarMode ? '胜负结果分布' : '冲突类型分布'}
            </h3>
            {typeStats.length > 0 && mounted ? (
              <div className="bg-gray-800/30 rounded-lg p-2 h-[160px]">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <PieChart>
                    <Pie
                      data={typeStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {typeStats.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={6}
                      formatter={(value: string) => (
                        <span className="text-gray-300 text-[10px]">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-800/20 rounded-lg h-[80px] flex items-center justify-center">
                <p className="text-gray-500 text-xs">{events.length === 0 ? '选择时间查看' : (isWarMode ? '暂无分类数据' : '暂无类型数据')}</p>
              </div>
            )}
          </div>

          {/* 死亡趋势折线图 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              {isWarMode ? '历史死亡趋势' : '年度死亡趋势'}
            </h3>
            {yearlyTrend.length > 0 && mounted ? (
              <div className="bg-gray-800/30 rounded-lg p-2 h-[160px]">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <LineChart data={yearlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="yearStr" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 6, fill: '#9ca3af' }} axisLine={false} width={40} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="deaths"
                      name="死亡数"
                      stroke="#ef4444"
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={{ r: 4, fill: '#ef4444' }}
                      activeDot={{ r: 6, fill: '#ef4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-800/20 rounded-lg h-[80px] flex items-center justify-center">
                <p className="text-gray-500 text-xs">暂无趋势数据</p>
              </div>
            )}
          </div>

          {/* 国家排行 */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              死亡最多的国家 (Top 10)
            </h3>
            {countryRank.length > 0 ? (
              <div className="space-y-1">
                {countryRank.map((c, i) => {
                  const maxDeaths = countryRank[0].deaths || 1;
                  const pct = (c.deaths / maxDeaths) * 100;
                  return (
                    <div key={c.country} className="bg-gray-800/30 rounded-lg px-3 py-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white text-xs truncate max-w-[180px]">
                          {i + 1}. {c.country}
                        </span>
                        <span className="text-red-400 text-xs font-mono ml-2 shrink-0">
                          {c.deaths.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-800/20 rounded-lg h-[60px] flex items-center justify-center">
                <p className="text-gray-500 text-xs">暂无排行数据</p>
              </div>
            )}
          </div>

          {/* 无数据时的占位 */}
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <AlertCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs">当前筛选条件下无数据</p>
            </div>
          )}

          <div className="pb-2" />
        </div>
      </div>

      {/* 移动端：展开数据看板浮动按钮 */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={`md:hidden fixed bottom-20 right-4 z-20 p-3 rounded-full shadow-lg transition-colors ${
          collapsed ? 'bg-blue-600' : 'bg-gray-700'
        }`}
        title="数据看板"
      >
        <BarChart3 className="w-5 h-5 text-white" />
      </button>
    </>
  );
}
