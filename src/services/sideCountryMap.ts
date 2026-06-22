/**
 * 参战方名 → 现代国家名（countries.json 中的 name 字段）映射表。
 *
 * 数据来源涵盖：
 * - CDB90：西班牙语/历史名（Alemania → Germany、Imperio Otomano → Turkey）
 * - Wikipedia：英语标准国名（France、United Kingdom 等）及历史名
 * - UCDP GED：非标准组织名通过 country 字段回退
 *
 * 映射规则（按优先级）：
 * 1. 精确映射表查询（西班牙语、英语、历史名）
 * 2. extractCountryName() 模糊子串匹配（处理 "Government of X" "X Military" 等）
 * 3. UCDP 的 country 字段直接回退
 * 4. 无法映射返回 null，不参与国家高亮
 */

// ──── countries.json 标准国名集合（构建时从数据中提取，用于模糊匹配）────
const STANDARD_COUNTRY_NAMES: string[] = [];

/** 延迟加载标准国名列表（避免循环依赖） */
let countryNamesLoaded = false;
async function ensureCountryNames(): Promise<string[]> {
  if (countryNamesLoaded) return STANDARD_COUNTRY_NAMES;
  try {
    const resp = await fetch('/data/countries.json');
    const data = await resp.json();
    const names: string[] = data.features.map((f: any) => f.properties.name as string);
    names.sort((a, b) => b.length - a.length); // 按长度降序，避免 "South Korea" 误匹配 "Korea"
    STANDARD_COUNTRY_NAMES.push(...names);
    countryNamesLoaded = true;
  } catch {
    // 降级：硬编码常用国名
    STANDARD_COUNTRY_NAMES.push(
      'United States of America', 'United Kingdom', 'United Republic of Tanzania',
      'Democratic Republic of the Congo', 'Bosnia and Herzegovina', 'South Africa',
      'South Korea', 'North Korea', 'China', 'France', 'Germany', 'Russia',
      'India', 'Pakistan', 'Iran', 'Turkey', 'Egypt', 'Algeria', 'Syria',
      'Israel', 'Japan', 'Italy', 'Spain', 'Vietnam', 'Myanmar', 'Ethiopia',
      'Afghanistan', 'Nigeria', 'Sudan', 'Ukraine', 'Poland', 'Greece',
      'Netherlands', 'Belgium', 'Norway', 'Sweden', 'Finland', 'Australia',
      'Brazil', 'Argentina', 'Mexico', 'Colombia', 'Peru', 'Chile',
      'Indonesia', 'Thailand', 'Philippines', 'Malaysia', 'Somalia',
      'Yemen', 'Iraq', 'Libya', 'Chad', 'Mali', 'Niger', 'Burkina Faso',
      'Serbia', 'Croatia', 'Georgia', 'Armenia', 'Azerbaijan', 'Bulgaria',
      'Romania', 'Hungary', 'Czech Republic', 'Slovakia', 'Austria'
    );
    countryNamesLoaded = true;
  }
  return STANDARD_COUNTRY_NAMES;
}

// 确保首次访问时加载
ensureCountryNames();

const MAP: Record<string, string | null> = {
  // ── CDB90：西班牙语直接映射 ──
  "Alemania": "Germany",
  "Austria": "Austria",
  "EE. UU.": "United States of America",
  "Egipto": "Egypt",
  "España": "Spain",
  "Francia": "France",
  "Italia": "Italy",
  "Japón": "Japan",
  "México": "Mexico",
  "Rusia": "Russia",

  // ── CDB90：英国相关 ──
  "Gran Bretaña": "United Kingdom",
  "Inglaterra": "United Kingdom",

  // ── CDB90：历史帝国 → 继承国 ──
  "Imperio Otomano": "Turkey",
  "Imperio Habsburgo": "Austria",
  "Prusia": "Germany",
  "Hanóver": "Germany",
  "URSS": "Russia",

  // ── CDB90：美国内战双方 ──
  "Confederación": "United States of America",

  // ── CDB90：其他直接映射 ──
  "Corea del Norte": "North Korea",
  "Jordania": "Jordan",
  "Serbia": "Republic of Serbia",
  "República de Sudáfrica": "South Africa",

  // ── Wikipedia：标准英语国名（identity）──
  "Albania": "Albania",
  "Algeria": "Algeria",
  "Argentina": "Argentina",
  "Australia": "Australia",
  "Belgium": "Belgium",
  "Bulgaria": "Bulgaria",
  "China": "China",
  "Egypt": "Egypt",
  "Ethiopia": "Ethiopia",
  "Finland": "Finland",
  "France": "France",
  "Georgia": "Georgia",
  "Germany": "Germany",
  "Greece": "Greece",
  "India": "India",
  "Indonesia": "Indonesia",
  "Iran": "Iran",
  "Israel": "Israel",
  "Italy": "Italy",
  "Japan": "Japan",
  "Mexico": "Mexico",
  "Morocco": "Morocco",
  "Myanmar": "Myanmar",
  "Netherlands": "Netherlands",
  "North Korea": "North Korea",
  "Norway": "Norway",
  "Pakistan": "Pakistan",
  "Poland": "Poland",
  "Russia": "Russia",
  "South Africa": "South Africa",
  "South Korea": "South Korea",
  "Spain": "Spain",
  "Sweden": "Sweden",
  "Syria": "Syria",
  "Turkey": "Turkey",
  "Vietnam": "Vietnam",

  // ── Wikipedia：别名/历史名映射 ──
  "United Kingdom": "United Kingdom",
  "United States": "United States of America",
  "United States of America": "United States of America",
  "USA": "United States of America",
  "Czech Republic": "Czech Republic",
  "Irish Free State": "Ireland",
  "Ankara Government": "Turkey",

  // ── Wikipedia/UCDP：非国家实体 → null（不参与国家高亮，但散点正常显示）──
  "AbkhaziaCMPC": null,
  "Anti-treaty IRA": null,
  "Cossacks": null,
  "Mojahedin-e-Khalq": null,
  "National Revolutionary Army": null,
  "New Fourth Army": "China",
  "Viet Cong": null,
  "AIS": null,
  "LTTE": null,
  "PKK": null,
  "Taliban": null,
  "BRAS": null,

  // ── CDB90：无法映射到单一现代国家 ──
  "Jacobitas": null,
  "Independentistas": null,
};

/**
 * 从参战方名字中提取匹配的标准国名（子串匹配）。
 * 用于处理 "Government of X"、"X Military"、"X Army" 等格式。
 * 按标准国名长度降序匹配，避免误匹配。
 */
export async function extractCountryName(sideName: string): Promise<string | null> {
  if (!sideName) return null;
  const names = await ensureCountryNames();
  const trimmed = sideName.trim();

  // 先尝试精确匹配
  for (const name of names) {
    if (name === trimmed) return name;
  }

  // 子串匹配：在参战方名中查找标准国名
  for (const name of names) {
    if (name.length < 4) continue; // 跳过太短的（如 "Chad"、"Mali" 等容易误匹配）
    if (trimmed.includes(name)) return name;
  }

  return null;
}

/** 同步版 extractCountryName（使用已加载的列表，未加载时返回 null） */
export function extractCountryNameSync(sideName: string): string | null {
  if (!sideName || STANDARD_COUNTRY_NAMES.length === 0) return null;
  const trimmed = sideName.trim();

  for (const name of STANDARD_COUNTRY_NAMES) {
    if (name === trimmed) return name;
  }
  for (const name of STANDARD_COUNTRY_NAMES) {
    if (name.length < 4) continue;
    if (trimmed.includes(name)) return name;
  }
  return null;
}

/**
 * 将参战方名映射到现代国家名。
 * @returns 国家名（对应 countries.json 的 properties.name），无映射则 null
 */
export function sideToCountry(sideName: string): string | null {
  if (!sideName) return null;
  const trimmed = sideName.trim();

  // 1. 精确映射表
  if (trimmed in MAP) return MAP[trimmed];

  // 2. 模糊匹配：在参战方名中查找标准国名子串
  //    处理 "Flag of the National Revolutionary ArmyNational Revolutionar" 这种
  //    包含 "China" 子串的情况（实际上这个 case 用了特殊的 "National Revolutionary Army"→null 映射）
  const extracted = extractCountryNameSync(trimmed);
  if (extracted) return extracted;

  return null;
}

/**
 * 从战役对象提取双方对应的现代国家名。
 * 用于内战检测和高亮着色。
 *
 * @param sideA 攻方名
 * @param sideB 守方名
 * @param eventCountry UCDP 等数据的标准国家名回退（当 sideA/sideB 无法映射时使用）
 */
export function getBattleCountries(
  sideA: string,
  sideB: string,
  eventCountry?: string
): { countryA: string | null; countryB: string | null; isCivil: boolean } {
  let countryA = sideToCountry(sideA);
  let countryB = sideToCountry(sideB);

  // UCDP 回退：sideA/sideB 为组织名无法映射时，用 eventCountry 作为防守方国家
  // UCDP 中 sideA 通常是政府军，sideB 是叛军，国家是被攻击方
  if (!countryA && !countryB && eventCountry) {
    // 用 eventCountry 匹配标准国名
    const mapped = sideToCountry(eventCountry);
    countryA = mapped ?? eventCountry; // 攻方=政府（国家本身）
    // countryB 留 null（叛军不是国家）
  }

  // 内战国检测：双方映射到同一个国家
  const isCivil = countryA !== null && countryA === countryB;
  return { countryA, countryB, isCivil };
}

export default MAP;
