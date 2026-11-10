import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaze, rotate, SPAWNS, shortestLength, isOpen } from '../shared/maze.js';
import { ALGORITHMS, HEURISTICS, heuristic, normalizeParams, createAgent, stepAgent } from '../shared/algorithms.js';
import { Room } from '../server/room.js';

function solve(maze, side, algorithm, name = 'manhattan') {
  const agent = createAgent(maze, side, algorithm, { heuristic: name });
  for (let i = 0; i < 105000 && agent.status === 'active'; i++) stepAgent(agent);
  return agent;
}

test('Ofrece A*, IDA* y cinco heurísticas configurables', () => {
  assert.deepEqual(ALGORITHMS.map((a) => a.id), ['astar', 'ida']);
  assert.deepEqual(HEURISTICS.map((h) => h.id), ['manhattan', 'euclidean', 'chebyshev', 'zero', 'weighted']);
  assert.equal(normalizeParams({ heuristic: 'desconocida' }).heuristic, 'manhattan');
  assert.equal(heuristic([0,0],[3,4],'manhattan'), 7);
  assert.equal(heuristic([0,0],[3,4],'euclidean'), 5);
  assert.equal(heuristic([0,0],[3,4],'chebyshev'), 4);
  assert.equal(heuristic([0,0],[3,4],'zero'), 0);
  assert.equal(heuristic([0,0],[3,4],'weighted'), 10.5);
});

test('Misma topología para las cuatro entradas, siempre en el anillo exterior', () => {
  for (const seed of [2026, 2027, 1, 42, 999]) {
    const maze = makeMaze(seed);
    assert.equal(maze.size, 33);
    const lengths = SPAWNS.map((p) => shortestLength(maze, p));
    assert.ok(Number.isFinite(lengths[0]) && lengths[0] >= 16);
    assert.equal(new Set(lengths).size, 1);
    for (let r = 0; r < maze.size; r++) for (let c = 0; c < maze.size; c++) {
      const [rr, cc] = rotate([r,c], 1);
      assert.equal(maze.grid[r][c], maze.grid[rr][cc]);
    }
    assert.deepEqual(maze.center, [16, 16]);
    for (const p of maze.spawns) {
      assert.ok(isOpen(maze, p));
      assert.ok(p.some((v) => v === 0 || v === 32));
    }
  }
});

test('A* e IDA* llegan al centro por caminos válidos y óptimos para heurísticas admisibles', () => {
  for (const seed of [2026, 2027, 1]) {
    const maze = makeMaze(seed);
    const optimal = shortestLength(maze, SPAWNS[0]);
    for (const algorithm of ['astar', 'ida']) {
      for (const h of ['manhattan', 'euclidean', 'chebyshev', 'zero']) {
        const a = solve(maze, 0, algorithm, h);
        assert.equal(a.reason, '¡Centro alcanzado!', `${algorithm}/${h}/${seed}: ${a.reason}`);
        assert.equal(a.distance, optimal);
        assert.deepEqual(a.path[0], maze.spawns[0]);
        assert.deepEqual(a.path.at(-1), maze.center);
        a.path.forEach((p, i) => {
          assert.ok(isOpen(maze, p));
          if (i) assert.equal(Math.abs(p[0] - a.path[i-1][0]) + Math.abs(p[1] - a.path[i-1][1]), 1);
        });
      }
    }
  }
});

test('La simetría más el orden relativo eliminan la ventaja entre entradas', () => {
  const maze = makeMaze(2026);
  for (const algorithm of ['astar', 'ida']) for (const h of ['manhattan','euclidean','zero','weighted']) {
    const results = [0, 1, 2, 3].map((side) => {
      const agent = solve(maze, side, algorithm, h);
      return [agent.distance, agent.expansions, agent.iterations];
    });
    results.forEach((value) => assert.deepEqual(value, results[0]));
  }
});

test('IDA* incrementa su umbral al menor valor que lo supera', () => {
  const a = createAgent(makeMaze(2026), 0, 'ida', { heuristic: 'manhattan' });
  const limits = [a.limit];
  while (a.status === 'active') {
    stepAgent(a);
    if (a.limit !== limits.at(-1)) limits.push(a.limit);
  }
  assert.deepEqual(limits, [16, 18, 20, 22, 24, 26, 28]);
  assert.equal(a.iterations, limits.length);
});

test('El administrador inicia y reinicia; ranking de llegada comparte empates', () => {
  const room = new Room(() => {}, () => .25);
  room.join('admin-id', 'admin', true);
  room.join('u1', 'Elena');
  room.join('u2', 'Luis');
  assert.throws(() => room.start('u1'), /administrador/);
  room.select('u1','astar',{heuristic:'manhattan'});
  room.select('u2','astar',{heuristic:'manhattan'});
  assert.equal(room.snapshot().readyCount,2);
  assert.equal(room.start('admin-id'),2);
  for (let i=0; i<100 && room.phase==='running'; i++) room.tick();
  assert.equal(room.phase,'finished');
  assert.equal(room.snapshot().leaderboard.length,2);
  assert.deepEqual(room.snapshot().leaderboard.map((p)=>p.rank), [1,1]);
  assert.equal(room.snapshot().leaderboard[0].distance, room.snapshot().optimalLength);
  room.reset('admin-id');
  assert.equal(room.phase,'lobby');
  assert.equal(room.round,2);
  assert.equal(room.snapshot().readyCount,0);
  assert.equal(room.players.get('u1').algorithm,null);
});
