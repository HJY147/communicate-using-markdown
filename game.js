const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const HUD = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  world: document.getElementById('world'),
  time: document.getElementById('time'),
};

const TILE = 32;
const COLORS = {
  0: 'transparent',
  1: getComputedStyle(document.documentElement).getPropertyValue('--ground'),
  2: getComputedStyle(document.documentElement).getPropertyValue('--brick'),
  3: getComputedStyle(document.documentElement).getPropertyValue('--question'),
  4: getComputedStyle(document.documentElement).getPropertyValue('--coin'),
  5: getComputedStyle(document.documentElement).getPropertyValue('--pipe'),
  6: getComputedStyle(document.documentElement).getPropertyValue('--flag'),
  7: '#c58f56',
  8: '#fff',
  9: '#92d665',
};

const INPUT = {
  left: false,
  right: false,
  jump: false,
  pause: false,
  reset: false,
};

document.addEventListener('keydown', ({ key }) => {
  if (key === 'ArrowLeft' || key === 'a') INPUT.left = true;
  if (key === 'ArrowRight' || key === 'd') INPUT.right = true;
  if (key === 'ArrowUp' || key === 'w' || key === ' ') INPUT.jump = true;
  if (key === 'Enter') togglePause();
  if (key === 'r' || key === 'R') resetLevel();
});

document.addEventListener('keyup', ({ key }) => {
  if (key === 'ArrowLeft' || key === 'a') INPUT.left = false;
  if (key === 'ArrowRight' || key === 'd') INPUT.right = false;
  if (key === 'ArrowUp' || key === 'w' || key === ' ') INPUT.jump = false;
});

let currentLevelIndex = 0;
let level = LEVELS[currentLevelIndex];
let cameraX = 0;

const player = {
  x: 64,
  y: 0,
  width: 24,
  height: 28,
  vx: 0,
  vy: 0,
  speed: 2.2,
  jumpSpeed: -8,
  onGround: false,
  alive: true,
  facing: 1,
};

let score = 0;
let coins = 0;
let timeLeft = level.time;
let enemies = [];
let countdown;
let paused = true;

function loadLevel(index) {
  currentLevelIndex = index;
  level = LEVELS[currentLevelIndex];
  HUD.world.textContent = `世界 ${level.name}`;
  timeLeft = level.time;
  score = 0;
  coins = 0;
  player.x = 64;
  player.y = TILE * 4;
  player.vx = 0;
  player.vy = 0;
  player.alive = true;
  enemies = level.enemies.map((e) => ({ ...e, width: 24, height: 24, dir: -1, alive: true }));
  cameraX = 0;
  clearInterval(countdown);
  countdown = setInterval(() => {
    if (!paused && timeLeft > 0) timeLeft--;
  }, 1000);
  paused = true;
  updateHUD();
  render();
}

function resetLevel() {
  loadLevel(currentLevelIndex);
}

function nextLevel() {
  const next = (currentLevelIndex + 1) % LEVELS.length;
  loadLevel(next);
}

function togglePause() {
  paused = !paused;
}

function updateHUD() {
  HUD.score.textContent = `分数 ${score.toString().padStart(6, '0')}`;
  HUD.coins.textContent = `硬币 x${coins.toString().padStart(2, '0')}`;
  HUD.time.textContent = `时间 ${timeLeft.toString().padStart(3, '0')}`;
}

function tileAt(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (row < 0 || row >= level.map.length) return 0;
  const line = level.map[row];
  const tileNumber = parseInt(line.slice(col * 2, col * 2 + 1), 10);
  return Number.isNaN(tileNumber) ? 0 : tileNumber;
}

function isSolid(tile) {
  return [1, 2, 3, 5, 6, 7, 9].includes(tile);
}

function isQuestion(tile) {
  return tile === 3;
}

function isCoin(tile) {
  return tile === 4;
}

function hitQuestionBlock(col, row) {
  // 50% 硬币、50% 加分
  const reward = Math.random() > 0.5 ? 'coin' : 'score';
  const line = level.map[row];
  level.map[row] = `${line.slice(0, col * 2)}2${line.slice(col * 2 + 1)}`;
  if (reward === 'coin') {
    coins++;
    score += 200;
  } else {
    score += 500;
  }
  updateHUD();
}

function collectCoin(col, row) {
  const line = level.map[row];
  level.map[row] = `${line.slice(0, col * 2)}0${line.slice(col * 2 + 1)}`;
  coins++;
  score += 100;
  updateHUD();
}

function resolveCollision(ax, ay, aw, ah, vx, vy) {
  let newX = ax + vx;
  let newY = ay + vy;
  const tiles = [];
  const corners = [
    [newX, newY],
    [newX + aw, newY],
    [newX, newY + ah],
    [newX + aw, newY + ah],
  ];

  corners.forEach(([cx, cy]) => {
    const tile = tileAt(cx, cy);
    tiles.push({ tile, col: Math.floor(cx / TILE), row: Math.floor(cy / TILE) });
  });

  // 垂直碰撞
  newY = ay + vy;
  for (const { tile, col, row } of tiles) {
    if (!isSolid(tile)) continue;
    const tileTop = row * TILE;
    const tileBottom = tileTop + TILE;

    if (vy > 0 && ay + ah <= tileTop && newY + ah > tileTop) {
      newY = tileTop - ah;
      player.onGround = true;
      player.vy = 0;
    } else if (vy < 0 && ay >= tileBottom && newY < tileBottom) {
      newY = tileBottom;
      player.vy = 0;
      if (isQuestion(tile)) hitQuestionBlock(col, row);
    }
  }

  // 水平碰撞
  newX = ax + vx;
  for (const { tile, col, row } of tiles) {
    if (!isSolid(tile)) continue;
    const tileLeft = col * TILE;
    const tileRight = tileLeft + TILE;

    if (vx > 0 && ax + aw <= tileLeft && newX + aw > tileLeft) {
      newX = tileLeft - aw;
      player.vx = 0;
    } else if (vx < 0 && ax >= tileRight && newX < tileRight) {
      newX = tileRight;
      player.vx = 0;
    }
  }

  // 硬币采集
  corners.forEach(([cx, cy]) => {
    const col = Math.floor(cx / TILE);
    const row = Math.floor(cy / TILE);
    const tile = tileAt(cx, cy);
    if (isCoin(tile)) collectCoin(col, row);
  });

  return { x: newX, y: newY };
}

function updatePlayer() {
  if (!player.alive) return;
  player.vx = 0;
  const accel = player.onGround ? player.speed : player.speed * 0.8;
  if (INPUT.left) {
    player.vx = -accel;
    player.facing = -1;
  }
  if (INPUT.right) {
    player.vx = accel;
    player.facing = 1;
  }
  if (INPUT.jump && player.onGround) {
    player.vy = player.jumpSpeed;
    player.onGround = false;
  }

  player.vy += 0.35; // 重力
  player.vy = Math.min(player.vy, 12);

  const { x, y } = resolveCollision(player.x, player.y, player.width, player.height, player.vx, player.vy);
  player.x = x;
  player.y = y;

  if (player.y > canvas.height) playerDies();

  // 旗杆检测
  if (tileAt(player.x + player.width / 2, player.y + player.height / 2) === 6) {
    score += 1000;
    updateHUD();
    nextLevel();
  }
}

function playerDies() {
  player.alive = false;
  score = Math.max(0, score - 500);
  updateHUD();
  setTimeout(resetLevel, 800);
}

function updateEnemies() {
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const nextX = enemy.x + enemy.dir * 1.2;
    const footTile = tileAt(nextX + enemy.dir * enemy.width, enemy.y + enemy.height + 1);
    const wallTile = tileAt(nextX + enemy.dir * enemy.width, enemy.y + enemy.height / 2);
    if (isSolid(wallTile) || !isSolid(footTile)) enemy.dir *= -1;
    enemy.x += enemy.dir * 1.2;

    // 碰撞玩家
    if (rectsOverlap(player, enemy) && player.alive) {
      if (player.vy > 0) {
        enemy.alive = false;
        player.vy = player.jumpSpeed * 0.6;
        score += 200;
      } else {
        playerDies();
      }
      updateHUD();
    }
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function renderTile(tile, col, row) {
  const x = col * TILE - cameraX;
  const y = row * TILE;
  ctx.fillStyle = COLORS[tile];
  if (tile === 0) return;
  ctx.fillRect(x, y, TILE, TILE);
  if (tile === 3) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 8, 16, 4);
  }
  if (tile === 6) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 8, 4, 16);
    ctx.fillRect(x + 10, y, 8, TILE);
  }
}

function renderPlayer() {
  ctx.save();
  ctx.translate(player.x - cameraX + player.width / 2, player.y + player.height / 2);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--mario');
  ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-4, -10, 8, 6);
  ctx.restore();
}

function renderEnemies() {
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    ctx.fillStyle = COLORS[4];
    ctx.fillRect(enemy.x - cameraX, enemy.y, enemy.width, enemy.height);
    ctx.fillStyle = COLORS[2];
    ctx.fillRect(enemy.x - cameraX, enemy.y + enemy.height - 8, enemy.width, 8);
  });
}

function renderHUD() {
  updateHUD();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const visibleCols = Math.ceil(canvas.width / TILE) + 2;
  const startCol = Math.max(0, Math.floor(cameraX / TILE));
  for (let row = 0; row < level.map.length; row++) {
    for (let col = startCol; col < startCol + visibleCols; col++) {
      const tile = tileAt(col * TILE, row * TILE);
      renderTile(tile, col, row);
    }
  }

  renderPlayer();
  renderEnemies();
  renderHUD();
}

function updateCamera() {
  cameraX = Math.max(0, player.x - canvas.width / 2);
}

function gameLoop() {
  if (!paused) {
    player.onGround = false;
    updatePlayer();
    updateEnemies();
    updateCamera();
  }
  render();
  requestAnimationFrame(gameLoop);
}

loadLevel(0);
gameLoop();
