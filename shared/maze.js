/** Laberinto cuadrado, cuatro sectores rotados 90°: misma dificultad por entrada. */
export const SIZE = 33;
export const CENTER = (SIZE - 1) / 2;
export const GOAL = [CENTER, CENTER];
export const SPAWNS = Object.freeze([
  [0, CENTER], [CENTER, SIZE - 1], [SIZE - 1, CENTER], [CENTER, 0],
]);

const key = (p) => `${p[0]},${p[1]}`;
export const cellKey = key;

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

export function makeMaze(seed = 2026) {
  const random = rngFrom(seed);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('#'));
  const carve = (p) => {
    for (let turn = 0; turn < 4; turn++) {
      const [r, c] = rotate(p, turn);
      grid[r][c] = '.';
    }
  };
  // Un sector triangular enlaza el norte con el centro. Los otros tres
  // son rotaciones EXACTAS: misma distancia óptima y estructura local.
  const allowed = ([r, c]) => r >= 2 && r <= CENTER - 2
    && c >= 2 && c <= SIZE - 3
    && r % 2 === 0 && c % 2 === 0
    && r + Math.abs(c - CENTER) <= CENTER - 2;
  const stack = [[2, CENTER]];
  const seen = new Set([key(stack[0])]);
  carve(stack[0]);
  while (stack.length) {
    const p = stack[stack.length - 1];
    const candidates = [[2, 0], [0, 2], [-2, 0], [0, -2]]
      .map(([dr, dc]) => [p[0] + dr, p[1] + dc])
      .filter((q) => allowed(q) && !seen.has(key(q)));
    if (!candidates.length) { stack.pop(); continue; }
    const q = candidates[Math.floor(random() * candidates.length)];
    seen.add(key(q));
    carve([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
    carve(q);
    stack.push(q);
  }
  carve([1, CENTER]); // puerta norte (rotada a los otros tres lados)
  carve([CENTER - 1, CENTER]); // paso final hacia el centro
  carve(GOAL);
  for (const spawn of SPAWNS) grid[spawn[0]][spawn[1]] = '.';
  return {
    seed, size: SIZE, center: GOAL, spawns: SPAWNS.map((p) => [...p]),
    grid: grid.map((row) => row.join('')),
  };
}

export function isOpen(maze, [r, c]) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < maze.size
    && c >= 0 && c < maze.size && maze.grid[r][c] !== '#';
}

// Cada jugador explora los vecinos en el mismo orden RELATIVO a su entrada.
// Esto evita ventajas por un orden fijo de coordenadas globales.
export function directionsFor(side = 0) {
  return [[1, 0], [0, -1], [0, 1], [-1, 0]].map(([dr, dc]) => {
    for (let t = 0; t < side; t++) [dr, dc] = [dc, -dr];
    return [dr, dc];
  });
}

export function shortestLength(maze, start, end = maze.center) {
  const queue = [[start, 0]], seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const [p, d] = queue[i];
    if (key(p) === key(end)) return d;
    for (const [dr, dc] of [[1,0], [-1,0], [0,1], [0,-1]]) {
      const q = [p[0] + dr, p[1] + dc];
      if (isOpen(maze, q) && !seen.has(key(q))) { seen.add(key(q)); queue.push([q, d + 1]); }
    }
  }
  return Infinity;
}
