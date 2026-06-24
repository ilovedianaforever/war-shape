'use client';

import { ProcessedEvent } from '@/types/conflict';
import { X, Calendar, MapPin, Users, Skull, Globe, ExternalLink, Swords, Cloud, Mountain, Target, AlertTriangle } from 'lucide-react';

interface EventModalProps {
  event: ProcessedEvent | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  const isUcdp = event.source === 'ucdp';

  const getWinnerLabel = (winner: string) => {
    switch (winner) {
      case 'attacker': return '攻方获胜';
      case 'defender': return '守方获胜';
      case 'draw': return '平局';
      default: return '结果未知';
    }
  };

  const getWinnerStyle = (winner: string) => {
    switch (winner) {
      case 'attacker': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'defender': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'draw': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getViolenceLabel = (vt: string) => {
    switch (vt) {
      case 'State-based conflict': return '国家间冲突';
      case 'Non-state conflict': return '非国家冲突';
      case 'One-sided violence': return '单方面暴力';
      default: return vt || '冲突事件';
    }
  };

  const getViolenceStyle = (vt: string) => {
    switch (vt) {
      case 'State-based conflict': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Non-state conflict': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'One-sided violence': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '日期未知';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatRate = (rate: number) => (rate * 100).toFixed(1) + '%';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white mb-1 leading-tight">
              {event.name}
            </h2>
            {event.warCn && (
              <p className="text-gray-400 text-sm mb-2">{event.warCn}{event.war && event.war !== event.warCn ? ` (${event.war})` : ''}</p>
            )}
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${
              isUcdp ? getViolenceStyle(event.typeOfViolence || event.terrain) : getWinnerStyle(event.winner)
            }`}>
              {isUcdp ? getViolenceLabel(event.typeOfViolence || event.terrain) : getWinnerLabel(event.winner)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content — two-column layout */}
        <div className="p-6 space-y-6">
          {/* Key info row */}
          <div className={`grid ${isUcdp ? 'grid-cols-3' : 'grid-cols-4'} gap-3 text-center`}>
            {!isUcdp && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-white font-mono text-lg">{event.totalTroops.toLocaleString()}</div>
                <div className="text-gray-500 text-xs mt-1">总兵力</div>
              </div>
            )}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-red-400 font-mono text-lg">{event.totalCasualties.toLocaleString()}</div>
              <div className="text-gray-500 text-xs mt-1">{isUcdp ? '死亡人数' : '总伤亡'}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              {isUcdp ? (
                <>
                  <div className="text-purple-400 text-sm">{getViolenceLabel(event.typeOfViolence || event.terrain)}</div>
                  <div className="text-gray-500 text-xs mt-1">冲突类型</div>
                </>
              ) : (
                <>
                  <div className="text-yellow-400 font-mono text-lg">{formatRate(event.casualtyRate)}</div>
                  <div className="text-gray-500 text-xs mt-1">伤亡率</div>
                </>
              )}
            </div>
            {event.wikiUrl && (
              <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col items-center justify-center">
                <a
                  href={event.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                  title="维基百科"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <div className="text-gray-500 text-xs mt-1">百科</div>
              </div>
            )}
            {!event.wikiUrl && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-gray-500 font-mono text-lg">—</div>
                <div className="text-gray-500 text-xs mt-1">百科</div>
              </div>
            )}
          </div>

          {/* Two-column detail grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: battle info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 日期
                </h3>
                <p className="text-white">{formatDate(event.date)}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 地点
                </h3>
                <p className="text-white">{event.country}</p>
                {(event.latitude != null && event.longitude != null) && (
                  <p className="text-gray-500 text-xs mt-1 font-mono">
                    {event.latitude.toFixed(4)}°, {event.longitude.toFixed(4)}°
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> 地区
                </h3>
                <p className="text-white">{event.region}</p>
              </div>

              {!isUcdp && event.terrain && event.terrain !== 'Unknown' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <Mountain className="w-4 h-4" /> 地形
                  </h3>
                  <p className="text-white text-sm">{event.terrain}</p>
                </div>
              )}

              {!isUcdp && event.weather && event.weather !== 'Unknown' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> 天气
                  </h3>
                  <p className="text-white text-sm">{event.weather}</p>
                </div>
              )}
            </div>

            {/* Right: forces & commanders */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" /> 攻方：{event.sideA}
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-1 ml-6">
                  {!isUcdp && (
                    <p className="text-white text-sm">兵力：<span className="font-mono">{event.attackerTroops.toLocaleString()}</span></p>
                  )}
                  <p className="text-red-300 text-sm">{isUcdp ? '死亡' : '伤亡'}：<span className="font-mono">{event.attackerCasualties.toLocaleString()}</span></p>
                  {!isUcdp && event.commanderA && <p className="text-gray-400 text-sm">指挥官：{event.commanderA}</p>}
                  {!isUcdp && Array.isArray(event.attackerAllies) && event.attackerAllies.length > 1 && (
                    <p className="text-gray-500 text-xs mt-1">盟友：{event.attackerAllies.slice(1).join('、')}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-blue-400" /> 守方：{event.sideB}
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-1 ml-6">
                  {!isUcdp && (
                    <p className="text-white text-sm">兵力：<span className="font-mono">{event.defenderTroops.toLocaleString()}</span></p>
                  )}
                  <p className="text-red-300 text-sm">{isUcdp ? '死亡' : '伤亡'}：<span className="font-mono">{event.defenderCasualties.toLocaleString()}</span></p>
                  {!isUcdp && event.commanderB && <p className="text-gray-400 text-sm">指挥官：{event.commanderB}</p>}
                  {!isUcdp && Array.isArray(event.defenderAllies) && event.defenderAllies.length > 1 && (
                    <p className="text-gray-500 text-xs mt-1">盟友：{event.defenderAllies.slice(1).join('、')}</p>
                  )}
                </div>
              </div>

              {!isUcdp && (event.front > 0 || event.depth > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" /> 战场维度
                  </h3>
                  <p className="text-white text-sm">
                    {event.front > 0 && <>前线宽 {event.front} km</>}
                    {event.front > 0 && event.depth > 0 && ' · '}
                    {event.depth > 0 && <>纵深 {event.depth} km</>}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Technical details */}
          <div className="border-t border-gray-700 pt-4">
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-gray-300 transition-colors">
                技术详情
              </summary>
              <div className="mt-2 text-xs font-mono text-gray-500 space-y-1">
                <div>编号：#{event.id}</div>
                {event.latitude != null && <div>纬度：{event.latitude}</div>}
                {event.longitude != null && <div>经度：{event.longitude}</div>}
                <div>年份：{event.year}</div>
                <div>伤亡率：{formatRate(event.casualtyRate)}</div>
                {event.source && (
                  <div className="pt-1 border-t border-gray-700/50 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      event.source === 'cdb90'
                        ? 'bg-purple-400/10 text-purple-400'
                        : event.source === 'wikipedia'
                        ? 'bg-green-400/10 text-green-400'
                        : 'bg-orange-400/10 text-orange-400'
                    }`}>
                      {event.source === 'cdb90' ? 'CDB90 数据集' : event.source === 'wikipedia' ? 'Wikipedia 爬取' : 'UCDP GED'}
                    </span>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 text-center">
          <p className="text-xs text-gray-500">
            数据来源：{event.source === 'cdb90' ? 'CDB90 历史战役数据集' : event.source === 'wikipedia' ? 'Wikipedia 爬取数据' : event.source === 'ucdp' ? 'UCDP GED 冲突事件数据' : '未知来源'} · #{event.id}
          </p>
        </div>
      </div>
    </div>
  );
}
