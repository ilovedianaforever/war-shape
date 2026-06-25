const d = require('../public/data/battle_events.json');

// All possible ways to identify China-related battles
const chinaBattles = d.filter(e => {
  const c = e.country || '';
  const sideA = e.sideA || '';
  const sideB = e.sideB || '';
  const war = e.war || '';
  const warCn = e.warCn || '';
  
  return c === 'China' ||
    sideA.includes('China') || sideB.includes('China') ||
    sideA.includes('Chinese') || sideB.includes('Chinese') ||
    sideA === 'China' || sideB === 'China' ||
    warCn.includes('中日') || warCn.includes('抗日') ||
    warCn.includes('中国') || war.includes('Sino-Japanese') ||
    war.includes('Chinese');
});

console.log('=== China-related battles count:', chinaBattles.length, '===\n');

// Group by war
const byWar = {};
chinaBattles.forEach(e => {
  const key = e.warCn || e.war || 'Unknown';
  if (!byWar[key]) byWar[key] = [];
  byWar[key].push(e);
});

Object.keys(byWar).sort().forEach(war => {
  console.log(`\n--- ${war} (${byWar[war].length} battles) ---`);
  byWar[war].sort((a,b) => b.totalCasualties - a.totalCasualties).forEach(e => {
    console.log(`  ${e.name} | year:${e.year} | deaths:${e.totalCasualties} | troops:${e.totalTroops} | country:${e.country}`);
  });
});

// Total deaths by country
const byCountry = {};
chinaBattles.forEach(e => {
  const c = e.country || 'Unknown';
  if (!byCountry[c]) byCountry[c] = { battles: 0, deaths: 0 };
  byCountry[c].battles++;
  byCountry[c].deaths += e.totalCasualties;
});

console.log('\n=== Country Totals ===');
Object.keys(byCountry).sort().forEach(c => {
  console.log(`  ${c}: ${byCountry[c].battles} battles, ${byCountry[c].deaths.toLocaleString()} deaths`);
});

// Top 10 countries by total deaths (all data)
const allByCountry = {};
d.forEach(e => {
  const c = e.country || 'Unknown';
  if (!allByCountry[c]) allByCountry[c] = { battles: 0, deaths: 0 };
  allByCountry[c].battles++;
  allByCountry[c].deaths += e.totalCasualties;
});

console.log('\n=== Top 15 Countries by Deaths (ALL data) ===');
Object.entries(allByCountry).sort((a,b) => b[1].deaths - a[1].deaths).slice(0,15).forEach(([c,v]) => {
  console.log(`  ${c}: ${v.battles} battles, ${v.deaths.toLocaleString()} deaths`);
});

// Check sample record format
console.log('\n=== Sample Record Format ===');
if (d.length > 0) console.log(JSON.stringify(d[0], null, 2));
