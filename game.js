const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const top3El = document.getElementById("top3");

// Cargar fuente "Press Start 2P" para toda la app
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);
document.body.style.fontFamily = '"Press Start 2P", cursive';

// =====================
// ASSETS (IMG > ICONOS)
// =====================
const dinoImg = new Image();
dinoImg.src = "img/mimi.svg"; 
let dinoReady = false;
dinoImg.onload = () => (dinoReady = true);

const bowImg = new Image();
bowImg.src = "img/lazo.png";
let bowReady = false;
bowImg.onload = () => (bowReady = true);

// Corazón vidas (lleno)
const heartImg = new Image();
heartImg.src = "img/heartComplete.png"; 
let heartReady = false;
heartImg.onload = () => (heartReady = true);

// Corazón vidas (perdidos)
const brokenHeartImg = new Image();
brokenHeartImg.src = "img/brokenHeart.png";
let brokenHeartReady = false;
brokenHeartImg.onload = () => (brokenHeartReady = true);

const clockImg = new Image();
clockImg.src = "img/clock.png";
let clockReady = false;
clockImg.onload = () => (clockReady = true);

// =====================
// INPUT (Controles del Juego)
// =====================
const keys = new Set();
window.addEventListener("keydown", (e) => {
  const block = ["ArrowLeft","ArrowRight","ArrowUp","Space","ShiftLeft","KeyA","KeyD","KeyW","KeyR","KeyP"];
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

// Tiempo límite y vidas iniciales
const TIME_LIMIT  = 60.0; 
const START_LIVES = 3;

const STORAGE_KEY = "mimi_rex_top3_v2";

// =====================
// WORLD
// MUNDO (NIVEL)
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

// Barras del camino
const bars = [
  { x: 360,  y: FLOOR_Y - 60, w: 22, h: 60 },
  { x: 950,  y: FLOOR_Y - 85, w: 26, h: 85 },
  { x: 1460, y: FLOOR_Y - 80, w: 22, h: 80 },
  { x: 1980, y: FLOOR_Y - 60, w: 26, h: 60 },
];

// Slime resbaladizo
const slime = [
  { x: 700,  y: FLOOR_Y - 10, w: 90,  h: 10 },
  { x: 1380, y: FLOOR_Y - 10, w: 110, h: 10 },
];

// Posiciones de los lazos
let bows = [
  { x: 300, y: 360, r: 12, w: 28, h: 28, taken:false },
  { x: 350, y: 360, r: 12, w: 28, h: 28, taken:false },
  { x: 560, y: 300, r: 12, w: 28, h: 28, taken:false },
  { x: 610, y: 300, r: 12, w: 28, h: 28, taken:false },
  { x: 840, y: 260, r: 12, w: 28, h: 28, taken:false },
  { x: 900, y: 260, r: 12, w: 28, h: 28, taken:false },
  { x: 1210, y: 320, r: 12, w: 28, h: 28, taken:false },
  { x: 1260, y: 320, r: 12, w: 28, h: 28, taken:false },
  { x: 1540, y: 280, r: 12, w: 28, h: 28, taken:false },
  { x: 1600, y: 280, r: 12, w: 28, h: 28, taken:false },
  { x: 1860, y: 340, r: 12, w: 28, h: 28, taken:false },
];

// Meta final
const goal = { x: 2450, y: FLOOR_Y - 90, w: 15, h: 90 };

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

// Variable global para el mejor (top1)
let bestPlayer = "—";

// =====================
// RANKING (TOP 3)
// =====================
function loadTop3() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveTop3(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// formato de tiempo en segundos
function formatTime(t) {
  return `${t.toFixed(2)}s`;
}

// from para calcular score > tiempo + lazos (0.11*lazo)
function calcScore(t, bows) {
  return Math.max(0, TIME_LIMIT - t) + (bows * 0.11);
}

function renderTop3() {
  const top = loadTop3();
  top3El.innerHTML = "";
  if (!top.length) {
    top3El.innerHTML = "<li style='list-style:none;'>No hay rankings aún. ¡Sé el primero!</li>";
    bestPlayer = "—";
    return;
  }
  top.forEach((e, i) => {
    const li = document.createElement("li");
    const finalScore = calcScore(e.time, e.score);
    li.textContent = `${e.name} - ${finalScore.toFixed(2)} pts`;
    li.style.fontSize = "15px"; 
    li.style.marginBottom = "5px";
    li.style.marginLeft = "40px";
    top3El.appendChild(li);
  });
  const bestScore = calcScore(top[0].time, top[0].score);
  bestPlayer = `${top[0].name} (${bestScore.toFixed(2)} pts)`;
}

function submitResult(name, timeSeconds, pts) {
  const top = loadTop3();
  top.push({ name, time: timeSeconds, score: pts });
  top.sort((a, b) => {
    return calcScore(b.time, b.score) - calcScore(a.time, a.score);
  });
  top.splice(3); 
  saveTop3(top);
  renderTop3();
}

// =====================
// UTILIDADES
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

// =====================
// ESTADOS: REINICIO / VICTORIA / DERROTA
// =====================
function resetRun() {
  lives = START_LIVES;
  timeLeft = TIME_LIMIT;
  score = 0;

  status = "MENU";
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
}

function winRun() {
  if (status !== "PLAYING") return;

  status = "WIN";
  endTime = performance.now();
  const elapsed = (endTime - startTime) / 1000;

  let name = prompt("¡MIMI REX lo ha logrado! Escribe tu nombre en el Ranking:", "Jugadoquett");
  if (!name) name = "Jugadoquett";
  name = name.trim().slice(0, 16) || "Jugadoquett";
  name = name.trim().slice(0, 12) || "Jugadoquett";

  submitResult(name, elapsed, score);

  resetRun();
}

// =====================
// FÍSICAS Y COLISIONES
let last = performance.now();
let dt = 0;

function resolveCollisions(entity) {
  entity.onGround = false;
  onSlime = false;

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

  entity.x += entity.vx * dt;
  for (const p of platforms) {
    if (p.active === false) continue;

    if (aabb(entity, p)) {
      if (entity.vx > 0) entity.x = p.x - entity.w;
      else if (entity.vx < 0) entity.x = p.x + p.w;
      entity.vx = 0;
    }
  }

  for (const b of bars) {
    if (aabb(entity, b)) {
      if (entity.vx > 0) entity.x = b.x - entity.w;
      else if (entity.vx < 0) entity.x = b.x + b.w;
      entity.vx = 0;
    }
  }

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
// BUCLE PRINCIPAL
function update() {
  const now = performance.now();
  dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (keys.has("KeyR")) {
    keys.delete("KeyR");
    resetRun();
  }

  if (status === "MENU") {
    if (keys.has("KeyP")) {
      status = "PLAYING";
      startTime = performance.now();
    }
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
  }

  draw();
  requestAnimationFrame(update);
}

// =====================
// DRAW (COQUETTE)
// DIBUJADO (ESTILO COQUETTE)
function drawSoftShadow(x, y, w, h, alpha = 0.18) {
  const shadowHeight = 14;
  const topY = y + h + 2;

  ctx.save();

  // degradado vertical
  const gradV = ctx.createLinearGradient(
    0, topY,
    0, topY + shadowHeight
  );
  gradV.addColorStop(0, `rgba(240, 128, 190, ${alpha})`);
  gradV.addColorStop(1, "rgba(240, 128, 190, 0)");

  ctx.fillStyle = gradV;
  ctx.fillRect(x, topY, w, shadowHeight);

  ctx.restore();
}

function drawCloudPlatform(p) {
  drawSoftShadow(p.x, p.y, p.w, p.h, 0.15);

  const baseY = p.y;
  const baseH = p.h;
  const r = Math.min(18, baseH);

  ctx.save();

  let grad;
  if (p.y === FLOOR_Y) {
    grad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
    grad.addColorStop(0, "rgba(180, 220, 150, 0.95)"); 
    grad.addColorStop(1, "rgba(140, 200, 120, 0.95)"); 
  } else {
    grad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
    grad.addColorStop(0, "rgba(255, 250, 250, 0.98)"); 
    grad.addColorStop(1, "rgba(255, 240, 245, 0.95)"); 
  }

  // rect base redondeado
  ctx.fillStyle = grad;
  roundRect(p.x, baseY, p.w, baseH, r);
  ctx.fill();

  if (p.y === FLOOR_Y) {
    ctx.strokeStyle = "rgba(100, 180, 100, 0.35)"; 
  } else {
    ctx.strokeStyle = "rgba(255, 200, 220, 0.30)";
  }
  ctx.lineWidth = 1.4;
  roundRect(p.x, baseY, p.w, baseH, r);
  ctx.stroke();

  // brillo de componentes
  ctx.globalAlpha = 0.25;
  if (p.y === FLOOR_Y) {
    ctx.fillStyle = "rgba(200, 240, 180, 1)"; // Brillo cespede
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // Brillo nubes
  }
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

  // bandera rosa
  ctx.fillStyle = "rgba(172, 35, 134, 0.85)";
  ctx.fillRect(g.x + g.w, g.y + 10, 60, 42);

  ctx.fillStyle = "rgba(220, 131, 180, 0.9)";
  ctx.fillRect(g.x + g.w + 8, g.y + 16, 10, 10);
}

function drawBow(b) {
  if (b.taken || !bowReady) return;

  const t = performance.now() / 1000;
  const bob = Math.sin(t * 3 + b.x * 0.01) * 2.2;

  const x = b.x - b.w / 2;
  const y = b.y - b.h / 2 + bob;

  // imagen del lazo
  ctx.drawImage(bowImg, x, y, b.w, b.h);
}

// pared ladrillos
function drawBars() {
  for (const b of bars) {
    // valla
    ctx.fillStyle = "rgba(210, 180, 140, 0.95)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    
    // rayitas
    ctx.fillStyle = "rgba(160, 120, 90, 0.6)";
    for (let y = b.y + 8; y < b.y + b.h; y += 14) {
      ctx.fillRect(b.x, y, b.w, 3);
    }

    // borde
    ctx.strokeStyle = "rgba(180, 140, 110, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawOverlay() {
  // Dibuja stats en el canvas durante PLAYING
  if (status === "PLAYING") {
    ctx.save();
    ctx.font = '14px "Press Start 2P"';
    ctx.fillStyle = "#3a2440";
    // Corazones para vidas 
    for (let i = 0; i < START_LIVES; i++) {
      const img = i < lives ? heartImg : brokenHeartImg;
      const ready = i < lives ? heartReady : brokenHeartReady;
      if (ready) {
        ctx.drawImage(img, 20 + i * 30, 20, 28, 28);
      }
    }
    // Lazo y el score
    if (bowReady) {
      ctx.drawImage(bowImg, 20, 60, 28, 28);
    }
    ctx.fillText(`${score}`, 60, 80);
    // Reloj y tiempo
    if (clockReady) {
      ctx.drawImage(clockImg, 20, 100, 28, 28);
    }
    ctx.fillText(`${timeLeft.toFixed(1)}s`, 60, 120);
    ctx.restore();
    return;
  }
}

// dimensiones de mimi rex
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

  for (const p of platforms) {
    if (p.active === false) continue;
    drawCloudPlatform(p);
  }

  // slime + pinchos + barras
  for (const s of slime) drawSlime(s);
  for (const sp of spikes) drawSpikes(sp);
  drawBars();

  //lazos
  for (const b of bows) drawBow(b);

  // meta
  drawGoal(goal);

  // mimi
  drawPlayer();

  ctx.restore();

  drawOverlay();

  if (status === "LOSE") {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = '36px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);

    ctx.font = '16px "Press Start 2P"';
    ctx.fillText("pulsa R para reiniciar", canvas.width / 2, canvas.height / 2 + 40);
    ctx.restore();
  }

  if (status === "MENU") {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = '36px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.fillText("PRESIONA P PARA COMENZAR", canvas.width / 2, canvas.height / 2);

    ctx.font = '12px "Press Start 2P"';
    ctx.fillText("A/D o ←/→ mover · Space saltar · Shift dash", canvas.width / 2, canvas.height / 2 + 40);
    ctx.restore();
  }
}

// init > final
// Inicialización
resetRun();
update();