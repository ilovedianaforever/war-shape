export interface ConflictEvent {
  id: number;
  relid: string;
  year: number;
  active_year: boolean;
  code_status: string;
  type_of_violence: number;
  conflict_dset_id: string;
  conflict_new_id: number;
  conflict_name: string;
  dyad_dset_id: string;
  dyad_new_id: number;
  dyad_name: string;
  side_a_dset_id: string;
  side_a_new_id: number;
  side_a: string;
  side_b_dset_id: string;
  side_b_new_id: number;
  side_b: string;
  number_of_sources: number;
  source_article: string;
  source_office: string;
  source_date: string;
  source_headline: string;
  source_original: string;
  where_prec: number;
  where_coordinates: string;
  where_description: string;
  adm_1: string;
  adm_2: string;
  latitude: number;
  longitude: number;
  geom_wkt: string;
  priogrid_gid: number;
  country: string;
  country_id: number;
  region: string;
  event_clarity: number;
  date_prec: number;
  date_start: string;
  date_end: string;
  deaths_a: number;
  deaths_b: number;
  deaths_civilians: number;
  deaths_unknown: number;
  best: number;
  high: number;
  low: number;
  gwnoa: string | null;
  gwnob: string | null;
}

export interface ApiResponse {
  Result: ConflictEvent[];
  TotalCount: number;
  TotalPages: number;
  NextPageUrl: string | null;
  PreviousPageUrl: string | null;
}

export interface ProcessedEvent {
  id: number;
  name: string;
  war: string;
  warCn: string;
  sideA: string;
  sideB: string;
  latitude: number | null;
  longitude: number | null;
  date: string;
  year: number;
  winner: string;
  region: string;
  country: string;
  attackerTroops: number;
  defenderTroops: number;
  totalTroops: number;
  attackerCasualties: number;
  defenderCasualties: number;
  totalCasualties: number;
  casualtyRate: number;
  terrain: string;
  weather: string;
  commanderA: string;
  commanderB: string;
  wikiUrl: string;
  front: number;
  depth: number;
  attackerAllies: string[];
  defenderAllies: string[];
  /** 数据来源标识 */
  source?: 'cdb90' | 'wikipedia' | 'ucdp';
}

export interface RegionFilter {
  name: string;
  label: string;
}

export interface ConflictStats {
  totalEvents: number;
  totalCasualties: number;
  totalTroops: number;
  avgCasualtyRate: number;
  topBattles: Array<{
    name: string;
    war: string;
    casualties: number;
    troops: number;
    casualtyRate: number;
  }>;
}
