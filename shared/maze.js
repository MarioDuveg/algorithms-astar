/** Laberinto 65×65: muros fragmentados, patios, densidad ajustable y simetría rotacional. */
export const SIZE = 65;
export const CENTER = (SIZE - 1) / 2;
export const GOAL = [CENTER, CENTER];
export const MAX_STUDENTS = 20;
export const DEFAULT_COMPLEXITY = 3;
export const COMPLEXITY_LEVELS = Object.freeze([
  { level: 1, name: 'Muy abierto', target: 0.12 },
  { level: 2, name: 'Abierto', target: 0.18 },
  { level: 3, name: 'Intermedio', target: 0.25 },
  { level: 4, name: 'Complejo', target: 0.31 },
  { level: 5, name: 'Muy complejo', target: 0.37 },
]);
export const cellKey = (p) => `${p[0]},${p[1]}`;

function rngFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function rotate([r, c], turns) {
  for (let i = 0; i < turns; i++) [r, c] = [c, SIZE - 1 - r];
  return [r, c];
}

function distanceMap(grid, center) {
  const dist = Array.from({ length: SIZE }, () => Array(SIZE).fill(Infinity));
  const queue = [center]; dist[center[0]][center[1]] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i];
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] !== '#' && !Number.isFinite(dist[nr][nc])) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }
  return dist;
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function makeMaze(seed = 2026, complexity = DEFAULT_COMPLEXITY) {
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 5)
    throw new Error('La complejidad debe ser un entero entre 1 y 5');
  const random = rngFrom(seed);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('.'));
  const protectedCell = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const symmetric = (p, action) => {
    for (let turn = 0; turn < 4; turn++) {
      const [r, c] = rotate(p, turn);
      if (r >= 0 && c >= 0 && r < SIZE && c < SIZE) action(r, c);
    }
  };
  // Los caminos centrales y el perímetro permiten llegar desde cualquier orilla.
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (r <= 1 || c <= 1 || r >= SIZE - 2 || c >= SIZE - 2 ||
        Math.abs(r - CENTER) <= 1 || Math.abs(c - CENTER) <= 1 ||
        Math.abs(r - CENTER) + Math.abs(c - CENTER) <= 7) protectedCell[r][c] = true;
  }
  // Patios libres distribuidos al azar, rotados para que los cuatro lados sean comparables.
  for (let i = 0; i < 9; i++) {
    const r = 4 + Math.floor(random() * 22);
    const c = 4 + Math.floor(random() * 22);
    const height = 3 + Math.floor(random() * 5);
    const width = 3 + Math.floor(random() * 5);
    for (let dr = 0; dr < height; dr++) for (let dc = 0; dc < width; dc++) {
      symmetric([r + dr, c + dc], (rr, cc) => { protectedCell[rr][cc] = true; });
    }
  }
  let wallCount = 0;
  const wall = (p) => {
    const cells = [];
    symmetric(p, (r, c) => cells.push([r, c]));
    if (cells.some(([r, c]) => protectedCell[r][c])) return;
    for (const [r, c] of cells) {
      if (grid[r][c] !== '#') { grid[r][c] = '#'; wallCount++; }
    }
  };
  const target = Math.round(COMPLEXITY_LEVELS[complexity - 1].target * SIZE * SIZE);
  // Construir fragmentos, no un laberinto de pasillos continuos. La densidad
  // se controla por cantidad real de celdas de pared, no solo por iteraciones.
  for (let attempt = 0; attempt < 15000 && wallCount < target - 60; attempt++) {
    const r = 3 + Math.floor(random() * 27);
    const c = 3 + Math.floor(random() * 27);
    const horizontal = random() < 0.5;
    const length = 2 + Math.floor(random() * 8);
    const shape = random();
    for (let j = 0; j < length && wallCount < target - 60; j++) {
      if (random() < 0.08) continue; // huecos en segmentos largos
      wall([r + (horizontal ? 0 : j), c + (horizontal ? j : 0)]);
      if (shape < .18 && j < 3) wall([r + (horizontal ? 1 : j), c + (horizontal ? j : 1)]);
    }
    if (shape > .68) for (let j = 0; j < length - 2 && wallCount < target - 60; j++) {
      wall([r + (horizontal ? j : length - 1), c + (horizontal ? length - 1 : j)]);
    }
  }
  // Tres desvíos por brazo: impiden que el corredor central sea una línea recta.
  // Se reabren conexiones laterales, siempre simétricas, después de dibujar paredes.
  for (const depth of [9, 19, 27]) {
    for (let dc = -2; dc <= 2; dc++) symmetric([depth, CENTER + dc], (r, c) => {
      if (grid[r][c] !== '#') { grid[r][c] = '#'; wallCount++; }
    });
    for (let dr = -1; dr <= 1; dr++) symmetric([depth + dr, CENTER + 3], (r, c) => {
      if (grid[r][c] === '#') { grid[r][c] = '.'; wallCount--; }
    });
    for (let dc = 0; dc <= 3; dc++) for (const dr of [-1, 1]) symmetric([depth + dr, CENTER + dc], (r, c) => {
      if (grid[r][c] === '#') { grid[r][c] = '.'; wallCount--; }
    });
  }
  // Cinco accesos por lado; se sortean, preservando una ventana de dificultad
  // muy parecida (máximo cuatro pasos óptimos) y una separación si es posible.
  const dist = distanceMap(grid, GOAL);
  const top = Array.from({ length: SIZE - 6 }, (_, i) => ({ p: [0, i + 3], d: dist[0][i + 3] }));
  const minDistance = Math.min(...top.map((x) => x.d));
  const windows = [];
  for (let d = minDistance; d <= minDistance + 20; d++) {
    const options = top.filter((x) => x.d >= d && x.d <= d + 4);
    if (options.length >= 5) windows.push(options);
  }
  shuffle(windows, random);
  let chosen = null;
  for (const gap of [4, 3, 2, 1]) {
    for (const options of windows) {
      const ordered = shuffle([...options], random);
      const picks = [];
      for (const option of ordered) {
        if (picks.every((x) => Math.abs(x.p[1] - option.p[1]) >= gap)) picks.push(option);
        if (picks.length === 5) { chosen = picks; break; }
      }
      if (chosen) break;
    }
    if (chosen) break;
  }
  if (!chosen) chosen = shuffle([...top], random).slice(0, 5);
  const spawns = chosen.flatMap(({ p }) => Array.from({ length: 4 }, (_, turn) => rotate(p, turn)));
  shuffle(spawns, random);
  return {
    seed, size: SIZE, center: [...GOAL], complexity,
    complexityName: COMPLEXITY_LEVELS[complexity - 1].name,
    wallCount, wallPercent: Math.round(wallCount * 1000 / (SIZE * SIZE)) / 10,
    spawns, grid: grid.map((row) => row.join('')),
    minSpawnDistance: Math.min(...spawns.map((p) => dist[p[0]][p[1]])),
    maxSpawnDistance: Math.max(...spawns.map((p) => dist[p[0]][p[1]])),
  };
}

export function isOpen(maze, [r, c]) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < maze.size
    && c >= 0 && c < maze.size && maze.grid[r][c] !== '#';
}

/** El orden de vecinos gira según el costado en que aparece cada estudiante. */
export function directionsFor(side = 0) {
  return [[1, 0], [0, -1], [0, 1], [-1, 0]].map(([dr, dc]) => {
    for (let t = 0; t < side; t++) [dr, dc] = [dc, -dr];
    return [dr, dc];
  });
}

export function spawnSide(maze, [r, c]) {
  if (r === 0) return 0;
  if (c === maze.size - 1) return 1;
  if (r === maze.size - 1) return 2;
  return 3;
}

export function shortestLength(maze, start, end = maze.center) {
  const queue = [[start, 0]], seen = new Set([cellKey(start)]);
  for (let i = 0; i < queue.length; i++) {
    const [p, d] = queue[i];
    if (cellKey(p) === cellKey(end)) return d;
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const q = [p[0] + dr, p[1] + dc];
      if (isOpen(maze, q) && !seen.has(cellKey(q))) { seen.add(cellKey(q)); queue.push([q, d + 1]); }
    }
  }
  return Infinity;
}
