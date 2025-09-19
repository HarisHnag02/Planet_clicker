// Physics calculations in a Web Worker for better performance
// This worker handles the intensive physics calculations

// Message types
const MESSAGE_TYPES = {
  INIT: 'INIT',
  UPDATE: 'UPDATE',
  RESULT: 'RESULT',
  ADD_PARTICLES: 'ADD_PARTICLES'
};

// Particle system
let particles = [];
let pool = [];
const MAX_PARTICLES = 3000;

// Game state (partial)
let gameState = {
  celestialObjects: [],
  upgrades: {
    gravity: { level: 0, effect: 0.1 },
    strongGravity: { level: 0, effect: 0.3 },
    supermassiveBH: { level: 0 }
  }
};

// Particle types
const TYPE = { BASIC: 0, STELLAR: 1, DARK: 2 };

// Create a particle
function makeParticle(x, y, type = TYPE.BASIC, orbitTarget = 60, angle = Math.random() * Math.PI * 2) {
  const p = pool.pop() || {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, 
    type: TYPE.BASIC, trail: [], orbitTarget: 60, angle: 0
  };
  
  p.x = x;
  p.y = y;
  p.vx = (Math.random() - 0.5) * 0.4;
  p.vy = (Math.random() - 0.5) * 0.4;
  p.ax = 0;
  p.ay = 0;
  p.type = type;
  p.trail.length = 0;
  p.orbitTarget = orbitTarget;
  p.angle = angle;
  
  particles.push(p);
  return p;
}

// Release a particle back to the pool
function releaseParticle(p) {
  const i = particles.indexOf(p);
  if (i >= 0) particles.splice(i, 1);
  pool.push(p);
}

// Calculate gravity total
function getGravityTotal() {
  return gameState.upgrades.gravity.level * gameState.upgrades.gravity.effect + 
         gameState.upgrades.strongGravity.level * gameState.upgrades.strongGravity.effect + 
         (gameState.upgrades.supermassiveBH.level > 0 ? 1.5 : 0.4);
}

// Process physics update
function processPhysics(dt, centerX, centerY) {
  const G = getGravityTotal();
  
  for (const p of particles) {
    p.ax = p.ay = 0;
    
    // Orbital behavior for particles
    if (p.orbitTarget) {
      const dx = centerX - p.x;
      const dy = centerY - p.y;
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
    const dx = centerX - p.x;
    const dy = centerY - p.y;
    let d2 = dx * dx + dy * dy;
    const d = Math.max(6, Math.sqrt(d2));
    const f = (G) / (d2 + 50);
    p.ax += f * dx;
    p.ay += f * dy;
    
    // Celestial objects pulls
    for (const o of gameState.celestialObjects) {
      const dx2 = o.x - p.x;
      const dy2 = o.y - p.y;
      const dd2 = dx2 * dx2 + dy2 * dy2;
      const dd = Math.max(6, Math.sqrt(dd2));
      const ff = (G * o.mass * 0.02) / (dd2 + 100);
      p.ax += ff * dx2;
      p.ay += ff * dy2;
    }
    
    p.vx = (p.vx + p.ax * dt) * 0.995; // light damping
    p.vy = (p.vy + p.ay * dt) * 0.995;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    
    // record trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
  }
  
  return particles;
}

// Handle messages from the main thread
self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case MESSAGE_TYPES.INIT:
      gameState = { ...gameState, ...data.gameState };
      break;
      
    case MESSAGE_TYPES.UPDATE:
      const { dt, centerX, centerY } = data;
      const updatedParticles = processPhysics(dt, centerX, centerY);
      
      // Send back the updated particles
      self.postMessage({
        type: MESSAGE_TYPES.RESULT,
        data: { particles: updatedParticles }
      });
      break;
      
    case MESSAGE_TYPES.ADD_PARTICLES:
      const { count, x, y, orbitRadius } = data;
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = orbitRadius + (Math.random() * 20 - 10);
        const particleX = x + Math.cos(angle) * distance;
        const particleY = y + Math.sin(angle) * distance;
        makeParticle(particleX, particleY, TYPE.BASIC, orbitRadius, angle);
      }
      break;
  }
});