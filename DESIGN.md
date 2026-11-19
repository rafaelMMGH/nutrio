# DESIGN.md — NUTRIO

Sistema de diseño del Dashboard de NUTRIO (rama `alt-dashboard`). Es la fuente de verdad visual para cualquier persona o agente que construya interfaz en este proyecto.

> **Regla de oro:** ante cualquier conflicto, manda el diseño de referencia (imagen DINEOS adaptada a NUTRIO) sobre el diseño anterior del proyecto.
> **Regla de tokens:** ningún componente usa un hex directo. Si falta un token, se añade aquí primero.

---

## 1. Tema visual

Elegante, minimalista y editorial. Fondo casi blanco, tipografía geométrica ligera y una fotografía de comida grande como protagonista. La información se agrupa en tarjetas de esquinas muy redondeadas. El negro marca la acción y la jerarquía; dos acentos pastel (mantequilla y celeste) agrupan bloques de datos.

**Palabras clave:** aire, calma, precisión, contraste alto, pastel suave, redondeado.

## 2. Principios

1. **Neutro dominante.** Casi toda la interfaz es blanca, gris y negra. Amarillo y celeste agrupan información; no decoran.
2. **El negro es acción y jerarquía.** Botón principal, sidebar activo y tarjeta «Métricas». Un solo negro relleno por zona.
3. **Color con significado fijo.** Coral solo para Peso y avisos; verde solo para variaciones positivas y «Live».
4. **El color nunca va solo.** Cada indicador lleva etiqueta; cada estado, texto o icono.
5. **Separación por borde y color, no por sombra.** Solo flota lo que se superpone.

---

## 3. Color

Tres capas: **primitivos** → **semánticos** → **componentes**. Los componentes consumen solo semánticos.

### 3.1 Primitivos

| Paleta | Pasos |
| --- | --- |
| `neutral` | 0 `#FFFFFF` · 50 `#F5F6F8` · 100 `#EEEFF2` · 200 `#E6E7EA` · 300 `#D3D5DA` · 400 `#A3A6AD` · 500 `#6B6E76` · 600 `#4B4E55` · 700 `#2E3036` · 800 `#171717` · 900 `#0E0E10` · 950 `#050505` |
| `butter` (amarillo) | 50 `#FDF9E8` · 100 `#FAF1CC` · 200 `#F6E7A6` · 300 `#F2D678` · 400 `#E8C24A` · 700 `#8A6D0E` · 900 `#5C4A0A` |
| `sky` (celeste) | 50 `#F1F6FC` · 100 `#E1EBF7` · 200 `#C8D9EF` · 300 `#9DB6D8` · 500 `#3E64B3` · 700 `#2F4E8C` · 900 `#1A2C52` |
| `coral` (naranja) | 100 `#FBE3D9` · 300 `#F2A07F` · 500 `#E8744A` · 700 `#B04A24` |
| `green` | 100 `#DDF3E3` · 500 `#3BA55C` · 700 `#1F6B37` |
| `red` | 100 `#FBE4E4` · 500 `#D9443B` · 700 `#B8362E` |

Los pasos 200 y 300 de `butter` y `sky` se midieron sobre la referencia; confirmarlos con cuentagotas antes de cerrar la Fase 1.

### 3.2 Semánticos

| Token | Primitivo | Uso |
| --- | --- | --- |
| `bg.page` | neutral-50 | Fondo de la página |
| `bg.surface` | neutral-0 | Tarjetas KPI, búsqueda, Current preparation, botones circulares |
| `bg.surface-subtle` | neutral-100 | Hover de secundarios, skeletons |
| `bg.inverse` | neutral-950 | Tarjeta «Métricas» |
| `bg.inverse-raised` | neutral-800 | Sub-tarjetas de los gauges |
| `bg.accent-warm` | butter-200 | Tarjeta amarilla, etiqueta «Platillo del día» |
| `bg.accent-cool` | sky-200 | Tarjeta celeste, fondo del emblema |
| `text.primary` | neutral-900 | Títulos, cifras, texto principal |
| `text.secondary` | neutral-500 | Texto auxiliar, solo sobre `bg.page` / `bg.surface` |
| `text.on-accent-secondary` | neutral-600 | Texto auxiliar sobre amarillo y celeste |
| `text.inverse` | neutral-0 | Texto sobre la tarjeta negra |
| `text.inverse-secondary` | neutral-400 | Etiquetas de los gauges |
| `text.disabled` | neutral-400 | Controles deshabilitados |
| `border.default` | neutral-200 | Tarjetas blancas, botones circulares, pills |
| `border.strong` | neutral-300 | Hover de botones circulares |
| `border.inverse` | neutral-700 | Pestañas inactivas sobre negro |
| `action.primary` | neutral-900 · hover neutral-700 · pulsado neutral-950 · texto neutral-0 | Botón principal, sidebar activo, flechas |
| `action.secondary` | neutral-0 · hover neutral-100 · borde neutral-200 | Botones circulares |
| `action.selected-inverse` | fondo neutral-0 · texto neutral-900 | Pestaña activa sobre negro |
| `focus.ring` | sky-500 (claro) / sky-300 (sobre negro), 2 px + 2 px de separación | Foco de teclado |
| `status.success` | texto green-700 sobre green-100 | Insignia de variación positiva |
| `status.live` | green-500 | Punto del pill «Live» |
| `status.danger` | texto red-700 sobre red-100 | Errores |
| `rating.star` | butter-300 | Estrella de la puntuación |

### 3.3 Métricas (tarjeta «Métricas»)

| Token | Valor | Contraste sobre `bg.inverse-raised` |
| --- | --- | --- |
| `metric.adherence` | butter-300 | 12.5:1 |
| `metric.calories` | sky-300 | 8.6:1 |
| `metric.protein` | neutral-0 | 17.9:1 |
| `metric.weight` | coral-500 | 6.0:1 |
| `gauge.track` | neutral-700 + `pattern.hatch` | decorativo |
| `gauge.tick` | neutral-500 | 3.5:1 |

Orden y color fijos en todas las pestañas: Adherencia → Calorías → Proteína → Peso.

### 3.4 Superposiciones, tramas y degradados

| Token | Valor | Uso |
| --- | --- | --- |
| `overlay.hero-fade` | radial: transparente 55 % → `bg.page` 80 % | Integrar la foto de la receta con el fondo |
| `overlay.hotspot` | blanco 55 %, borde blanco 90 % | Puntos decorativos sobre la foto |
| `overlay.scrim` | neutral-900 al 40 % | Fondo tras menús en móvil |
| `pattern.hatch` | línea 1 px a 135° cada 4 px, en `currentColor` | Barras de la tarjeta amarilla, pista de diales |
| `gradient.plan-arc` | sky-700 → sky-300 (0–85 %) → coral-500 (85–100 %) | Semicírculo de la tarjeta celeste |
| `skeleton` | neutral-100 con brillo a neutral-50, 1.2 s | Carga |
| `progress.dotted` | lleno neutral-900 · vacío neutral-300 | Barra de Current preparation |

### 3.5 Contrastes verificados (WCAG 2.1)

| Texto / fondo | Ratio | Resultado |
| --- | --- | --- |
| `text.primary` / `bg.page` | 17.8:1 | AA |
| `text.secondary` / `bg.surface` | 5.1:1 | AA |
| `text.secondary` / `bg.page` | 4.7:1 | AA |
| `text.on-accent-secondary` / `bg.accent-warm` | 6.7:1 | AA |
| `text.on-accent-secondary` / `bg.accent-cool` | 5.8:1 | AA |
| `text.primary` / `bg.accent-warm` | 15.5:1 | AA |
| `text.primary` / `bg.accent-cool` | 13.4:1 | AA |
| `text.inverse-secondary` / `bg.inverse-raised` | 7.4:1 | AA |
| `text.inverse` / `action.primary` hover | 13.2:1 | AA |
| `status.success` green-700 / green-100 | 5.6:1 | AA |
| `status.danger` red-700 / blanco | 5.8:1 | AA |
| `focus.ring` sky-500 / `bg.page` | 5.3:1 | ≥ 3:1 no textual |
| `focus.ring` sky-300 / `bg.inverse` | 9.8:1 | ≥ 3:1 no textual |
| Punto inactivo del carrusel neutral-500 / `bg.page` | 4.7:1 | ≥ 3:1 no textual |

**Combinaciones prohibidas** (no pasan): neutral-500 sobre amarillo (4.1:1) o celeste (3.6:1); green-500 como texto sobre green-100 (2.7:1); neutral-300 para controles sobre `bg.page` (1.4:1).

---

## 4. Tipografía

Familia: **Urbanist** (Google Fonts; alternativa: Outfit), sans geométrica. Aplicar en todo el layout nuevo (barra superior, sidebar y dashboard).

| Estilo | Tamaño / interlínea | Peso | Uso |
| --- | --- | --- | --- |
| `display` | 64 / 1.0 | 500 | Título «Dashboard» |
| `title-hero` | 36 / 1.15 | 300 | Nombre de la receta (máx. 2 líneas) |
| `number-xl` | 40 / 1.0 | 400 | Cifras KPI, cifra de la tarjeta amarilla |
| `number-lg` | 32 / 1.0 | 400 | Porcentajes de los gauges (el «%» a 14 px) |
| `title-card` | 16 / 1.3 | 500 | Títulos de tarjeta |
| `body` | 14 / 1.4 | 400 | Etiquetas, pills, botones |
| `caption` | 12 / 1.3 | 400 | Texto auxiliar, ejes, ETA |
| `wordmark` | 22 / 1.0 | 400, mayúsculas, tracking 0.2 em | «NUTRIO» |

Cifras con `font-variant-numeric: tabular-nums`. Conteos KPI con dos dígitos mínimo («06»).

---

## 5. Layout y espaciado

**Base:** 8 px. Escala: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64.

**Estructura (≥ 1280 px):** barra superior a todo el ancho; debajo, sidebar de iconos (72 px), hero (≈ 43 %) y columna de datos (≈ 57 %).

```text
+------------------------------------------------------------------------------+
| emblema NUTRIO | búsqueda IA | Chef's selection | Procesar plan | B N I | perfil |
+----+--------------------------+----------------------------------------------+
| () | Dashboard                | KPI 1 | KPI 2 | KPI 3 | KPI 4                |
| () | Platillo del día         +----------------------------------------------+
| () | Nombre de la receta      | MÉTRICAS  [Semana][Mes][Año][Histórico]      |
| () | ★ 4.9                    | Adherencia | Calorías | Proteína | Peso      |
| () |   (foto como fondo)    :  +----------------------+-----------------------+
| () | [Current preparation]  :  | Amarilla (visual)    | Celeste (visual)  (C) |
+----+--------------------------+----------------------+-----------------------+
```

| Elemento | Medida |
| --- | --- |
| Margen de página | 32 px |
| Gap entre tarjetas | 16–20 px |
| Padding interno de tarjeta | 20–24 px |
| Separación entre botones del sidebar | 12 px |

**Breakpoints**

| Rango | Comportamiento |
| --- | --- |
| ≥ 1280 px | Fiel a la referencia |
| 768–1279 px | La columna de datos baja bajo el hero; KPIs en 2 × 2 |
| < 768 px | Una columna; sidebar → barra inferior; chatbot por encima de ella |

---

## 6. Forma, bordes y elevación

| Token | Valor | Uso |
| --- | --- | --- |
| `radius.card` | 28 px | Tarjetas principales |
| `radius.inner` | 22 px | Sub-tarjetas de gauges |
| `radius.pill` | 999 px | Pills, botones, etiquetas, pestañas |
| `size.icon-button` | 44 px, círculo | Botones de barra y sidebar |
| `border.width` | 1 px | Tarjetas blancas y botones circulares |
| `shadow.none` | — | Tarjetas KPI, negra, amarilla, celeste |
| `shadow.floating` | 0 12px 32px neutral-900 al 10 % | Current preparation, menú de perfil |
| `shadow.floating-strong` | 0 16px 40px neutral-900 al 14 % | Hover de Current preparation, chatbot |

---

## 7. Iconografía

Librería **Lucide**, trazo 1.5, tamaño 20 px en botones de 44 px y 18 px en encabezados de tarjeta. Iconos de tarjeta dentro de un círculo de 36 px con `border.default`.

| Lugar | Iconos |
| --- | --- |
| Barra superior | `sparkle`, `chef-hat`, `plus`, `bell`, `notebook-pen`, `inbox`, `chevron-down` |
| Sidebar | `layout-grid` (Inicio), `calendar-days` (Planes), `cooking-pot` (Recetario), `shopping-basket` (Compras), `chart-column` (Análisis), `settings` (Configuración) |
| KPIs | `hand-platter` (Comidas de hoy), `clipboard-list` (Planes disponibles), `concierge-bell` (Recetas disponibles), `package` (Compras pendientes) |
| Tarjetas | `gauge` (Métricas), `cooking-pot` + `clock` (Current preparation), `arrow-up-right`, `star`, `arrow-up` |

Todo botón de solo icono lleva `aria-label` y tooltip.

---

## 8. Componentes

### 8.1 Botón primario
Pill `action.primary`, texto `body` 500 en `text.inverse`, icono `plus` a la izquierda, alto 48 px, padding 0 24 px. Uno solo por zona. Uso: «Procesar plan» (ejecuta «Subir Plan»).

### 8.2 Botón circular
44 px, `action.secondary`. Activo (sidebar): `action.primary` con icono `text.inverse`. Los botones sin acción conservan hover y foco y llevan `aria-disabled="true"`.

### 8.3 Pill de búsqueda
Fondo `bg.surface`, borde `border.default`, alto 48 px. A la izquierda, círculo `action.primary` de 36 px con `sparkle` blanco. Placeholder `text.secondary`.

### 8.4 Chef's selection
Pill blanca: icono `chef-hat` en círculo, título `body` 500, subtítulo `caption` `text.secondary`, 3 miniaturas circulares de 32 px superpuestas −8 px con borde 2 px `bg.surface`, y contador «+N» en círculo `neutral-700`.

### 8.5 Perfil
Avatar circular 40 px, nombre `body` 500 `text.primary`, rol `caption` `text.secondary`, `chevron-down`. Extremo derecho de la barra.

### 8.6 Etiqueta
Pill `bg.accent-warm`, texto `body` `text.primary`, padding 6 px 14 px. Ej.: «Platillo del día».

### 8.7 Puntuación
Pill `bg.surface` con borde, `star` relleno `rating.star`, número `body` 500. Valor determinista: `4.5 + (hash(idReceta) % 6) / 10`.

### 8.8 Carrusel del hero
Foto de la receta activa como fondo con `overlay.hero-fade`; puntos decorativos `overlay.hotspot`; paginación vertical a la derecha (punto activo neutral-900, inactivo neutral-500, 8 px). Cambio de diapositiva: fundido de 300 ms. Sin autoplay. Teclado: flechas.

### 8.9 Tarjeta Current preparation
`bg.surface`, `radius.card`, `shadow.floating`. Icono `cooking-pot`, título `body` 500, ETA `caption` con `clock`, botón circular `action.primary` con `arrow-up-right`, `progress.dotted` y porcentaje `number-lg`. Toda la tarjeta enlaza a la receta activa.

### 8.10 Tarjeta KPI
`bg.surface`, borde `border.default`, `radius.card`, sin sombra. Icono en círculo + etiqueta `body` arriba; cifra `number-xl` debajo, unidad opcional en `body`.

### 8.11 Tarjeta «Métricas»
`bg.inverse`, `radius.card`. Encabezado: icono `gauge` en círculo con `border.inverse`, título «Métricas» en `text.inverse`, pestañas Semana · Mes · Año · Histórico (activa `action.selected-inverse`, inactivas `border.inverse` + `text.inverse-secondary`). Cuatro sub-tarjetas `bg.inverse-raised` con `radius.inner`: porcentaje `number-lg`, dial con marcas `gauge.tick`, cuña en el color de su métrica y etiqueta «Nombre (dato)» en `text.inverse-secondary`.

Reglas: > 100 % → dial lleno y número real; sin datos → «—», dial sin cuña.

### 8.12 Tarjetas amarilla y celeste (solo visuales)
- **Amarilla** (`bg.accent-warm`): «Resumen calórico», selector «Hoy» inactivo, cifra `number-xl`, insignia `status.success` con `arrow-up`, dos métricas secundarias con separador vertical, 9 barras neutral-900 con `pattern.hatch`, eje horario `caption` `text.on-accent-secondary`.
- **Celeste** (`bg.accent-cool`): «Cumplimiento del plan», botón `arrow-up-right` inactivo, pill «Live» con punto `status.live`, semicírculo `gradient.plan-arc`, total al centro, tres cifras abajo con punto de color.

### 8.13 Chatbot flotante
Se conserva del dashboard anterior: funcionamiento y diseño intactos. Fijo abajo a la derecha, `shadow.floating-strong`, por encima de todas las capas, sin tapar la tarjeta celeste.

---

## 9. Movimiento

| Interacción | Duración | Curva |
| --- | --- | --- |
| Hover / pulsado | 150 ms | ease-out |
| Cambio de pestaña | 200 ms | ease-out |
| Cambio de diapositiva | 300 ms (fundido) | ease-in-out |
| Llenado de diales | 600 ms al cargar | ease-out |

Respetar `prefers-reduced-motion`: sin animación de diales ni fundidos.

---

## 10. Accesibilidad

- Texto normal ≥ 4.5:1; elementos no textuales ≥ 3:1 (ver 3.5).
- Foco visible en todos los controles (`focus.ring`).
- `aria-label` en todos los botones de solo icono; `aria-disabled` en los que aún no tienen acción.
- Gauges con `role="img"` y `aria-label` completo («Adherencia al plan: 78 %, 25 de 32 comidas»).
- El carrusel anuncia la receta activa (`aria-live="polite"`).

---

## 11. Tokens en CSS

```css
:root {
  /* Primitivos */
  --neutral-0:#FFFFFF; --neutral-50:#F5F6F8; --neutral-100:#EEEFF2; --neutral-200:#E6E7EA;
  --neutral-300:#D3D5DA; --neutral-400:#A3A6AD; --neutral-500:#6B6E76; --neutral-600:#4B4E55;
  --neutral-700:#2E3036; --neutral-800:#171717; --neutral-900:#0E0E10; --neutral-950:#050505;
  --butter-50:#FDF9E8; --butter-100:#FAF1CC; --butter-200:#F6E7A6; --butter-300:#F2D678;
  --butter-400:#E8C24A; --butter-700:#8A6D0E; --butter-900:#5C4A0A;
  --sky-50:#F1F6FC; --sky-100:#E1EBF7; --sky-200:#C8D9EF; --sky-300:#9DB6D8;
  --sky-500:#3E64B3; --sky-700:#2F4E8C; --sky-900:#1A2C52;
  --coral-100:#FBE3D9; --coral-300:#F2A07F; --coral-500:#E8744A; --coral-700:#B04A24;
  --green-100:#DDF3E3; --green-500:#3BA55C; --green-700:#1F6B37;
  --red-100:#FBE4E4; --red-500:#D9443B; --red-700:#B8362E;

  /* Semánticos */
  --color-bg-page: var(--neutral-50);
  --color-bg-surface: var(--neutral-0);
  --color-bg-surface-subtle: var(--neutral-100);
  --color-bg-inverse: var(--neutral-950);
  --color-bg-inverse-raised: var(--neutral-800);
  --color-bg-accent-warm: var(--butter-200);
  --color-bg-accent-cool: var(--sky-200);
  --color-text-primary: var(--neutral-900);
  --color-text-secondary: var(--neutral-500);
  --color-text-on-accent-secondary: var(--neutral-600);
  --color-text-inverse: var(--neutral-0);
  --color-text-inverse-secondary: var(--neutral-400);
  --color-text-disabled: var(--neutral-400);
  --color-border-default: var(--neutral-200);
  --color-border-strong: var(--neutral-300);
  --color-border-inverse: var(--neutral-700);
  --color-action-primary: var(--neutral-900);
  --color-action-primary-hover: var(--neutral-700);
  --color-action-primary-pressed: var(--neutral-950);
  --color-focus-ring: var(--sky-500);
  --color-focus-ring-inverse: var(--sky-300);
  --color-success-fg: var(--green-700);
  --color-success-bg: var(--green-100);
  --color-live: var(--green-500);
  --color-danger-fg: var(--red-700);
  --color-danger-bg: var(--red-100);
  --color-rating-star: var(--butter-300);

  /* Métricas */
  --color-metric-adherence: var(--butter-300);
  --color-metric-calories: var(--sky-300);
  --color-metric-protein: var(--neutral-0);
  --color-metric-weight: var(--coral-500);
  --color-gauge-track: var(--neutral-700);
  --color-gauge-tick: var(--neutral-500);

  /* Superposiciones, tramas y sombras */
  --overlay-hero-fade: radial-gradient(ellipse at 50% 50%, transparent 55%, var(--color-bg-page) 80%);
  --overlay-hotspot: rgb(255 255 255 / .55);
  --overlay-scrim: rgb(14 14 16 / .40);
  --pattern-hatch: repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 4px);
  --gradient-plan-arc: linear-gradient(90deg, var(--sky-700) 0%, var(--sky-300) 85%, var(--coral-500) 100%);
  --shadow-floating: 0 12px 32px rgb(14 14 16 / .10);
  --shadow-floating-strong: 0 16px 40px rgb(14 14 16 / .14);

  /* Forma y tipografía */
  --radius-card: 28px;
  --radius-inner: 22px;
  --radius-pill: 999px;
  --size-icon-button: 44px;
  --font-sans: "Urbanist", "Outfit", system-ui, sans-serif;
}
```

Si el proyecto usa Tailwind, exponer estas variables en `theme.extend.colors`, `borderRadius`, `boxShadow` y `fontFamily` apuntando a `var(--…)`; nunca duplicar los hex en la configuración.

---

## 12. Sí / No

| Sí | No |
| --- | --- |
| Amarillo y celeste solo como fondo de bloques completos | Amarillo o celeste para texto o iconos pequeños |
| Un negro relleno por zona (acción principal o estado activo) | Varios botones negros juntos |
| Coral solo para Peso y avisos | Coral decorativo |
| Texto secundario en neutral-600 sobre acentos | neutral-500 sobre amarillo o celeste |
| Separar tarjetas con borde y color | Sombras en tarjetas que no flotan |
| Pedir un token nuevo cuando falte | Escribir un hex en un componente |

## 13. Guía para agentes de código

1. Leer este archivo antes de crear o modificar cualquier componente de interfaz.
2. Usar solo tokens semánticos (`--color-*`, `--radius-*`, `--shadow-*`); los primitivos son solo para definir semánticos.
3. Antes de dar por terminado un componente: comprobar los cinco estados (reposo, hover, pulsado, foco, deshabilitado) y los contrastes de la sección 3.5.
4. Si una decisión no está cubierta aquí, preguntar antes de inventar un valor y, una vez resuelta, añadirla a este archivo.
