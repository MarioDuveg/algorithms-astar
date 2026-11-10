import { ALGORITHMS, createAgent, normalizeParams, stepAgent } from '../shared/algorithms.js';
import { makeMaze, shortestLength } from '../shared/maze.js';

export class Room {
  constructor(onChange = () => {}, rng = Math.random) {
    this.players = new Map();
    this.phase = 'lobby';
    this.round = 1;
    this.startedAt = null;
    this.finishedAt = null;
    this.onChange = onChange;
    this.rng = rng;
    this.sequence = 0;
    this.tickNumber = 0;
    this.maze = makeMaze(2026);
  }

  join(id, name, isAdmin = false) {
    if (this.players.size >= 100) throw new Error('Capacidad máxima de 100 usuarios');
    if ([...this.players.values()].some((p) => p.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw new Error('Ese nombre ya está en uso');
    const player = { id, name, isAdmin, online: true, algorithm: null, params: null, agent: null, participating: false, order: ++this.sequence };
    this.players.set(id, player); this.onChange(); return player;
  }

  setOnline(id, online) {
    const p = this.players.get(id);
    if (!p || p.online === online) return;
    p.online = online; this.onChange();
  }

  remove(id) {
    if (this.players.delete(id)) {
      if (this.phase === 'running') this.checkFinish();
      this.onChange();
    }
  }

  select(id, algorithm, rawParams) {
    const p = this.players.get(id);
    if (!p) throw new Error('Debes iniciar sesión');
    if (this.phase !== 'lobby') throw new Error('La ronda está activa. Espera el reinicio del administrador.');
    if (!ALGORITHMS.some((a) => a.id === algorithm)) throw new Error('Selecciona un algoritmo válido');
    p.algorithm = algorithm;
    p.params = normalizeParams(rawParams);
    // Puertas cardinales rotadas: todas tienen el mismo camino óptimo.
    const side = (p.order - 1) % 4;
    p.agent = createAgent(this.maze, side, algorithm, p.params);
    p.participating = false;
    this.onChange();
    return p;
  }

  start(id) {
    const p = this.players.get(id);
    if (!p?.isAdmin) throw new Error('Acción exclusiva del administrador');
    if (this.phase !== 'lobby') throw new Error('La ronda ya comenzó');
    const eligible = [...this.players.values()].filter((v) => v.online && v.algorithm && v.agent);
    if (!eligible.length) throw new Error('Se necesita al menos un jugador con algoritmo seleccionado');
    for (const v of this.players.values()) {
      v.participating = eligible.includes(v);
      if (v.participating) v.agent.status = 'active';
    }
    this.phase = 'running'; this.startedAt = Date.now(); this.finishedAt = null;
    this.tickNumber = 0;
    this.onChange(); return eligible.length;
  }

  reset(id) {
    if (!this.players.get(id)?.isAdmin) throw new Error('Acción exclusiva del administrador');
    this.phase = 'lobby'; this.round++;
    this.startedAt = null; this.finishedAt = null; this.tickNumber = 0;
    // Un único laberinto NUEVO por ronda, siempre simétrico.
    this.maze = makeMaze(1000 + Math.floor(this.rng() * 1_000_000_000));
    for (const v of this.players.values()) {
      v.algorithm = null; v.params = null; v.agent = null; v.participating = false;
    }
    this.onChange();
  }

  checkFinish() {
    const competing = [...this.players.values()].filter((p) => p.participating);
    if (this.phase === 'running' && (!competing.length || competing.every((p) => p.agent.status === 'finished'))) {
      this.phase = 'finished'; this.finishedAt = Date.now();
    }
  }

  tick() {
    if (this.phase !== 'running') return;
    this.tickNumber++;
    const BUDGET = 4; // Igual número máximo de expansiones por pulso para cada agente.
    for (let i = 1; i <= BUDGET; i++) {
      for (const p of this.players.values()) {
        if (!p.participating || !p.online || p.agent?.status !== 'active') continue;
        stepAgent(p.agent);
        if (p.agent.arrivedAt !== null && p.agent.finishTick === null) {
          p.agent.finishTick = this.tickNumber;
          p.agent.finishTurn = i;
        }
      }
    }
    this.checkFinish(); this.onChange();
  }

  snapshot() {
    const players = [...this.players.values()].map((p) => {
      const a = p.agent;
      return {
        id: p.id, name: p.name, isAdmin: p.isAdmin, online: p.online,
        algorithm: p.algorithm, params: p.params, participating: p.participating,
        status: a?.status ?? 'waiting', reason: a?.reason ?? '',
        x: a?.x ?? null, z: a?.z ?? null,
        start: a?.start ?? null,
        steps: a?.steps ?? 0, expansions: a?.expansions ?? 0,
        generated: a?.generated ?? 0, iterations: a?.iterations ?? 0,
        limit: a?.limit ?? null, distance: a?.distance ?? null,
        arrivedAt: a?.arrivedAt ?? null, finishTick: a?.finishTick ?? null,
        finishTurn: a?.finishTurn ?? null, path: a?.path ?? [],
        explored: a?.explored.slice(-160) ?? [], order: p.order,
      };
    });
    const leaderboard = players.filter((p) => p.participating).sort((a, b) => {
      if (a.arrivedAt !== null && b.arrivedAt === null) return -1;
      if (b.arrivedAt !== null && a.arrivedAt === null) return 1;
      if (a.arrivedAt !== null && b.arrivedAt !== null)
        return a.finishTick - b.finishTick || a.finishTurn - b.finishTurn || a.order - b.order;
      return a.order - b.order;
    });
    let lastTick = null, lastTurn = null, place = 0;
    leaderboard.forEach((p, index) => {
      if (p.arrivedAt === null) { p.rank = null; return; }
      if (p.finishTick !== lastTick || p.finishTurn !== lastTurn) place = index + 1;
      p.rank = place; lastTick = p.finishTick; lastTurn = p.finishTurn;
    });
    return {
      phase: this.phase, round: this.round,
      startedAt: this.startedAt, finishedAt: this.finishedAt,
      onlineCount: players.filter((p) => p.online).length,
      readyCount: players.filter((p) => p.online && p.algorithm).length,
      activeCount: players.filter((p) => p.participating && p.status === 'active').length,
      arrivedCount: leaderboard.filter((p) => p.arrivedAt !== null).length,
      players, leaderboard, maze: this.maze,
      optimalLength: shortestLength(this.maze, this.maze.spawns[0]),
    };
  }
}
