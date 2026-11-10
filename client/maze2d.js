const COLORS = ['#16927d','#5565d6','#d17e3f','#a458b8','#248cb9','#bf5865','#898536','#45966e','#ed6b9a','#ac7c3d','#396fa6','#f08e52','#7b54c7','#45a39c','#bc608a','#689f42','#c86d55','#2d76a1','#b98c2e','#6e6bc9'];
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
    const dark = document.documentElement.dataset.theme === 'dark';
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
    ctx.shadowColor = dark ? '#00000066' : '#254e5a22'; ctx.shadowBlur = 20;
    ctx.fillStyle = dark ? '#304f59' : '#dfeae8'; ctx.fillRect(left - 8, originY - 8, cell * n + 16, cell * n + 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = dark ? '#102932' : '#fdfefd'; ctx.fillRect(left, originY, cell * n, cell * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = left + c * cell, y = originY + r * cell;
      if (maze.grid[r][c] === '#') {
        ctx.fillStyle = dark ? '#497884' : '#284e59';
        ctx.fillRect(x, y, cell + .5, cell + .5);
        if (cell > 6) {
          ctx.fillStyle = dark ? '#79aab3' : '#416977';
          ctx.fillRect(x + cell * .1, y + cell * .08, cell * .8, Math.max(.7, cell * .10));
        }
      } else if (cell > 10) {
        ctx.fillStyle = dark ? '#16353e' : '#eaf1f0';
        ctx.fillRect(x + cell * .08, y + cell * .08, cell * .84, cell * .84);
      }
    }

    // No dibujar puntos de inicio vacíos: solo aparecen los estudiantes reales.
    const own = players.find((p) => p.id === this.meId);
    if (this.trails && own?.explored?.length) {
      const unique = new Set(own.explored.map(([r, c]) => `${r},${c}`));
      ctx.fillStyle = dark ? '#5ce3bc99' : '#24b79e63';
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
      ctx.strokeStyle = p.arrivedAt !== null ? (isMine ? '#1bc8a5' : '#6eabf1') : (isMine ? '#0dba9db8' : dark ? '#729dccb0' : '#849fc19a');
      ctx.lineWidth = isMine ? Math.max(2, cell * .42) : Math.max(1.5, cell * .17);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }

    // Meta en verde azulado; no se usan puntos amarillos como accesos.
    const [gx, gy] = XY(maze.center);
    ctx.fillStyle = dark ? '#56e6c4' : '#139c87';
    ctx.fillRect(gx - cell * .55, gy - cell * .55, cell * 1.1, cell * 1.1);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, cell * .86)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('◆', gx, gy);

    // Las etiquetas pertenecen a fichas confirmadas, no a slots sin usar.
    // Si coinciden varias fichas, se separan ligeramente para identificarlas.
    const markers = players.filter((p) => p.algorithm && p.x !== null && p.z !== null);
    const occupancy = new Map();
    for (const p of markers) {
      const key = `${p.x},${p.z}`;
      if (!occupancy.has(key)) occupancy.set(key, []);
      occupancy.get(key).push(p);
    }
    const dots = [];
    for (const group of occupancy.values()) {
      const [cx, cy] = XY([group[0].x, group[0].z]);
      group.forEach((p, i) => {
        const angle = i * 2.399963229728653;
        const spread = group.length > 1 ? Math.min(18, 5 + Math.sqrt(i) * 3) : 0;
        const x = cx + Math.cos(angle) * spread;
        const y = cy + Math.sin(angle) * spread;
        dots.push({ p, x, y });
      });
    }
    dots.sort((a, b) => Number(a.p.id === this.meId) - Number(b.p.id === this.meId));
    for (const { p, x, y } of dots) {
      const color = agentColor(p, this.meId);
      const radius = Math.max(3.1, Math.min(6.8, cell * .52));
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = p.id === this.meId ? 2.4 : 1.2; ctx.stroke();
    }

    // Nombre visible junto a cada punto. Buscar posiciones que no se tapen;
    // una línea del mismo color conecta cada etiqueta con su ficha.
    const placed = [];
    for (const { p, x, y } of dots) {
      const name = String(p.name);
      const fontSize = 10;
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      const labelWidth = Math.ceil(ctx.measureText(name).width) + 13;
      const labelHeight = 17;
      const isMine = p.id === this.meId;
      const atStart = this.state.phase === 'lobby';
      const [r, c] = p.start;
      const side = r === 0 ? 0 : c === n - 1 ? 1 : r === n - 1 ? 2 : 3;
      // Preferir la etiqueta hacia fuera de la orilla durante la espera.
      const directions = atStart
        ? [side, (side + 1) % 4, (side + 3) % 4, (side + 2) % 4]
        : [0, 1, 3, 2];
      let best = null;
      for (const dir of directions) for (const distance of [12, 26, 43, 61]) {
        for (const offset of [0, -16, 16, -34, 34]) {
          let bx, by;
          if (dir === 0) { bx = x - labelWidth / 2 + offset; by = y - distance - labelHeight; }
          else if (dir === 1) { bx = x + distance; by = y - labelHeight / 2 + offset; }
          else if (dir === 2) { bx = x - labelWidth / 2 + offset; by = y + distance; }
          else { bx = x - distance - labelWidth; by = y - labelHeight / 2 + offset; }
          bx = Math.max(3, Math.min(width - labelWidth - 3, bx));
          by = Math.max(3, Math.min(height - labelHeight - 3, by));
          const rect = { x: bx, y: by, w: labelWidth, h: labelHeight };
          let collision = 0;
          for (const other of placed) {
            const dx = Math.max(0, Math.min(rect.x + rect.w + 3, other.x + other.w + 3) - Math.max(rect.x - 3, other.x - 3));
            const dy = Math.max(0, Math.min(rect.y + rect.h + 3, other.y + other.h + 3) - Math.max(rect.y - 3, other.y - 3));
            collision += dx * dy;
          }
          const score = collision * 10 + distance + Math.abs(offset) * .4 + directions.indexOf(dir) * 5;
          if (!best || score < best.score) best = { ...rect, score };
        }
      }
      const { x: bx, y: by, w, h } = best;
      placed.push(best);
      const nearX = Math.max(bx, Math.min(bx + w, x));
      const nearY = Math.max(by, Math.min(by + h, y));
      const color = agentColor(p, this.meId);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nearX, nearY);
      ctx.lineWidth = isMine ? 1.8 : 1; ctx.strokeStyle = color; ctx.stroke();
      ctx.fillStyle = dark ? '#0c222deF' : '#f7fdfcf2';
      ctx.strokeStyle = color; ctx.lineWidth = isMine ? 1.7 : 1;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 4); ctx.fill(); ctx.stroke();
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = dark ? '#f0fbf8' : '#1b393b';
      ctx.fillText(name, bx + 6, by + h / 2 + .4);
    }
    ctx.restore();
  }
}
