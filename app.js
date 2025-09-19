// ---------------------------
// Home Page Functionality
// ---------------------------

// Create starry background
function createStars() {
  const starsContainer = document.getElementById('stars');
  const starsCount = 150;
  
  for (let i = 0; i < starsCount; i++) {
    const star = document.createElement('div');
    star.classList.add('star');
    
    // Random properties for each star
    const size = Math.random() * 3;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const delay = Math.random() * 5;
    
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${posX}%`;
    star.style.top = `${posY}%`;
    star.style.animationDelay = `${delay}s`;
    
    starsContainer.appendChild(star);
  }
}

// Preload the game in the background
function preloadGame() {
  const loadingText = document.getElementById('loadingText');
  const progressBar = document.getElementById('progressBar');
  
  // Simulate loading process
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    progressBar.style.width = `${progress}%`;
    
    if (progress <= 25) {
      loadingText.textContent = "Initializing cosmic particles...";
    } else if (progress <= 50) {
      loadingText.textContent = "Calibrating gravity fields...";
    } else if (progress <= 75) {
      loadingText.textContent = "Forming celestial objects...";
    } else if (progress < 100) {
      loadingText.textContent = "Finalizing universe...";
    } else {
      clearInterval(interval);
      loadingText.textContent = "Ready to launch!";
      document.getElementById('launchBtn').disabled = false;
      
      // Initialize the game in the background
      initializeGame();
    }
  }, 100);
}

// Launch the game
function launchGame() {
  document.getElementById('homeScreen').classList.add('hidden');
  document.getElementById('gameContainer').style.display = 'block';
  startGameLoop();
}

// Go back to home screen
function goBackToHome() {
  document.getElementById('homeScreen').classList.remove('hidden');
  document.getElementById('gameContainer').style.display = 'none';
}

// ---------------------------
// Core Game State
// ---------------------------
let S;
let gameInitialized = false;

function initializeGame() {
  if (gameInitialized) return;
  
  const defaultState = {
    particles: 0,
    particlesPerClick: 1,
    particlesPerSecond: 0,
    celestialObjects: [],
    upgrades: {
      gravity: { level: 0, cost: 10, effect: 0.1 },
      starFormation: { unlocked: false, cost: 100 },
      planetarySystem: { unlocked: false, cost: 500 },
      strongGravity: { level: 0, cost: 50, effect: 0.3 },
      supermassiveBH: { level: 0, cost: 5000, effect: 3.0 }
    },
    achievements: [],
    universeAge: 0,
    totalClicks: 0,
    darkMatter: 0,
    dmBonusNextPrestige: 0,
    adBuffs: { pMulti: 1, expiresAt: 0 },
    prestigeCount: 0,
    // Planetary system state
    planets: {
      mercury: { formed: false, progress: 0, required: 50, orbitRadius: 60, color: '#a5a5a5' },
      venus: { formed: false, progress: 0, required: 80, orbitRadius: 90, color: '#e6e6fa' },
      earth: { formed: false, progress: 0, required: 120, orbitRadius: 120, color: '#6b93d6' },
      mars: { formed: false, progress: 0, required: 160, orbitRadius: 150, color: '#c1440e' },
      jupiter: { formed: false, progress: 0, required: 200, orbitRadius: 200, color: '#c9b59d' },
      saturn: { formed: false, progress: 0, required: 250, orbitRadius: 250, color: '#e3d8b0' },
      uranus: { formed: false, progress: 0, required: 300, orbitRadius: 300, color: '#c6e2ff' },
      neptune: { formed: false, progress: 0, required: 350, orbitRadius: 350, color: '#5b5ddf' }
    },
    currentOrbit: 60, // Starting orbit for Mercury
    particlesInOrbit: {} // Track particles in each orbit
  };
  
  S = loadState() || JSON.parse(JSON.stringify(defaultState));

  // Initialize particlesInOrbit for each planet
  for (const planetName in S.planets) {
    if (!S.particlesInOrbit[planetName]) {
      S.particlesInOrbit[planetName] = 0;
    }
  }

  // Initialize UI
  renderUpgrades();
  renderStatsPanel();
  renderPlanetProgress();
  log('Welcome to Button Masher Universe. Mash the Singularity to form planets!');
  log('Particles will orbit and combine to form planets when enough are in the same orbit.');

  // Start with a few particles for flair
  spawnParticles(30);
  
  gameInitialized = true;
}

// ---------------------------
// Canvas & Rendering Setup
// ---------------------------
const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let W = 0, H = 0;

function resize(){
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
}

// Camera/zoom
let zoom = 1;
const zoomSlider = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');

// ---------------------------
// Particles & Physics
// ---------------------------
const MAX_PARTICLES = 3000;
const particles = [];
const pool = [];
const CENTER = { x: ()=>W/2, y: ()=>H/2 };

const TYPE = { BASIC:0, STELLAR:1, DARK:2 };

function makeParticle(x,y,type=TYPE.BASIC){
  const p = pool.pop() || {x:0,y:0,vx:0,vy:0,ax:0,ay:0,type:TYPE.BASIC,trail:[], orbitTarget: S.currentOrbit, angle: Math.random() * Math.PI * 2};
  p.x=x; p.y=y; p.vx=(Math.random()-0.5)*0.4; p.vy=(Math.random()-0.5)*0.4; p.ax=0; p.ay=0; p.type=type; p.trail.length=0;
  particles.push(p);
  return p;
}

function releaseParticle(p){
  const i = particles.indexOf(p); if(i>=0) particles.splice(i,1);
  pool.push(p);
}

function spawnParticles(n, aroundCenter=true){
  const cx = CENTER.x(), cy = CENTER.y();
  for(let i=0;i<n && particles.length<MAX_PARTICLES;i++){
    const r = aroundCenter? Math.random()*20 : 0;
    const a = Math.random()*Math.PI*2;
    makeParticle(cx + Math.cos(a)*r, cy + Math.sin(a)*r, TYPE.BASIC);
  }
}

function spawnPlanetaryParticles(n, orbitRadius){
  const cx = CENTER.x(), cy = CENTER.y();
  for(let i=0;i<n && particles.length<MAX_PARTICLES;i++){
    const angle = Math.random() * Math.PI * 2;
    const distance = orbitRadius + (Math.random() * 20 - 10);
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const p = makeParticle(x, y, TYPE.BASIC);
    p.orbitTarget = orbitRadius;
    p.angle = angle;
  }
}

// Celestial objects
const CO_TYPE = { 
  CLUSTER:'Cluster', 
  PROTOSTAR:'Protostar', 
  STAR:'Main Sequence Star', 
  SYSTEM:'Planetary System', 
  NEBULA:'Nebula', 
  GALAXY:'Galaxy', 
  SMBH:'Supermassive Black Hole',
  MERCURY: 'Mercury',
  VENUS: 'Venus',
  EARTH: 'Earth',
  MARS: 'Mars',
  JUPITER: 'Jupiter',
  SATURN: 'Saturn',
  URANUS: 'Uranus',
  NEPTUNE: 'Neptune'
};

const PLANET_COLORS = {
  MERCURY: '#a5a5a5',
  VENUS: '#e6e6fa',
  EARTH: '#6b93d6',
  MARS: '#c1440e',
  JUPITER: '#c9b59d',
  SATURN: '#e3d8b0',
  URANUS: '#c6e2ff',
  NEPTUNE: '#5b5ddf'
};

function addCelestial(type, x, y){
  const obj = { id:crypto.randomUUID(), type, x, y, age:0, mass:0, pps:0 };
  switch(type){
    case CO_TYPE.CLUSTER: obj.mass=8; obj.pps=0; break;
    case CO_TYPE.PROTOSTAR: obj.mass=20; obj.pps=0.5; break;
    case CO_TYPE.STAR: obj.mass=50; obj.pps=2; break;
    case CO_TYPE.SYSTEM: obj.mass=120; obj.pps=6; break;
    case CO_TYPE.NEBULA: obj.mass=300; obj.pps=10; break;
    case CO_TYPE.GALAXY: obj.mass=1000; obj.pps=40; break;
    case CO_TYPE.SMBH: obj.mass=2000; obj.pps=0; break;
    case CO_TYPE.MERCURY: obj.mass=10; obj.pps=0.2; break;
    case CO_TYPE.VENUS: obj.mass=15; obj.pps=0.3; break;
    case CO_TYPE.EARTH: obj.mass=20; obj.pps=0.4; break;
    case CO_TYPE.MARS: obj.mass=25; obj.pps=0.5; break;
    case CO_TYPE.JUPITER: obj.mass=40; obj.pps=0.8; break;
    case CO_TYPE.SATURN: obj.mass=35; obj.pps=0.7; break;
    case CO_TYPE.URANUS: obj.mass=30; obj.pps=0.6; break;
    case CO_TYPE.NEPTUNE: obj.mass=30; obj.pps=0.6; break;
  }
  S.celestialObjects.push(obj);
  log(`Formed <span class="good">${obj.type}</span> (${obj.mass} mass)`, true);
  
  // Show formation notice
  const notice = document.getElementById('formationNotice');
  notice.textContent = `${type} Formed!`;
  notice.style.display = 'block';
  setTimeout(() => {
    notice.style.display = 'none';
  }, 2000);
  
  return obj;
}

function evolve(obj){
  if(obj.type===CO_TYPE.CLUSTER && obj.mass>=20) { obj.type=CO_TYPE.PROTOSTAR; obj.pps=0.5; log(`A cluster ignited into a <span class="good">Protostar</span>.`); }
  else if(obj.type===CO_TYPE.PROTOSTAR && obj.mass>=50){ obj.type=CO_TYPE.STAR; obj.pps=2; log(`Protostar stabilized as a <span class="good">Main Sequence Star</span>.`); }
  else if(obj.type===CO_TYPE.STAR && obj.mass>=120 && S.upgrades.planetarySystem.unlocked){ obj.type=CO_TYPE.SYSTEM; obj.pps=6; log(`Planets formed around a star → <span class="good">Planetary System</span>.`); }
  else if(obj.type===CO_TYPE.SYSTEM && obj.mass>=300){ obj.type=CO_TYPE.NEBULA; obj.pps=10; log(`Multiple systems birthed a <span class="good">Nebula</span>.`); }
  else if(obj.type===CO_TYPE.NEBULA && obj.mass>=1000){ obj.type=CO_TYPE.GALAXY; obj.pps=40; log(`Spiral arms coalesced into a <span class="good">Galaxy</span>!`); }
}

function drawCelestial(obj){
  ctx.save();
  ctx.translate(obj.x, obj.y); ctx.scale(zoom, zoom);
  let r=0, grad;
  switch(obj.type){
    case CO_TYPE.CLUSTER: r=6; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(122,215,255,.7)'); grad.addColorStop(1,'rgba(122,215,255,.05)'); break;
    case CO_TYPE.PROTOSTAR: r=8; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(255,230,170,.9)'); grad.addColorStop(1,'rgba(255,210,120,.08)'); break;
    case CO_TYPE.STAR: r=10; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(255,240,200,1)'); grad.addColorStop(1,'rgba(255,180,80,.10)'); break;
    case CO_TYPE.SYSTEM: r=12; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(200,240,255,1)'); grad.addColorStop(1,'rgba(140,210,255,.12)'); break;
    case CO_TYPE.NEBULA: r=18; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(170,140,255,1)'); grad.addColorStop(1,'rgba(100,80,200,.12)'); break;
    case CO_TYPE.GALAXY: r=24; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(210,200,255,1)'); grad.addColorStop(1,'rgba(180,130,255,.16)'); break;
    case CO_TYPE.SMBH: r=14; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(20,20,30,1)'); grad.addColorStop(1,'rgba(120,100,180,.18)'); break;
    case CO_TYPE.MERCURY: r=4; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.MERCURY); grad.addColorStop(1,'rgba(165,165,165,.1)'); break;
    case CO_TYPE.VENUS: r=5; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.VENUS); grad.addColorStop(1,'rgba(230,230,250,.1)'); break;
    case CO_TYPE.EARTH: r=6; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.EARTH); grad.addColorStop(1,'rgba(107,147,214,.1)'); break;
    case CO_TYPE.MARS: r=5; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.MARS); grad.addColorStop(1,'rgba(193,68,14,.1)'); break;
    case CO_TYPE.JUPITER: r=10; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.JUPITER); grad.addColorStop(1,'rgba(201,181,157,.1)'); break;
    case CO_TYPE.SATURN: r=9; 
      grad=ctx.createRadialGradient(0,0,0,0,0,r); 
      grad.addColorStop(0,PLANET_COLORS.SATURN); 
      grad.addColorStop(1,'rgba(227,216,176,.1)'); 
      // Draw Saturn's rings
      ctx.beginPath();
      ctx.ellipse(0, 0, r*1.8, r*0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(210, 180, 140, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case CO_TYPE.URANUS: r=8; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.URANUS); grad.addColorStop(1,'rgba(198,226,255,.1)'); break;
    case CO_TYPE.NEPTUNE: r=8; grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,PLANET_COLORS.NEPTUNE); grad.addColorStop(1,'rgba(91,93,223,.1)'); break;
  }
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ---------------------------
// Upgrades UI
// ---------------------------
const upgradeDefs = [
  { key:'gravity', name:'Basic Gravity', desc:'+0.1 attraction per level', cost: s=>S.upgrades.gravity.cost * Math.pow(1.25, S.upgrades.gravity.level), buy: ()=>{ S.upgrades.gravity.level++; } },
  { key:'strongGravity', name:'Strong Gravity', desc:'+0.3 attraction per level', cost: s=>S.upgrades.strongGravity.cost * Math.pow(1.35, S.upgrades.strongGravity.level), buy: ()=>{ S.upgrades.strongGravity.level++; } },
  { key:'starFormation', name:'Star Formation', desc:'Enable star creation', cost: s=>S.upgrades.starFormation.cost, oneTime:true, buy: ()=>{ S.upgrades.starFormation.unlocked=true; } },
  { key:'planetarySystem', name:'Planetary Formation', desc:'Enable planet creation', cost: s=>S.upgrades.planetarySystem.cost, oneTime:true, buy: ()=>{ S.upgrades.planetarySystem.unlocked=true; } },
  { key:'supermassiveBH', name:'Supermassive Black Hole', desc:'Massive attraction center', cost: s=>S.upgrades.supermassiveBH.cost * Math.pow(2, S.upgrades.supermassiveBH.level), buy: ()=>{ S.upgrades.supermassiveBH.level++; createSMBH(); } },
];

const upgradesEl = document.getElementById('upgrades');

function renderUpgrades(){
  upgradesEl.innerHTML='';
  for(const u of upgradeDefs){
    const isOne = u.oneTime;
    const owned = isOne ? getByKey(u.key) : null;
    const cost = Math.floor(u.cost());
    const available = S.particles >= cost;
    const wrapper = document.createElement('div');
    wrapper.className='upgrade';
    wrapper.innerHTML = `<div><h4>${u.name} ${!isOne?`<span class="badge">Lv ${getLevel(u.key)}</span>`:''}</h4><small>${u.desc}</small></div>`;
    const btn = document.createElement('button'); btn.className='btn';
    if(isOne){
      const unlocked = isUnlocked(u.key);
      btn.textContent = unlocked? 'Purchased' : `Buy • ${cost}`;
      btn.disabled = unlocked || !available;
    }else{
      btn.textContent = `Buy • ${cost}`;
      btn.disabled = !available;
    }
    btn.addEventListener('click', ()=>{
      if(S.particles < cost) return;
      S.particles -= cost;  // Deduct particles when purchasing
      u.buy();
      log(`<span class="good">Purchased</span> ${u.name} for ${cost} particles.`);
      renderUpgrades();
    });
    wrapper.appendChild(btn);
    upgradesEl.appendChild(wrapper);
  }
}

function getLevel(key){ return S.upgrades[key]?.level||0; }
function isUnlocked(key){ return S.upgrades[key]?.unlocked||false; }
function getByKey(key){ return S.upgrades[key]; }

function createSMBH(){
  const obj = addCelestial(CO_TYPE.SMBH, CENTER.x(), CENTER.y());
  obj.pps = 0; obj.mass = 2000 + S.upgrades.supermassiveBH.level * 500;
}

// ---------------------------
// Planetary System Functions
// ---------------------------
function updatePlanetarySystem() {
  // Reset particle counts for this frame
  for (const planetName in S.particlesInOrbit) {
    S.particlesInOrbit[planetName] = 0;
  }
  
  // Count particles in each orbit
  for (const p of particles) {
    if (p.orbitTarget) {
      const dx = CENTER.x() - p.x;
      const dy = CENTER.y() - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Find which orbit this particle is closest to
      for (const planetName in S.planets) {
        const planet = S.planets[planetName];
        if (Math.abs(distance - planet.orbitRadius) < 15) {
          S.particlesInOrbit[planetName]++;
          break;
        }
      }
    }
  }
  
  // Check if we should form a new planet
  const planetOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  
  for (const planetName of planetOrder) {
    const planet = S.planets[planetName];
    
    if (!planet.formed) {
      // Update progress based on particles in orbit
      const particlesInOrbit = S.particlesInOrbit[planetName] || 0;
      planet.progress = Math.min(planet.required, particlesInOrbit);
      
      // Check if planet is ready to form
      if (particlesInOrbit >= planet.required) {
        planet.formed = true;
        S.currentOrbit = planet.orbitRadius + 30; // Set next orbit radius
        
        // Remove particles that formed this planet
        let particlesRemoved = 0;
        for (let i = particles.length - 1; i >= 0 && particlesRemoved < planet.required; i--) {
          const p = particles[i];
          const dx = CENTER.x() - p.x;
          const dy = CENTER.y() - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (Math.abs(distance - planet.orbitRadius) < 15) {
            releaseParticle(p);
            particlesRemoved++;
          }
        }
        
        // Create the planet at a position where most particles were clustered
        const angle = Math.random() * Math.PI * 2;
        const x = CENTER.x() + Math.cos(angle) * planet.orbitRadius;
        const y = CENTER.y() + Math.sin(angle) * planet.orbitRadius;
        
        addCelestial(CO_TYPE[planetName.toUpperCase()], x, y);
        log(`<span class="good">${planetName.charAt(0).toUpperCase() + planetName.slice(1)}</span> has formed from ${particlesRemoved} particles!`, true);
      }
      break; // Only work on the next unformed planet
    }
  }
  
  renderPlanetProgress();
}

function renderPlanetProgress() {
  const container = document.getElementById('planetProgress');
  container.innerHTML = '<h4 style="margin:0 0 8px 0">Planet Formation Progress</h4>';
  
  const planetOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  
  for (const planetName of planetOrder) {
    const planet = S.planets[planetName];
    const particlesInOrbit = S.particlesInOrbit[planetName] || 0;
    const progressPercent = Math.min(100, (particlesInOrbit / planet.required) * 100);
    
    const planetDiv = document.createElement('div');
    planetDiv.className = 'planet-item';
    planetDiv.innerHTML = `
      <div class="planet-info">
        <span>${planetName.charAt(0).toUpperCase() + planetName.slice(1)}</span>
        <span>${planet.formed ? 'Formed' : `${particlesInOrbit}/${planet.required}`}</span>
      </div>
      ${planet.formed ? '' : `
        <div class="planet-progress-bar" style="width: ${progressPercent}%"></div>
      `}
    `;
    
    container.appendChild(planetDiv);
  }
}

// ---------------------------
// UI: Stats & Log
// ---------------------------
const statParticles = document.getElementById('statParticles');
const statPps = document.getElementById('statPps');
const statAge = document.getElementById('statAge');
const statDM = document.getElementById('statDM');
const statsList = document.getElementById('stats');
const logEl = document.getElementById('log');
const logCountEl = document.getElementById('logCount');
const clearLogBtn = document.getElementById('clearLog');

let logCount=0;

function log(msg, important=false){
  const t = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.innerHTML = `<span class="r">[${t}]</span> ${msg}`;
  logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight; logCount++; logCountEl.textContent=logCount;
  if(important){
    // little flash in title
    document.title = '★ ' + document.title;
    setTimeout(()=>{ document.title = 'Button Masher Universe (Fixed Formation)'; }, 800);
  }
}

function renderStatsPanel(){
  const co = S.celestialObjects;
  const totals = co.reduce((a,c)=>{a.mass+=c.mass; a.pps+=c.pps; return a;},{mass:0,pps:0});
  
  // Count planets
  const planetCount = Object.values(S.planets).filter(p => p.formed).length;
  
  const lines = [
    `Total Mass: <strong>${Math.floor(totals.mass)}</strong>`,
    `Objects: <strong>${co.length}</strong>`,
    `Particles: <strong>${particles.length}</strong>`,
    `Planets Formed: <strong>${planetCount}/8</strong>`,
    `Clicks: <strong>${S.totalClicks}</strong>`,
    `P/click: <strong>${S.particlesPerClick.toFixed(2)}</strong>`,
    `Base P/s: <strong>${totals.pps.toFixed(2)}</strong>`,
    `Effective P/s: <strong>${(effectivePPS(totals.pps)).toFixed(2)}</strong>`,
    `Gravity Lv: <strong>${S.upgrades.gravity.level}</strong> • Strong Lv: <strong>${S.upgrades.strongGravity.level}</strong>`,
    `Star Formation: <strong>${S.upgrades.starFormation.unlocked?'Yes':'No'}</strong>`,
    `Planetary Formation: <strong>${S.upgrades.planetarySystem.unlocked?'Yes':'No'}</strong>`,
    `Prestiges: <strong>${S.prestigeCount}</strong>`
  ];
  statsList.innerHTML = lines.map(l=>`<div>${l}</div>`).join('');
}

// ---------------------------
// Progression & Prestige
// ---------------------------
function effectivePPS(base){
  const dmMulti = 1 + S.darkMatter * 0.01; // +1% per DM
  const adMulti = (S.adBuffs.expiresAt>performance.now()) ? S.adBuffs.pMulti : 1;
  return base * dmMulti * adMulti;
}

function prestigeGainEstimate(){
  const mass = S.celestialObjects.reduce((a,c)=>a+c.mass,0);
  const base = Math.sqrt(mass/100);
  const bonus = 1 + S.dmBonusNextPrestige;
  return Math.floor(base * bonus);
}

function bigCrunch(){
  const gain = prestigeGainEstimate();
  S.darkMatter += gain;
  S.prestigeCount++;
  S.dmBonusNextPrestige = 0;
  log(`<span class="good">Big Crunch!</span> Gained <strong>${gain}</strong> Dark Matter.`, true);
  // reset most state
  const keep = { darkMatter:S.darkMatter, prestigeCount:S.prestigeCount };
  S = JSON.parse(JSON.stringify(defaultState));
  S.darkMatter = keep.darkMatter; S.prestigeCount = keep.prestigeCount;
  saveState();
  renderUpgrades();
  renderPlanetProgress();
}

// ---------------------------
// Input: Clicking / Holding
// ---------------------------
const clickBtn = document.getElementById('clickBtn');
const clickBtnSidebar = document.getElementById('clickBtnSidebar');
let holding=false, lastHold=0;

// Improved button interaction with visual feedback
function addButtonInteraction(button) {
  button.addEventListener('mousedown', ()=>{
    button.classList.add('active');
    if(button.id === 'clickBtn' || button.id === 'clickBtnSidebar') {
      holding = true;
      doClick();
    }
  });
  
  button.addEventListener('mouseup', ()=>{
    button.classList.remove('active');
    if(button.id === 'clickBtn' || button.id === 'clickBtnSidebar') holding = false;
  });
  
  button.addEventListener('mouseleave', ()=>{
    button.classList.remove('active');
    if(button.id === 'clickBtn' || button.id === 'clickBtnSidebar') holding = false;
  });
  
  button.addEventListener('touchstart', e=>{
    e.preventDefault();
    button.classList.add('active');
    if(button.id === 'clickBtn' || button.id === 'clickBtnSidebar') {
      holding = true;
      doClick();
    }
  });
  
  button.addEventListener('touchend', ()=>{
    button.classList.remove('active');
    if(button.id === 'clickBtn' || button.id === 'clickBtnSidebar') holding = false;
  });
}

function doClick(){
  S.totalClicks++;
  const multi = 1 + S.darkMatter*0.01;
  const gain = S.particlesPerClick * multi * ((S.adBuffs.expiresAt>performance.now())?S.adBuffs.pMulti:1);
  S.particles += gain;
  
  // Spawn particles in the appropriate orbit
  spawnPlanetaryParticles(Math.min(20, Math.ceil(gain)), S.currentOrbit);  
  // Add visual feedback
  clickBtn.classList.add('pulse');
  clickBtnSidebar.classList.add('pulse');
  setTimeout(() => {
    clickBtn.classList.remove('pulse');
    clickBtnSidebar.classList.remove('pulse');
  }, 500);
}

// ---------------------------
// Ads (Mock Implementation)
// ---------------------------
function setupAdButtons() {
  document.getElementById('adDoubleParticles').addEventListener('click', ()=>{
    S.adBuffs.pMulti = 2;
    const fourHours = 4*60*60*1000;
    S.adBuffs.expiresAt = performance.now() + fourHours;
    log(`Rewarded Ad: <span class="good">2x particles</span> for 4 hours applied.`);
  });
  
  document.getElementById('adInstantFormation').addEventListener('click', ()=>{
    // If a planet is close to formation, complete it
    const planetOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    for (const planetName of planetOrder) {
      const planet = S.planets[planetName];
      if (!planet.formed && planet.progress >= planet.required * 0.7) {
        // Add enough particles to complete the planet
        const needed = planet.required - planet.progress;
        for (let i = 0; i < needed; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = planet.orbitRadius + (Math.random() * 10 - 5);
          const x = CENTER.x() + Math.cos(angle) * distance;
          const y = CENTER.y() + Math.sin(angle) * distance;
          const p = makeParticle(x, y, TYPE.BASIC);
          p.orbitTarget = planet.orbitRadius;
        }
        log(`Rewarded Ad: Added particles to complete ${planetName}.`);
        return;
      }
    }
    log(`No planet near formation threshold.`);
  });
  
  document.getElementById('adBonusDM').addEventListener('click', ()=>{
    S.dmBonusNextPrestige = Math.max(S.dmBonusNextPrestige, 0.25);
    log(`Rewarded Ad: <span class="good">+25% Dark Matter</span> on next Prestige.`);
  });
}

// ---------------------------
// Time & Game Loop
// ---------------------------
const timeScale = document.getElementById('timeScale');
const timeScaleVal = document.getElementById('timeScaleVal');

let last=performance.now();
let gameLoopRunning = false;

function startGameLoop() {
  if (gameLoopRunning) return;
  
  // Set up event listeners
  clearLogBtn.addEventListener('click', ()=>{ logEl.innerHTML=''; logCountEl.textContent='0';});
  document.getElementById('prestigeBtn').addEventListener('click', ()=>{
    if(confirm(`Reset your universe for Dark Matter? (Est. +${prestigeGainEstimate()})`)) bigCrunch();
  });
  
  // Apply button interactions to all buttons
  document.querySelectorAll('button').forEach(btn => {
    addButtonInteraction(btn);
  });
  
  setupAdButtons();
  
  // Set up zoom
  zoomSlider.addEventListener('input', ()=>{ zoom=parseFloat(zoomSlider.value); zoomVal.textContent=zoom.toFixed(2);});
  
  // Set up time scale
  timeScale.addEventListener('input', ()=>{ timeScaleVal.textContent=timeScale.value; });
  
  // Set up resize observer
  new ResizeObserver(resize).observe(canvas);
  resize();
  
  gameLoopRunning = true;
  loop(performance.now());
}

function loop(now){
  if (!gameLoopRunning) return;
  
  const rawDt = Math.min(0.05, (now-last)/1000); // clamp 50ms
  last = now;
  const dt = rawDt * parseFloat(timeScale.value);

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  // Universe age
  S.universeAge += dt;

  // Handle holding the button for continuous clicks
  if(holding && performance.now() - lastHold > 100) {
    doClick();
    lastHold = performance.now();
  }

  // Passive generation from celestial objects
  let basePps = 0;
  for(const o of S.celestialObjects){
    o.age += dt; basePps += o.pps;
    // slow mass increase as they attract particles
    o.mass += dt * (0.2 + getGravityTotal()*0.1);
    evolve(o);
  }
  const gain = effectivePPS(basePps) * dt;
  S.particles += gain;

  // Physics: attraction toward center + celestial objects + SMBH if any
  const G = getGravityTotal();
  for(const p of particles){
    p.ax = p.ay = 0;
    
    // Orbital behavior for particles
    if (p.orbitTarget) {
      const dx = CENTER.x() - p.x;
      const dy = CENTER.y() - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const targetDistance = p.orbitTarget;
      
      // Adjust velocity to achieve orbit
      if (Math.abs(distance - targetDistance) > 5) {
        const direction = distance > targetDistance ? -1 : 1;
        p.ax += (dx / distance) * direction * 0.1;
        p.ay += (dy / distance) * direction * 0.1;
      }
      
      // Add tangential velocity for orbital motion
      const tangentX = -dy / distance;
      const tangentY = dx / distance;
      const orbitalSpeed = 0.3 * Math.sqrt(G * 50 / targetDistance);
      p.vx += tangentX * orbitalSpeed * dt;
      p.vy += tangentY * orbitalSpeed * dt;
      
      // Update angle for orbital position
      p.angle += orbitalSpeed * dt * 0.5;
    }
    
    // Center attraction
    const dx = CENTER.x()-p.x, dy = CENTER.y()-p.y; 
    let d2 = dx*dx+dy*dy; 
    const d = Math.max(6, Math.sqrt(d2));
    const f = (G)/(d2+50);
    p.ax += f*dx; p.ay += f*dy;
    
    // celestial pulls
    for(const o of S.celestialObjects){
      const dx2 = o.x-p.x, dy2 = o.y-p.y; 
      const dd2 = dx2*dx2+dy2*dy2; 
      const dd = Math.max(6, Math.sqrt(dd2));
      const ff = (G*o.mass*0.02)/(dd2+100);
      p.ax += ff*dx2; p.ay += ff*dy2;
    }
    
    p.vx = (p.vx + p.ax*dt) * 0.995; // light damping
    p.vy = (p.vy + p.ay*dt) * 0.995;
    p.x += p.vx*dt*60; p.y += p.vy*dt*60;
    
    // record trail
    p.trail.push({x:p.x,y:p.y}); if(p.trail.length>6) p.trail.shift();
  }

  // Update planetary system (check for planet formation)
  updatePlanetarySystem();

  // Update HUD
  statParticles.textContent = `Particles: ${Math.floor(S.particles).toLocaleString()}`;
  statPps.textContent = `P/s: ${effectivePPS(S.celestialObjects.reduce((a,c)=>a+c.pps,0)).toFixed(2)}`;
  statAge.textContent = `Age: ${Math.floor(S.universeAge)}s`;
  statDM.textContent = `Dark Matter: ${Math.floor(S.darkMatter)}`;
  renderStatsPanel();
  renderUpgrades();
}

function getGravityTotal(){
  return S.upgrades.gravity.level * S.upgrades.gravity.effect + S.upgrades.strongGravity.level * S.upgrades.strongGravity.effect + (S.upgrades.supermassiveBH.level>0?1.5:0.4);
}

function draw(){
  ctx.clearRect(0,0,W,H);

  // Draw orbital rings (only for unformed planets)
  ctx.save();
  ctx.strokeStyle = 'rgba(122,215,255,0.1)';
  ctx.setLineDash([5, 5]);
  for (const planetName in S.planets) {
    const planet = S.planets[planetName];
    if (!planet.formed) {
      ctx.beginPath();
      ctx.arc(CENTER.x(), CENTER.y(), planet.orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // background starfield flicker
  ctx.globalAlpha = 0.25; for(let i=0;i<40;i++){ ctx.fillStyle = '#2a3a6b'; ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1); }
  ctx.globalAlpha = 1;

  // draw trails
  ctx.save();
  for(const p of particles){
    ctx.beginPath();
    for(let i=0;i<p.trail.length;i++){
      const t = p.trail[i];
      if(i===0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
    }
    ctx.strokeStyle = 'rgba(122,215,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();

  // draw particles
  for(const p of particles){
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(zoom, zoom);
    const r = p.type===TYPE.DARK?1.5:1.8;
    const g = ctx.createRadialGradient(0,0,0,0,0,r*2);
    if(p.type===TYPE.DARK){ g.addColorStop(0,'rgba(130,110,200,.6)'); g.addColorStop(1,'rgba(80,60,140,.04)'); }
    else { g.addColorStop(0,'rgba(122,215,255,.9)'); g.addColorStop(1,'rgba(122,215,255,.05)'); }
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // draw celestial objects
  for(const o of S.celestialObjects){ drawCelestial(o); }

  // center ripple
  ctx.save(); ctx.translate(CENTER.x(), CENTER.y()); ctx.scale(zoom, zoom);
  const t = (performance.now()/1000)%1; const rr = 12 + Math.sin(t*Math.PI*2)*1.5;
  ctx.strokeStyle = 'rgba(160,132,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

// ---------------------------
// Save / Load
// ---------------------------
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const wipeBtn = document.getElementById('wipeBtn');

function saveState(){ localStorage.setItem('bmu_save', JSON.stringify(S)); log('Game saved.'); }
function loadState(){ try { const raw = localStorage.getItem('bmu_save'); return raw? JSON.parse(raw): null; } catch(e){ console.warn(e); return null; } }

// ---------------------------
// Initialize the page
// ---------------------------
document.addEventListener('DOMContentLoaded', function() {
  createStars();
  preloadGame();
  
  // Set up launch button
  const launchBtn = document.getElementById('launchBtn');
  launchBtn.disabled = true;
  launchBtn.addEventListener('click', launchGame);
  
  // Set up back button
  document.getElementById('backBtn').addEventListener('click', goBackToHome);
  
  // Set up save/load buttons
  saveBtn.addEventListener('click', saveState);
  loadBtn.addEventListener('click', ()=>{ const L = loadState(); if(L){ S=L; log('Save loaded.', true); } else log('No save found.');});
  wipeBtn.addEventListener('click', ()=>{ if(confirm('Wipe local save and reset?')){ localStorage.removeItem('bmu_save'); S=JSON.parse(JSON.stringify(defaultState)); log('Save wiped.'); }});
});