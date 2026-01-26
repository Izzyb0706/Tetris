const COLS = 10;
const ROWS = 20;
const CELL = 30;

const playCanvas = document.getElementById('playfield');
const ctx = playCanvas.getContext('2d');

const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');

const SCORE_ELEM = document.getElementById('score');
const LEVEL_ELEM = document.getElementById('level');
const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

playCanvas.width = CELL * COLS;
playCanvas.height = CELL * ROWS;


const COLORS = {
  I: '#adb3b3ff',
  J: '#0070f0',
  O: '#f0f000',
  L: '#cf19c6ff',
  S: '#00f000',
  T: '#a000f0',
  Z: '#f00000',
  X: '#1486d3ff'
};


const TETROMINOES = {
  I: [
    [
      [0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]
    ],
    [
      [0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]
    ]
  ],
  J: [
    [
      [1,0,0],[1,1,1],[0,0,0]
    ],
    [
      [0,1,1],[0,1,0],[0,1,0]
    ],
    [
      [0,0,0],[1,1,1],[0,0,1]
    ],
    [
      [0,1,0],[0,1,0],[1,1,0]
    ]
  ],
  L: [
    [
      [0,0,1],[1,1,1],[0,0,0]
    ],
    [
      [0,1,0],[0,1,0],[0,1,1]
    ],
    [
      [0,0,0],[1,1,1],[1,0,0]
    ],
    [
      [1,1,0],[0,1,0],[0,1,0]
    ]
  ],
  O: [
    [
      [1,1],[1,1]
    ]
  ],
  S: [
    [
      [0,1,1],[1,1,0],[0,0,0]
    ],
    [
      [0,1,0],[0,1,1],[0,0,1]
    ]
  ],
  T: [
    [
      [0,1,0],[1,1,1],[0,0,0]
    ],
    [
      [0,1,0],[0,1,1],[0,1,0]
    ],
    [
      [0,0,0],[1,1,1],[0,1,0]
    ],
    [
      [0,1,0],[1,1,0],[0,1,0]
    ]
  ],
  Z: [
    [
      [1,1,0],[0,1,1],[0,0,0]
    ],
    [
      [0,0,1],[0,1,1],[0,1,0]
    ]
  ]
};


let grid = createMatrix(COLS, ROWS);
let current = null;
let nextPiece = null;
let score = 0;
let level = 1;
let linesCleared = 0;
let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;
let isPaused = false;
let isGameOver = false;
let isRunning = false;


function createMatrix(cols, rows) {
  const m = [];
  for (let y=0; y<rows; y++) {
    m.push(new Array(cols).fill(0));
  }
  return m;
}

function randomPiece() {
  const types = Object.keys(TETROMINOES);
  const type = types[Math.floor(Math.random() * types.length)];
  const rotations = TETROMINOES[type];
  return {
    type,
    rotations,
    rotation: 0,
    matrix: rotations[0].map(r => r.slice()),
    x: Math.floor((COLS - rotations[0][0].length) / 2),
    y: -1
  };
}

function rotateMatrix(mat) {
  const n = mat.length;
  const res = Array.from({length: n}, () => new Array(n).fill(0));
  for (let y=0; y<n; y++) {
    for (let x=0; x<n; x++) {
      res[x][n-1-y] = mat[y][x] || 0;
    }
  }
  return res;
}


function collide(grid, piece) {
  const m = piece.matrix;
  for (let y=0; y<m.length; y++) {
    for (let x=0; x<m[y].length; x++) {
      if (m[y][x]) {
        const gx = piece.x + x;
        const gy = piece.y + y;
        if (gy >= ROWS || gx < 0 || gx >= COLS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
  }
  return false;
}


function merge(grid, piece) {
  const m = piece.matrix;
  for (let y=0; y<m.length; y++) {
    for (let x=0; x<m[y].length; x++) {
      if (m[y][x]) {
        const gx = piece.x + x;
        const gy = piece.y + y;
        if (gy >= 0) grid[gy][gx] = piece.type;
      }
    }
  }
}

function clearLines() {
  let lines = 0;
  outer: for (let y = ROWS-1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!grid[y][x]) continue outer;
    }
    grid.splice(y, 1);
    grid.unshift(new Array(COLS).fill(0));
    lines++;
    y++;
  }
  if (lines > 0) {
    linesCleared += lines;
    const points = [0, 40, 100, 300, 1200];
    score += (points[lines] || 0) * level;
    SCORE_ELEM.textContent = score;
    const newLevel = Math.floor(linesCleared / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      LEVEL_ELEM.textContent = "Level: " + level;
      dropInterval = Math.max(100, 1000 - (level-1) * 75);
    }
  }
}

function move(offsetX) {
  current.x += offsetX;
  if (collide(grid, current)) current.x -= offsetX;
}

function softDrop() {
  current.y++;
  if (collide(grid, current)) {
    current.y--;
    lockPiece();
  }
}

function hardDrop() {
  while (!collide(grid, current)) current.y++;
  current.y--;
  lockPiece();
}

function rotatePiece() {
  const len = current.rotations.length;
  const newIdx = (current.rotation + 1) % len;
  const newMat = current.rotations[newIdx].map(r => r.slice());
  const oldX = current.x;
  const kicks = [0, -1, 1, -2, 2];
  let kicked = false;
  for (let k of kicks) {
    current.matrix = newMat;
    current.rotation = newIdx;
    current.x = oldX + k;
    if (!collide(grid, current)) { kicked = true; break; }
  }
  if (!kicked) {
    current.rotation = (current.rotation - 1 + len) % len;
    current.matrix = current.rotations[current.rotation].map(r => r.slice());
    current.x = oldX;
  }
}

function lockPiece() {
  merge(grid, current);
  clearLines();
  spawnPiece();
}


function spawnPiece() {
  current = nextPiece || randomPiece();
  current.matrix = current.rotations[current.rotation].map(r => r.slice());
  current.x = Math.floor((COLS - current.matrix[0].length) / 2);
  current.y = -1;

  nextPiece = randomPiece();
  drawNext();

  if (collide(grid, current)) {
    isGameOver = true;
    isRunning = false;
    alert("Game Over — score: " + score);
  }
}


function drawCell(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size-1, size-1);
}

function drawGrid() {
  ctx.clearRect(0,0,playCanvas.width, playCanvas.height);
  for (let y=0; y<ROWS; y++) {
    for (let x=0; x<COLS; x++) {
      const cell = grid[y][x];
      if (cell) {
        drawCell(ctx, x, y, CELL, COLORS[cell]);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.01)';
        ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
      }
    }
  }
}

function drawPiece(ctx, piece, size) {
  const m = piece.matrix;
  for (let y=0; y<m.length; y++) {
    for (let x=0; x<m[y].length; x++) {
      if (m[y][x]) {
        const gx = piece.x + x;
        const gy = piece.y + y;
        if (gy >= 0) drawCell(ctx, gx, gy, size, COLORS[piece.type]);
      }
    }
  }
}

function drawCurrent() {
  drawGrid();
  drawPiece(ctx, current, CELL);
}

function drawNext() {
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const block = 24;
  const offsetX = Math.floor((nextCanvas.width - block * nextPiece.matrix[0].length)/2);
  const offsetY = Math.floor((nextCanvas.height - block * nextPiece.matrix.length)/2);
  for (let y=0; y<nextPiece.matrix.length; y++) {
    for (let x=0; x<nextPiece.matrix[y].length; x++) {
      if (nextPiece.matrix[y][x]) {
        nctx.fillStyle = COLORS[nextPiece.type];
        nctx.fillRect(offsetX + x*block, offsetY + y*block, block-2, block-2);
        nctx.strokeStyle = 'rgba(255,255,255,0.06)';
        nctx.strokeRect(offsetX + x*block + 0.5, offsetY + y*block + 0.5, block-3, block-3);
      }
    }
  }
}


function update(time = 0) {
  if (!isRunning || isPaused || isGameOver) {
    lastTime = time;
    requestAnimationFrame(update);
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    current.y++;
    if (collide(grid, current)) {
      current.y--;
      lockPiece();
    }
    dropCounter = 0;
  }
  drawCurrent();
  requestAnimationFrame(update);
}


document.addEventListener('keydown', e => {
  if (!isRunning) return;
  if (e.key === 'ArrowLeft') move(-1);
  else if (e.key === 'ArrowRight') move(1);
  else if (e.key === 'ArrowDown') softDrop();
  else if (e.key === 'ArrowUp') rotatePiece();
  else if (e.code === 'Space') { e.preventDefault(); hardDrop(); }
  else if (e.key.toLowerCase() === 'p') togglePause();
  drawCurrent();
});

startBtn.addEventListener('click', () => {
  if (!isRunning) startGame();
});
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', () => location.reload());


function startGame() {
  grid = createMatrix(COLS, ROWS);
  score = 0;
  level = 1;
  linesCleared = 0;
  dropInterval = 1000;
  isPaused = false;
  isGameOver = false;
  isRunning = true;
  SCORE_ELEM.textContent = score;
  LEVEL_ELEM.textContent = "Level: " + level;
  nextPiece = randomPiece();
  spawnPiece();
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function togglePause() {
  if (!isRunning) return;
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";
}


startGame();
