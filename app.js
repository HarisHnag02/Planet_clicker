// app.js - main thread: UI, rendering, input handling, and communicating with physics.worker.js

/* Globals & DOM */
const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');

let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let W = 800, H = 600;
function resize(){
  const rect = canvas.getBoundingClientRect();
  W = Math.max(320, rect.width);
  H = Math.max(200, rect.height);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
new ResizeObserver(resize).observe(canvas);
resize();

/* UI elements */
const statParticles = document.getElementById('statParticles');
const statPps = document.getElementById('statPps');
const statAge = document.getElementById('statAge');
const statDM = document.getElementById('statDM');
const upgradesEl = document.getElementById('upgrades');
const logBox = document.getElementById('log');
const logCountEl = document.getElementById('logCount');
const clearLogBtn = document.getElementById('clearLog');

const clickBtn = document.getElementById('clickBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const wipeBtn = document.getElementById('wipeBtn');
const prestigeBtn = document.getElementById('prestigeBtn');
const adDouble = document.getElementById('adDoubleParticles');
const adEvo = document.getElementById('adInstantFormation');
const adDM = document.getElementById('adBonusDM');
const zoomSlider = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');
const timeScaleEl = document.getElementById('timeScale');
const timeScaleVal = document.getElementById('timeScaleVal');

let zoom = zoomSlider ? parseFloat(zoomSlider.value) : 1;
if(zoomSlider) zoomSlider.addEventListener('input', ()=>{ zoom = parseFloat(zoomSlider.value); zoomVal.textContent = zoom.toFixed(2); });

let timeScale = timeScaleEl ? parseFloat(timeScaleEl.value) : 1;
if(timeScaleEl) timeScaleEl.addEventListener('input', ()=>{ timeScale = parseFloat(timeScaleEl.value); timeScaleVal.textContent = timeScaleEl.value; });

/* View state mirror (keeps rendering data) */
let View = {
  particlesCount: 0,
  pps: 0,
  darkMatter: 0,
  particles: [], // sampled particles
  celestialObjects: []
};

/* Start worker */
const worker = new Worker('physics.worker.js');
worker.postMessage({ cmd:'init', w: W, h: H });
worker.postMessage({ cmd:'start', opts:{ w: W, h: H, timeScale } });

/* Handle worker messages */
worker.addEventListener('message', (ev)=>{
  const d = ev.data;
  if(!d) return;
  if(d.type === 'state'){
    View.particlesCount = d.particlesCount;
    View.pps = d.pps;
    View.darkMatter = d.darkMatter;
    View.particles = d.particles;
    View.celestialObjects = d.celestialObjects;
  } else if(d.type === 'log'){
    appendLog(d.msg, d.important);
  } else if(d.type === 'autosave'){
    try{ localStorage.setItem('bmu_autosave', d.data); appendLog('Autosave performed.'); }catch(e){}
  } else if(d.type === 'file'){
    // optional: offer file download; for now store in localStorage
    localStorage.setItem(d.name, d.data);
    appendLog('Worker provided saved snapshot.');
  }
});

/* UI -> worker commands */
function doClick(){ worker.postMessage({ cmd:'click' }); }
clickBtn.addEventListener('mousedown', ()=>{ doClick(); hold = true; });
let hold = false;
clickBtn.addEventListener('mouseup', ()=>{ hold = false; });
clickBtn.addEventListener('mouseleave', ()=>{ hold = false; });
clickBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); doClick(); hold = true; });
clickBtn.addEventListener('touchend', ()=>{ hold = false; });

let holdTimer = 0;
function handleHoldAuto(now){
  if(hold && now - holdTimer > 90){ doClick(); holdTimer = now; }
}

/* upgrades UI interaction forwarded to worker */
function buyUpgrade(key){ worker.postMessage({ cmd:'buy', key }); }

/* ad buttons */
adDouble && adDouble.addEventListener('click', ()=> worker.postMessage({ cmd:'ad', id:'double' }));
adEvo && adEvo.addEventListener('click', ()=> worker.postMessage({ cmd:'ad', id:'instant' }));
adDM && adDM.addEventListener('click', ()=> worker.postMessage({ cmd:'ad', id:'dm' }));

/* Save/load/wipe via worker */
saveBtn && saveBtn.addEventListener('click', ()=> worker.postMessage({ cmd:'save' }));
loadBtn && loadBtn.addEventListener('click', ()=> {
  const raw = localStorage.getItem('bmu_save');
  if(raw) worker.postMessage({ cmd:'loadData', data: raw });
  else appendLog('No local save file found.');
});
wipeBtn && wipeBtn.addEventListener('click', ()=> { if(confirm('Wipe save?')) worker.postMessage({ cmd:'wipe' }); });

/* prestige */
prestigeBtn && prestigeBtn.addEventListener('click', ()=> {
  if(confirm('Reset universe for Dark Matter?')) worker.postMessage({ cmd:'prestige' });
});

/* clear log */
clearLogBtn && clearLogBtn.addEventListener('click', ()=>{ logBox.innerHTML=''; logCountEl.textContent='0'; });

/* Append log UI */
let logCount = 0;
function appendLog(msg, important=false){
  const t = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.innerHTML = `<span class="r">[${t}]</span> ${msg}`;
  logBox.appendChild(div); logBox.scrollTop = logBox.scrollHeight;
  logCount++; logCountEl.textContent = logCount;
  if(important){
    document.title = '★ Button Masher Universe';
    setTimeout(()=>document.title='Button Masher Universe',900);
  }
}

/* Rendering loop (uses View snapshot) */
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  handleHoldAuto(now);

  // clear
  ctx.clearRect(0,0,W,H);

  // star dust background
  ctx.globalAlpha = 0.12;
  for(let i=0;i<40;i++){ ctx.fillStyle = '#22467a'; ctx.fillRect((i*92)%W, (i*37)%H, 1,1); }
  ctx.globalAlpha = 1;

  // draw sampled particles
  for(const p of View.particles){
    ctx.beginPath();
    const r = p.type===2 ? 1.2 : 1.6;
    const grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2);
    if(p.type===2){ grad.addColorStop(0,'rgba(140,110,200,0.85)'); grad.addColorStop(1,'rgba(70,50,140,0.04)'); }
    else { grad.addColorStop(0,'rgba(122,215,255,0.95)'); grad.addColorStop(1,'rgba(122,215,255,0.04)'); }
    ctx.fillStyle = grad; ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
  }

  // draw celestial objects
  for(const o of View.celestialObjects){
    drawCelestial(o);
  }

  // update HUD (mirror from worker)
  statParticles.textContent = `Particles: ${Math.floor(View.particlesCount).toLocaleString()}`;
  statPps.textContent = `P/s: ${View.pps.toFixed(2)}`;
  statDM.textContent = `Dark Matter: ${Math.floor(View.darkMatter)}`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* drawCelestial (simple main-thread drawing) */
function drawCelestial(o){
  ctx.save();
  ctx.translate(o.x, o.y);
  const r = o.radius || 8;
  let grad = ctx.createRadialGradient(0,0,0,0,0,r);
  if(o.type === 'Cluster'){ grad.addColorStop(0,'rgba(122,215,255,0.7)'); grad.addColorStop(1,'rgba(122,215,255,0.05)'); }
  else if(o.type === 'Protostar'){ grad.addColorStop(0,'rgba(255,220,160,0.95)'); grad.addColorStop(1,'rgba(255,210,120,0.06)'); }
  else if(o.type === 'Main Sequence Star'){ grad.addColorStop(0,'rgba(255,240,200,1)'); grad.addColorStop(1,'rgba(255,180,80,0.12)'); }
  else{ grad.addColorStop(0,'rgba(200,220,255,1)'); grad.addColorStop(1,'rgba(140,210,255,0.12)'); }
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0,0,r*zoom,0,Math.PI*2); ctx.fill();

  // planets if present (o.planets)
  if(o.planets && o.planets.length){
    for(const p of o.planets){
      const px = Math.cos(p.angle) * p.dist;
      const py = Math.sin(p.angle) * p.dist;
      ctx.beginPath(); ctx.fillStyle = p.color; ctx.arc(px,py,p.size*zoom,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

/* Resize handler: inform worker */
window.addEventListener('resize', ()=>{ resize(); worker.postMessage({ cmd:'resize', w: W, h: H }); });

/* Expose small debug */
window.BMU = { view: View, worker };

/* END app.js */
