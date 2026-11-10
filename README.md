# Maze Race — A* vs IDA* · edición 5.0 (20 estudiantes)

Carrera multijugador en español para comparar **A*** e **IDA*** sobre el **mismo laberinto cuadrado 65×65**. Basado en el proyecto original Summit Lab. Incluye acceso de estudiantes, administrador, botón Start/Reset, ranking de llegada, recorrido de cada buscador, cinco heurísticas y tema claro/oscuro. Solo necesita **Node.js 20 o superior**, sin paquetes npm externos.

## Cambios de esta edición

- **Laberintos auténticos y conectados**: un árbol de expansión generado con DFS forma corredores, bifurcaciones y callejones sin salida. Después se crean algunas salas y se abren atajos según la complejidad. **Todas las casillas transitables son alcanzables desde el centro**: no hay zonas libres aisladas. El mapa es diferente con cada semilla o al pulsar **Generar nuevo laberinto**.
- **Complejidad ajustable en cinco niveles**: Muy abierto (~22 % de paredes), Abierto (~28 %), Intermedio (~35 %, predeterminado), Complejo (~42 %) y Muy complejo (~49 %). Los niveles altos mantienen más corredores estrechos y obligan a resolver más desvíos. El indicador de paredes muestra la densidad real del mapa.
- **Acceso exterior para 20 estudiantes**: cinco puntos de partida por orilla, seleccionados aleatoriamente. Los 20 se encuentran conectados con la meta central, y la distancia óptima entre el punto más cercano y el más lejano varía **a lo sumo cuatro pasos**. El mapa tiene simetría rotacional de 90° para ofrecer la misma topología en las cuatro orillas.
- **Confirmación única**: una vez elegidos algoritmo y heurística, el botón muestra **Estrategia confirmada ✓**. Ya no aparece el texto «Estrategia bloqueada». La estrategia sigue siendo definitiva durante la ronda y el servidor rechaza otros intentos de selección hasta que el administrador use **Reset**.
- **Generador del administrador**: **Generar nuevo laberinto** crea otra distribución en la sala de espera, sin borrar las estrategias ya confirmadas. Se sortean nuevas posiciones válidas para cada estudiante. **Reset** inicia otra ronda y vuelve a habilitar la selección.
- **Identificación y accesibilidad**: los estudiantes aparecen con sus nombres en las orillas y durante la carrera. No se pintan puntos de acceso amarillos sin ocupantes. La interfaz conserva el modo claro/oscuro, zoom, desplazamiento, ranking y las cinco heurísticas de A*/IDA*.

Las diferencias de posiciones iniciales son pequeñas, pero no idénticas; la clasificación es una carrera didáctica y **no un experimento estrictamente controlado** para medir algoritmos.

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

El administrador inicia la competición con **Start**. Con **Generar nuevo laberinto** en la sala de espera cambia el mapa y sortea otras 20 posiciones, conservando las estrategias ya confirmadas. Con **Reset** cambia el laberinto, sortea otras 20 posiciones, reinicia los resultados y desbloquea la elección para una nueva ronda. Reset mantiene el nivel de complejidad seleccionado. No se requiere cerrar sesión.

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

Las pruebas incluyen conectividad total del espacio transitable en los cinco niveles, pasillos y bifurcaciones, generación aleatoria, simetría, 20 accesos con distancias cercanas, A*/IDA*, umbrales, confirmación única en servidor, regeneración autorizada, API, Start/Reset y tema oscuro.

## Estructura

```text
client/index.html       Acceso, panel del generador, botón de tema y opciones
client/app.js           Selección única, ranking y eventos SSE
client/styles.css       Temas claro/oscuro y diseño adaptable
client/maze2d.js        Dibujo del laberinto y puntos con nombres de usuario
shared/maze.js          Generación 65×65, cinco densidades y sorteos
shared/algorithms.js    A*, IDA*, heurísticas y expansiones
server/room.js          Control de las 20 plazas, bloqueo y regeneración
server/index.js         API y servidor Node.js
render.yaml             Despliegue en Render
tests/                  Pruebas unitarias e integración
```

## Consideraciones

La simulación conserva el estado **solo en memoria**. Si se reinicia el servidor o se crea otra instancia, se perderá la sala; no se guarda una base de datos. La desconexión de un estudiante detiene temporalmente su agente y, tras un tiempo, puede retirar su sesión. En la interfaz, los nodos visitados se muestran para el propio jugador; las fichas superpuestas se desplazan ligeramente y sus etiquetas buscan posiciones sin solapamiento. El modo oscuro se guarda por navegador, no en el servidor.
