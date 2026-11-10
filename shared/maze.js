/** Tablero compartido de 65×65, con paredes parciales y cuatro sectores rotados. */
export const SIZE = 65;
export const CENTER = (SIZE - 1) / 2;
export const GOAL = [CENTER, CENTER];
export const MAX_STUDENTS = 20;
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

export function makeMaze(seed = 2026) {
  const random = rngFrom(seed);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('.'));
  // Obstáculos fragmentados (tramos, L y bloques) en un cuadrante; rotar crea
  // cuatro sectores equivalentes, con grandes claros en lugar de pasillos cerrados.
  const wall = ([r, c]) => {
    if (r < 2 || c < 2 || r >= SIZE - 2 || c >= SIZE - 2) return;
    if (Math.abs(r - CENTER) <= 1 || Math.abs(c - CENTER) <= 1) return;
    if (Math.abs(r - CENTER) + Math.abs(c - CENTER) <= 8) return;
    for (let turn = 0; turn < 4; turn++) {
      const [rr, cc] = rotate([r, c], turn);
      grid[rr][cc] = '#';
    }
  };
  const open = ([r, c]) => {
    for (let turn = 0; turn < 4; turn++) {
      const [rr, cc] = rotate([r, c], turn);
      grid[rr][cc] = '.';
    }
  };
  // Cada figura ocupa una parte del terreno; NO construimos una pared continua.
  for (let i = 0; i < 108; i++) {
    const r = 3 + Math.floor(random() * (CENTER - 6));
    const c = 3 + Math.floor(random() * (CENTER - 6));
    const length = 2 + Math.floor(random() * 7);
    const horizontal = random() < .5;
    const shape = random();
    for (let j = 0; j < length; j++) {
      wall([r + (horizontal ? 0 : j), c + (horizontal ? j : 0)]);
      if (shape < .24 && j < 3) wall([r + (horizontal ? 1 : j), c + (horizontal ? j : 1)]);
    }
    if (shape > .74) for (let j = 0; j < Math.max(2, length - 2); j++) {
      wall([r + (horizontal ? j : length - 1), c + (horizontal ? length - 1 : j)]);
    }
  }
  // Claros amplios, patios sin muros y fragmentos aislados: laberinto incompleto.
  for (let i = 0; i < 24; i++) {
    const r = 2 + Math.floor(random() * (CENTER - 5));
    const c = 2 + Math.floor(random() * (CENTER - 5));
    const height = 3 + Math.floor(random() * 6);
    const width = 3 + Math.floor(random() * 6);
    for (let dr = 0; dr < height; dr++) for (let dc = 0; dc < width; dc++) open([r + dr, c + dc]);
  }
  // Perímetro transitable y caminos anchos próximos a los ejes, que luego
  // se interrumpen mediante algunos tramos para exigir decisiones de búsqueda.
  for (let t = 0; t < SIZE; t++) {
    grid[0][t] = grid[SIZE - 1][t] = grid[t][0] = grid[t][SIZE - 1] = '.';
    for (const d of [-1, 0, 1]) {
      grid[CENTER + d][t] = grid[t][CENTER + d] = '.';
    }
  }

  // Interrumpir las avenidas con segmentos cortos: los corredores NO son
  // continuos, pero hay desvíos abiertos a ambos lados de cada fragmento.
  for (const depth of [9, 19, 27]) {
    for (let dc = -2; dc <= 2; dc++) {
      for (let side = 0; side < 4; side++) {
        const [r, c] = rotate([depth, CENTER + dc], side);
        grid[r][c] = '#';
      }
    }
  }
  // Los desvíos laterales conectan los tramos del eje. Se abren DESPUÉS
  // de colocar paredes, por lo que jamás se aísla la meta por accidente.
  for (const depth of [9, 19, 27]) {
    for (let side = 0; side < 4; side++) {
      for (let dr = -1; dr <= 1; dr++) {
        const [r, c] = rotate([depth + dr, CENTER + 3], side);
        grid[r][c] = '.';
      }
      for (let dc = 0; dc <= 3; dc++) for (const dr of [-1, 1]) {
        const [r, c] = rotate([depth + dr, CENTER + dc], side);
        grid[r][c] = '.';
      }
    }
  }
  // Cinco salidas distintas por lado, escogidas al azar entre accesos de
  // dificultad próxima (diferencia máxima de 4 pasos óptimos). 20 en total.
  const dist = distanceMap(grid, GOAL);
  const top = [];
  for (let c = 2; c < SIZE - 2; c++) top.push({ p: [0, c], d: dist[0][c] });
  const minDistance = Math.min(...top.map((x) => x.d));
  const windows = [];
  for (let d = minDistance; d <= minDistance + 14; d++) {
    const candidates = top.filter((x) => x.d >= d && x.d <= d + 4);
    if (candidates.length >= MAX_STUDENTS / 4) windows.push(candidates);
  }
  const eligible = windows[Math.floor(random() * windows.length)];
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const chosen = eligible.slice(0, MAX_STUDENTS / 4);
  const spawns = chosen.flatMap(({ p }) => Array.from({ length: 4 }, (_, turn) => rotate(p, turn)));
  for (let i = spawns.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
  }
  return {
    seed, size: SIZE, center: [...GOAL], spawns,
    grid: grid.map((row) => row.join('')),
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
