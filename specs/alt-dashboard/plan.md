# Plan de rediseño del Dashboard — NUTRIO (rama alt-dashboard)

Nov 14, 2026 · @Rafael Martinez

## 1. Resumen

Rediseñar el Dashboard de NUTRIO en una rama nueva, `alt-dashboard` (derivada de `main`), replicando el layout y la estética de la imagen de referencia (DINEOS) y adaptando su contenido al dominio de nutrición.

**Regla de oro:** ante cualquier conflicto, el diseño de la imagen manda sobre el diseño actual del proyecto. La funcionalidad existente se conserva solo donde este plan lo indica.

**Regla de proceso:** antes de escribir código, el implementador completa la Fase 0 (auditoría) y resuelve la ronda de preguntas de la sección 3. Si en la auditoría surgen dudas nuevas, abre otra ronda antes de continuar.

**Alcance:**

- Barra superior, sidebar, hero con carrusel y columna derecha (KPIs, tarjeta negra de reporte, tarjetas amarilla y celeste).
- Datos reales donde ya existan en el dashboard actual (opciones del día, reporte semanal, perfil, recetas).
- Elementos sin funcionalidad marcados explícitamente como *solo visuales*.

**Del dashboard actual solo se conserva el chatbot** (botón flotante abajo a la derecha). Todo lo demás se sustituye por el diseño de la imagen.

## 2. Análisis del plan original

El plan es sólido en intención, pero tiene huecos y ambigüedades que un implementador resolvería adivinando. Estas son las correcciones aplicadas en este documento:

| # | Problema en el plan original | Corrección en este plan |
| --- | --- | --- |
| 1 | La línea «Tarjetas blancas tipo KPI. Se deberán colocar» quedó incompleta: no dice qué métricas van. | Se propone un mapeo 1:1 con la imagen (sección 5.4) y se marca como pregunta bloqueante P1. |
| 2 | «En la parte final de la página hay tres secciones verticales» no coincide con la imagen: es una **columna derecha** con tres filas apiladas (KPIs, tarjeta negra, tarjetas amarilla/celeste). | Se redefine el layout como dos columnas: hero a la izquierda, columna de datos a la derecha (sección 4). |
| 3 | Las sub-viñetas de la tarjeta negra están anidadas bajo «Tarjetas blancas tipo KPI». | Cada bloque tiene su propia especificación (5.4, 5.5, 5.6). |
| 4 | «Sustituye el diseño del ticket» es ambiguo. | Se interpreta como el **icono** de recibo junto a «Order status», reemplazado por el icono Lucide `square-chart-gantt`. Confirmar (P8). |
| 5 | Si las pestañas cambian a Mes/Año/Histórico, el título fijo «Reporte semanal» deja de ser cierto. | Se propone título dinámico o neutro (P4). |
| 6 | No se define qué representan los porcentajes de los 4 indicadores (actividad, peso, comidas, agua). | Se define como % de cumplimiento del objetivo del periodo (5.5). |
| 7 | Las fotos de recetas suelen ser rectangulares con fondo; la imagen usa un plato recortado sobre fondo claro. Sin tratamiento, se verá como un bloque pegado. | Se añade tratamiento de imagen y fallback (5.3, riesgo R1). |
| 8 | «Puntuación ficticia» sin regla: si es aleatoria, cambia en cada recarga. | Puntuación determinista derivada del id de la receta (rango 4.5–5.0). |
| 9 | No se especifica el idioma de etiquetas que vienen en inglés («Dish of the day», textos de las tarjetas amarilla y celeste). | Pregunta P5 con valor por defecto. |
| 10 | Botones «sin acción» sin criterio de accesibilidad: al ser solo iconos, un lector de pantalla no sabe qué son. | `aria-label` obligatorio y estado hover/focus aunque no ejecuten acción. |
| 11 | No se define comportamiento responsive ni estados vacíos (día sin plan, receta sin imagen). | Se añaden en 5.3 y en la checklist de QA. |
| 12 | Errata: «Tenderlion» → «Tenderloin»; «mejorarlo» → «mejóralo». | Sin impacto técnico; corregido. |

## 3. Ronda 1 de preguntas

**Ronda 1 cerrada el 14 de noviembre de 2026.** Tus respuestas están en la última columna y ya se aplicaron en las secciones 4 a 7. Donde no cambiaste nada, rige el valor por defecto. Las dudas nuevas que salgan de la auditoría (Fase 0) abren una ronda 2.

| # | Tema | Pregunta | Valor por defecto | Bloquea | Tu respuesta |
| --- | --- | --- | --- | --- | --- |
| P1 | Tarjetas KPI | ¿Qué 4 métricas van en las tarjetas blancas? | Comidas de hoy (completadas/plan) · Recetas disponibles (total del recetario) · Tiempo de preparación promedio de hoy (min) · Compras pendientes (artículos en la lista) | Fase 4 | 1. Comidas de hoy (totales del plan activo)<br>2. Planes disponibles (total de planes)&#32;<br>3. Recetas disponibles (total del recetario)<br>4. El último te lo dejo a tu imaginación. |
| P2 | Reporte | ¿Se mantienen actividad, peso, comidas y agua, o se sustituye alguno? Alternativas con más valor: adherencia al plan (% comidas cumplidas), calorías vs objetivo, proteína vs objetivo. | Se mantienen los 4, en ese orden | Fase 4 | Queda así:<br>1. &#32;adherencia al plan (% comidas cumplidas)<br>2. calorías vs objetivo<br>3. Proteína vs objetivo.<br>4. Peso (actual vs ideal o configurado)\
 |
| P3 | Pestañas | ¿Semana/Mes/Año/Histórico filtran datos reales ya, o solo cambian el estado visual? | Semana con datos reales; las demás cambian de estado y muestran los mismos indicadores con dato real si existe, o «—» si no | Fase 4 | Debeé de mostrar datos reales dependiendo del filtro, pero en caso que no existan se deberán marcar los mismo indicadores. Similar al Valor por defecto. |
| P4 | Título del reporte | ¿Título fijo «Reporte semanal» o dinámico según pestaña? | Dinámico: Reporte semanal / mensual / anual / histórico | Fase 4 | Para el titulo de reporte tienes razón, considero se debe renombrar a "Métricas" o algo más relacionado a los datos mostrados y dejarlo sin un rango específico como "...semana" |
| P5 | Idioma | ¿Las etiquetas en inglés de la imagen se traducen? | Todo en español excepto «Dashboard» y «Chef's selection» (por indicación expresa). «Dish of the day» → «Platillo del día» | Fase 3 | Todo en español excepto «Dashboard» y «Chef's selection» (por indicación expresa). «Dish of the day» → «Platillo del día» |
| P6 | Tarjetas amarilla y celeste | ¿Copiar los textos del restaurante como placeholder o adaptarlos a nutrición con datos ficticios? | Adaptar, solo visual: amarilla = «Resumen calórico» (kcal del día, variación %, comidas completadas, promedio por comida, barras por hora); celeste = «Cumplimiento del plan» (semicírculo: 32 comidas planificadas, 25 cumplidas, 05 pendientes, 02 omitidas) | Fase 4 | Adaptar, solo visual: amarilla = «Resumen calórico» (kcal del día, variación %, comidas completadas, promedio por comida, barras por hora); celeste = «Cumplimiento del plan» (semicírculo: 32 comidas planificadas, 25 cumplidas, 05 pendientes, 02 omitidas) |
| P7 | Carrusel | ¿Cada diapositiva es una comida del día (desayuno, comida, cena, colación) o una alternativa para la misma comida? | Una diapositiva por cada opción que hoy muestra el calendario actual, en su mismo orden; etiqueta amarilla fija | Fase 3 | Una diapositiva por cada opción que hoy muestra el calendario actual, en su mismo orden; etiqueta amarilla fija |
| P8 | Icono «ticket» | ¿Se refiere al icono de recibo junto a «Order status», reemplazado por Lucide `square-chart-gantt`? | Sí | Fase 4 | Sí. El icono `square-chart-gantt` es una sugerencia puedes adapatarlo al que mejor corresponda segun el contexto. |
| P9 | Current preparation | ¿Qué representan el ETA y el 68%? | ETA = tiempo de preparación de la receta activa; % = valor ficticio fijo hasta definir la lógica. Clic → receta activa del carrusel | Fase 3 | ETA = tiempo de preparación de la receta activa; % = valor ficticio fijo hasta definir la lógica. Clic → receta activa del carrusel |
| P10 | Botón «Procesar plan» | ¿Qué acción ejecuta? | La acción principal equivalente del dashboard actual, si existe; si no, sin acción | Fase 2 | La acción principal equivalente del dashboard actual, "Subir Plan" |
| P11 | Búsqueda con IA | ¿Se conecta a la búsqueda existente o es solo visual? | Se conecta a la búsqueda actual si existe; si no, solo visual | Fase 2 | Se conecta a la búsqueda actual si existe; si no, solo visual. |
| P12 | Chef's selection | ¿Cuántas recetas recientes y a dónde lleva el clic? | 3 miniaturas + contador del resto («+4»); clic → Recetario | Fase 2 | 3 miniaturas + contador del resto («+4»); clic → Recetario |
| P13 | Tipografía | La imagen usa una sans geométrica distinta a la del proyecto. ¿Se adopta? ¿Solo en el dashboard o en toda la app? | Adoptar una sans geométrica de Google Fonts (p. ej. Urbanist u Outfit) en todo el layout nuevo (barra superior, sidebar y dashboard) | Fase 1 | Adoptar una sans geométrica de Google Fonts (p. ej. Urbanist u Outfit) en todo el layout nuevo (barra superior, sidebar y dashboard) |
| P14 | Emblema | ¿Emblema nuevo o el icono actual? | Proponer un emblema nuevo y conservar el actual como respaldo hasta tu aprobación | Fase 2 | Proponer un emblema nuevo y conservar el actual como respaldo hasta tu aprobación |
| P15 | Responsive | ¿Qué se espera en tablet y móvil? | Fiel a la imagen desde 1280 px; de 768 a 1279 px la columna derecha baja bajo el hero; menos de 768 px todo en una columna y el sidebar pasa a barra inferior | Fase 5 | Fiel a la imagen desde 1280 px; de 938 a 1279 px la columna derecha baja bajo el hero; hasta 937 px todo en una columna y el sidebar pasa a barra inferior (el corte era 768 px; el usuario lo subió a 937/938 px el 2026-11-15) |
| P16 | Detalles menores | Contador de la bandeja («12») y puntos decorativos sobre la foto del platillo | Contador estático; puntos decorativos se conservan | Fase 3 | Contador estático; puntos decorativos se conservan |
| P17 | Git | ¿Se publica la rama en el remoto? ¿Se abre PR? | Push de `alt-dashboard` a origin; sin PR hasta tu revisión | Fase 0 | Push de `alt-dashboard` a origin; sin PR hasta tu revisión |

## 4. Layout general y tokens de diseño

La página es una barra superior a todo el ancho y, debajo, tres columnas: sidebar de iconos, hero (≈ 43 % del ancho) y columna de datos (≈ 57 %). La foto del platillo es el fondo del hero y se extiende por detrás del borde izquierdo de la columna de datos.

```text
+--------------------------------------------------------------------------------------------+
| [emblema] NUTRIO  [* Buscar...........]  [Chef's selection o o o +4] [+ Procesar plan] (B)(N)(I) [perfil v] |
+----+-------------------------------------+-------------------------------------------------+
|    | Dashboard                           | [KPI 1]   [KPI 2]   [KPI 3]   [KPI 4]           |
| () | [Platillo del día]                  +-------------------------------------------------+
| () | Nombre de la receta                 | TARJETA NEGRA  Métricas  [Sem][Mes][Año][Hist]  |
| () | [* 4.9]                             | [Adherencia] [Calorías] [Proteína] [Peso]       |
| () |        (foto del platillo           +------------------------+------------------------+
| () |         como fondo)            :    | AMARILLA (solo visual) | CELESTE (solo visual)  |
| () | [Current preparation  ->  68%]  :    |                        |                    (C) |
+----+-------------------------------------+------------------------+------------------------+
  () = botón circular del sidebar      : = paginación vertical del carrusel
  (B)(N)(I) = alertas, libreta, bandeja con contador
  (C) = chatbot actual, botón flotante fijo abajo a la derecha (se conserva)
```

**Tokens.** Valores aproximados medidos sobre la imagen; el implementador los confirma con cuentagotas sobre el original y los declara como variables CSS / tema antes de maquetar.

| Token | Valor aprox. | Uso |
| --- | --- | --- |
| `--bg` | #F5F6F8 | Fondo de la página |
| `--surface` | #FFFFFF | Tarjetas KPI, barra de búsqueda, Current preparation |
| `--border` | #E6E7EA | Borde 1 px de tarjetas blancas y botones circulares |
| `--ink` | #0E0E10 | Texto principal, botón «Procesar plan», sidebar activo |
| `--ink-card` | #050505 / #171717 | Tarjeta negra / sub-tarjetas de los gauges |
| `--muted` | #6B6E76 | Textos secundarios y etiquetas |
| `--yellow` | #F6E7A6 | Tarjeta amarilla y etiqueta «Platillo del día» |
| `--yellow-accent` | #F2D678 | Gauge 1 (Adherencia), estrella |
| `--sky` | #C8D9EF | Tarjeta celeste |
| `--sky-accent` | #9DB6D8 / #2F4E8C | Gauge 2 (Calorías) / arco del semicírculo |
| `--orange` | #E8744A | Gauge 4 (Peso), punto de alerta |
| `--success` | #3BA55C sobre #DDF3E3 | Insignia de variación positiva |
| `--radius-card` | 28 px | Tarjetas principales |
| `--radius-inner` | 22 px | Sub-tarjetas de gauges |
| `--radius-pill` | 999 px | Pills, botones, etiquetas |
| `--icon-btn` | 44 px, círculo, borde 1 px | Sidebar y botones de la barra superior |
| Espaciado | base 8 px; gaps de 16–20 px | Entre tarjetas y secciones |

**Escala tipográfica** (sans geométrica, ver P13): título «Dashboard» 64 px / peso 500 · nombre de receta 36 px / peso 300 en dos líneas · números KPI 40 px / peso 400 · porcentajes de gauges 32 px con «%» a 14 px · etiquetas 14 px · texto auxiliar 12 px.

## 5. Especificación por sección

Nombres de icono según Lucide. Si el proyecto usa otra librería, se busca el equivalente visual más cercano.

### 5.1 Barra superior (izquierda → derecha)

| Elemento | En la imagen | En NUTRIO | Comportamiento |
| --- | --- | --- | --- |
| Emblema | Forma orgánica en círculo celeste | Emblema nuevo, minimalista, mismo tratamiento (trazo fino sobre círculo `--sky`); si no se aprueba, el icono actual | Enlace a Inicio |
| Logotipo | «DINEOS» en mayúsculas con espaciado amplio | «NUTRIO», mismo estilo (mayúsculas, tracking ≈ 0.2 em, peso 400) | Enlace a Inicio |
| Búsqueda con IA | Pill blanca, círculo negro con destello (`sparkle`) a la izquierda | Igual; placeholder «Buscar recetas, planes, ingredientes…» | Ver P11 |
| Chef's selection | Pill con gorro de chef (`chef-hat`), título, subtítulo y miniaturas superpuestas + contador | Mismo nombre; subtítulo «Recetas nuevas»; miniaturas de las recetas más recientes (luego, mejor calificadas) | Ver P12 |
| Botón principal | Pill negra «+ Create order» | «+ Procesar plan», mismo diseño | Ejecuta la acción actual «Subir Plan» (P10) |
| Alertas | Botón circular `bell` | Idéntico | Sin acción; `aria-label="Alertas"` |
| Libreta | Botón circular `notebook-pen` | Idéntico | Sin acción; `aria-label="Notas"` |
| Bandeja | Botón circular `inbox` con insignia negra «12» | Idéntico | Sin acción; `aria-label="Bandeja de entrada"` |
| Perfil | Avatar, nombre, rol, flecha `chevron-down`, a la derecha | Se traslada del lado actual al extremo derecho; datos del usuario actual; colores de la imagen (nombre `--ink`, rol `--muted`) | Conserva el menú/acciones que ya tenga hoy |

### 5.2 Sidebar

Columna de botones circulares de 44 px, solo iconos, separados 12 px. Activo: círculo `--ink` relleno con icono blanco. Inactivo: borde `--border`, icono `--ink`. Todos con `aria-label` y tooltip con el nombre.

| Orden | Botón | Icono Lucide | Comportamiento |
| --- | --- | --- | --- |
| 1 | Inicio (antes «HOY») | `layout-grid` | Ruta actual de HOY, renombrada |
| 2 | Planes | `calendar-days` | Ruta existente |
| 3 | Recetario | `cooking-pot` | Ruta existente |
| 4 | Compras | `shopping-basket` | Ruta existente |
| 5 | Análisis | `chart-column` | Solo visual, sin acción |
| 6 | Configuración | `settings` | Solo visual, sin acción; al final de la columna, como en la imagen |

### 5.3 Hero (columna izquierda)

| Elemento | En NUTRIO | Detalle |
| --- | --- | --- |
| Título | «Dashboard» | Sin cambios respecto a la imagen |
| Etiqueta amarilla | «Platillo del día» (P5) | Pill `--yellow`, texto 14 px |
| Nombre de la receta | Dinámico: receta de la diapositiva activa | Dos líneas máx., peso ligero; truncar con «…» si excede |
| Puntuación | Pill blanca con estrella `--yellow-accent` | Ficticia y determinista: `4.5 + (hash(idReceta) % 6) / 10` → 4.5–5.0; nunca cambia entre recargas |
| Foto del platillo | Imagen de la receta activa como fondo del hero, mismo tamaño y posición que en la imagen | Máxima calidad disponible (`srcset`/2x, `object-fit: cover`), carga prioritaria de la primera diapositiva, precarga de la siguiente. Tratamiento para integrarla con el fondo claro: máscara radial con desvanecido en los bordes (ver R1) |
| Puntos decorativos | Círculos blancos translúcidos sobre la foto | Solo decorativos (P16) |
| Paginación | Puntos verticales a la derecha de la foto | Un punto por opción del día; clic cambia de diapositiva; flechas de teclado; sin autoplay |
| Current preparation | Tarjeta blanca: icono `cooking-pot`, título, ETA con `clock`, botón negro `arrow-up-right`, barra de puntos y porcentaje | Diseño sin cambios. ETA y % según P9. Toda la tarjeta enlaza a la receta activa |
| Gráfica «Dishes sold» | — | Se elimina por completo |
| Estado vacío | Día sin plan | Etiqueta + texto «Hoy no tienes comidas planificadas» + enlace a Planes; fondo neutro sin foto |
| Receta sin foto | — | Ilustración o fondo neutro con el mismo encuadre; nunca un hueco |

### 5.4 Tarjetas KPI (fila 1 de la columna derecha)

Cuatro tarjetas blancas de igual ancho, como en la imagen: icono en círculo con borde, etiqueta 14 px y número 40 px con al menos dos dígitos («06»). Datos reales, calculados al cargar el dashboard; si un conteo no existe, se muestra «00».

| Posición | Equivale a (imagen) | Métrica NUTRIO | Cálculo | Icono |
| --- | --- | --- | --- | --- |
| 1 | Active orders | Comidas de hoy | Total de comidas del plan activo para hoy | `hand-platter` (el mismo dibujo de la imagen) |
| 2 | Available Dishes | Planes disponibles | Total de planes | `clipboard-list` |
| 3 | Avg prep time | Recetas disponibles | Total del recetario | `concierge-bell` (la campana de servicio de la imagen) |
| 4 | Low stock items | Compras pendientes | Artículos sin marcar en la lista de compras activa | `package` (la caja de la imagen) |

> **Nota (2026-11-18):** la posición 1 «Comidas de hoy» queda reemplazada por «Racha» (días seguidos con todas las comidas planeadas cumplidas, icono `flame`) según `specs/dashboard-polish/spec.md` (US2). Las posiciones 2 a 4 no cambian.

La cuarta métrica es mi propuesta: equivale directamente a «Low stock items», cierra el ciclo del día (qué como → con qué plan → qué recetas → qué me falta) y conecta con la sección Compras del sidebar.

### 5.5 Tarjeta negra — Métricas (fila 2)

| Elemento | En la imagen | En NUTRIO |
| --- | --- | --- |
| Icono | Recibo | `gauge`: los indicadores son diales, así que encaja mejor que la sugerencia `square-chart-gantt` (P8) |
| Título | «Order status» | «Métricas», sin rango de tiempo; el periodo lo indica la pestaña activa (P4) |
| Pestañas | All · Main dining · Patio · Private suite | Semana · Mes · Año · Histórico; activa = pill blanca con texto negro; inactivas = borde gris (P3) |
| Contador | «42 Orders» | Se elimina |
| Gauges | 4 sub-tarjetas: porcentaje, dial con marcas y cuña de color, etiqueta con conteo | Adherencia (`--yellow-accent`) · Calorías (`--sky-accent`) · Proteína (blanco) · Peso (`--orange`), en ese orden (P2) |

Cada gauge muestra el porcentaje grande, el dial con la cuña proporcional y la etiqueta con el dato absoluto entre paréntesis, igual que «New (6)». Los datos son reales y cambian con la pestaña; si no hay datos para el periodo, se muestran los mismos cuatro indicadores con «—» y el dial vacío.

| Indicador | Porcentaje | Etiqueta (ejemplo) |
| --- | --- | --- |
| Adherencia al plan | Comidas cumplidas ÷ comidas planificadas del periodo | Adherencia (25/32) |
| Calorías vs objetivo | kcal consumidas ÷ objetivo; en Mes, Año e Histórico, promedio diario | Calorías (1850 kcal) |
| Proteína vs objetivo | g consumidos ÷ objetivo; mismo criterio de promedio | Proteína (96 g) |
| Peso | Avance hacia el peso ideal o configurado: (inicial − actual) ÷ (inicial − objetivo) | Peso (72.4 kg) |

Si un valor supera el 100 % (por ejemplo, calorías por encima del objetivo), el dial se queda lleno y el número muestra el valor real («112 %»). Si no hay peso objetivo configurado, el porcentaje muestra «—» y la etiqueta conserva el peso actual.

### 5.6 Tarjetas amarilla y celeste (fila 3) — solo visuales

> Superseded by `specs/dashboard-real-data/` (aprobado, 19 nov 2026): las dos tarjetas dejan de ser estáticas y pasan a mostrar datos reales («Comidas de hoy» y conteos de «Cumplimiento del plan»). Lo que sigue describe el diseño original.

Réplica exacta de la imagen en estructura, proporciones y estilo, con datos ficticios fijos y sin interacción. Textos según P6. Elementos a reproducir:

- **Amarilla:** icono en círculo, título, selector «Hoy» con `chevron-down` (no abre), cifra grande, insignia de variación con `arrow-up`, dos métricas secundarias a la derecha con separador vertical, gráfica de 9 barras con relleno de trama y eje horario.
- **Celeste:** icono en círculo, título, botón negro `arrow-up-right` (no navega), pill «Live» con punto verde, semicírculo con degradado azul y tramo final naranja, total al centro, tres cifras abajo con punto de color en su etiqueta.
- Marcar ambos componentes en código como `// TODO: solo visual — pendiente de revisión` para la siguiente iteración.

### 5.7 Chatbot (botón flotante)

Es el único elemento del dashboard actual que se conserva, con su funcionamiento y su diseño.

- Posición fija abajo a la derecha, por encima del resto de capas (`z-index`).
- No debe tapar contenido clave: dejar margen inferior en la columna de datos para que la tarjeta celeste no quede debajo del botón.
- En móvil convive con la barra inferior del sidebar (P15): se sube por encima de ella.

## 6. Fases de implementación

Siete fases en orden estricto; un commit por fase como mínimo. Ninguna fase empieza sin cumplir el «Hecho cuando» de la anterior.

1. **Fase 0 — Rama y auditoría**
   - Crear la rama: `git checkout main && git pull && git checkout -b alt-dashboard && git push -u origin alt-dashboard` (P17).
   - Auditar el proyecto y anotar: framework y sistema de estilos, librería de iconos, rutas existentes (HOY, Planes, Recetario, Compras), componente del calendario con las opciones del día, fuentes de datos de adherencia, calorías, proteína y peso por periodo, acción «Subir Plan», chatbot flotante, componente de perfil, icono actual, resolución real de las fotos de recetas.
   - Contrastar la auditoría con las preguntas de la sección 3 y abrir una segunda ronda si aparece algo nuevo.
   - *Hecho cuando:* la rama existe en el remoto y las preguntas bloqueantes están respondidas o con valor por defecto aceptado.
2. **Fase 1 — Fundamentos visuales**
   - Declarar los tokens de la sección 4 y cargar la tipografía (P13).
   - Crear componentes base reutilizables: `IconButton` circular, `Pill`, `Card` (variantes blanca, negra, amarilla, celeste), `SegmentedTabs`, `RadialGauge`, `DottedProgress`.
   - *Hecho cuando:* los componentes se ven correctamente aislados y no hay colores ni radios fijos fuera de los tokens.
3. **Fase 2 — Estructura: barra superior y sidebar**
   - Maquetar la barra superior según 5.1 y el sidebar según 5.2, incluido el traslado del perfil al extremo derecho y el renombrado de HOY a Inicio. Conectar «Procesar plan» a la acción actual «Subir Plan» y retirar todo lo demás del dashboard actual excepto el chatbot.
   - *Hecho cuando:* la navegación a Inicio, Planes, Recetario y Compras funciona; Análisis, Configuración, alertas, libreta y bandeja no hacen nada y todos tienen `aria-label`.
4. **Fase 3 — Hero y carrusel**
   - Maquetar título, etiqueta, nombre dinámico, puntuación, foto de fondo con tratamiento, paginación vertical y tarjeta Current preparation (5.3). Eliminar la gráfica «Dishes sold».
   - Conectar el carrusel a las opciones del día del calendario actual.
   - *Hecho cuando:* cambiar de diapositiva actualiza nombre, puntuación, foto y destino de Current preparation; los estados vacíos se ven bien.
5. **Fase 4 — Columna de datos**
   - Tarjetas KPI (5.4), tarjeta «Métricas» con pestañas y gauges conectados a datos reales según el filtro (5.5), tarjetas amarilla y celeste estáticas (5.6).
   - *Hecho cuando:* los gauges muestran datos reales del periodo elegido (o «—» si no hay), «42 Orders» no aparece y las tarjetas amarilla/celeste coinciden con la imagen.
6. **Fase 5 — Responsive, accesibilidad y estados**
   - Aplicar los cortes de P15; foco visible en todos los controles; contraste mínimo AA en textos sobre amarillo y celeste; estados de carga (skeletons) y error.
   - *Hecho cuando:* la checklist de QA de la sección 7 pasa completa.
7. **Fase 6 — Verificación y entrega**
   - Capturas a 1440 × 900 y 1920 × 1080 comparadas lado a lado con la imagen de referencia; corregir desviaciones visibles de espaciado, radio, color o tipografía.
   - Push final a `alt-dashboard` con un resumen de decisiones tomadas por defecto y preguntas abiertas para la siguiente iteración.

## 7. Fuera de alcance, riesgos y QA

**Fuera de alcance en esta iteración:** funcionalidad de Análisis, Configuración, alertas, libreta y bandeja; lógica de las tarjetas amarilla y celeste; sistema real de calificaciones («Chef's selection» usa recetas recientes); integración con una API de imágenes de comida (siguiente iteración); merge a `main`.

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| R1. Fotos de recetas rectangulares y con fondo no se integran como el plato recortado de la imagen | El hero pierde el efecto principal del diseño | Máscara radial con desvanecido hacia `--bg`; en la siguiente iteración, API gratuita de imágenes de comida con una URL por platillo (preferir fotos sobre fondo claro o transparente) |
| R2. Fotos de baja resolución se ven pixeladas al ocupar ≈ 40 % de la pantalla | Calidad percibida baja | Detectar resolución en la Fase 0; usar la mayor variante disponible y fallback neutro si es menor de 1200 px de ancho |
| R3. El reporte actual no tiene datos mensuales/anuales | Pestañas vacías | Valor por defecto de P3 (mostrar «—») |
| R4. Cambiar la tipografía global afecta otras pantallas | Inconsistencia visual fuera del dashboard | Limitar la fuente al layout nuevo (P13) |
| R5. Textos en español más largos que los de la imagen | Desbordes en pills y tarjetas | Probar con el texto más largo esperado; truncar con «…» y tooltip |

**Checklist de QA**

- [ ] Rama `alt-dashboard` creada desde `main` y publicada.
- [ ] Barra superior en el orden exacto de 5.1; «Procesar plan» con el diseño de «Create order».
- [ ] «Procesar plan» ejecuta la acción «Subir Plan».
- [ ] Tarjetas KPI: Comidas de hoy, Planes disponibles, Recetas disponibles y Compras pendientes, con dos dígitos mínimo.
- [ ] Perfil en el extremo derecho con el esquema de color de la imagen.
- [ ] Sidebar con 6 botones en el orden de 5.2; «HOY» ya no aparece en ningún sitio.
- [ ] Carrusel muestra las opciones del día; nombre, puntuación y foto cambian juntos.
- [ ] Puntuación idéntica tras recargar la página.
- [ ] Current preparation abre la receta activa.
- [ ] La gráfica «Dishes sold» no existe.
- [ ] Tarjeta negra: título «Métricas» sin rango, icono `gauge`, pestañas Semana/Mes/Año/Histórico, sin «42 Orders».
- [ ] Gauges en orden Adherencia, Calorías, Proteína, Peso con datos reales según la pestaña activa.
- [ ] Tarjetas amarilla y celeste fieles a la imagen y sin interacción.
- [ ] Todos los botones de solo icono tienen `aria-label` y foco visible.
- [ ] Sin errores en consola; estados vacío, carga y error revisados.
- [ ] Capturas a 1440 × 900 y 1920 × 1080 comparadas con la referencia.
- [ ] El chatbot flotante funciona como antes y no tapa la tarjeta celeste ni la barra inferior en móvil.
