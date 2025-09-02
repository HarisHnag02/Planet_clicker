// physics.worker.js - runs physics, cluster detection, evolution and sends snapshots to main thread

let W = 800, H = 600;
let running = false;
let timeScale = 1;

const MAX_PARTICLES = 4000;
const particles = [];
const pool = [];

const TYPE = { BASIC:0, STELLAR:1, DARK:2 };

const defaultState = {
  particlesCount: 0,
  particlesPerClick: 1,
  celestialObjects: [],
  upgrades: {
    gravity: { level: 0, cost: 10, effect: 0.02 },
    strongGravity: { level: 0, cost: 50, effect: 0.08 },
    starFormation: { unlocked: false, cost: 100 },
    planetarySystem: { unlocked: false, cost: 500 },
    supermassiveBH: { level: 0, cost: 2000, effect: 1.0 }
  },
  universeAge: 0,
  totalClicks: 0,
  darkMatter: 0,
  adBuffs: { pMulti: 1, expiresAt: 0 },
  prestigeCount: 0,
  dmBonusNextPrestige: 0
};
let S = deepCopy(defaultState);

function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

/* utilities */
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }

/* particles pool */
function makeParticle(x,y,t=TYPE.BASIC){
  const p = pool.pop() || {x:0,y:0,vx:0,vy:0,ax:0,ay:0,type:TYPE.BASIC,trail:[]};
  p.x = x; p.y = y; p.vx = (Math.random()-0.5)*0.8; p.vy=(Math.random()-0.5)*0.8; p.type = t; p.trail.length=0;
  particles.push(p); return p;
}
function releaseParticle(p){
  const i = particles.indexOf(p); if(i>=0) particles.splice(i,1);
  pool.push(p);
}

/* spawn */
function spawnParticles(n, aroundCenter=true){
  const cx = W/2, cy = H/2;
  for(let i=0;i<n && particles.length<MAX_PARTICLES;i++){
    const r = aroundCenter ? Math.random()*20 : Math.random()*Math.max(W,H)/2;
    const a = Math.random()*Math.PI*2;
    makeParticle(cx + Math.cos(a)*r, cy + Math.sin(a)*r, TYPE.BASIC);
  }
}

/* celestial helpers */
const CO_TYPE = { CLUSTER:'Cluster', PROTOSTAR:'Protostar', STAR:'Main Sequence Star', SYSTEM:'Planetary System', NEBULA:'Nebula', GALAXY:'Galaxy', SMBH:'Supermassive Black Hole' };
function addCelestial(type,x,y){
  const o = { id: uid('co_'), type, x, y, age:0, mass:0, pps:0, meta:{} };
  switch(type){
    case CO_TYPE.CLUSTER: o.mass=8; o.pps=0; break;
    case CO_TYPE.PROTOSTAR: o.mass=20; o.pps=0.5; break;
    case CO_TYPE.STAR: o.mass=50; o.pps=2; break;
    case CO_TYPE.SYSTEM: o.mass=120; o.pps=6; o.meta.planets=[]; break;
    case CO_TYPE.NEBULA: o.mass=300; o.pps=10; break;
    case CO_TYPE.GALAXY: o.mass=1000; o.pps=40; break;
    case CO_TYPE.SMBH: o.mass=2000; o.pps=0; break;
  }
  S.celestialObjects.push(o);
  postLog(`Formed ${o.type} (mass ${Math.floor(o.mass)})`, true);
  return o;
}

/* evolution */
function evolve(obj){
  if(obj.type===CO_TYPE.CLUSTER && obj.mass>=20){ obj.type=CO_TYPE.PROTOSTAR; obj.pps=0.5; postLog('Cluster → Protostar'); return; }
  if(obj.type===CO_TYPE.PROTOSTAR && obj.mass>=50){ obj.type=CO_TYPE.STAR; obj.pps=2; postLog('Protostar → Star'); if(S.upgrades.starFormation.unlocked) attemptPlanetaryAround(obj); return; }
  if(obj.type===CO_TYPE.STAR && obj.mass>=120 && S.upgrades.planetarySystem.unlocked){ obj.type=CO_TYPE.SYSTEM; obj.pps=6; postLog('Star → Planetary System'); attemptPlanetaryAround(obj); return; }
  if(obj.type===CO_TYPE.SYSTEM && obj.mass>=300){ obj.type=CO_TYPE.NEBULA; obj.pps=10; postLog('Planetary System → Nebula'); return; }
  if(obj.type===CO_TYPE.NEBULA && obj.mass>=1000){ obj.type=CO_TYPE.GALAXY; obj.pps=40; postLog('Nebula → Galaxy'); return; }
}

function attemptPlanetaryAround(star){
  if(star.type==='Star' && S.upgrades.planetarySystem.unlocked){
    const sys = addCelestial(CO_TYPE.SYSTEM, star.x + 40*(Math.random()-0.5), star.y + 40*(Math.random()-0.5));
    sys.mass = star.mass + 40;
    const count = 2 + Math.floor(Math.random()*4);
    for(let i=0;i<count;i++){
      const dist = 36 + i*18 + Math.random()*12;
      const ang = Math.random()*Math.PI*2;
      sys.meta.planets.push({ angle: ang, dist, speed: 0.3 + Math.random()*0.6, size: 3 + Math.random()*3, color: `hsl(${Math.floor(Math.random()*360)} 70% 55%)` });
    }
    postLog(`Planetary System created (${sys.meta.planets.length} planets)`, true);
  }
}

/* logs to main thread */
function postLog(msg, important=false){
  postMessage({ type:'log', msg, important });
}

/* gravity calculation */
function getGravityTotal(){
  const g = (S.upgrades.gravity.level||0) * (S.upgrades.gravity.effect||0.02);
  const sg = (S.upgrades.strongGravity.level||0) * (S.upgrades.strongGravity.effect||0.08);
  const bh = (S.upgrades.supermassiveBH.level||0) > 0 ? 1.5 : 0.4;
  return 0.04 + g + sg + bh;
}

/* spatial hash */
function buildHash(){
  const map = new Map();
  for(const p of particles){
    const cx = Math.floor(p.x / cellSize), cy = Math.floor(p.y / cellSize);
    const key = `${cx},${cy}`;
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(p);
  }
  return map;
}

/* physics step */
const cellSize = 28;
function step(dt){
  S.universeAge += dt;
  // passive pps
  let basePps = 0;
  for(const o of S.celestialObjects){
    o.age += dt;
    basePps += o.pps;
    o.mass += dt * (0.15 + getGravityTotal()*0.05);
    if(o.type === CO_TYPE.SYSTEM && o.meta.planets){
      for(const p of o.meta.planets) p.angle += p.speed * dt * (1 + (S.upgrades.supermassiveBH.level||0)*0.05);
    }
    evolve(o);
  }
  // generate particles from objects
  const ppsGain = basePps * dt * (1 + (S.darkMatter||0)*0.01) * ((S.adBuffs.expiresAt>performance.now()) ? S.adBuffs.pMulti : 1);
  S.particlesCount += ppsGain;

  // particle physics
  const G = getGravityTotal();
  for(const p of particles){
    p.ax = p.ay = 0;
    const dx = W/2 - p.x, dy = H/2 - p.y; const d2 = dx*dx + dy*dy; const d = Math.max(6, Math.sqrt(d2));
    const f = (G) / (d2 + 60);
    p.ax += f*dx; p.ay += f*dy;
    for(const o of S.celestialObjects){
      const dx2 = o.x - p.x, dy2 = o.y - p.y; const dd2 = dx2*dx2 + dy2*dy2; const dd = Math.max(6, Math.sqrt(dd2));
      const ff = (G * Math.max(1, o.mass*0.02)) / (dd2 + 120);
      p.ax += ff*dx2; p.ay += ff*dy2;
    }
    p.vx = (p.vx + p.ax * dt) * 0.995; p.vy = (p.vy + p.ay * dt) * 0.995;
    p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
    p.trail && p.trail.push({x:p.x,y:p.y}); if(p.trail && p.trail.length>6) p.trail.shift();

    const cd = Math.hypot(W/2 - p.x, H/2 - p.y);
    if(cd < 10){
      let c = S.celestialObjects.find(o=>o.type===CO_TYPE.CLUSTER && Math.hypot(o.x - W/2, o.y - H/2) < 16);
      if(!c) c = addCelestial(CO_TYPE.CLUSTER, W/2, H/2);
      c.mass += 1;
      evolve(c);
      releaseParticle(p);
    }
  }

  // cluster detection off-center
  const map = buildHash();
  for(const [key,arr] of map){
    if(arr.length >= 6){
      const [cx,cy] = key.split(',').map(Number);
      const x = cx * cellSize + cellSize/2, y = cy * cellSize + cellSize/2;
      if(Math.hypot(x - W/2, y - H/2) > 30){
        if(!S.celestialObjects.some(o => Math.hypot(o.x - x, o.y - y) < 18)){
          const cluster = addCelestial(CO_TYPE.CLUSTER, x, y);
          cluster.mass += arr.length;
          for(let i=0;i<Math.min(6,arr.length);i++) releaseParticle(arr[i]);
        }
      }
    }
  }
}

/* snapshot and send minimized state to main thread */
function snapshotAndSend(){
  const sample = [];
  for(let i=0;i<Math.min(800, particles.length); i+=Math.max(1, Math.floor(particles.length/800))){
    const p = particles[i];
    sample.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, type: p.type });
  }
  const po = S.celestialObjects.map(o => ({
    id: o.id, type: o.type, x: o.x, y: o.y, mass: o.mass, pps: o.pps, radius: getRadiusForType(o.type),
    planets: o.meta && o.meta.planets ? o.meta.planets.map(p => ({ angle: p.angle, dist: p.dist, size: p.size, color: p.color })) : []
  }));
  postMessage({ type:'state', particlesCount: S.particlesCount, pps: S.celestialObjects.reduce((a,c)=>a+c.pps,0), darkMatter: S.darkMatter, celestialObjects: po, particles: sample });
}

/* radius helper */
function getRadiusForType(t){
  switch(t){ case CO_TYPE.CLUSTER: return 6; case CO_TYPE.PROTOSTAR: return 8; case CO_TYPE.STAR: return 10; case CO_TYPE.SYSTEM: return 12; case CO_TYPE.NEBULA: return 18; case CO_TYPE.GALAXY: return 26; case CO_TYPE.SMBH: return 14; default: return 8; }
}

/* main loop */
let last = performance.now();
let interval = null;
function startLoop(){
  if(interval) clearInterval(interval);
  last = performance.now();
  interval = setInterval(()=>{
    const now = performance.now();
    let dt = Math.min(0.05, (now - last)/1000); last = now;
    dt = dt * timeScale;
    step(dt);
    snapshotAndSend();
  }, 200);
}

/* handle messages from main thread */
onmessage = function(ev){
  const d = ev.data;
  if(!d) return;
  if(d.cmd === 'init'){
    W = d.w || W; H = d.h || H;
  } else if(d.cmd === 'start'){
    if(d.opts && d.opts.w) { W = d.opts.w; H = d.opts.h; timeScale = d.opts.timeScale || timeScale; }
    running = true; startLoop();
  } else if(d.cmd === 'resize'){
    W = d.w || W; H = d.h || H;
  } else if(d.cmd === 'click'){
    S.totalClicks = (S.totalClicks||0)+1;
    const multi = 1 + (S.darkMatter||0)*0.01;
    const buff = (S.adBuffs.expiresAt > performance.now()) ? (S.adBuffs.pMulti||1) : 1;
    const gain = (S.particlesPerClick || 1) * multi * buff;
    S.particlesCount += gain;
    spawnParticles(Math.min(12, Math.ceil(gain)));
  } else if(d.cmd === 'buy'){
    const key = d.key;
    if(key === 'gravity'){ if(S.particlesCount >= 10){ S.particlesCount -= 10; S.upgrades.gravity.level++; postLog('Bought Basic Gravity'); } else postLog('Not enough particles'); }
    if(key === 'strongGravity'){ if(S.particlesCount>=50){ S.particlesCount -=50; S.upgrades.strongGravity.level++; postLog('Bought Strong Gravity'); } else postLog('Not enough particles'); }
    if(key === 'starFormation'){ if(S.particlesCount>=100){ S.particlesCount-=100; S.upgrades.starFormation.unlocked=true; postLog('Star Formation unlocked'); } else postLog('Not enough particles'); }
    if(key === 'planetarySystem'){ if(S.particlesCount>=500){ S.particlesCount-=500; S.upgrades.planetarySystem.unlocked=true; postLog('Planetary Systems unlocked'); } else postLog('Not enough particles'); }
    if(key === 'supermassiveBH'){ if(S.particlesCount>=2000){ S.particlesCount-=2000; S.upgrades.supermassiveBH.level=(S.upgrades.supermassiveBH.level||0)+1; addCelestial(CO_TYPE.SMBH, W/2, H/2); postLog('Supermassive BH created'); } else postLog('Not enough particles'); }
  } else if(d.cmd === 'ad'){
    if(d.id === 'double'){ S.adBuffs.pMulti = 2; S.adBuffs.expiresAt = performance.now() + 4*60*60*1000; postLog('Ad: 2x particles for 4 hours'); }
    if(d.id === 'instant'){ const near = S.celestialObjects.find(o=>o.type===CO_TYPE.CLUSTER && o.mass >= 15); if(near){ near.mass = 60; evolve(near); postLog('Ad: Instant evolution applied'); } else postLog('Ad: No near cluster to evolve'); }
    if(d.id === 'dm'){ S.dmBonusNextPrestige = Math.max(S.dmBonusNextPrestige||0, 0.25); postLog('Ad: +25% DM next prestige'); }
  } else if(d.cmd === 'save'){
    try { const s = JSON.stringify(S); postMessage({ type:'file', name:'bmu_save', data:s}); postLog('Save snapshot created (worker)'); } catch(e){ postLog('Save failed: '+e.message); }
  } else if(d.cmd === 'loadData'){
    try { const parsed = JSON.parse(d.data); S = parsed; postLog('Loaded save into worker'); } catch(e){ postLog('Failed loading: '+e.message); }
  } else if(d.cmd === 'wipe'){
    S = deepCopy(defaultState); particles.length = 0; pool.length = 0; postLog('Wiped save/state in worker');
  } else if(d.cmd === 'prestige'){
    // compute prestige gain and reset keeping dark matter (main thread asked for it)
    const mass = S.celestialObjects.reduce((a,c)=>a+c.mass,0);
    const gain = Math.floor(Math.sqrt(mass/100) * (1 + (S.dmBonusNextPrestige||0)));
    S.darkMatter += gain;
    S.prestigeCount = (S.prestigeCount||0) + 1;
    S.dmBonusNextPrestige = 0;
    postLog(`Prestige: Gained ${gain} Dark Matter`, true);
    const keep = { darkMatter: S.darkMatter, prestigeCount: S.prestigeCount };
    S = deepCopy(defaultState);
    S.darkMatter = keep.darkMatter; S.prestigeCount = keep.prestigeCount;
    particles.length = 0; pool.length = 0;
  } else if(d.cmd === 'setTimeScale'){
    timeScale = d.v || 1;
  } else if(d.cmd === 'save-auto'){
    postMessage({ type:'autosave', data: JSON.stringify(S) });
  }
};

/* -------------------------
   Init seed & start
   ------------------------- */
for(let i=0;i<30;i++) spawnParticles(1);
postLog('Physics worker initialized');
startLoop();
