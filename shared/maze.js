/** Laberinto aleatorio 65×65, conectado, con pasillos, bifurcaciones y salas.
 *  Cuatro sectores rotados ofrecen una topología equivalente para cada orilla. */
export const SIZE = 65;
export const CENTER = (SIZE - 1) / 2;
export const GOAL = [CENTER, CENTER];
export const MAX_STUDENTS = 20;
export const DEFAULT_COMPLEXITY = 3;
export const COMPLEXITY_LEVELS = Object.freeze([
  { level: 1, name: 'Muy abierto', target: 0.22 },
  { level: 2, name: 'Abierto', target: 0.28 },
  { level: 3, name: 'Intermedio', target: 0.35 },
  { level: 4, name: 'Complejo', target: 0.42 },
  { level: 5, name: 'Muy complejo', target: 0.49 },
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
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('#'));
  let wallCount = SIZE * SIZE;
  const carve = ([r, c]) => {
    // Sólo dibujar sobre una cuarta parte y rotar: evita ventajas entre lados.
    for (let t = 0; t < 4; t++) {
      const [rr, cc] = rotate([r, c], t);
      if (grid[rr][cc] === '#') { grid[rr][cc] = '.'; wallCount--; }
    }
  };

  // 1) Laberinto REAL: árbol de expansión aleatorio (DFS) sobre celdas impares.
  //    Cada celda del pasillo de un sector se conecta con todas las demás.
  //    Los cuatro sectores son rotaciones del mismo árbol, sin islas aisladas.
  const seen = Array.from({ length: 16 }, () => Array(16).fill(false));
  const first = [Math.floor(random() * 16), Math.floor(random() * 16)];
  const stack = [first];
  seen[first[0]][first[1]] = true;
  carve([1 + 2 * first[0], 1 + 2 * first[1]]);
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const neighbors = shuffle([[r + 1,c],[r - 1,c],[r,c + 1],[r,c - 1]], random)
      .filter(([nr, nc]) => nr >= 0 && nr < 16 && nc >= 0 && nc < 16 && !seen[nr][nc]);
    if (!neighbors.length) { stack.pop(); continue; }
    const [nr, nc] = neighbors[0];
    seen[nr][nc] = true;
    carve([1 + r + nr, 1 + c + nc]); // corredor entre ambas casillas
    carve([1 + 2 * nr, 1 + 2 * nc]);
    stack.push([nr, nc]);
  }

  // 2) Una sola meta y cuatro conexiones simétricas con el árbol generado.
  //    Los nodos (31,31), (31,33), (33,31), (33,33) ya pertenecen a él.
  for (let r = CENTER - 1; r <= CENTER + 1; r++)
    for (let c = CENTER - 1; c <= CENTER + 1; c++) carve([r, c]);

  // 3) Algunas salas y bucles rompen la rigidez del laberinto perfecto.
  //    Las salas contienen celdas impares ya conectadas; no crean zonas aisladas.
  const roomCounts = [16, 12, 8, 5, 2];
  const target = Math.round(COMPLEXITY_LEVELS[complexity - 1].target * SIZE * SIZE);
  for (let i = 0; i < roomCounts[complexity - 1]; i++) {
    const r0 = 2 + Math.floor(random() * 24), c0 = 2 + Math.floor(random() * 24);
    const height = 3 + Math.floor(random() * 4), width = 3 + Math.floor(random() * 4);
    for (let r = r0; r < Math.min(31, r0 + height); r++)
      for (let c = c0; c < Math.min(31, c0 + width); c++) carve([r, c]);
  }

  // 4) Abrir puertas y atajos sin desconectar nunca las casillas existentes.
  //    Se preserva una parte de las esquinas de muro para mantener pasillos
  //    reconocibles, en lugar de colocar obstáculos aleatorios sueltos.
  let attempts = 0;
  while (wallCount > target + 20 && attempts++ < 20000) {
    const r = 2 + Math.floor(random() * 29), c = 2 + Math.floor(random() * 29);
    if (grid[r][c] !== '#') continue;
    const door = r % 2 !== c % 2;
    if (random() > (door ? 0.95 : 0.30)) continue;
    if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dr, dc]) => grid[r + dr][c + dc] === '.')) carve([r, c]);
  }
  // Escenario muy abierto: si faltan huecos, completar desde la frontera
  // conectada (sin formar casillas libres completamente incomunicadas).
  if (wallCount > target + 20) {
    const candidates = shuffle(Array.from({ length: 29 * 29 }, (_, i) => [2 + Math.floor(i / 29), 2 + i % 29]), random);
    for (const [r, c] of candidates) {
      if (wallCount <= target + 20) break;
      if (grid[r][c] === '#' && [[1,0],[-1,0],[0,1],[0,-1]].some(([dr, dc]) => grid[r + dr][c + dc] === '.')) carve([r, c]);
    }
  }

  // 5) Cinco accesos por lado. Se eligen al azar entre aquellos con una
  //    distancia al centro de como máximo cuatro pasos de diferencia.
  //    La orilla está cerrada salvo por las 20 puertas ocupables.
  const dist = distanceMap(grid, GOAL);
  const candidates = Array.from({ length: 30 }, (_, i) => ({
    p: [0, 3 + 2 * i], d: dist[1][3 + 2 * i] + 1,
  }));
  const windows = [];
  for (const candidate of candidates) {
    const options = candidates.filter(({ d }) => d >= candidate.d && d <= candidate.d + 4);
    if (options.length >= 5) windows.push(options);
  }
  shuffle(windows, random);
  let chosen = null;
  for (const gap of [8, 6, 4, 2]) {
    for (const options of windows) {
      const picks = [];
      for (const option of shuffle([...options], random)) {
        if (picks.every(({ p }) => Math.abs(p[1] - option.p[1]) >= gap)) picks.push(option);
        if (picks.length === 5) { chosen = picks; break; }
      }
      if (chosen) break;
    }
    if (chosen) break;
  }
  if (!chosen) {
    // Respaldo para árboles muy sinuosos: abrir una pequeña galería de borde
    // conectada al pasillo y elegir cinco entradas vecinas equidistantes.
    const offset = 3 + Math.floor(random() * 56);
    for (let c = offset; c < offset + 5; c++) carve([1, c]);
    chosen = Array.from({ length: 5 }, (_, i) => ({ p: [0, offset + i] }));
  }
  const spawns = chosen.flatMap(({ p }) => Array.from({ length: 4 }, (_, turn) => rotate(p, turn)));
  for (const p of spawns) carve(p);
  shuffle(spawns, random);
  const finalDistances = distanceMap(grid, GOAL);

  return {
    seed, size: SIZE, center: [...GOAL], complexity,
    complexityName: COMPLEXITY_LEVELS[complexity - 1].name,
    wallCount, wallPercent: Math.round(wallCount * 1000 / (SIZE * SIZE)) / 10,
    spawns, grid: grid.map((row) => row.join('')),
    minSpawnDistance: Math.min(...spawns.map(([r, c]) => finalDistances[r][c])),
    maxSpawnDistance: Math.max(...spawns.map(([r, c]) => finalDistances[r][c])),
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
