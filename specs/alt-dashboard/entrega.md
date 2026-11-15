# Entrega — rediseño del Dashboard (rama `alt-dashboard`)

Plan: [`plan.md`](plan.md) · Referencia: [`reference.png`](reference.png) · Capturas: [`screenshots/`](screenshots/)

## Qué se construyó

- **Marco nuevo en todas las páginas con sesión:** barra superior (emblema, NUTRIO, búsqueda con IA, Chef's selection, «Procesar plan», alertas, notas, bandeja, perfil) y sidebar de iconos (Inicio, Planes, Recetario, Compras, Análisis, Configuración).
- **Dashboard:** hero con carrusel de las comidas de hoy y columna de datos con KPIs, tarjeta «Métricas» y tarjetas amarilla y celeste.
- **Se conserva** el chatbot flotante, sin cambios.
- **Código:** `src/components/nutrio/` (tokens, primitivas, marco y dashboard) y `src/lib/metrics.ts` (cálculo por periodo, con pruebas unitarias).

## Decisiones tomadas por defecto (ronda 2, aceptadas el 14 nov 2026)

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Fotos | Las recetas no tienen fotos (solo iconos de 256 px). El hero dibuja un plato en CSS con los iconos de los ingredientes de la receta. |
| 2 | Calorías y proteína | La app no registra consumo. Se estiman: objetivo diario × comidas cumplidas ÷ planificadas. Proteína objetivo = kcal × %PRO ÷ 4. Etiqueta con «≈». Dan el mismo porcentaje que Adherencia. Si el plan no trae kcal o macros, muestran «—». |
| 3 | Registrar avance | Pill «Marcar cumplida» en el hero; el gauge de Peso abre el editor de peso y meta. Agua, ejercicio y edición de horarios ya no están en el dashboard. |
| 4 | Alcance del marco | Barra superior y sidebar en todas las páginas; la tipografía Urbanist solo en el marco y el Dashboard. |
| 5 | Configuración y tema | El botón enlaza a `/settings`. El selector de tema es un botón del sidebar, justo arriba de Configuración (cambio pedido el 14 nov). Papelera y Cerrar sesión están en el menú del perfil. El tema oscuro usa una inversión básica de los tokens. |
| 6 | ETA | 5 min + 2 min por ingrediente, mostrado como «ETA aprox.». |
| 7 | Búsqueda | Envía la pregunta al asistente, igual que el buscador anterior. |

Otras decisiones menores:

- **Periodos de «Métricas»:** Semana = lunes a hoy; Mes = día 1 a hoy; Año = 1 de enero a hoy; Histórico = desde el primer registro. Sin registros en el periodo se muestra «—».
- **Peso:** avance = (primer peso registrado − último peso del periodo) ÷ (primer peso − meta). Sin meta, «—» y se conserva el peso actual.
- **Compras pendientes:** artículos sin marcar de la lista más reciente; si no hay lista, artículos del carrito.
- **Perfil:** la app no tiene «rol», así que la segunda línea es el correo.
- **Asistente y tarjeta celeste:** la columna de datos termina antes del borde inferior para que el botón flotante no tape ninguna tarjeta.
- **Icono de «Métricas»:** `gauge` (P8).
- **Emblema:** brote de trazo fino sobre círculo celeste (`src/components/nutrio/Emblem.tsx`), aprobado el 14 nov 2026. El favicon (`src/app/icon.svg`), la marca de la página pública (landing, login, páginas legales y 404) y la imagen para redes usan el mismo dibujo; la «N» verde queda en el historial de git.

## Preguntas abiertas para la siguiente iteración

1. Fotos reales de platillos (API de imágenes, R1): hoy el plato muestra iconos.
2. Calorías y proteína reales: requieren kcal y macros por receta o un registro de consumo.
3. Lógica real de las tarjetas amarilla y celeste y del 68 % de «Preparación actual» (marcadas `TODO: solo visual`).
4. Análisis, alertas, notas y bandeja siguen sin acción.
5. ¿Deben volver al dashboard el registro de agua y ejercicio y la edición de horarios?
6. El carrusel muestra la primera opción de cada comida (lo mismo que el calendario anterior). ¿Debe mostrar todas las opciones?
