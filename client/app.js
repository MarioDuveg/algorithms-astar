import { ALGORITHMS, HEURISTICS, DEFAULT_PARAMS } from '/shared/algorithms.js';
import { MazeView, agentColor } from './maze2d.js';

const $ = (selector) => document.querySelector(selector);
const scene = new MazeView($('#terrain-canvas'));
const algoById = new Map(ALGORITHMS.map((a) => [a.id, a]));
const hById = new Map(HEURISTICS.map((h) => [h.id, h]));
const paramsByAlgorithm = new Map();
let me = null, state = null, stream = null;
let selectedAlgorithm = null, pending = false, confirming = false, lastRound = null, lastPhase = null;
let toastTimer = null;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const initials = (name) => [...name][0]?.toLocaleUpperCase('es') || '?';

function showToast(message, error = false) {
  const node = $('#toast'); node.textContent = message;
  node.classList.toggle('error', error); node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3300);
}
async function request(endpoint, payload = {}) {
  let response;
  try { response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
  catch { throw new Error('No se pudo establecer conexión con el servidor.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}
function ownPlayer() { return state?.players.find((p) => p.id === me?.id); }
function lockedSelection() { return Boolean(ownPlayer()?.algorithm) || confirming; }
function chooseAlgorithm(id) {
  if (!algoById.has(id) || (state && state.phase !== 'lobby') || lockedSelection() || me?.isAdmin) return;
  selectedAlgorithm = id; pending = true;
  if (!paramsByAlgorithm.has(id)) paramsByAlgorithm.set(id, { ...DEFAULT_PARAMS });
  renderAlgorithms(); renderParameters(); renderSelection();
}
function renderAlgorithms() {
  const own = ownPlayer();
  const disabled = Boolean(own?.algorithm) || confirming || state?.phase !== 'lobby' || me?.isAdmin;
  $('#algo-list').innerHTML = ALGORITHMS.map((algo, i) => `
    <button type="button" class="algo-card ${selectedAlgorithm === algo.id ? 'active' : ''} ${own?.algorithm === algo.id ? 'ready' : ''}"
      data-algorithm="${algo.id}" aria-pressed="${selectedAlgorithm === algo.id}" ${disabled ? 'disabled' : ''}>
      <span class="algo-number">${String(i + 1).padStart(2, '0')}</span>
      <span class="algo-info"><strong>${esc(algo.name)}</strong><small>${esc(algo.short)}</small><em>${esc(algo.kind.toUpperCase())}</em></span>
    </button>`).join('');
  $('#algo-list').querySelectorAll('[data-algorithm]').forEach((b) => b.addEventListener('click', () => chooseAlgorithm(b.dataset.algorithm)));
}
function renderParameters() {
  const panel = $('#params-panel');
  if (!selectedAlgorithm) {
    panel.innerHTML = '<p class="note">Selecciona A* o IDA* para elegir una heurística.</p>';
    $('#param-subtitle').textContent = 'POR DEFINIR'; return;
  }
  const algo = algoById.get(selectedAlgorithm);
  const selected = paramsByAlgorithm.get(selectedAlgorithm) || { ...DEFAULT_PARAMS };
  $('#param-subtitle').textContent = 'HEURÍSTICA';
  panel.innerHTML = `
    <p class="algo-description">${esc(algo.description)}</p>
    <div class="parameter"><label class="parameter-top" for="heuristic-select"><span>Función h(n)</span></label>
      <select id="heuristic-select" class="param-select" aria-label="Selecciona tu heurística">
        ${HEURISTICS.map((h) => `<option value="${h.id}" ${selected.heuristic === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
      </select>
      <div id="heuristic-detail" class="heuristic-detail"></div>
    </div>
    <div class="fairness-tip"><strong>La misma pista para todos</strong><span>20 accesos aleatorios, 5 por orilla. Las distancias mínimas pueden diferir hasta 4 pasos y se muestran al confirmar. Ambos algoritmos reciben el mismo número de expansiones por pulso.</span></div>`;
  const select = $('#heuristic-select');
  const update = () => {
    const h = hById.get(select.value);
    $('#heuristic-detail').innerHTML = `<span class="formula">h(n) = ${esc(h.formula)}</span><span>${esc(h.description)}</span>`;
  };
  select.addEventListener('change', () => {
    if (lockedSelection()) return;
    paramsByAlgorithm.get(selectedAlgorithm).heuristic = select.value;
    pending = true; update(); renderSelection();
  });
  update();
}
function renderSelection() {
  const button = $('#select-btn'), note = $('#selection-note');
  const own = ownPlayer();
  const canEdit = Boolean(me && !me.isAdmin) && state?.phase === 'lobby' && !own?.algorithm && !confirming;
  button.disabled = !selectedAlgorithm || !canEdit;
  $('#algo-list').style.opacity = canEdit || !state ? '1' : '.56';
  const dropdown = $('#heuristic-select'); if (dropdown) dropdown.disabled = !canEdit;
  if (me?.isAdmin) {
    button.innerHTML = 'Administrador / observador <span>✓</span>';
    note.textContent = 'Los estudiantes confirman su estrategia. Puedes iniciar o reiniciar la ronda.';
    note.classList.add('note-ready');
  } else if (own?.algorithm) {
    button.innerHTML = 'Estrategia bloqueada <span>✓</span>';
    note.textContent = `Confirmación única. Inicio: (${own.start.join(', ')}). Ruta óptima desde tu posición: ${own.optimalLength} pasos. Solo Reset permite volver a elegir.`;
    note.classList.add('note-ready');
  } else if (state && state.phase !== 'lobby') {
    note.textContent = state.phase === 'running' ? 'La carrera está en curso. Espera a Reset.' : 'Carrera terminada. El administrador puede reiniciar.';
    note.classList.remove('note-ready');
  } else {
    button.innerHTML = 'Confirmar estrategia <span>→</span>';
    note.textContent = confirming ? 'Registrando tu única confirmación…' : 'Antes de confirmar puedes cambiar tu elección; después quedará bloqueada hasta Reset.';
    note.classList.remove('note-ready');
  }
}
function drawLeaderboard() {
  const rankings = state?.leaderboard || [];
  if (!rankings.length) {
    $('#leaderboard').innerHTML = '<div class="empty-rank">Al pulsar Start, aquí aparecerán quienes compiten por llegar primero al centro.</div>';
    return;
  }
  $('#leaderboard').innerHTML = rankings.map((p) => {
    const color = agentColor(p, me?.id);
    const heuristicName = hById.get(p.params?.heuristic)?.name || '';
    const arrived = p.arrivedAt !== null;
    const status = arrived ? 'Meta alcanzada' : p.status === 'active' ? 'Buscando centro' : p.status === 'finished' ? 'Sin solución' : 'En espera';
    return `<div class="rank-item ${p.id === me?.id ? 'is-me' : ''} ${arrived ? 'rank-finished' : ''}">
      <span class="rank-number">${p.rank ? String(p.rank).padStart(2, '0') : '—'}</span>
      <span class="rank-avatar" style="color:${color};background:${color}19;border-color:${color}65">${esc(initials(p.name))}</span>
      <span class="rank-main"><strong>${esc(p.name)}${p.isAdmin ? ' ◈' : ''}</strong><small>${esc(algoById.get(p.algorithm)?.name)} · ${esc(heuristicName)}</small><small>${status}</small></span>
      <span class="rank-score"><strong>${arrived ? `${p.distance} p.` : p.expansions}</strong><small>${arrived ? `${p.expansions} exp.` : 'expansiones'}</small></span>
    </div>`;
  }).join('');
}
function drawRoom() {
  const players = state?.players || [];
  $('#room-players').innerHTML = players.map((p) => `<div class="room-player">
    <span class="room-player-name"><i class="${p.online && p.algorithm ? 'ready' : ''}"></i><span>${esc(p.name)}${p.id === me?.id ? ' (tú)' : ''}</span></span>
    <small>${p.algorithm ? `${esc(algoById.get(p.algorithm)?.name)} · ${esc(hById.get(p.params?.heuristic)?.name)}` : 'Sin elegir'}</small>
  </div>`).join('') || '<div class="note">No hay jugadores conectados.</div>';
}
function updateClock() {
  const milliseconds = state?.startedAt ? (state.finishedAt || Date.now()) - state.startedAt : 0;
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  $('#time-counter').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function applyState(next) {
  const oldRound = lastRound, oldPhase = lastPhase;
  state = next; lastRound = state.round; lastPhase = state.phase;
  const own = state.players.find((p) => p.id === me?.id);
  if (oldRound !== null && oldRound !== state.round) {
    selectedAlgorithm = null; paramsByAlgorithm.clear(); pending = false; confirming = false;
    renderParameters(); showToast('Nueva ronda y nuevo laberinto: elige tu estrategia.');
  } else if (own?.algorithm && !selectedAlgorithm) {
    selectedAlgorithm = own.algorithm;
    paramsByAlgorithm.set(own.algorithm, { ...own.params }); pending = false;
    renderParameters();
  }
  if (oldPhase === 'lobby' && state.phase === 'running') showToast('¡Comienza la carrera hacia el centro!');
  if (oldPhase === 'running' && state.phase === 'finished') showToast('La ronda ha terminado.');
  $('#round-label').textContent = `RONDA ${String(state.round).padStart(2, '0')}`;
  $('#phase-label').textContent = ({ lobby: 'SALA DE ESPERA', running: 'CARRERA EN VIVO', finished: 'RONDA FINALIZADA' })[state.phase];
  $('#users-count').textContent = String(state.onlineCount).padStart(2, '0');
  $('#ready-count').textContent = String(state.readyCount).padStart(2, '0');
  $('#optimal-length').textContent = Array.isArray(state.optimalLength) ? state.optimalLength.join('–') : '—';
  $('#start-btn').disabled = state.phase !== 'lobby' || !state.readyCount;
  scene.setState(state, me?.id);
  renderAlgorithms(); renderSelection(); drawLeaderboard(); drawRoom(); updateClock();

  const prompt = $('#map-prompt');
  prompt.hidden = Boolean(own?.algorithm) || state.readyCount > 0;
  if (!prompt.hidden) {
    prompt.innerHTML = state.phase === 'lobby'
      ? '<span class="map-prompt-icon">◎</span><strong>La carrera está por comenzar</strong><span>Elige A* o IDA* y confirma una sola vez: te asignaremos una orilla aleatoria.</span>'
      : '<span class="map-prompt-icon">◌</span><strong>Carrera en curso</strong><span>El administrador puede iniciar una nueva ronda.</span>';
  }
  const hud = $('#my-hud'); hud.hidden = !own?.algorithm;
  if (own?.algorithm) {
    $('#hud-expansions').textContent = own.expansions;
    $('#hud-distance').textContent = own.distance === null ? '—' : own.distance;
    $('#hud-iterations').textContent = own.iterations;
    $('#hud-temp-block').hidden = own.algorithm !== 'ida';
    if (own.algorithm === 'ida') $('#hud-temp').textContent = Number(own.limit).toFixed(1);
  }
}
function openStream() {
  if (stream) stream.close();
  stream = new EventSource('/api/events');
  stream.addEventListener('state', (event) => {
    try { applyState(JSON.parse(event.data)); }
    catch (error) { console.error('Error de actualización SSE:', error); }
  });
  stream.addEventListener('error', () => {
    if (stream?.readyState === EventSource.CLOSED && me) showToast('Conexión perdida. Actualiza para iniciar sesión.', true);
  });
}
function enter(response) {
  me = response.player;
  $('#auth-screen').hidden = true; $('#account-box').hidden = false;
  $('#account-name').textContent = me.name;
  $('#account-avatar').textContent = initials(me.name);
  $('#admin-controls').hidden = !me.isAdmin;
  applyState(response.state); openStream();
}
$('#login-name').addEventListener('input', () => {
  $('#password-field').hidden = $('#login-name').value.trim().toLocaleLowerCase('es') !== 'admin';
  $('#login-error').hidden = true;
});
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const button = $('#login-form button[type=submit]');
  button.disabled = true; $('#login-error').hidden = true;
  try {
    const response = await request('/api/login', { name: $('#login-name').value, password: $('#login-password').value });
    enter(response); showToast(`Bienvenido a la carrera, ${me.name}.`);
  } catch (error) {
    $('#login-error').textContent = error.message; $('#login-error').hidden = false;
  } finally { button.disabled = false; }
});
$('#select-btn').addEventListener('click', async () => {
  if (!selectedAlgorithm || state?.phase !== 'lobby' || lockedSelection() || me?.isAdmin) return;
  confirming = true; $('#select-btn').disabled = true; renderAlgorithms();
  try {
    const response = await request('/api/select', { algorithm: selectedAlgorithm, params: paramsByAlgorithm.get(selectedAlgorithm) || DEFAULT_PARAMS });
    pending = false; applyState(response.state);
    showToast('Estrategia confirmada y bloqueada hasta la próxima ronda.');
  } catch (error) { showToast(error.message, true); }
  finally { confirming = false; renderAlgorithms(); renderSelection(); }
});
$('#start-btn').addEventListener('click', async () => {
  try {
    const response = await request('/api/start'); applyState(response.state);
    showToast(`${response.count} participante(s) comienzan a explorar.`);
  } catch (error) { showToast(error.message, true); }
});
$('#reset-btn').addEventListener('click', async () => {
  if (!window.confirm('¿Nueva ronda? Se generará otro laberinto incompleto de 65×65, se sortearán las 20 entradas y las estrategias podrán elegirse de nuevo.')) return;
  try { applyState((await request('/api/reset')).state); }
  catch (error) { showToast(error.message, true); }
});
$('#logout-btn').addEventListener('click', async () => {
  if (stream) { stream.close(); stream = null; }
  try { await request('/api/logout'); } catch { /* Limpieza visual. */ }
  me = null; state = null; selectedAlgorithm = null; lastRound = null; lastPhase = null; pending = false; confirming = false;
  paramsByAlgorithm.clear(); scene.setState(null, null);
  $('#auth-screen').hidden = false; $('#account-box').hidden = true;
  $('#admin-controls').hidden = true; $('#login-password').value = '';
  renderAlgorithms(); renderParameters(); renderSelection(); $('#login-name').focus();
});
$('#home-camera').addEventListener('click', () => scene.home());
$('#spin-camera').addEventListener('click', () => scene.zoomIn());
$('#toggle-trails').addEventListener('click', (e) => {
  scene.trails = !scene.trails;
  e.currentTarget.classList.toggle('active', scene.trails);
  scene.draw();
});
$('#toggle-trails').classList.add('active');
setInterval(updateClock, 1000);
renderAlgorithms(); renderParameters(); renderSelection();
fetch('/api/me', { credentials: 'same-origin' }).then(async (r) => r.ok ? r.json() : null)
  .then((response) => response ? enter(response) : $('#login-name').focus())
  .catch(() => $('#login-name').focus());

// Tema visual independiente de la carrera. La preferencia queda en el navegador.
function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-icon').textContent = dark ? '☀' : '☾';
  $('#theme-label').textContent = dark ? 'Claro' : 'Oscuro';
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#07131a' : '#eef4f5';
  try { localStorage.setItem('maze-race-theme', theme); } catch { /* Sin almacenamiento persistente. */ }
  scene.draw();
}
let storedTheme = null;
try { storedTheme = localStorage.getItem('maze-race-theme'); } catch { /* Preferencia local opcional. */ }
setTheme(storedTheme === 'dark' || (storedTheme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
