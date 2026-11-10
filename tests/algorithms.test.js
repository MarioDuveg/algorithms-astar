import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaze, rotate, SIZE, MAX_STUDENTS, shortestLength, isOpen, spawnSide, DEFAULT_COMPLEXITY } from '../shared/maze.js';
import { ALGORITHMS, HEURISTICS, heuristic, normalizeParams, createAgent, stepAgent } from '../shared/algorithms.js';
import { Room } from '../server/room.js';

function solve(maze, index, algorithm, name = 'manhattan') {
  const agent = createAgent(maze, index, algorithm, { heuristic: name });
  while (agent.status === 'active') stepAgent(agent);
  return agent;
}

test('Incluye A*, IDA* y cinco heurísticas', () => {
  assert.deepEqual(ALGORITHMS.map((a) => a.id), ['astar', 'ida']);
  assert.deepEqual(HEURISTICS.map((h) => h.id), ['manhattan','euclidean','chebyshev','zero','weighted']);
  assert.equal(normalizeParams({ heuristic: 'desconocida' }).heuristic, 'manhattan');
  assert.equal(heuristic([0,0], [3,4], 'manhattan'), 7);
  assert.equal(heuristic([0,0], [3,4], 'euclidean'), 5);
  assert.equal(heuristic([0,0], [3,4], 'chebyshev'), 4);
  assert.equal(heuristic([0,0], [3,4], 'zero'), 0);
  assert.equal(heuristic([0,0], [3,4], 'weighted'), 10.5);
});

test('65×65 incompleto, cuatro sectores simétricos y zonas abiertas', () => {
  assert.equal(SIZE, 65);
  for (const seed of [2026, 2027, 1, 42, 999]) {
    const maze = makeMaze(seed);
    assert.deepEqual(maze.center, [32,32]);
    assert.equal(maze.size, 65);
    assert.equal(maze.grid.length, 65);
    assert.ok(maze.grid.every((line) => line.length === 65));
    const walls = maze.grid.join('').split('').filter((x) => x === '#').length;
    assert.ok(walls > 100 && walls < 2000, `Mapa con muros fragmentados: ${walls}`);
    let patio = false;
    for (let r = 2; r < 61; r++) for (let c = 2; c < 61; c++) {
      if (Array.from({ length: 5 }, (_, dr) => maze.grid.slice(r + dr, r + dr + 1)[0].slice(c, c + 5)).every((x) => x === '.....')) patio = true;
    }
    assert.ok(patio, 'Debe existir un espacio libre de al menos 5×5');
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const [rr, cc] = rotate([r,c], 1);
      assert.equal(maze.grid[r][c], maze.grid[rr][cc]);
    }
  }
});

test('20 entradas únicas, aleatorias y alcanzables: cinco por borde y diferencia máxima de 4 pasos', () => {
  for (const seed of [2026,2027,1,42,999,10001,91822]) {
    const maze = makeMaze(seed);
    assert.equal(MAX_STUDENTS, 20);
    assert.equal(maze.spawns.length, 20);
    assert.equal(new Set(maze.spawns.map((p) => p.join(','))).size, 20);
    const sides = [0,0,0,0];
    const lengths = maze.spawns.map((p) => {
      assert.ok(isOpen(maze,p));
      assert.ok(p.some((v) => v === 0 || v === SIZE - 1));
      sides[spawnSide(maze,p)]++;
      return shortestLength(maze,p);
    });
    assert.deepEqual(sides,[5,5,5,5]);
    assert.ok(lengths.every(Number.isFinite));
    assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 4);
    assert.equal(maze.minSpawnDistance,Math.min(...lengths));
    assert.equal(maze.maxSpawnDistance,Math.max(...lengths));
  }
  assert.notDeepEqual(makeMaze(2026).spawns,makeMaze(2027).spawns);
});

test('A* e IDA* encuentran caminos válidos y óptimos con Manhattan; A* también con Euclidiana y Cero', () => {
  for (const seed of [2026,2027,1,42]) {
    const maze = makeMaze(seed);
    for (const algorithm of ['astar','ida']) for (const h of (algorithm === 'ida' ? ['manhattan','chebyshev'] : ['manhattan','euclidean','chebyshev','zero'])) {
      const a = solve(maze, 0, algorithm, h);
      assert.equal(a.reason,'¡Centro alcanzado!',`${seed} ${algorithm} ${h}: ${a.reason}`);
      assert.equal(a.distance,shortestLength(maze,a.start));
      assert.deepEqual(a.path[0],a.start);
      assert.deepEqual(a.path.at(-1),maze.center);
      a.path.forEach((p,i) => {
        assert.ok(isOpen(maze,p));
        if (i) assert.equal(Math.abs(p[0]-a.path[i-1][0])+Math.abs(p[1]-a.path[i-1][1]),1);
      });
    }
  }
});

test('IDA* cambia el umbral cuando una rama excede el f permitido', () => {
  const a = createAgent(makeMaze(2026), 0, 'ida', { heuristic:'manhattan' });
  const limits = [a.limit];
  while (a.status === 'active') {
    stepAgent(a);
    if (a.limit !== limits.at(-1)) limits.push(a.limit);
  }
  assert.ok(limits.length >= 2);
  assert.ok(limits.every((v,i) => i === 0 || v > limits[i-1]));
  assert.equal(a.iterations,limits.length);
  assert.equal(a.distance,shortestLength(a.maze,a.start));
});

test('20 alumnos, un solo envío de estrategia, posiciones sin repetición, Start y Reset', () => {
  const room = new Room(() => {}, () => .25);
  room.join('admin-id','admin',true);
  for (let n=1;n<=20;n++) room.join(`u${n}`, `Alumno ${n}`);
  assert.throws(() => room.join('u21','Alumno 21'), /20 estudiantes/);
  assert.throws(() => room.select('admin-id','astar',{heuristic:'manhattan'}), /administrador/);
  for (let n=1;n<=20;n++) {
    room.select(`u${n}`,n%2?'astar':'ida',{heuristic:n%2?'manhattan':'weighted'});
    assert.throws(() => room.select(`u${n}`,'astar',{heuristic:'zero'}), /ya confirmada/);
  }
  assert.equal(room.snapshot().readyCount,20);
  assert.equal(new Set([...room.players.values()].filter((p)=>p.agent).map((p)=>p.agent.start.join(','))).size,20);
  assert.throws(() => room.start('u1'),/administrador/);
  assert.equal(room.start('admin-id'),20);
  assert.throws(() => room.select('u2','ida',{heuristic:'manhattan'}),/ronda está activa/);
  assert.equal(room.snapshot().leaderboard.length,20);
  room.reset('admin-id');
  assert.equal(room.phase,'lobby');
  assert.equal(room.snapshot().readyCount,0);
  assert.equal(room.round,2);
  assert.equal(room.maze.spawns.length,20);
  assert.equal(room.players.get('u1').algorithm,null);
  assert.doesNotThrow(() => room.select('u1','ida',{heuristic:'manhattan'}));
});

test('Puestos iguales cuando los dos llegan durante la misma expansión de simulación', () => {
  const room = new Room();
  room.join('admin','admin',true);room.join('a','Ana');room.join('b','Bruno');
  room.select('a','astar',{heuristic:'manhattan'});room.select('b','astar',{heuristic:'manhattan'});
  room.start('admin');
  for (const id of ['a','b']) {
    const a = room.players.get(id).agent;
    a.arrivedAt = Date.now();a.finishTick = 3;a.finishTurn = 2;
    a.status = 'finished';a.distance = 40;
  }
  assert.deepEqual(room.snapshot().leaderboard.map((p) => p.rank),[1,1]);
});


test('Cinco niveles de paredes: densidad graduada, mapas aleatorios, acceso garantizado', () => {
  const averages = [];
  for (let level = 1; level <= 5; level++) {
    const maps = [101,102,103,104,105].map((seed) => makeMaze(seed,level));
    const percent = maps.reduce((sum,m) => sum + m.wallPercent, 0) / maps.length;
    averages.push(percent);
    for (const maze of maps) {
      assert.equal(maze.complexity,level);
      assert.ok(maze.wallCount > 0);
      assert.ok(maze.spawns.every((p) => Number.isFinite(shortestLength(maze,p))));
      assert.ok(maze.maxSpawnDistance - maze.minSpawnDistance <= 4);
    }
    assert.notDeepEqual(maps[0].grid,maps[1].grid);
  }
  assert.deepEqual(DEFAULT_COMPLEXITY,3);
  assert.ok(averages.every((p,i) => i === 0 || p > averages[i-1] + 4),`Densidad creciente: ${averages}`);
  assert.ok(averages[2] >= 23 && averages[2] <= 26);
  assert.throws(() => makeMaze(1, 0),/complejidad/);
  assert.throws(() => makeMaze(1, 5.2),/complejidad/);
});

test('El administrador puede generar nuevo mapa sin borrar ni desbloquear confirmaciones', () => {
  const room = new Room(()=>{},()=>.2);
  room.join('ad','admin',true);
  room.join('a','Ana');room.join('b','Beto');
  room.select('a','astar',{heuristic:'manhattan'});
  room.select('b','ida',{heuristic:'euclidean'});
  const before = room.maze.grid;
  const version = room.mazeVersion;
  assert.throws(() => room.regenerate('a',5),/administrador/);
  assert.throws(() => room.regenerate('ad',0),/complejidad/);
  room.regenerate('ad',5);
  assert.equal(room.round,1);
  assert.equal(room.mazeVersion,version + 1);
  assert.equal(room.maze.complexity,5);
  assert.notDeepEqual(room.maze.grid,before);
  assert.equal(room.players.get('a').algorithm,'astar');
  assert.equal(room.players.get('b').params.heuristic,'euclidean');
  assert.equal(room.players.get('a').agent.maze,room.maze);
  assert.throws(() => room.select('a','ida',{heuristic:'zero'}),/ya confirmada/);
  room.start('ad');
  assert.throws(() => room.regenerate('ad',1),/antes de iniciar/);
  room.reset('ad');
  assert.equal(room.maze.complexity,5);
  assert.equal(room.players.get('a').algorithm,null);
  assert.doesNotThrow(() => room.regenerate('ad',2));
});
