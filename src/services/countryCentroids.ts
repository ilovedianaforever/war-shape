/**
 * 国家质心计算工具。
 * 从 countries.json 的 MultiPolygon 坐标中为每个国家计算质心（所有坐标点的算术平均），
 * 用于战争流向弧线的起点定位。
 */

export interface CountryCentroid {
  lng: number;
  lat: number;
  name: string;
}

let centroidsCache: Map<string, CountryCentroid> | null = null;
let loadingPromise: Promise<Map<string, CountryCentroid>> | null = null;

/**
 * 从 GeoJSON FeatureCollection 计算所有国家的质心
 * @param fc GeoJSON FeatureCollection（MultiPolygon 类型）
 * @returns name → {lng, lat, name}
 */
function computeCentroids(fc: GeoJSON.FeatureCollection): Map<string, CountryCentroid> {
  const map = new Map<string, CountryCentroid>();

  for (const feature of fc.features) {
    const name = feature.properties?.name as string | undefined;
    if (!name) continue;

    const geom = feature.geometry as GeoJSON.MultiPolygon;
    const allCoords: [number, number][] = [];

    function collect(c: any) {
      if (typeof c[0] === 'number') {
        allCoords.push(c as [number, number]);
      } else {
        for (const item of c) collect(item);
      }
    }

    for (const polygon of geom.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) {
          allCoords.push(coord as [number, number]);
        }
      }
    }

    if (allCoords.length === 0) continue;

    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of allCoords) {
      sumLng += lng;
      sumLat += lat;
    }

    map.set(name, {
      lng: sumLng / allCoords.length,
      lat: sumLat / allCoords.length,
      name,
    });
  }

  return map;
}

/**
 * 加载国家质心数据（带缓存）。
 * 从 public/data/countries.json 加载并计算，结果缓存后重复使用。
 */
export async function loadCountryCentroids(): Promise<Map<string, CountryCentroid>> {
  if (centroidsCache) return centroidsCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const resp = await fetch('/data/countries.json');
    if (!resp.ok) throw new Error(`Failed to load countries.json: HTTP ${resp.status}`);
    const fc: GeoJSON.FeatureCollection = await resp.json();
    centroidsCache = computeCentroids(fc);
    return centroidsCache;
  })();

  return loadingPromise;
}

/**
 * 同步获取质心（仅在已加载后使用，否则返回 undefined）
 */
export function getCachedCentroids(): Map<string, CountryCentroid> | undefined {
  return centroidsCache ?? undefined;
}

/**
 * 根据预计算的 FeatureCollection 同步计算质心（用于组件中直接传入已加载的数据）
 */
export function computeCentroidsSync(fc: GeoJSON.FeatureCollection): Map<string, CountryCentroid> {
  return computeCentroids(fc);
}
