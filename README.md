# Maze Race — A* vs IDA* · edición 20 estudiantes

Carrera multijugador en español para comparar **A*** e **IDA*** sobre el **mismo laberinto cuadrado 65×65**. Basado en el proyecto original Summit Lab. Incluye acceso de estudiantes, administrador, botón Start/Reset, ranking de llegada, recorrido de cada buscador, cinco heurísticas y tema claro/oscuro. Solo necesita **Node.js 20 o superior**, sin paquetes npm externos.

## Cambios de esta edición

- **Tablero de 65×65 celdas** (antes 33×33), con paredes sueltas, obstáculos en L, segmentos cortos y patios de 5×5 o mayores. No es obligatorio que las paredes formen pasillos cerrados. El terreno se genera a partir de una semilla y se regenera con **Reset**.
- **20 accesos exteriores exclusivos**, cinco en cada borde. Los lugares se sortean al crear el laberinto; su distribución también cambia al reiniciar. Cada estudiante recibe uno distinto en el momento de confirmar su estrategia.
- El mapa sigue siendo el **mismo para todos**, con simetría rotacional de 90°. Para reducir la ventaja geográfica, las 20 posiciones se sortean dentro de una banda de longitud óptima de **como máximo cuatro pasos de diferencia**, calculada por búsqueda en anchura. Esto NO implica distancias exactamente iguales ni garantiza el mismo número de expansiones: la interfaz muestra la longitud óptima personal y el rango de la ronda. El origen exacto es aleatorio; no se debe interpretar la clasificación como una comparación experimental controlada únicamente de heurísticas.
- Las cuatro avenidas centrales están interrumpidas por pequeños tramos de muro, pero se han abierto desvíos para **garantizar un camino** desde cualquiera de los 20 inicios hasta el centro. El borde exterior permanece transitable.
- **Confirmar estrategia solo una vez por ronda:** la interfaz bloquea A*, IDA*, el selector de heurística y el botón. El **servidor también rechaza una segunda confirmación**, incluso al repetir manualmente la petición. Solo **Reset** permite elegir otra vez.
- **Modo claro / modo oscuro**, desde el botón en la esquina superior derecha. Cambia toda la interfaz y los colores del Canvas; la preferencia queda guardada en el navegador.
- Hasta **20 estudiantes y un administrador** conectados al mismo tiempo. El administrador dirige la carrera, sin ocupar una de las 20 posiciones.

## Reglas

Cada estudiante elige entre **A*** e **IDA*** y una heurística:

| Heurística | Fórmula | ¿Admisible en este tablero? |
|---|---|---|
| Manhattan | `abs(Δfila) + abs(Δcolumna)` | Sí |
| Euclidiana | `sqrt(Δfila²+Δcolumna²)` | Sí |
| Chebyshev | `max(abs(Δfila), abs(Δcolumna))` | Sí |
| Cero (Dijkstra) | `0` | Sí |
| Manhattan × 1.5 | `1.5 × Manhattan` | No; puede producir caminos subóptimos |

Los movimientos cuestan una unidad y se realizan solo en cuatro direcciones. Todos los algoritmos reciben **cuatro expansiones de nodos por pulso**, con un pulso por defecto de **180 ms**. Esto es una *simulación pedagógica de costos de búsqueda*, no una prueba de velocidad del procesador ni del navegador.

IDA* utiliza una pila explícita con límites sucesivos de `f = g + h` y una tabla de mejores costos **reiniciada en cada iteración** para evitar repeticiones innecesarias en los espacios abiertos. Esta optimización consume más memoria que el IDA* clásico. **La heurística cero o Euclidiana en IDA*** puede realizar muchas más expansiones que Manhattan, incluso agotando el límite de protección de **100 000 expansiones** sin llegar; la interfaz registra la razón de finalización. Para una competición razonablemente corta se recomienda Manhattan.

El primer estudiante en llegar al centro encabeza el ranking. El orden lo determina el pulso y la expansión simulada de llegada. Quienes llegan en el mismo pulso y expansión comparten puesto. Las posiciones de inicio pueden tener hasta cuatro pasos de diferencia óptima, por lo que la prueba es una carrera desde ubicaciones próximas en dificultad, **no una medición estrictamente equivalente para comparar algoritmos**.

El administrador inicia la competición con **Start**. Con **Reset** cambia el laberinto, sortea otras 20 posiciones, reinicia los resultados y desbloquea la elección para una nueva ronda. No se requiere cerrar sesión.

## Ejecución local

```bash
npm install
npm start
```

Abrir **http://localhost:10000**. Estudiantes en distintos equipos pueden acceder al mismo servidor si la red lo permite. Por ejemplo, en LAN pueden abrir `http://IP-DEL-SERVIDOR:10000`.

- Administrador: usuario `admin` y contraseña de **demostración local** `Admin2026`.
- Estudiante: nombre único de 2 a 24 caracteres. No se necesita contraseña.
- En internet / Render: establece `ADMIN_PASSWORD` con una contraseña segura. No publiques la predeterminada ni ejecutes varias instancias independientes del servidor (el estado está en memoria).

```bash
npm run check
npm test
```

Las pruebas incluyen 65×65, muro incompleto, patios abiertos, simetría, 20 entradas de borde diferentes, rutas siempre posibles y con distancias cercanas, A*/IDA*, umbrales, capacidad máxima, bloqueo de confirmación en servidor, API, Start/Reset y el tema oscuro.

## Estructura

```text
client/index.html       Acceso, interfaz, botón de tema y opciones
client/app.js           Selección única, ranking y eventos SSE
client/styles.css       Temas claro/oscuro y diseño adaptable
client/maze2d.js        Dibujo del laberinto y sus 20 inicios
shared/maze.js          Generación 65×65, cuatro sectores y sorteos
shared/algorithms.js    A*, IDA*, heurísticas y expansiones
server/room.js          Control de las 20 plazas y bloqueo de estrategia
server/index.js         API y servidor Node.js
render.yaml             Despliegue en Render
tests/                  Pruebas unitarias e integración
```

## Consideraciones

La simulación conserva el estado **solo en memoria**. Si se reinicia el servidor o se crea otra instancia, se perderá la sala; no se guarda una base de datos. La desconexión de un estudiante detiene temporalmente su agente y, tras un tiempo, puede retirar su sesión. En la interfaz, los nodos visitados se muestran para el propio jugador; en posiciones superpuestas se agrupan fichas para mejorar la visualización. El modo oscuro se guarda por navegador, no en el servidor.
