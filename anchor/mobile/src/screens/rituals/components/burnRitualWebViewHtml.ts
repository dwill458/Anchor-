/**
 * Inlined HTML for the BurnRitual WebView.
 *
 * Kept as a TypeScript string constant instead of a `require()` asset to avoid
 * Metro resolving the .html file to an http:// URI in certain Expo build modes,
 * which Android 9+ blocks with ERR_CLEARTEXT_NOT_PERMITTED.
 */
export const burnRitualWebViewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Burn</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%; height: 100%;
  background: #050208;
  overflow: hidden;
  font-family: 'Georgia', serif;
}

/* Full-screen canvas — always behind everything */
#c {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 1;
}

/* Sigil container — centered, above canvas */
#sigil-wrap {
  position: fixed;
  z-index: 2;
  /* centered via JS after load */
  display: flex;
  align-items: center;
  justify-content: center;
}

#sigil-circle {
  position: relative;
  border-radius: 50%;
  border: 1.5px solid rgba(201,168,76,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 40% 35%,
    rgba(201,168,76,0.12),
    rgba(10,13,20,0.96) 70%
  );
  box-shadow: 0 0 30px rgba(201,168,76,0.15);
  isolation: isolate;
  contain: layout paint;
  will-change: transform, opacity, filter;
}

#sigil-image-shell {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
}

#sigil-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 14%;
  image-rendering: auto;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  filter: drop-shadow(0 0 14px rgba(236,208,120,0.18));
}

#sigil-image-shell img {
  width: 72%;
  height: 72%;
  object-fit: cover;
  padding: 0;
  border-radius: 50%;
  image-rendering: auto;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  filter: drop-shadow(0 0 14px rgba(236,208,120,0.18));
}

#sigil-img {
  opacity: 0.92;
}

#burn-glow,
#burn-veil {
  position: absolute;
  inset: -14%;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}

#burn-glow {
  z-index: 3;
  background:
    radial-gradient(circle at 50% 72%,
      rgba(255,179,69,0.34) 0%,
      rgba(255,99,0,0.22) 24%,
      rgba(93,18,0,0.09) 50%,
      rgba(0,0,0,0) 76%
    );
  filter: blur(18px);
  mix-blend-mode: screen;
}

#burn-veil {
  z-index: 4;
  background:
    linear-gradient(180deg,
      rgba(255,214,153,0) 0%,
      rgba(255,214,153,0.06) 26%,
      rgba(255,176,77,0.18) 38%,
      rgba(255,108,19,0.56) 54%,
      rgba(50,8,0,0.84) 68%,
      rgba(0,0,0,0.98) 100%
    );
  filter: blur(8px) saturate(1.2);
}

/* Status label */
#status {
  position: fixed;
  z-index: 3;
  left: 0; right: 0;
  font-family: 'Georgia', serif;
  font-size: 11px;
  letter-spacing: 0.35em;
  color: #C9A84C;
  text-align: center;
  text-transform: uppercase;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.6s ease;
}
#status.show { opacity: 1; }
</style>
</head>
<body>

<canvas id="c"></canvas>

<div id="sigil-wrap">
  <div id="sigil-circle">
    <div id="sigil-image-shell">
      <!-- RN will inject a base64 image via postMessage, or use the SVG placeholder -->
      <svg id="sigil-img" viewBox="0 0 100 100" fill="none">
        <polygon points="50,10 90,80 10,80" stroke="#C9A84C" stroke-width="1.5" fill="none" opacity="0.75"/>
        <circle cx="50" cy="50" r="20" stroke="#C9A84C" stroke-width="1" fill="none" opacity="0.55"/>
        <line x1="50" y1="10" x2="50" y2="90" stroke="#C9A84C" stroke-width="1" opacity="0.45"/>
        <line x1="10" y1="50" x2="90" y2="50" stroke="#C9A84C" stroke-width="1" opacity="0.45"/>
        <circle cx="50" cy="50" r="4" fill="#C9A84C" opacity="0.9"/>
      </svg>
    </div>
    <div id="burn-glow"></div>
    <div id="burn-veil"></div>
  </div>
</div>

<div id="status">Igniting\u2026</div>

<script>
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  SETUP
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

const SIGIL_SIZE = Math.min(window.innerWidth * 0.58, 240);
const wrap  = document.getElementById('sigil-wrap');
const circle = document.getElementById('sigil-circle');
const imageShell = document.getElementById('sigil-image-shell');
const burnGlow = document.getElementById('burn-glow');
const burnVeil = document.getElementById('burn-veil');
const status = document.getElementById('status');

// Size and center sigil
circle.style.width  = SIGIL_SIZE + 'px';
circle.style.height = SIGIL_SIZE + 'px';
wrap.style.width    = SIGIL_SIZE + 'px';
wrap.style.height   = SIGIL_SIZE + 'px';
wrap.style.left     = (window.innerWidth  - SIGIL_SIZE) / 2 + 'px';
wrap.style.top      = (window.innerHeight - SIGIL_SIZE) / 2 + 'px';

// Status position \u2014 below sigil
status.style.top = (window.innerHeight / 2 + SIGIL_SIZE / 2 + 48) + 'px';

// Canvas full screen
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Sigil center coords (fire spawn point)
const CX = window.innerWidth  / 2;
const CY = window.innerHeight / 2;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  PARTICLE CLASSES
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

class Flame {
  constructor(phase) {
    // Spawn scattered across the bottom half of the sigil
    const spreadX = (Math.random() - 0.5) * SIGIL_SIZE * 0.8;
    const spreadY = SIGIL_SIZE * 0.3 + Math.random() * SIGIL_SIZE * 0.25;
    this.x  = CX + spreadX;
    this.y  = CY + spreadY;
    this.vx = (Math.random() - 0.5) * 3.5;
    this.vy = -(5 + Math.random() * 7);
    // Bigger flames in burning phase
    this.size  = phase === 'burning'
      ? 10 + Math.random() * 22
      :  6 + Math.random() * 14;
    this.life  = 1;
    this.decay = 0.008 + Math.random() * 0.018;
    this.type  = Math.random() < 0.68 ? 'flame' : 'spark';
    this.wobble      = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.08 + Math.random() * 0.14;
  }

  update() {
    this.wobble += this.wobbleSpeed;
    this.vx += Math.sin(this.wobble) * 0.45;
    this.vy -= 0.12;            // upward acceleration
    this.x  += this.vx;
    this.y  += this.vy;
    this.life -= this.decay;
    this.size *= 0.975;
  }

  draw() {
    if (this.life <= 0) return;
    const a = this.life;

    if (this.type === 'flame') {
      const g = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size
      );
      if (this.life > 0.5) {
        // Young flame \u2014 white-hot \u2192 amber \u2192 red
        g.addColorStop(0,    \`rgba(255,255,230,\${a})\`);
        g.addColorStop(0.2,  \`rgba(255,230,80,\${a * 0.9})\`);
        g.addColorStop(0.55, \`rgba(255,90,0,\${a * 0.6})\`);
        g.addColorStop(1,    \`rgba(160,10,0,0)\`);
      } else {
        // Dying flame \u2014 orange \u2192 dark red
        g.addColorStop(0,   \`rgba(255,140,0,\${a * 0.85})\`);
        g.addColorStop(0.5, \`rgba(200,30,0,\${a * 0.45})\`);
        g.addColorStop(1,   \`rgba(100,0,0,0)\`);
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      // Spark \u2014 tiny bright dot with corona
      const r = this.size * 0.15;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = \`rgba(255,250,120,\${a})\`;
      ctx.fill();
      // Glow around spark
      const sg = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 5);
      sg.addColorStop(0, \`rgba(255,200,50,\${a * 0.35})\`);
      sg.addColorStop(1, \`rgba(255,100,0,0)\`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 5, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
    }
  }
}

class Ember {
  constructor() {
    // Drift up from around and below the sigil
    this.x     = CX + (Math.random() - 0.5) * window.innerWidth * 0.9;
    this.y     = CY + SIGIL_SIZE * 0.4 + Math.random() * SIGIL_SIZE * 0.3;
    this.vx    = (Math.random() - 0.5) * 1.5;
    this.vy    = -(0.4 + Math.random() * 2.2);
    this.life  = 0.4 + Math.random() * 0.6;
    this.decay = 0.002 + Math.random() * 0.005;
    this.size  = 1 + Math.random() * 3;
    this.hot   = Math.random() < 0.55;
  }

  update() {
    // Gentle wind drift
    this.x += this.vx + Math.sin(Date.now() * 0.0007 + this.y * 0.01) * 0.4;
    this.y += this.vy;
    this.vy -= 0.004;
    this.life -= this.decay;
  }

  draw() {
    if (this.life <= 0) return;
    const a = this.life;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.hot
      ? \`rgba(255,160,40,\${a})\`
      : \`rgba(200,80,10,\${a * 0.7})\`;
    ctx.fill();
    if (this.hot) {
      const eg = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 4
      );
      eg.addColorStop(0, \`rgba(255,100,0,\${a * 0.25})\`);
      eg.addColorStop(1, \`rgba(255,40,0,0)\`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = eg;
      ctx.fill();
    }
  }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  STATE
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let phase   = 'ignite';  // ignite | burning | embers | done
let flames  = [];
let embers  = [];
let frameId = null;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  SPAWN HELPERS
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function spawnFlames() {
  const counts = { ignite: 5, burning: 16, embers: 6, done: 0 };
  const n = counts[phase] || 0;
  for (let i = 0; i < n; i++) flames.push(new Flame(phase));
}

function spawnEmbers() {
  const counts = { ignite: 1, burning: 4, embers: 2, done: 0 };
  const n = counts[phase] || 0;
  for (let i = 0; i < n; i++) embers.push(new Ember());
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  BACKGROUND HEAT GLOW
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function drawHeatGlow() {
  const intensity = phase === 'burning' ? 1.0
                  : phase === 'ignite'  ? 0.45
                  : phase === 'embers'  ? 0.3
                  : 0;
  if (intensity === 0) return;

  // Deep glow from below sigil
  const g1 = ctx.createRadialGradient(
    CX, CY + SIGIL_SIZE * 0.6, 10,
    CX, CY + SIGIL_SIZE * 0.6, window.innerHeight * 0.7
  );
  g1.addColorStop(0,   \`rgba(220,70,0,\${0.22 * intensity})\`);
  g1.addColorStop(0.35,\`rgba(150,30,0,\${0.12 * intensity})\`);
  g1.addColorStop(0.7, \`rgba(80,10,0,\${0.06 * intensity})\`);
  g1.addColorStop(1,   \`rgba(0,0,0,0)\`);
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tighter core glow at sigil base
  const g2 = ctx.createRadialGradient(CX, CY + 30, 5, CX, CY + 30, SIGIL_SIZE);
  g2.addColorStop(0,   \`rgba(255,120,0,\${0.18 * intensity})\`);
  g2.addColorStop(0.5, \`rgba(200,50,0,\${0.08 * intensity})\`);
  g2.addColorStop(1,   \`rgba(0,0,0,0)\`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  MAIN RENDER LOOP
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawHeatGlow();
  spawnFlames();
  spawnEmbers();

  // Cull dead particles
  flames = flames.filter(p => p.life > 0);
  embers = embers.filter(p => p.life > 0);

  // Draw order: embers (background) \u2192 flames (foreground)
  embers.forEach(p => { p.update(); p.draw(); });
  flames.forEach(p => { p.update(); p.draw(); });

  if (phase !== 'done') {
    frameId = requestAnimationFrame(tick);
  }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  SIGIL BURN ANIMATION (pure CSS keyframes
//  injected at runtime so timing is exact)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function applySigilBurnCSS() {
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes sigilShake {
      0%,100% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(-1.4deg) scale(1.02); }
      75% { transform: rotate(1.4deg) scale(0.985); }
    }
    @keyframes sigilFrameBurn {
      0% { transform: scale(1); opacity: 1; filter: brightness(1) saturate(1); }
      18% { transform: scale(1.03); opacity: 1; filter: brightness(1.28) saturate(1.12); }
      48% { transform: scale(0.98); opacity: 1; filter: brightness(1.46) saturate(0.94); }
      78% { transform: scale(0.84); opacity: 0.82; filter: brightness(1.88) saturate(0.18) blur(1px); }
      100% { transform: scale(0.62); opacity: 0; filter: brightness(2.2) saturate(0) blur(6px); }
    }
    @keyframes sigilArtBurn {
      0% { transform: scale(1) translateY(0); opacity: 1; filter: brightness(1) saturate(1) contrast(1.04); }
      16% { transform: scale(1.02) translateY(0); opacity: 1; filter: brightness(1.2) saturate(1.08) contrast(1.06); }
      40% { transform: scale(0.995) translateY(-2%); opacity: 0.98; filter: brightness(1.42) saturate(0.88) contrast(1.1); }
      68% { transform: scale(0.92) translateY(-8%); opacity: 0.74; filter: brightness(1.7) saturate(0.34) contrast(1.14) blur(0.6px); }
      100% { transform: scale(0.74) translateY(-18%); opacity: 0; filter: brightness(2.35) saturate(0) contrast(1.18) blur(3px); }
    }
    @keyframes burnVeilSweep {
      0% { opacity: 0; transform: translateY(46%) scale(1.12) rotate(0deg); }
      18% { opacity: 0.18; }
      44% { opacity: 0.82; transform: translateY(12%) scale(1.02) rotate(-2deg); }
      72% { opacity: 0.94; transform: translateY(-24%) scale(0.96) rotate(1deg); }
      100% { opacity: 0; transform: translateY(-54%) scale(0.88) rotate(2deg); }
    }
    @keyframes burnGlowPulse {
      0%, 100% { opacity: 0; transform: scale(0.78); }
      20% { opacity: 0.42; }
      55% { opacity: 0.88; transform: scale(1.04); }
    }
  \`;
  document.head.appendChild(style);
}
applySigilBurnCSS();

function resetAnimation(node) {
  if (!node) return;
  node.style.animation = 'none';
  void node.offsetHeight;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  SEQUENCE CONTROLLER
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var pendingTimers = [];

function cancelPendingTimers() {
  pendingTimers.forEach(function(id) { clearTimeout(id); });
  pendingTimers = [];
  cancelAnimationFrame(frameId);
}

function runSequence() {
  cancelPendingTimers();
  // Show status
  status.textContent = 'Igniting\u2026';
  status.classList.add('show');
  resetAnimation(circle);
  resetAnimation(imageShell);
  resetAnimation(burnGlow);
  resetAnimation(burnVeil);
  burnGlow.style.opacity = '0';
  burnVeil.style.opacity = '0';

  // Phase 1 \u2014 ignite shake (0\u2013900ms)
  phase = 'ignite';
  circle.style.animation = 'sigilShake 0.22s ease-in-out infinite';
  tick();

  // Phase 2 \u2014 full burn (900ms)
  pendingTimers.push(setTimeout(() => {
    phase = 'burning';
    status.textContent = 'Releasing\u2026';
    circle.style.animation = 'sigilFrameBurn 3.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards';
    imageShell.style.animation = 'sigilArtBurn 3.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards';
    burnGlow.style.animation = 'burnGlowPulse 1.08s ease-in-out 3';
    burnVeil.style.animation = 'burnVeilSweep 3.2s ease forwards';
  }, 900));

  // Phase 3 \u2014 embers (3800ms)
  pendingTimers.push(setTimeout(() => {
    phase = 'embers';
    status.textContent = 'It is done.';
  }, 3800));

  // Phase 4 \u2014 done (5800ms) \u2014 notify React Native
  pendingTimers.push(setTimeout(() => {
    phase = 'done';
    cancelAnimationFrame(frameId);
    status.classList.remove('show');

    // Tell RN the burn is complete
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'burnComplete' }));
    }
  }, 5800));
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  RN \u2194 WEBVIEW BRIDGE
//  RN sends: { cmd: 'start', sigilUri: '...', fallbackSigilUri: '...' }
//  WebView sends back: { event: 'burnComplete' }
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function replaceSigilImage(primaryUri, fallbackUri) {
  const initialUri = primaryUri || fallbackUri;
  if (!initialUri) return;

  const img = document.createElement('img');
  img.decoding = 'async';
  img.alt = '';

  let attemptedFallback = false;
  img.onload = () => {
    imageShell.innerHTML = '';
    imageShell.appendChild(img);
  };
  img.onerror = () => {
    if (!attemptedFallback && fallbackUri && img.src !== fallbackUri) {
      attemptedFallback = true;
      img.src = fallbackUri;
    }
  };

  img.src = initialUri;
}

window.addEventListener('message', (e) => {
  try {
    const msg = JSON.parse(e.data);
    if (msg.cmd === 'cleanup') {
      cancelPendingTimers();
      return;
    }
    if (msg.cmd === 'start') {
      // Replace placeholder with the anchor image and fall back to SVG if needed.
      replaceSigilImage(msg.sigilUri, msg.fallbackSigilUri);
      runSequence();
    }
  } catch(_) {}
});

// Also support direct auto-start for standalone testing in browser
if (!window.ReactNativeWebView) {
  pendingTimers.push(setTimeout(() => runSequence(), 400));
}
</script>
</body>
</html>`;
