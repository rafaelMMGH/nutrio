# PRD v0.1 — Nutritional Manager

## 1. Resumen ejecutivo

**Nutritional Manager** será una web app personal para administrar planes nutricionales creados por un nutriólogo.

El usuario podrá subir PDFs de planes alimenticios, extraer su información, revisarla, organizar comidas, seleccionar recetas para un periodo, generar un carrito global y convertirlo en listas de compras estructuradas.

La aplicación también incluirá un chat RAG global para consultar información del sistema: plan activo, recetario, carrito, listas, plantillas, sustituciones e historial.

---

## 2. Objetivo del producto

Centralizar y operacionalizar planes nutricionales personales, convirtiendo PDFs estáticos en información estructurada, reutilizable, consultable y accionable.

### Objetivos V1

- Subir y procesar PDFs nutricionales.
- Extraer comidas, opciones, ingredientes, cantidades, add-ons, suplementos y recomendaciones.
- Revisar y corregir la extracción mediante wizard.
- Mantener un plan activo y planes archivados.
- Crear un recetario global.
- Planificar comidas por periodo.
- Generar carrito global.
- Crear listas de compras.
- Consultar información mediante chat RAG global.
- Exportar listas.
- Mantener privacidad, versionado y trazabilidad.

---

## 3. Fuera de alcance V1

Queda fuera de V1:

- Generación automática de dietas.
- Cálculo automático de calorías/macronutrientes no presentes en el PDF.
- Integración con supermercados.
- App móvil nativa.
- Recomendaciones médicas fuera del plan.
- Creación manual de plan desde cero.
- Tracking de cumplimiento personal.
- Recordatorios automáticos.
- Constructor avanzado drag & drop.
- Hard delete.

---

## 4. Usuario objetivo

Usuario individual que recibe planes nutricionales en PDF por parte de su nutriólogo y necesita:

- Organizar comidas.
- Planificar compras.
- Reutilizar recetas anteriores.
- Consultar su información rápidamente.
- Evitar errores de interpretación.
- Mantener privacidad sobre datos personales y de salud.

No habrá roles, grupos ni colaboración en V1.

---

## 5. Plataforma

### V1

- Web app responsive.
- Optimizada primero para desktop/laptop.
- Compatible con móvil/tablet vía responsive design.
- Cloud-hosted.
- Login obligatorio.
- Backend propio.
- Base de datos propia.
- Storage privado para PDFs.

### Fases posteriores

- App móvil nativa.
- Integración con supermercados.
- Funcionalidades avanzadas de nutrición.

---

## 6. Módulos principales

### 6.1 Dashboard

Módulo operativo con métricas simples:

- Plan activo.
- Carrito activo.
- Última lista generada.
- Listas de compras generadas.
- Porcentaje de ingredientes comprados.
- Recetas más usadas en carrito/listas.
- Días planificados.

No habrá tracking de cumplimiento personal.

---

### 6.2 Planes

Permite:

- Subir PDF.
- Procesar PDF.
- Revisar extracción.
- Confirmar plan.
- Ver plan activo.
- Archivar planes.
- Activar plan archivado.
- Ver PDF original.
- Editar plan confirmado.
- Consultar versiones anteriores.
- Enviar planes a Papelera mediante soft delete.

Regla central:

- Solo puede existir un plan activo.
- Al activar un plan archivado, el plan actual se archiva.
- El carrito no se borra automáticamente, pero se muestra advertencia si contiene elementos de otro plan.

---

### 6.3 Recetario

Módulo separado de planes archivados.

Contiene todas las recetas extraídas de todos los planes.

Cada receta conserva:

- Nombre.
- Tipo de comida.
- Ingredientes.
- Cantidades.
- Unidades.
- Add-ons heredados.
- Plan/versiones donde aparece.
- Estado del plan de origen.
- Fecha de creación.
- `deleted_at`.

Desde el Recetario se podrán agregar recetas históricas al carrito.

Si la receta pertenece a un plan archivado, se debe advertir al usuario.

---

### 6.4 Planificación

Permite seleccionar comidas para un periodo.

#### Periodos rápidos

- 5 días.
- 1 semana = 7 días.
- 1 quincena = 14 días.

#### Periodo personalizado

- Fecha inicio.
- Fecha fin.
- Total de días calculado automáticamente.

#### Modos

- Modo simple: Día 1, Día 2, Día 3.
- Modo calendario: Lunes 10, Martes 11, etc.

#### Selección

El usuario selecciona opciones por tipo de comida:

- Pre-entreno.
- Desayuno.
- Colación.
- Comida.
- Cena.
- Otras comidas detectadas.

Reglas:

- Una sola opción seleccionada se repite todo el periodo.
- Varias opciones se rotan automáticamente.
- La asignación manual por día es opcional.
- Las comidas de única opción se seleccionan automáticamente, pero pueden desactivarse.
- El pre-entreno solo se calcula según días de entrenamiento.

---

### 6.5 Carrito global

El carrito será global y persistente en toda la app.

Debe estar disponible desde:

- Dashboard.
- Planes.
- Recetario.
- Planificación.
- Lista de compras.
- Chat RAG.

El carrito guarda fuentes, no solo ingredientes.

Ejemplos de fuentes:

- Desayuno Opción 1 × 7 días.
- Cena histórica × 2 veces.
- Ingrediente manual × 3 piezas.
- Plantilla de compra cargada.

La lista consolidada de ingredientes se calcula dinámicamente.

---

### 6.6 Listas de compras

Una lista se genera desde el carrito.

Debe guardar snapshot congelado:

- Ingredientes.
- Cantidades.
- Unidades.
- Estados.
- Sustituciones.
- Fuentes originales.
- Fecha de generación.
- Plan usado.
- Periodo asociado.

Estados por ingrediente:

- Pendiente.
- Comprado.
- No encontrado.
- Omitido.
- Sustituido manualmente.

La lista debe agruparse por categoría:

- Proteínas.
- Verduras.
- Frutas.
- Lácteos.
- Cereales / tortillas / pan.
- Suplementos.
- Otros.

---

### 6.7 Historial de listas

Toda lista generada se guarda automáticamente en historial.

Debe permitir:

- Ver lista anterior.
- Exportar nuevamente.
- Duplicar al carrito.
- Enviar a Papelera.
- Restaurar.

Al duplicar una lista:

- Opción default: reemplazar carrito actual.
- Alternativa: agregar al carrito actual.

---

### 6.8 Plantillas de compra

Las plantillas se crean únicamente desde listas generadas.

Una plantilla guarda:

- Nombre.
- Descripción opcional.
- Periodo original.
- Plan de origen.
- Comidas/recetas incluidas.
- Ingredientes manuales incluidos.
- Alternativas seleccionadas.
- Add-ons incluidos/excluidos.
- Suplementos incluidos/excluidos.
- Días de entrenamiento.
- Snapshot de referencia.

Al cargar una plantilla al carrito, se recalcula con datos actuales.

Si contiene fuentes eliminadas o archivadas:

- Cargar parcialmente.
- Mostrar advertencia.
- Permitir restaurar recetas desde Papelera si aplica.

---

### 6.9 Chat RAG global

Chat disponible globalmente, similar al carrito.

Debe funcionar como:

- Panel lateral.
- Drawer.
- Modal flotante.

Default:

- Automático = Todo el sistema.

Selector manual de contexto:

- Automático.
- Plan activo.
- Carrito actual.
- Recetario.
- Historial de listas.
- Plantillas.
- Planes archivados.
- Todo el sistema.

Reglas obligatorias:

- Mostrar contexto usado.
- Citar fuente.
- No inventar información.
- Pedir aclaración si la pregunta es ambigua.
- Usar búsqueda híbrida.
- Ejecutar acciones solo con confirmación.

---

### 6.10 Configuración

Permite administrar:

- Catálogo maestro de ingredientes.
- Alias de ingredientes.
- Categorías.
- Cantidades default para ingredientes “al gusto”.
- Unidades.
- Preferencias futuras.
- Sustituciones frecuentes.
- Exportación.

---

### 6.11 Papelera

Todas las eliminaciones usan soft delete mediante:

```text
deleted_at
```

La Papelera permite:

- Ver elementos eliminados.
- Filtrar por tipo.
- Restaurar elementos.
- No habrá hard delete en V1.

---

## 7. Flujo principal: subir PDF

El proceso debe ejecutarse mediante wizard multi-step en modal.

### Pasos

1. Subir PDF.
2. Procesar PDF.
3. Revisar datos generales.
4. Revisar comidas y opciones.
5. Revisar ingredientes, cantidades, alternativas y add-ons.
6. Revisar suplementos, recomendaciones y resumen nutricional.
7. Resolver duplicados.
8. Confirmar y guardar.

### Estados del procesamiento

- `uploaded`
- `processing`
- `needs_review`
- `ready_to_confirm`
- `confirmed`
- `failed`
- `cancelled`

El plan solo será utilizable cuando esté `confirmed`.

### Fallos

Si falla parcial o totalmente:

- Reintentar procesamiento.
- Subir otro PDF.
- Cancelar proceso.

La creación manual desde cero queda para fase 2.

---

## 8. Reglas de extracción del PDF

### Información a extraer

- Datos generales.
- Objetivo.
- Diagnóstico si existe.
- Comidas.
- Horarios.
- Opciones.
- Ingredientes.
- Cantidades.
- Unidades.
- Alternativas.
- Add-ons compartidos.
- Suplementos.
- Recomendaciones.
- Snacks libres.
- Alimentos libres.
- Comidas libres.
- Resumen nutricional informativo.
- PDF original.

### Confianza por campo

Cada campo extraído debe tener:

- `confidence_score`
- `requires_review`

Campos críticos:

- Comida.
- Opción.
- Ingrediente.
- Cantidad.
- Unidad.
- Alternativa.
- Add-on compartido.
- Duplicado exacto sin decisión.

No se puede guardar un plan con campos críticos pendientes.

---

## 9. Reglas de comidas y recetas

### Comidas

Cada comida puede tener:

- Nombre.
- Horario informativo.
- Opciones.
- Add-ons compartidos.
- Notas.

Los horarios se guardan solo como metadata informativa.

No generan recordatorios en V1.

### Recetas

Una receta representa una preparación reutilizable.

Debe separarse de la opción del plan.

- `MealOption` representa la opción dentro de un plan.
- `Recipe` representa la receta reutilizable en el Recetario.

### Add-ons compartidos

Ejemplo:

- Batido de desayuno.
- Batido de cena.
- Bebida compartida de comida.

Deben modelarse como entidad independiente.

Al agregar una receta al carrito:

- Los add-ons se incluyen por default si eran obligatorios.
- El usuario puede desactivarlos manualmente.

---

## 10. Alternativas de ingredientes

Líneas con “o” se modelan como alternativas excluyentes.

Ejemplo:

```text
Rice Krispies Treats o Zucaritas
Plátano dominico o manzana cocida
```

Reglas:

- Si el usuario selecciona una alternativa, se usa esa.
- Si no selecciona ninguna, se usa la primera como default.
- Solo una alternativa del grupo puede aplicarse en la lista de compras.

---

## 11. Ingredientes “al gusto”

### Excluir de lista de compras

Por default no se agregan:

- Sal.
- Condimentos.
- Especias.
- Limón / jugo de limón.

### Convertir a cantidad exacta

Otros ingredientes “al gusto” sí se agregan con cantidades default editables por pieza.

Ejemplo:

- Tomate → 1 pieza.
- Cebolla → 1/4 pieza.
- Chile serrano → 1 pieza.
- Cilantro → 1 manojo por semana.

El usuario puede editar el catálogo.

---

## 12. Unidades y conversiones

### Regla 1: sumar unidades iguales

```text
20 g + 40 g = 60 g
5 piezas + 4 piezas = 9 piezas
```

### Regla 2: adaptar solo si supera unidad superior

```text
900 ml → 900 ml
1250 ml → 1 L + 250 ml

900 g → 900 g
1250 g → 1 kg + 250 g
```

### Regla 3: mantener unidades no convertibles

Unidades como:

- taza
- paquete
- scoop
- lata
- sobre
- rebanada
- cucharadita

se mantienen como vienen en el plan y pueden marcarse para revisión.

---

## 13. Ingredientes con doble medida

Ejemplo:

```text
60 g de aguacate hass (2/3 de pieza)
```

Guardar ambas:

- Medida nutricional: 60 g.
- Medida práctica: 2/3 pieza.

Para compras se usa la medida práctica cuando exista.

Para trazabilidad y RAG se conservan ambas.

---

## 14. Duplicados

### Recetas duplicadas

Una receta solo es duplicada si tiene:

- Mismos ingredientes.
- Mismas porciones/cantidades.
- Mismas unidades.

El orden en el PDF no importa.

Si se detecta duplicado exacto:

- No crear receta duplicada.
- Reutilizar receta existente.
- Asociarla al nuevo plan/version.

### Add-ons duplicados

Los add-ons se comparan de forma independiente.

La receta principal y los add-ons no se mezclan para detectar duplicados.

---

## 15. Suplementos

Los suplementos deben:

- Extraerse del PDF.
- Guardarse en el plan.
- Mostrarse como categoría separada.
- Poder agregarse manualmente al carrito.
- No agregarse por default.

---

## 16. Recomendaciones

Las recomendaciones generales y específicas se guardan como notas informativas.

Sirven para:

- Visualización en detalle del plan.
- Respuestas RAG.
- Referencia informativa.

No deben:

- Modificar carrito.
- Bloquear comidas.
- Generar alertas médicas.
- Cambiar cantidades.
- Crear recomendaciones fuera del plan.

---

## 17. Resumen nutricional

El resumen nutricional del PDF debe guardarse como información estructurada, pero puede estar oculto.

Incluye:

- Equivalentes.
- Gramos.
- Kcal.
- Suma kcal.
- Porcentaje de adecuación.

Se muestra bajo demanda:

- Botón “Ver resumen nutricional”.
- Pregunta vía chat RAG.

No afecta carrito ni lista de compras en V1.

---

## 18. RAG

### Alcance

El RAG puede consultar todo el sistema:

- Plan activo.
- Versiones del plan.
- PDF original.
- Recetario.
- Carrito actual.
- Historial de listas.
- Plantillas de compra.
- Estados de compra.
- Sustituciones manuales.
- Planes archivados, si aplica.

### Búsqueda híbrida

Usar búsqueda estructurada para:

- Cantidades.
- Estados.
- Sustituciones.
- Historial.
- Carrito.
- Plantillas.

Usar búsqueda semántica para:

- Preguntas abiertas.
- Recomendaciones.
- Notas.
- PDF.
- Recetas por similitud textual.

### Regla anti-invención

El sistema no debe inventar datos.

Si la información no existe, debe responder:

```text
No encontré esa información en el sistema.
```

Si el contexto es el plan activo:

```text
No encontré esa información en tu plan activo.
```

### Fuentes

Toda respuesta debe mostrar:

- Contexto usado.
- Fuente específica.
- Página o sección si aplica.

---

## 19. Acciones desde chat

El chat puede iniciar acciones, pero nunca ejecutarlas sin confirmación.

### Confirmación simple

Para:

- Agregar al carrito.
- Generar lista.
- Exportar lista.
- Mostrar resumen.
- Buscar receta.

### Confirmación fuerte

Para:

- Eliminar con soft delete.
- Activar plan archivado.
- Restaurar desde Papelera.
- Cargar plantilla con fuentes eliminadas.
- Reemplazar carrito.
- Cambios que creen nueva versión del plan.

Confirmación fuerte = resumen de impacto + botón explícito.

---

## 20. Seguridad y privacidad

Medidas obligatorias V1:

- Login obligatorio.
- Datos privados por usuario.
- PDFs privados por usuario.
- Recetario privado.
- Carrito privado.
- Historial privado.
- Storage cifrado.
- PDFs no públicos.
- RAG limitado al usuario autenticado.
- Auditoría básica de fechas.
- Soft delete con `deleted_at`.

Auditoría mínima:

- Fecha de carga.
- Fecha de edición.
- Fecha de generación de lista.
- Fecha de cambio de plan activo.
- Fecha de eliminación lógica.

---

## 21. Versionado

Cada vez que se confirmen cambios importantes en un plan, se crea nueva versión.

Guardar:

- Versión anterior.
- Versión nueva.
- Fecha de edición.
- Campos modificados.

Reglas:

- RAG usa por defecto la versión actual.
- Versiones anteriores se consultan solo si el usuario lo pide.
- Listas históricas no cambian.
- Snapshots anteriores no cambian.

---

## 22. RAG por versión

Cada versión confirmada del plan debe tener su propio índice RAG.

Estados:

- `pending_index`
- `indexing`
- `ready`
- `failed`
- `outdated`

Si cambia el plan:

```text
outdated → indexing → ready
```

Si falla la indexación, el usuario debe ver el estado.

---

## 23. Modelo de datos base

### Entidades principales

```text
User
Plan
PlanVersion
UploadedPdf
MealType
MealOption
Recipe
PlanVersionRecipe
SharedAddOn
MealOptionSharedAddOn
Ingredient
IngredientAlias
IngredientUsage
AlternativeGroup
ShoppingCart
CartItem
ShoppingList
ShoppingListItem
ShoppingTemplate
RagIndex
```

Todas las entidades eliminables deben tener:

```text
deleted_at
```

---

## 24. Modelo de datos recomendado

### User

```text
id
email
name
created_at
updated_at
deleted_at
```

### Plan

```text
id
user_id
name
objective
status: active | archived
created_at
updated_at
deleted_at
```

### PlanVersion

```text
id
plan_id
version_number
structured_data
change_summary
is_current
created_at
updated_at
deleted_at
```

### UploadedPdf

```text
id
plan_id
file_path
file_name
mime_type
storage_status
created_at
deleted_at
```

### MealType

```text
id
plan_version_id
name
display_order
time_window
created_at
deleted_at
```

### MealOption

```text
id
plan_version_id
meal_type_id
recipe_id
option_number
is_unique_option
created_at
deleted_at
```

### Recipe

```text
id
user_id
name
description
canonical_hash
created_at
updated_at
deleted_at
```

### PlanVersionRecipe

```text
id
plan_version_id
recipe_id
meal_type_id
option_number
created_at
deleted_at
```

### SharedAddOn

```text
id
plan_version_id
meal_type_id
name
applies_to_all_options
canonical_hash
created_at
deleted_at
```

### Ingredient

```text
id
user_id
canonical_name
category
primary_unit
created_at
updated_at
deleted_at
```

### IngredientAlias

```text
id
ingredient_id
alias
created_at
deleted_at
```

### IngredientUsage

```text
id
ingredient_id
source_type
source_id
quantity
unit
practical_quantity
practical_unit
notes
is_optional
alternative_group_id
confidence_score
requires_review
created_at
deleted_at
```

### AlternativeGroup

```text
id
source_type
source_id
default_ingredient_usage_id
created_at
deleted_at
```

### ShoppingCart

```text
id
user_id
status: active
created_at
updated_at
deleted_at
```

### CartItem

```text
id
cart_id
source_type
source_id
quantity_multiplier
period_days
training_days
selected_alternatives
include_add_ons
include_supplements
created_at
updated_at
deleted_at
```

### ShoppingList

```text
id
user_id
name
plan_version_id
period_days
generated_from_cart_id
snapshot_data
created_at
updated_at
deleted_at
```

### ShoppingListItem

```text
id
shopping_list_id
ingredient_id
name_snapshot
quantity_snapshot
unit_snapshot
category_snapshot
status
substitution_data
source_breakdown
created_at
updated_at
deleted_at
```

### ShoppingTemplate

```text
id
user_id
name
description
source_config
reference_snapshot
created_at
updated_at
deleted_at
```

### RagIndex

```text
id
user_id
scope_type
scope_id
status
index_metadata
created_at
updated_at
deleted_at
```

---

## 25. Backend lógico

Servicios recomendados:

```text
AuthService
PlanService
PdfProcessingService
RecipeService
IngredientService
CartService
ShoppingListService
TemplateService
RagService
ExportService
TrashService
```

---

## 26. Jobs async

Procesos en background:

- Extracción PDF.
- OCR.
- Parsing estructurado.
- Detección de duplicados.
- Generación de embeddings.
- Exportación PDF.
- Reindexación RAG.

Estados:

- `pending`
- `processing`
- `needs_review`
- `completed`
- `failed`

---

## 27. Endpoints principales

```http
POST   /plans/upload
GET    /plans
GET    /plans/:id
PATCH  /plans/:id
POST   /plans/:id/activate
POST   /plans/:id/confirm
DELETE /plans/:id

GET    /recipes
GET    /recipes/:id
PATCH  /recipes/:id
DELETE /recipes/:id

GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id
POST   /cart/generate-list
POST   /cart/clear

GET    /shopping-lists
GET    /shopping-lists/:id
PATCH  /shopping-lists/:id/items/:itemId
POST   /shopping-lists/:id/export
POST   /shopping-lists/:id/save-template
DELETE /shopping-lists/:id

GET    /templates
POST   /templates/:id/load-to-cart
DELETE /templates/:id

POST   /rag/chat
GET    /trash
POST   /trash/:entityType/:id/restore
```

---

## 28. Exportaciones

Formatos V1:

- PDF.
- Texto simple.
- Markdown.
- JSON.

Las exportaciones salen desde listas generadas, no desde carrito crudo.

---

## 29. Criterios de aceptación V1

### PDF

- Permite subir PDF privado.
- Extrae estructura principal.
- Detecta comidas, opciones e ingredientes.
- Detecta alternativas.
- Detecta add-ons.
- Detecta suplementos y recomendaciones.
- Marca baja confianza.
- Bloquea guardado con campos críticos pendientes.
- Guarda PDF original.
- Crea versión inicial.
- Indexa RAG.

### Planificación

- Permite periodos rápidos.
- Permite periodo personalizado.
- Rota opciones automáticamente.
- Permite asignación manual opcional.
- Calcula pre-entreno por días de entrenamiento.
- Agrega selección al carrito.

### Carrito

- Es global.
- Guarda fuentes.
- Recalcula dinámicamente.
- Permite recetas históricas.
- Permite ingredientes manuales.
- Consolida cantidades.
- Agrupa por categoría.

### Lista de compras

- Genera snapshot congelado.
- Maneja estados.
- Permite sustituciones.
- Detecta sustituciones frecuentes después de 3 usos.
- Exporta en formatos definidos.
- Permite guardar como plantilla.

### RAG

- Chat global disponible.
- Default automático sobre todo el sistema.
- Usa búsqueda híbrida.
- Muestra contexto usado.
- Cita fuente.
- No inventa datos.
- Pide aclaración ante ambigüedad.
- Ejecuta acciones solo con confirmación.

### Seguridad

- Login obligatorio.
- Datos privados.
- PDFs privados.
- Storage cifrado.
- Soft delete con `deleted_at`.
- Papelera y restauración.
- Sin hard delete.

---

## 30. Backlog MVP

### Prioridad alta

1. Auth + app shell.
2. Storage privado para PDFs.
3. Upload PDF.
4. Pipeline extracción/OCR.
5. Wizard de revisión.
6. Modelo Plan/PlanVersion/PDF.
7. Modelo Meal/Recipe/Ingredient.
8. Recetario.
9. Planificación.
10. Carrito global.
11. Generación de lista.
12. Chat RAG global.

### Prioridad media

13. Historial de listas.
14. Plantillas de compra.
15. Exportaciones.
16. Papelera.
17. Sustituciones frecuentes.
18. Dashboard operativo.
19. Configuración de ingredientes/defaults.

### Prioridad baja V1

20. Métricas simples.
21. Mejoras visuales.
22. Optimización avanzada de búsqueda.
23. Mejoras de parsing.
24. Mejoras de UX en wizard.

---

## 31. Roadmap posterior

### Phase 2

- Creación manual de plan desde cero.
- Cálculo automático de macros/calorías.
- Generación automática de dietas.
- Preferencias alimentarias avanzadas.
- Constructor visual de recetas.
- Mejoras de análisis nutricional.

### Phase 3

- Integración con supermercados.
- Match ingrediente-producto.
- Cálculo de paquetes necesarios.
- Comparación de precios.
- Carrito externo hacia tiendas.
- Sustituciones basadas en productos reales.

### Phase 4

- App móvil nativa.
- Notificaciones.
- Recordatorios.
- Experiencia offline parcial.
- Escaneo de productos.

### Phase 5

- Recomendaciones médicas avanzadas, solo con validación adecuada.
- Integración con nutriólogo.
- Roles/grupos.
- Reportes compartibles.

---

## 32. Riesgos principales

### Riesgo 1: extracción incorrecta del PDF

Mitigación:

- Wizard obligatorio.
- Confianza por campo.
- Bloqueo de guardado por campos críticos.

### Riesgo 2: RAG inventa información

Mitigación:

- Regla anti-invención obligatoria.
- Fuentes obligatorias.
- Búsqueda estructurada para datos exactos.

### Riesgo 3: listas de compras incorrectas

Mitigación:

- Carrito basado en fuentes.
- Desglose de origen.
- Revisión antes de generar lista.
- Snapshots congelados.

### Riesgo 4: datos sensibles expuestos

Mitigación:

- Login obligatorio.
- Storage privado.
- Cifrado.
- Aislamiento por usuario.
- RAG limitado al usuario autenticado.

### Riesgo 5: exceso de complejidad V1

Mitigación:

- Mantener app web responsive.
- Evitar mobile nativo.
- Evitar supermercados.
- Evitar tracking.
- Evitar cálculo automático de macros.

---

## 33. Definición de terminado V1

V1 estará terminada cuando el usuario pueda:

1. Iniciar sesión.
2. Subir un PDF nutricional.
3. Procesarlo.
4. Revisarlo en wizard.
5. Confirmarlo como plan activo.
6. Ver recetas en Recetario.
7. Planificar un periodo.
8. Agregar comidas al carrito.
9. Generar lista de compras.
10. Marcar estados de compra.
11. Exportar lista.
12. Guardar plantilla.
13. Consultar datos mediante chat global.
14. Restaurar elementos desde Papelera.
15. Mantener privacidad y trazabilidad.
