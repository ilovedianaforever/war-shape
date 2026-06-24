const d = require('../public/data/battle_events.json');

// Check USSR/Russia data
const su = d.filter(e => e.country === 'Russia' || e.country === 'URSS');
const suDeaths = su.reduce((s, e) => s + e.totalCasualties, 0);
const wars = {};
su.forEach(e => { 
  const w = e.warCn || e.war;
  wars[w] = (wars[w] || 0) + 1; 
});

console.log('USSR/Russia battles:', su.length, 'deaths:', suDeaths.toLocaleString());
console.log('By war:');
Object.entries(wars).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ',k,':',v));

// All wars involving China or Russia
console.log('\n=== All wars with China/Russia involvement ===');
const allWars = {};
d.forEach(e => {
  const key = e.warCn || e.war;
  if (!allWars[key]) allWars[key] = {};
  const c = e.country;
  if (!allWars[key][c]) allWars[key][c] = 0;
  allWars[key][c] += e.totalCasualties;
});

Object.entries(allWars)
  .filter(([k,v]) => v['China'] || v['Russia'] || v['URSS'])
  .sort((a,b) => (b[1]['China']||0) + (b[1]['Russia']||0) + (b[1]['URSS']||0) - (a[1]['China']||0) - (a[1]['Russia']||0) - (a[1]['URSS']||0))
  .forEach(([k,v]) => {
    console.log(k + ':');
    if (v['China']) console.log('  China:', v['China'].toLocaleString());
    if (v['Russia']) console.log('  Russia:', v['Russia'].toLocaleString());
    if (v['URSS']) console.log('  URSS:', v['URSS'].toLocaleString());
  });

// Sample of a Russia battle for format reference
console.log('\n=== Sample Russia battle ===');
const ru = d.find(e => e.country === 'Russia' || e.country === 'URSS');
if (ru) console.log(JSON.stringify(ru, null, 2));
