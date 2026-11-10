# Maze Race — A* vs IDA*

Arena **multijugador, en español**, para enseñar y competir con los algoritmos A* e IDA* en un **laberinto cuadrado compartido**. Adaptación del proyecto original Summit Lab. Conserva el inicio de sesión, el rol administrador, Start / Reset, las actualizaciones en vivo mediante SSE, el ranking y los recorridos visibles en Canvas 2D. No requiere paquetes externos.

## Reglas de la carrera

- Todos los participantes comienzan **fuera del laberinto**, en una de las cuatro puertas cardinales: norte, este, sur u oeste.
- **Un mismo laberinto** para todos durante cada ronda. Tiene **simetría rotacional exacta de 90°**: los cuatro sectores contienen los mismos pasillos y obstáculos girados. Las cuatro entradas tienen **idéntica distancia óptima** hasta la celda central.
- La entrada depende del orden de ingreso, asignada circularmente. Si hay más de cuatro competidores, comparten puertas (superposición visual). El orden de expansión de vecinos también se rota con la entrada para evitar ventajas en los desempates algorítmicos.
- Cada jugador elige **A*** o **IDA*** y una de las cinco heurísticas. Ambos reciben el mismo presupuesto: **cuatro expansiones de nodos por pulso** (por defecto, cada 180 ms). La velocidad es deliberadamente pedagógica, no una medición de rendimiento de CPU.
- Gana quien llega antes al centro según el **pulso de llegada y la expansión dentro de ese pulso**; llegadas simultáneas se consideran empate y comparten puesto. Antes de la llegada, la clasificación muestra un guion y el número de expansiones, no una posición provisional inventada.
- El mapa muestra los agentes y sus rutas actuales, la ruta final una vez alcanzado el centro y (en el usuario propio) los nodos recientemente explorados. Permite hacer zoom con rueda, arrastrar, restablecer zoom o alternar los nodos explorados.
- **Start** es exclusivo del administrador. **Reset** genera un nuevo laberinto simétrico para todos, borra el progreso y obliga a confirmar nuevas estrategias, sin cerrar sesiones.

## Algoritmos y heurísticas

### A*

Mantiene una frontera ordenada mediante montículo binario, con `f = g + h`. Utiliza costo acumulado `g`, el mejor costo por celda y predecesores para reconstruir un camino válido. Un nodo extraído con costo obsoleto se ignora. En cada expansión analiza hasta cuatro vecinos transitables.

### IDA*

Aplica búsqueda en profundidad iterativa con límite `f = g + h`. Cuando `f > límite` se registra el menor valor excedido, sin expandir esa rama. Una vez agotada la pasada se actualiza el límite y se reinicia la búsqueda desde la entrada. El retroceso evita ciclos en el camino **actual**; se implementó con una pila explícita para pausar la recursión entre pulsos, lo que permite visualizar las sucesivas iteraciones.

| Heurística | Fórmula | ¿Garantiza camino óptimo?* |
| --- | --- | --- |
| Manhattan | `abs(Δfila) + abs(Δcolumna)` | Sí |
| Euclidiana | `sqrt(Δfila² + Δcolumna²)` | Sí |
| Chebyshev | `max(abs(Δfila),abs(Δcolumna))` | Sí |
| Cero / Dijkstra | `0` | Sí |
| Manhattan × 1.5 | `1.5 × Manhattan` | **No** |

\* Con movimientos ortogonales de costo 1, este grafo finito y las condiciones implementadas. La heurística ponderada es intencionalmente no admisible, para demostrar la diferencia entre eficiencia exploratoria y garantía de optimalidad. En IDA* también puede modificar los límites de búsqueda significativamente.

## Cómo ejecutarlo

Necesitas **Node.js 20+**.

```bash
npm install
npm start
```

Abre **http://localhost:10000**. En varias pestañas, dispositivos o navegadores conectados al mismo servidor puedes representar estudiantes distintos.

- **Administrador:** usuario `admin`. La contraseña predeterminada *solo para demostración local* es `Admin2026`; en producción configura `ADMIN_PASSWORD`.
- **Estudiantes:** nombres únicos de 2 a 24 caracteres, sin contraseña.
- Los estudiantes confirman una estrategia antes de Start. No se pueden hacer cambios en medio de la ronda.
- En Render, sube el repositorio a GitHub/GitLab y usa el archivo `render.yaml` o crea un Web Service con `npm install` / `npm start`. Configura **`ADMIN_PASSWORD`** como secreto; **nunca publiques la contraseña de demostración**.

### Pruebas

```bash
npm run check
npm test
```

Incluyen: simetría del laberinto, igualdad de caminos óptimos desde las cuatro puertas, invariancia de expansiones respecto de la entrada, validez de rutas, optimalidad con heurísticas admisibles, crecimiento de umbrales de IDA*, clasificación y empates, controles del administrador y ciclo de vida de la API.

## Estructura

```text
client/index.html       Pantalla de acceso, mapa y paneles
client/styles.css       Estilos responsivos
client/app.js           Eventos, formularios, ranking y SSE
client/maze2d.js        Vista Canvas con rutas y agentes
shared/maze.js          Generación determinista y simétrica del laberinto
shared/algorithms.js    A*, IDA*, heurísticas y ejecución por expansión
server/room.js          Sala, participantes y reglas de carrera
server/index.js         Servidor web y API (sin dependencias)
tests/                  Pruebas de algoritmos e integración
render.yaml             Despliegue en Render
```

## Notas técnicas

- Laberinto de 33×33 celdas, un único centro, costo 1 por movimiento y cuatro vecinos ortogonales. Cada sector se construye con DFS aleatorizada y luego se rota tres veces. Las puertas de la primera ronda se crean con una semilla fija para permitir ejemplos reproducibles; cada Reset genera otra semilla compartida.
- La simulación es autoritativa en el servidor: el navegador no puede enviar movimientos, posiciones o resultados. Los estados se envían por Server-Sent Events (SSE).
- Los tiempos en el ranking son **tiempos de simulación** basados en pulsos y expansiones, no microbenchmarks. La visualización del recorrido de A* representa la ruta de padres del nodo expandido actualmente, no una caminata continua del agente en tiempo físico.
- La heurística cero en IDA* puede requerir muchas iteraciones; se limita a 100 000 expansiones por agente como protección.
- El estado está en memoria, es adecuado para un servidor de clase de una única instancia y se pierde al reiniciar la aplicación. Un servidor en Render gratuito puede suspenderse por inactividad.
- La ronda se termina cuando han acabado todos los participantes. Si un jugador se desconecta, su agente queda pausado hasta volver a conectarse o salir de la sala.
