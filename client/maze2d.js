const COLORS = ['#16927d', '#5565d6', '#d17e3f', '#a458b8', '#248cb9', '#bf5865', '#898536', '#45966e'];
export function agentColor(player, meId) {
  return player.id === meId ? '#0d927c' : COLORS[(player.order - 1) % COLORS.length];
}

/** Renderizador Canvas 2D del mapa compartido y las rutas de búsqueda. */
export class MazeView {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.state = null; this.meId = null; this.trails = true;
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.drag = null;
    const refresh = () => this.draw();
    new ResizeObserver(refresh).observe(canvas);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(.7, Math.min(3.2, this.zoom * (e.deltaY < 0 ? 1.12 : .89)));
      this.draw();
    }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, px: this.panX, py: this.panY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.panX = this.drag.px + e.clientX - this.drag.x;
      this.panY = this.drag.py + e.clientY - this.drag.y;
      this.draw();
    });
    canvas.addEventListener('pointerup', () => { this.drag = null; });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
  }
  home() { this.zoom = 1; this.panX = 0; this.panY = 0; this.draw(); }
  zoomIn() { this.zoom = Math.min(3.2, this.zoom * 1.2); this.draw(); }
  setState(state, meId) { this.state = state; this.meId = meId; this.draw(); }
  draw() {
    if (!this.ctx) return;
    const { canvas, ctx } = this;
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width, height = bounds.height;
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!this.state?.maze) return;
    const { maze, players } = this.state;
    const n = maze.size;
    // Dejar espacio visible para encabezado y HUD superpuestos.
    const top = height > 480 ? 119 : 104;
    const bottom = height > 470 ? 112 : 96;
    const side = width > 700 ? 86 : 48;
    const baseCell = Math.min((width - side) / n, (height - top - bottom) / n);
    const cell = Math.max(2, baseCell) * this.zoom;
    const left = (width - n * cell) / 2 + this.panX;
    const originY = top + (Math.max(0, height - top - bottom) - n * cell) / 2 + this.panY;
    const XY = (p) => [left + (p[1] + .5) * cell, originY + (p[0] + .5) * cell];

    ctx.save();
    ctx.shadowColor = '#254e5a22'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#dfeae8'; ctx.fillRect(left - 8, originY - 8, cell * n + 16, cell * n + 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fdfefd'; ctx.fillRect(left, originY, cell * n, cell * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = left + c * cell, y = originY + r * cell;
      if (maze.grid[r][c] === '#') {
        ctx.fillStyle = '#284e59';
        ctx.fillRect(x, y, cell + .5, cell + .5);
        if (cell > 6) {
          ctx.fillStyle = '#416977';
          ctx.fillRect(x + cell * .1, y + cell * .08, cell * .8, Math.max(.7, cell * .10));
        }
      } else if (cell > 10) {
        ctx.fillStyle = '#eaf1f0';
        ctx.fillRect(x + cell * .08, y + cell * .08, cell * .84, cell * .84);
      }
    }

    const own = players.find((p) => p.id === this.meId);
    if (this.trails && own?.explored?.length) {
      const unique = new Set(own.explored.map(([r, c]) => `${r},${c}`));
      ctx.fillStyle = '#24b79e63';
      for (const key of unique) {
        const [r, c] = key.split(',').map(Number);
        ctx.fillRect(left + c * cell + cell * .2, originY + r * cell + cell * .2, cell * .6, cell * .6);
      }
    }
    // Mostrar primero otras rutas y luego la ruta propia en primer plano.
    for (const p of [...players.filter((p) => p.id !== this.meId), ...players.filter((p) => p.id === this.meId)]) {
      if (!p.algorithm || p.path.length < 2) continue;
      const isMine = p.id === this.meId;
      ctx.beginPath();
      p.path.forEach((point, i) => {
        const [x, y] = XY(point);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = p.arrivedAt !== null ? (isMine ? '#05957b' : '#4c83bf') : (isMine ? '#0d9c84b8' : '#849fc19a');
      ctx.lineWidth = isMine ? Math.max(2, cell * .42) : Math.max(1.5, cell * .17);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }

    const [gx, gy] = XY(maze.center);
    ctx.fillStyle = '#f4c86c';
    ctx.fillRect(gx - cell * .51, gy - cell * .51, cell * 1.02, cell * 1.02);
    ctx.fillStyle = '#9c6322';
    ctx.font = `${Math.max(9, cell * .88)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', gx, gy + cell * .04);

    const byCell = new Map();
    for (const p of players) {
      if (!p.algorithm || p.x === null) continue;
      const k = `${p.x},${p.z}`;
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(p);
    }
    for (const group of byCell.values()) {
      const [cx, cy] = XY([group[0].x, group[0].z]);
      group.forEach((p, i) => {
        const a = i * Math.PI * 2 / Math.min(5, group.length);
        const radius = group.length === 1 ? 0 : Math.min(cell * .26, 5);
        const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
        const r = Math.max(2.3, Math.min(7, cell * .47));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = agentColor(p, this.meId);
        ctx.fill(); ctx.lineWidth = p.id === this.meId ? 2.5 : 1.5;
        ctx.strokeStyle = '#fff'; ctx.stroke();
      });
    }
    // Etiquetas de entrada en los cuatro puntos del exterior.
    const labels = ['N', 'E', 'S', 'O'];
    maze.spawns.forEach((p, i) => {
      const [x, y] = XY(p);
      ctx.font = `700 ${Math.max(8, Math.min(12, cell * .72))}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff'; ctx.fillText(labels[i], x, y);
    });
    ctx.restore();
  }
}
