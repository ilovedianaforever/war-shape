import { ProcessedEvent, RegionFilter, ConflictStats } from '@/types/conflict';
import { withBasePath } from '@/lib/basePath';

interface UcdpManifest {
  years: number[];
  counts: Record<string, number>;
  totalEvents: number;
  totalSkipped: number;
}

class ConflictDataService {
  private allEvents: ProcessedEvent[] | null = null;
  private loading = false;
  private loadPromise: Promise<ProcessedEvent[]> | null = null;

  // UCDP 按年缓存
  private ucdpCache: Map<number, ProcessedEvent[]> = new Map();
  private ucdpManifest: UcdpManifest | null = null;
  private ucdpManifestLoading = false;
  private ucdpManifestPromise: Promise<UcdpManifest | null> | null = null;

  private readonly regions: RegionFilter[] = [
    { name: 'Africa', label: '非洲' },
    { name: 'Middle East', label: '中东' },
    { name: 'Asia', label: '亚洲' },
    { name: 'Europe', label: '欧洲' },
    { name: 'Americas', label: '美洲' },
    { name: 'Oceania', label: '大洋洲' },
  ];

  /** 规范化事件：确保 ally 字段始终为数组 */
  private normalizeEvent(e: ProcessedEvent): ProcessedEvent {
    if (!Array.isArray(e.attackerAllies)) {
      e.attackerAllies = typeof e.attackerAllies === 'string'
        ? [e.attackerAllies]
        : [];
    }
    if (!Array.isArray(e.defenderAllies)) {
      e.defenderAllies = typeof e.defenderAllies === 'string'
        ? [e.defenderAllies]
        : [];
    }
    return e;
  }

  /** 一次性全量加载本地 JSON，返回所有事件（带缓存） */
  async loadAll(): Promise<ProcessedEvent[]> {
    if (this.allEvents) return this.allEvents;
    if (this.loading && this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = (async () => {
      const response = await fetch(withBasePath('/data/battle_events.json'));
      if (!response.ok) throw new Error(`Failed to load data: HTTP ${response.status}`);
      const data: ProcessedEvent[] = await response.json();
      const normalized = data.map(e => this.normalizeEvent(e));
      this.allEvents = normalized;
      this.loading = false;
      return normalized;
    })();

    return this.loadPromise;
  }

  /** 从全量事件中按年份筛选（精确匹配） */
  filterByYear(events: ProcessedEvent[], year: number): ProcessedEvent[] {
    return events.filter(e => e.year === year);
  }

  /**
   * 世纪/五年段感知的年份筛选。
   * - 1600-1899：按世纪聚合（稀疏数据避免空年）
   * - 1900+：按 5 年一段聚合（1900-1904, 1905-1909, ...）
   */
  filterByYearCentury(events: ProcessedEvent[], year: number): ProcessedEvent[] {
    if (year < 1900) {
      const centuryStart = Math.floor(year / 100) * 100;
      const centuryEnd = centuryStart + 99;
      return events.filter(e => e.year >= centuryStart && e.year <= centuryEnd);
    }
    // 五年一段
    const chunkStart = Math.floor(year / 5) * 5;
    const chunkEnd = chunkStart + 4;
    return events.filter(e => e.year >= chunkStart && e.year <= chunkEnd);
  }

  /**
   * 压缩后的年份步进。
   * 战争模式：1600 → 1700 → 1800 → 1900 → 1905 → 1910 → ... → 最后一个五年段
   * @returns null 表示已到终点
   */
  getNextYear(currentYear: number, maxYear: number, _minYear: number): number | null {
    // 世纪档位
    if (currentYear === 1600) return 1700;
    if (currentYear === 1700) return 1800;
    if (currentYear === 1800) return 1900;
    // 五年段：1900, 1905, 1910, ...
    if (currentYear >= 1900) {
      const next = currentYear + 5;
      if (next > maxYear) return null;
      // 最后一段不满 5 年也作为一个单位
      if (next + 4 > maxYear) {
        // 检查当前是否已经是最后一个段
        const lastFiveStart = Math.floor(maxYear / 5) * 5;
        if (currentYear >= lastFiveStart) return null;
        return lastFiveStart;
      }
      return next;
    }
    return null;
  }

  /** 格式化年份显示文字 */
  formatYearDisplay(year: number, mode: 'war' | 'conflict'): string {
    if (mode === 'conflict') return `${year}`;
    if (year < 1900) {
      const century = Math.floor(year / 100) + 1;
      return `${century}世纪`;
    }
    const chunkStart = Math.floor(year / 5) * 5;
    const chunkEnd = Math.min(chunkStart + 4, 1973);
    if (chunkStart === chunkEnd) return `${chunkStart}`;
    return `${chunkStart}–${chunkEnd}`;
  }

  /**
   * 按日期排序事件（闪点动画用）。
   * date 字段为 YYYY-MM-DD 字符串，缺失时回退到年份。
   */
  sortEventsByDate(events: ProcessedEvent[], ascending: boolean = true): ProcessedEvent[] {
    const sorted = [...events].sort((a, b) => {
      const dateA = (a.date && a.date.length >= 10) ? a.date : `${a.year}-01-01`;
      const dateB = (b.date && b.date.length >= 10) ? b.date : `${b.year}-01-01`;
      return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
    return sorted;
  }

  /** 按地区筛选 */
  filterEvents(
    events: ProcessedEvent[],
    filters: { regions?: string[] }
  ): ProcessedEvent[] {
    if (!filters.regions || filters.regions.length === 0) return events;
    return events.filter(e => filters.regions!.includes(e.region));
  }

  getRegions(): RegionFilter[] {
    return this.regions;
  }

  /** 获取年份范围（包含 UCDP 年份） */
  getYearRange(): { min: number; max: number } {
    let min = 1600;
    let max = 1973;
    if (this.allEvents) {
      const years = this.allEvents.map(e => e.year);
      min = Math.min(...years);
      max = Math.max(...years);
    }
    // 合并 UCDP 年份范围
    if (this.ucdpManifest && this.ucdpManifest.years.length > 0) {
      min = Math.min(min, this.ucdpManifest.years[0]);
      max = Math.max(max, this.ucdpManifest.years[this.ucdpManifest.years.length - 1]);
    }
    return { min, max };
  }

  // ── UCDP 按年加载 ─────────────────────────────────────────

  /** 加载 UCDP manifest */
  async loadUcdpManifest(): Promise<UcdpManifest | null> {
    if (this.ucdpManifest) return this.ucdpManifest;
    if (this.ucdpManifestLoading && this.ucdpManifestPromise) return this.ucdpManifestPromise;

    this.ucdpManifestLoading = true;
    this.ucdpManifestPromise = (async () => {
      try {
        const resp = await fetch(withBasePath('/data/ucdp/_manifest.json'));
        if (!resp.ok) return null;
        const data: UcdpManifest = await resp.json();
        this.ucdpManifest = data;
        return data;
      } catch {
        return null;
      } finally {
        this.ucdpManifestLoading = false;
      }
    })();
    return this.ucdpManifestPromise;
  }

  /** 按年加载 UCDP 数据（带缓存） */
  async loadUcdpByYear(year: number): Promise<ProcessedEvent[]> {
    // 检查缓存
    if (this.ucdpCache.has(year)) {
      return this.ucdpCache.get(year)!;
    }
    try {
      const resp = await fetch(withBasePath(`/data/ucdp/${year}.json`));
      if (!resp.ok) return [];
      const data: ProcessedEvent[] = await resp.json();
      const normalized = data.map(e => this.normalizeEvent(e));
      this.ucdpCache.set(year, normalized);
      return normalized;
    } catch {
      return [];
    }
  }

  /** 检查某年是否有 UCDP 数据（需先加载 manifest） */
  async hasUcdpYear(year: number): Promise<boolean> {
    const m = await this.loadUcdpManifest();
    if (!m) return false;
    return m.years.includes(year);
  }

  /** 获取 UCDP 数据所有可用年份 */
  async getUcdpYears(): Promise<number[]> {
    const m = await this.loadUcdpManifest();
    return m?.years ?? [];
  }

  /** 清除 UCDP 缓存 */
  clearUcdpCache(): void {
    this.ucdpCache.clear();
  }

  /** 统计当前筛选后的数据 */
  calculateStats(events: ProcessedEvent[]): ConflictStats {
    const totalEvents = events.length;
    const totalCasualties = events.reduce((sum, e) => sum + e.totalCasualties, 0);
    const totalTroops = events.reduce((sum, e) => sum + e.totalTroops, 0);
    const avgCasualtyRate = totalEvents > 0
      ? events.reduce((sum, e) => sum + e.casualtyRate, 0) / totalEvents
      : 0;

    const topBattles = [...events]
      .sort((a, b) => b.totalCasualties - a.totalCasualties)
      .slice(0, 5)
      .map(e => ({
        name: e.name,
        war: e.warCn || e.war,
        casualties: e.totalCasualties,
        troops: e.totalTroops,
        casualtyRate: e.casualtyRate,
      }));

    return {
      totalEvents,
      totalCasualties,
      totalTroops,
      avgCasualtyRate,
      topBattles,
    };
  }

  /** 胜方颜色映射 -> [R, G, B] */
  getWinnerColor(winner: string): [number, number, number] {
    switch (winner) {
      case 'attacker': return [220, 38, 128];   // 暖红 #dc2680
      case 'defender': return [59, 130, 246];    // 冷蓝 #3b82f6
      case 'draw':     return [250, 204, 21];    // 灰金 #facc15
      default:         return [107, 114, 128];   // 灰色 #6b7280
    }
  }

  /** 颜色字符串 (用于 legend 等) */
  getWinnerColorHex(winner: string): string {
    const [r, g, b] = this.getWinnerColor(winner);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}

export const conflictDataService = new ConflictDataService();
