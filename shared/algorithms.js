import { cellKey, directionsFor, isOpen, spawnSide } from './maze.js';

export const ALGORITHMS = Object.freeze([
  { id: 'astar', name: 'A*', short: 'Cola de prioridad · f = g + h', kind: 'Búsqueda informada', description: 'Selecciona el nodo con menor f = g + h. Conserva la frontera y los mejores costos conocidos.', color: '#138c7b' },
  { id: 'ida', name: 'IDA*', short: 'Profundidad iterativa · límite f', kind: 'Búsqueda informada', description: 'Realiza búsqueda en profundidad con límite f = g + h, aumentando el umbral al menor valor excedido.', color: '#6678dc' },
]);

export const HEURISTICS = Object.freeze([
  { id: 'manhattan', name: 'Manhattan', formula: '|Δfila| + |Δcolumna|', description: 'Distancia L1; admisible para movimientos ortogonales de costo 1.' },
  { id: 'euclidean', name: 'Euclidiana', formula: '√(Δfila² + Δcolumna²)', description: 'Distancia en línea recta; admisible, pero habitualmente menos informada.' },
  { id: 'chebyshev', name: 'Chebyshev', formula: 'max(|Δfila|, |Δcolumna|)', description: 'Distancia L∞; admisible pero menos informada en este laberinto.' },
  { id: 'zero', name: 'Cero (Dijkstra)', formula: '0', description: 'Sin estimación: A* equivale a Dijkstra y IDA* usa límites de profundidad.' },
  { id: 'weighted', name: 'Manhattan × 1.5', formula: '1.5 × (|Δfila| + |Δcolumna|)', description: 'No admisible: puede expandir menos, pero no garantiza caminos óptimos.' },
]);

export const DEFAULT_PARAMS = Object.freeze({ heuristic: 'manhattan' });
export function normalizeParams(raw = {}) {
  return { heuristic: HEURISTICS.some((h) => h.id === raw?.heuristic) ? raw.heuristic : DEFAULT_PARAMS.heuristic };
}
export function heuristic(from, goal, kind = 'manhattan') {
  const dr = Math.abs(from[0] - goal[0]), dc = Math.abs(from[1] - goal[1]);
  switch (kind) {
    case 'euclidean': return Math.hypot(dr, dc);
    case 'chebyshev': return Math.max(dr, dc);
    case 'zero': return 0;
    case 'weighted': return 1.5 * (dr + dc);
    default: return dr + dc;
  }
}

/** Montículo mínimo: compara primero f, luego h y al final el orden de inserción. */
function before(a, b) { return a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.seq < b.seq))); }
function push(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const j = (i - 1) >> 1;
    if (!before(item, heap[j])) break;
    heap[i] = heap[j]; i = j;
  }
  heap[i] = item;
}
function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (!heap.length) return first;
  let i = 0;
  while (true) {
    let j = i * 2 + 1;
    if (j >= heap.length) break;
    if (j + 1 < heap.length && before(heap[j + 1], heap[j])) j++;
    if (!before(heap[j], last)) break;
    heap[i] = heap[j]; i = j;
  }
  heap[i] = last;
  return first;
}

const MAX_EXPANSIONS = 100_000;
const pos = (p) => [...p];

export function createAgent(maze, spawnIndex, algorithm, rawParams = {}) {
  if (!ALGORITHMS.some((a) => a.id === algorithm)) throw new Error('Algoritmo no válido');
  if (!Number.isInteger(spawnIndex) || spawnIndex < 0 || spawnIndex >= maze.spawns.length) throw new Error('Entrada no válida');
  const params = normalizeParams(rawParams);
  const start = pos(maze.spawns[spawnIndex]), goal = pos(maze.center);
  const h = heuristic(start, goal, params.heuristic);
  const agent = {
    algorithm, params, spawnIndex, start, goal, x: start[0], z: start[1],
    status: 'active', reason: '', expansions: 0, generated: 1,
    iterations: 1, limit: algorithm === 'ida' ? h : null,
    steps: 0, distance: null, arrivedAt: null, finishTick: null,
    path: [start], explored: [], maze,
    dirs: directionsFor(spawnSide(maze, start)), seq: 0, seen: new Set(),
  };
  if (algorithm === 'astar') {
    agent.heap = [];
    push(agent.heap, { p: start, g: 0, h, f: h, seq: agent.seq++ });
    agent.costs = new Map([[cellKey(start), 0]]);
    agent.parents = new Map();
  } else {
    agent.stack = [{ p: start, g: 0, next: 0, expanded: false }];
    agent.onPath = new Set([cellKey(start)]);
    agent.nextLimit = Infinity;
    // Tabla de mejores costos por iteración: evita repeticiones exponenciales
    // en las zonas abiertas del laberinto. Aumenta el uso de memoria de IDA*.
    agent.bestG = new Map();
  }
  return agent;
}

function trace(agent, end) {
  const path = [pos(end)];
  let k = cellKey(end);
  while (agent.parents.has(k)) {
    const p = agent.parents.get(k);
    path.push(pos(p)); k = cellKey(p);
  }
  return path.reverse();
}
function visit(agent, p, path) {
  agent.x = p[0]; agent.z = p[1]; agent.path = path;
  agent.explored.push(pos(p));
  if (agent.explored.length > 450) agent.explored.shift();
  agent.seen.add(cellKey(p));
  agent.expansions++; agent.steps = agent.expansions;
  if (agent.expansions >= MAX_EXPANSIONS) {
    agent.status = 'finished'; agent.reason = 'Límite de seguridad de expansiones';
  }
}
function arrive(agent, path) {
  agent.path = path.map(pos);
  agent.distance = path.length - 1;
  agent.x = agent.goal[0]; agent.z = agent.goal[1];
  agent.status = 'finished'; agent.reason = '¡Centro alcanzado!';
  agent.arrivedAt = Date.now();
}
function finishWithoutPath(agent) {
  agent.status = 'finished'; agent.reason = 'No existe camino hasta el centro';
}

/** UNA expansión de nodo por turno; ambos algoritmos tienen el mismo presupuesto. */
export function stepAgent(agent) {
  if (agent.status !== 'active') return agent;
  if (agent.algorithm === 'astar') {
    while (agent.heap.length) {
      const node = pop(agent.heap);
      if (node.g !== agent.costs.get(cellKey(node.p))) continue; // entrada obsoleta
      const path = trace(agent, node.p);
      visit(agent, node.p, path);
      if (cellKey(node.p) === cellKey(agent.goal)) { arrive(agent, path); return agent; }
      if (agent.status !== 'active') return agent;
      for (const [dr, dc] of agent.dirs) {
        const q = [node.p[0] + dr, node.p[1] + dc], k = cellKey(q);
        if (!isOpen(agent.maze, q) || node.g + 1 >= (agent.costs.get(k) ?? Infinity)) continue;
        const g = node.g + 1, h = heuristic(q, agent.goal, agent.params.heuristic);
        agent.costs.set(k, g); agent.parents.set(k, node.p);
        push(agent.heap, { p: q, g, h, f: g + h, seq: agent.seq++ });
        agent.generated++;
      }
      return agent;
    }
    finishWithoutPath(agent);
    return agent;
  }

  // IDA*: pila explícita para PAUSAR y continuar la recursión entre ticks.
  // Los saltos de límite y el backtracking NO cuentan como expansiones.
  while (agent.status === 'active') {
    if (!agent.stack.length) {
      if (!Number.isFinite(agent.nextLimit)) { finishWithoutPath(agent); break; }
      agent.limit = agent.nextLimit;
      agent.nextLimit = Infinity;
      agent.bestG = new Map();
      agent.iterations++;
      agent.stack = [{ p: agent.start, g: 0, next: 0, expanded: false }];
      agent.onPath = new Set([cellKey(agent.start)]);
    }
    const frame = agent.stack[agent.stack.length - 1];
    const f = frame.g + heuristic(frame.p, agent.goal, agent.params.heuristic);
    if (f > agent.limit) {
      agent.nextLimit = Math.min(agent.nextLimit, f);
      agent.stack.pop(); agent.onPath.delete(cellKey(frame.p));
      continue;
    }
    if (!frame.expanded) {
      const k = cellKey(frame.p);
      if ((agent.bestG.get(k) ?? Infinity) <= frame.g) {
        agent.stack.pop(); agent.onPath.delete(k);
        continue;
      }
      agent.bestG.set(k, frame.g);
      frame.expanded = true;
      visit(agent, frame.p, agent.stack.map((v) => v.p));
      if (cellKey(frame.p) === cellKey(agent.goal)) arrive(agent, agent.stack.map((v) => v.p));
      return agent;
    }
    if (frame.next >= agent.dirs.length) {
      agent.stack.pop(); agent.onPath.delete(cellKey(frame.p));
      continue;
    }
    const [dr, dc] = agent.dirs[frame.next++];
    const q = [frame.p[0] + dr, frame.p[1] + dc], k = cellKey(q);
    if (!isOpen(agent.maze, q) || agent.onPath.has(k)) continue;
    agent.stack.push({ p: q, g: frame.g + 1, next: 0, expanded: false });
    agent.onPath.add(k); agent.generated++;
  }
  return agent;
}
