const d = require('../public/data/battle_events.json');

const bySrc = {};
d.forEach(e => { bySrc[e.source] = (bySrc[e.source] || 0) + 1; });
console.log('By source:', JSON.stringify(bySrc));

const ch = d.filter(e => e.country === 'China');
const deaths = ch.reduce((s, e) => s + e.totalCasualties, 0);
console.log('China battles:', ch.length, '| total deaths:', deaths.toLocaleString());

console.log('\nTop 10 China battles by deaths:');
ch.sort((a, b) => b.totalCasualties - a.totalCasualties).slice(0, 10).forEach(e =>
  console.log(' ', e.name, '|', e.year, '|', e.totalCasualties.toLocaleString(), 'deaths |', e.warCn)
);

// Check new China rank
const byCountry = {};
d.forEach(e => {
  const c = e.country || 'Unknown';
  if (!byCountry[c]) byCountry[c] = { battles: 0, deaths: 0 };
  byCountry[c].battles++;
  byCountry[c].deaths += e.totalCasualties;
});

const ranked = Object.entries(byCountry).sort((a, b) => b[1].deaths - a[1].deaths);
console.log('\nChina rank by deaths:', ranked.findIndex(e => e[0] === 'China') + 1);
console.log('China deaths:', byCountry['China'].deaths.toLocaleString());
console.log('Top 5 by deaths:');
ranked.slice(0, 5).forEach(([c, v]) => console.log('  ', c, ':', v.deaths.toLocaleString()));
