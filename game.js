const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const livesEl = document.getElementById("lives");
const timeEl  = document.getElementById("time");
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const top3El  = document.getElementById("top3");

// =====================
// ASSETS (MIMI)
// =====================
const dinoImg = new Image();
dinoImg.src = "img/mimi.svg"; // mismo fichero que usas en el <link rel="icon"...>
let dinoReady = false;
dinoImg.onload = () => (dinoReady = true);

// Si tu dino es pixel-art, esto ayuda (si es foto, no pasa nada)
ctx.imageSmoothingEnabled = false;

// =====================
// INPUT
// =====================
const keys = new Set();
window.addEventListener("keydown", (e) => {
  const block = ["ArrowLeft","ArrowRight","ArrowUp","Space","ShiftLeft","KeyA","KeyD","KeyW","KeyR"];
  if (block.includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

// =====================
// CONFIG
// =====================
const GRAVITY = 1800;
const FLOOR_Y = 480;

const MOVE_ACCEL = 2400;
const MAX_SPEED  = 420;
const FRICTION   = 2200;
const JUMP_V     = 650;

const COYOTE_MS  = 90;

const DASH_SPEED = 900;
const DASH_TIME  = 0.10;

const TIME_LIMIT  = 30.0;
const START_LIVES = 3;

const STORAGE_KEY = "mimi_rex_top3_v2";

// =====================
// WORLD
// =====================
const platforms = [
  { x: 0,    y: FLOOR_Y, w: 2600, h: 60, type: "solid" },
  { x: 260,  y: 400,     w: 180,  h: 20, type: "solid" },
  { x: 520,  y: 340,     w: 180,  h: 20, type: "solid" },
  { x: 820,  y: 300,     w: 220,  h: 20, type: "solid" },

  // Plataforma que cae
  { x: 1180, y: 360, startY: 360, w: 220, h: 20, type: "fall", triggered:false, fallDelay:0.25, fallTimer:0, vy:0, active:true },

  { x: 1500, y: 320,     w: 240,  h: 20, type: "solid" },
  { x: 1820, y: 380,     w: 180,  h: 20, type: "solid" },
];

// Trampa: pinchos
const spikes = [
  { x: 430,  y: FLOOR_Y - 18, w: 60, h: 18 },
  { x: 1040, y: FLOOR_Y - 18, w: 70, h: 18 },
  { x: 1650, y: FLOOR_Y - 18, w: 80, h: 18 },
];

// Barras/obstáculos del camino
const bars = [
  { x: 360,  y: FLOOR_Y - 70, w: 22, h: 70 },
  { x: 950,  y: FLOOR_Y - 55, w: 26, h: 55 },
  { x: 1460, y: FLOOR_Y - 80, w: 22, h: 80 },
  { x: 1980, y: FLOOR_Y - 60, w: 26, h: 60 },
];

// Trampa: charco resbaladizo
const slime = [
  { x: 700,  y: FLOOR_Y - 10, w: 90,  h: 10 },
  { x: 1380, y: FLOOR_Y - 10, w: 110, h: 10 },
];

// 🎀 LAZOS
let bows = [
  { x: 300, y: 360, r: 12, taken:false },
  { x: 350, y: 360, r: 12, taken:false },
  { x: 560, y: 300, r: 12, taken:false },
  { x: 610, y: 300, r: 12, taken:false },
  { x: 840, y: 260, r: 12, taken:false },
  { x: 900, y: 260, r: 12, taken:false },
  { x: 1210, y: 320, r: 12, taken:false },
  { x: 1260, y: 320, r: 12, taken:false },
  { x: 1540, y: 280, r: 12, taken:false },
  { x: 1600, y: 280, r: 12, taken:false },
  { x: 1860, y: 340, r: 12, taken:false },
];

// Meta final
const goal = { x: 2450, y: FLOOR_Y - 90, w: 30, h: 90 };

// =====================
// PLAYER
// =====================
const player = {
  x: 120, y: 200, w: 56, h: 56,
  vx: 0, vy: 0,
  onGround: false,
  facing: 1,
  dashReady: true,
  dashCooldown: 0,
};

let coyote = 0;
let dashTimer = 0;
let camX = 0;

let lives = START_LIVES;
let timeLeft = TIME_LIMIT;
let score = 0;

let startTime = 0;
let endTime = null;
let status = "PLAYING"; // PLAYING | WIN | LOSE
let respawnLock = 0;

let onSlime = false;

// =====================
// TOP 3 (Nombre + Tiempo + Lazos)
// =====================
function loadTop3() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveTop3(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function formatTime(t) {
  return `${t.toFixed(2)}s`;
}
function renderTop3() {
  const top = loadTop3();
  top3El.innerHTML = "";
  if (!top.length) {
    const li = document.createElement("li");
    li.textContent = "Aún no hay marcas ✨";
    top3El.appendChild(li);
    bestEl.textContent = "—";
    return;
  }
  top.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = `${e.name} — ${formatTime(e.time)} — 🎀 ${e.score}`;
    top3El.appendChild(li);
  });
  bestEl.textContent = `${top[0].name} ${formatTime(top[0].time)} (🎀 ${top[0].score})`;
}
function submitResult(name, timeSeconds, pts) {
  const top = loadTop3();
  top.push({ name, time: timeSeconds, score: pts });
  top.sort((a,b) => (a.time - b.time) || (b.score - a.score));
  saveTop3(top.slice(0,3));
  renderTop3();
}

// =====================
// HELPERS
// =====================
function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
function circleRectCollide(c, r) {
  const closestX = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const closestY = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  return (dx*dx + dy*dy) <= (c.r*c.r);
}
function updateHUD() {
  livesEl.textContent = String(lives);
  timeEl.textContent  = timeLeft.toFixed(1);
  scoreEl.textContent = String(score);
}

// =====================
// RESET / WIN / LOSE
// =====================
function resetRun() {
  lives = START_LIVES;
  timeLeft = TIME_LIMIT;
  score = 0;

  status = "PLAYING";
  endTime = null;
  respawnLock = 0;

  player.x = 120; player.y = 200;
  player.vx = 0; player.vy = 0;
  player.facing = 1;
  player.dashReady = true;
  player.dashCooldown = 0;

  coyote = 0;
  dashTimer = 0;

  bows.forEach(b => b.taken = false);

  for (const p of platforms) {
    if (p.type === "fall") {
      p.triggered = false;
      p.fallTimer = 0;
      p.vy = 0;
      p.active = true;
      p.y = p.startY ?? p.y;
    }
  }

  startTime = performance.now();
  updateHUD();
}

function loseLife() {
  if (respawnLock > 0 || status !== "PLAYING") return;

  lives -= 1;
  respawnLock = 0.6;

  if (lives <= 0) {
    status = "LOSE";
    endTime = performance.now();
  } else {
    player.x = 120; player.y = 200;
    player.vx = 0; player.vy = 0;
    dashTimer = 0;
    coyote = 0;
  }
  updateHUD();
}

function winRun() {
  if (status !== "PLAYING") return;

  status = "WIN";
  endTime = performance.now();
  const elapsed = (endTime - startTime) / 1000;

  let name = prompt("💗 ¡MIMI REX lo ha logrado! Escribe tu nombre en el Ranking:", "Jugadoquett");
  if (!name) name = "Jugadoquett";
  name = name.trim().slice(0, 16) || "Jugadoquett";

  submitResult(name, elapsed, score);
}

// =====================
// PHYSICS & COLLISIONS
// =====================
let last = performance.now();
let dt = 0;

function resolveCollisions(entity) {
  entity.onGround = false;
  onSlime = false;

  // Y vs plataformas
  entity.y += entity.vy * dt;
  for (const p of platforms) {
    if (p.active === false) continue;

    if (aabb(entity, p)) {
      if (entity.vy > 0) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
        coyote = COYOTE_MS;

        if (p.type === "fall" && !p.triggered) {
          p.triggered = true;
          p.fallTimer = p.fallDelay;
        }
      } else if (entity.vy < 0) {
        entity.y = p.y + p.h;
        entity.vy = 0;
      }
    }
  }

  // Y vs barras
  for (const b of bars) {
    if (aabb(entity, b)) {
      if (entity.vy > 0) {
        entity.y = b.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
        coyote = COYOTE_MS;
      } else if (entity.vy < 0) {
        entity.y = b.y + b.h;
        entity.vy = 0;
      }
    }
  }

  // X vs plataformas
  entity.x += entity.vx * dt;
  for (const p of platforms) {
    if (p.active === false) continue;

    if (aabb(entity, p)) {
      if (entity.vx > 0) entity.x = p.x - entity.w;
      else if (entity.vx < 0) entity.x = p.x + p.w;
      entity.vx = 0;
    }
  }

  // X vs barras
  for (const b of bars) {
    if (aabb(entity, b)) {
      if (entity.vx > 0) entity.x = b.x - entity.w;
      else if (entity.vx < 0) entity.x = b.x + b.w;
      entity.vx = 0;
    }
  }

  // slime
  const feet = { x: entity.x, y: entity.y + entity.h - 2, w: entity.w, h: 4 };
  for (const s of slime) {
    if (aabb(feet, s)) { onSlime = true; break; }
  }
}

function updateFallingPlatforms() {
  for (const p of platforms) {
    if (p.type !== "fall") continue;
    if (p.active === false) continue;

    if (p.triggered) {
      if (p.fallTimer > 0) {
        p.fallTimer -= dt;
      } else {
        p.vy += 2200 * dt;
        p.y += p.vy * dt;
        if (p.y > canvas.height + 300) p.active = false;
      }
    }
  }
}

// =====================
// LOOP
// =====================
function update() {
  const now = performance.now();
  dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (keys.has("KeyR")) {
    keys.delete("KeyR");
    resetRun();
  }

  if (status === "PLAYING") {
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft <= 0) {
      status = "LOSE";
      endTime = performance.now();
    }

    if (respawnLock > 0) respawnLock -= dt;

    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.dashCooldown <= 0) player.dashReady = true;

    const left  = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");

    const feetNow = { x: player.x, y: player.y + player.h - 2, w: player.w, h: 4 };
    onSlime = slime.some(s => aabb(feetNow, s));

    if (dashTimer <= 0) {
      if (left)  { player.vx -= MOVE_ACCEL * dt; player.facing = -1; }
      if (right) { player.vx += MOVE_ACCEL * dt; player.facing = 1; }

      const localFriction = onSlime ? 500 : FRICTION;

      if (!left && !right) {
        const f = localFriction * dt;
        if (Math.abs(player.vx) <= f) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * f;
      }

      player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));
    }

    if (!player.onGround) coyote = Math.max(0, coyote - (dt * 1000));

    const jumpPressed = keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW");
    if (jumpPressed && (player.onGround || coyote > 0)) {
      player.vy = -JUMP_V;
      player.onGround = false;
      coyote = 0;
      keys.delete("Space"); keys.delete("ArrowUp"); keys.delete("KeyW");
    }

    const dashPressed = keys.has("ShiftLeft");
    if (dashPressed && player.dashReady && dashTimer <= 0) {
      dashTimer = DASH_TIME;
      player.vx = player.facing * DASH_SPEED;
      player.vy = 0;
      player.dashReady = false;
      player.dashCooldown = 0.6;
      keys.delete("ShiftLeft");
    }
    if (dashTimer > 0) dashTimer -= dt;

    if (dashTimer <= 0) player.vy += GRAVITY * dt;

    updateFallingPlatforms();
    resolveCollisions(player);

    if (player.y > canvas.height + 200) loseLife();

    for (const sp of spikes) {
      if (aabb(player, sp)) { loseLife(); break; }
    }

    // 🎀 recoger lazos
    const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const b of bows) {
      if (b.taken) continue;
      if (circleRectCollide(b, playerRect)) {
        b.taken = true;
        score += 1;
      }
    }

    if (aabb(player, goal)) winRun();

    camX = player.x - 200;
    updateHUD();
  }

  draw();
  requestAnimationFrame(update);
}

// =====================
// DRAW (COQUETTE)
// =====================
function drawSoftShadow(x, y, w, h, alpha = 0.22) {
  ctx.save();
  ctx.fillStyle = `rgba(60, 20, 50, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h + 8, w * 0.45, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCloudPlatform(p) {
  // sombra flotante
  drawSoftShadow(p.x, p.y, p.w, p.h, 0.18);

  // cuerpo nube
  const baseY = p.y;
  const baseH = p.h;
  const r = Math.min(18, baseH);

  ctx.save();

  // degradado suave
  const grad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
  if (p.type === "fall") {
    grad.addColorStop(0, "rgba(255, 190, 230, 0.95)");
    grad.addColorStop(1, "rgba(255, 220, 245, 0.95)");
  } else {
    grad.addColorStop(0, "rgba(255, 240, 250, 0.98)");
    grad.addColorStop(1, "rgba(255, 220, 240, 0.95)");
  }

  // rect base redondeado
  ctx.fillStyle = grad;
  roundRect(p.x, baseY, p.w, baseH, r);
  ctx.fill();

  // borde sutil rosa
  ctx.strokeStyle = "rgba(255, 105, 217, 0.35)";
  ctx.lineWidth = 1.4;
  roundRect(p.x, baseY, p.w, baseH, r);
  ctx.stroke();

  // brillo
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "rgba(252, 156, 196, 1)";
  roundRect(p.x + 8, baseY + 4, Math.max(0, p.w - 16), 6, 6);
  ctx.fill();

  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSpikes(s) {
  // pinchos “cute” (no agresivo)
  ctx.fillStyle = "rgba(250, 218, 242, 0.10)";
  ctx.fillRect(s.x, s.y, s.w, s.h);

  ctx.fillStyle = "rgba(120, 30, 90, 0.60)";
  const spikesN = Math.max(3, Math.floor(s.w / 12));
  for (let i=0;i<spikesN;i++){
    const w = s.w / spikesN;
    const sx = s.x + i*w;
    ctx.beginPath();
    ctx.moveTo(sx, s.y + s.h);
    ctx.lineTo(sx + w/2, s.y);
    ctx.lineTo(sx + w, s.y + s.h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSlime(s) {
  ctx.fillStyle = "rgba(81, 26, 176, 0)";
  ctx.fillRect(s.x, s.y, s.w, s.h);

  ctx.strokeStyle = "rgba(255, 105, 217, 0)";
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x, s.y, s.w, s.h);
}

function drawGoal(g) {
  // poste
  ctx.fillStyle = "rgba(126, 97, 115, 0.3)";
  ctx.fillRect(g.x, g.y, g.w, g.h);

  // banderita rosa + mini lazo
  ctx.fillStyle = "rgba(172, 35, 134, 0.85)";
  ctx.fillRect(g.x + g.w, g.y + 10, 56, 22);

  ctx.fillStyle = "rgba(220, 131, 180, 0.9)";
  ctx.fillRect(g.x + g.w + 8, g.y + 16, 10, 10);
}

function drawBow(b) {
  if (b.taken) return;

  const t = performance.now() / 1000;
  const bob = Math.sin(t * 3 + b.x * 0.01) * 2.2;

  const x = b.x;
  const y = b.y + bob;

  // glow
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(x, y, b.r + 7, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255, 105, 217, 0.18)";
  ctx.fill();
  ctx.restore();

  // centro
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fill();

  // lazo izq
  ctx.beginPath();
  ctx.ellipse(x - 8, y, 9.5, 7.5, 0, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255, 105, 217, 0.92)";
  ctx.fill();

  // lazo der
  ctx.beginPath();
  ctx.ellipse(x + 8, y, 9.5, 7.5, 0, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255, 154, 232, 0.88)";
  ctx.fill();

  // colitas
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 4);
  ctx.lineTo(x - 10, y + 18);
  ctx.lineTo(x - 1, y + 14);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 105, 217, 0.85)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 2, y + 4);
  ctx.lineTo(x + 10, y + 18);
  ctx.lineTo(x + 1, y + 14);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 154, 232, 0.82)";
  ctx.fill();

  // brillo
  ctx.strokeStyle = "rgba(204, 34, 34, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x - 10, y - 1, 6, -0.8, 0.6);
  ctx.stroke();
}

function drawBars() {
  for (const b of bars) {
    // valla pastel visible
    ctx.fillStyle = "rgba(255, 200, 235, 0.95)";
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // rayitas
    ctx.fillStyle = "rgba(200, 80, 160, 0.35)";
    for (let y = b.y + 8; y < b.y + b.h; y += 14) {
      ctx.fillRect(b.x, y, b.w, 3);
    }

    // borde
    ctx.strokeStyle = "rgba(255, 105, 217, 0.30)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawOverlay() {
  if (status === "PLAYING") return;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(255, 210, 240, 0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#3a2440";
  ctx.font = "900 42px system-ui";
  const title = status === "WIN" ? "💗 ¡MIMI REX LO LOGRÓ!" : "💔 OH NO...";
  ctx.fillText(title, 160, 240);

  ctx.font = "500 18px system-ui";
  const elapsed = endTime ? (endTime - startTime)/1000 : 0;
  const msg = status === "WIN"
    ? `Tiempo: ${formatTime(elapsed)} · 🎀 Lazos: ${score} · Pulsa R para jugar otra vez`
    : `Pulsa R para reintentar (Mimi cree en ti) 🎀`;
  ctx.fillText(msg, 210, 290);

  ctx.restore();
}

function drawPlayer() {
  const blink = respawnLock > 0 && status === "PLAYING";
  if (blink && Math.floor(performance.now()/80) % 2 !== 0) return;

  if (dinoReady) {
    ctx.save();
    if (player.facing === -1) {
      ctx.translate(player.x + player.w, player.y);
      ctx.scale(-1, 1);
      ctx.drawImage(dinoImg, 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(dinoImg, player.x, player.y, player.w, player.h);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255, 105, 217, 0.80)";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
}

function drawBackgroundSparkles() {
  // estrellitas suaves (se ven en fondo claro)
  ctx.globalAlpha = 0.30;
  for (let i=0;i<70;i++){
    const x = ((i*173) % 2600) - camX*0.2;
    const y = (i*97) % 540;
    ctx.fillStyle = "rgba(255, 105, 217, 0.25)";
    ctx.fillRect((x % canvas.width + canvas.width) % canvas.width, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackgroundSparkles();

  ctx.save();
  ctx.translate(-camX, 0);

  // plataformas como nubes
  for (const p of platforms) {
    if (p.active === false) continue;
    drawCloudPlatform(p);
  }

  // slime + pinchos + barras
  for (const s of slime) drawSlime(s);
  for (const sp of spikes) drawSpikes(sp);
  drawBars();

  // 🎀 lazos
  for (const b of bows) drawBow(b);

  // meta
  drawGoal(goal);

  // mimi
  drawPlayer();

  ctx.restore();

  drawOverlay();
}

// init
renderTop3();
resetRun();
update();
