# Doc de Titulación · UTET (Electron v0.9.0)

Aplicación de escritorio de la Unidad de Titulación y Eficiencia Terminal (ITSQMET). Mantiene 6 períodos, 11 requisitos, 9 procesos y 24 tipos documentales.

## Configuración documental

En **Procesos → Datos**, cada documento abre su ficha con el alcance, la fuente y la salida prevista. Las tres actas de titulación, los dos memorandos de similitud y el cronograma de Artículo Académico abren sus pantallas de emisión.

Los otros 18 documentos admiten formulario y carga Excel. La vista previa genera las tablas y secciones del tipo documental para revisión. Los consolidados agrupan registros por período y referencia, con convocatoria, sesión o corte cuando corresponde. Las plantillas descargadas conservan el período y el tipo documental. Las plantillas anteriores pueden cargarse con sus columnas obligatorias.

Los formularios individuales pueden completar la ficha desde `matriculas` y `Estudiante`. Los informes de verificación también consultan `requisitos`. Los campos que no consten quedan pendientes o se capturan con su evidencia. Las solicitudes y planes de núcleo registran su referencia de SISACAD. El Informe Final registra el corte preparado en el módulo Inf de Requisitos y sus ocho apartados. Los registros de captura y los borradores se guardan en el perfil local.

## PRO-56 · Planificación del Examen Complexivo

En **Procesos → Planificación semestral → Planificación del Examen Complexivo → Datos**, registra actividades por formulario o Excel y elige **Preparar PDF**. La planificación incluye introducción, base legal, metodología y referencias reutilizables. El contexto del período, las conclusiones y las recomendaciones se generan a partir de las actividades cargadas y se pueden editar en la vista previa.

La app dibuja el Gantt con las fechas completas, ofrece un flujo cuando existe un orden de etapas y ofrece un esquema cuando hay varias sedes. El campo opcional **Orden de la etapa** permite indicar la secuencia. Las actividades con fechas pendientes siguen en la tabla y se señalan en la revisión. Puedes seleccionar hasta dos figuras y editar sus pies. Al guardar el borrador se conserva una copia de los registros, los textos, la versión de la plantilla y la selección de figuras.

**Redactar con IA local** utiliza un modelo de texto instalado en Ollama. Abre Ollama en el equipo y, si tienes varios modelos, escribe su nombre en el campo opcional de la vista previa. El borrador automático, los gráficos y el PDF están disponibles directamente en la app. [Ollama para Windows](https://docs.ollama.com/windows)

## Identidad visual UTET

El icono propio de la app muestra **documento, sello y birrete** en azul marino y dorado; es distinto del logotipo institucional que se conserva en los PDF.

- `renderer/assets/utet-app-icon.png`: imagen transparente de 256 × 256 para la cabecera, Linux y favicon alternativo.
- `renderer/assets/utet-app-icon.ico`: icono Windows multirresolución (16, 32, 48, 64 y 256 px) para ventana, barra de tareas, instalador y accesos directos.
- `renderer/index.html`: favicon de la pestaña/ventana web y logo en la barra superior.
- `electron/main.js`: icono nativo de Electron y AppUserModelID para agrupar la app en la barra de tareas de Windows.
- `package.json`: configuración de electron-builder para generar instalador Windows y versión portable con el icono integrado.

Desarrollo:
```powershell
npm install
npm start
```

Paquete de Windows (instalador con acceso directo de escritorio y menú Inicio; también genera portable):
```powershell
npm run dist:win
```

El instalador final se genera en `dist/` en Windows; un proyecto abierto con `npm start` sigue lanzándose a través de Electron y **no crea por sí mismo un acceso directo**. Los accesos directos anteriores pueden conservar su icono hasta reinstalar o actualizar el acceso directo. No se cambian los datos de SQLite ni el proyecto Firebase por este ajuste visual.

## Actas de Titulación · PRO-93 Examen Complexivo (CX) y PRO-164 Trabajo de Titulación (TT)

Los documentos `acta-examen` (UTET-PRO-93) y `acta-trabajo` (UTET-PRO-164) comparten con `acta-articulo` la misma pantalla, el mismo motor de verificación y la misma plantilla de tres hojas carta descrita en la sección siguiente. Cada botón «Datos» del catálogo abre la pantalla con su modalidad; la configuración de textos, prefijos y controles vive en `renderer/acta-titulacion.modalidades.js`.

| Modalidad | Prefijo del número | Identidad en `actas_registro` | Controles además de 9 requisitos + 2 aprobaciones CUMPLE |
|---|---|---|---|
| Artículo Académico (PRO-57) | `AA-AAAA-CCCC-MM-NNNN` | `AA__<periodo>__<cedula>` | artículo ≥7/10, defensa ≥7/10, similitud real ≤20 % (memorando `articulo__…`), modalidad `ARTICULO_ACADEMICO` |
| Trabajo de Titulación (PRO-164) | `TT-AAAA-CCCC-MM-NNNN` | `TT__<periodo>__<cedula>` | trabajo escrito ≥7/10 (`notaEscrito`/`notaTrabajo`), defensa ≥7/10, similitud real <20 % (memorando de trabajo `<periodo>__<cedula>`), modalidad `TRABAJO_TITULACION` |
| Examen Complexivo (PRO-93) | `CX-AAAA-CCCC-MM-NNNN` | `CX__<periodo>__<cedula>` | solo modalidad `EXAMEN_COMPLEXIVO` acreditada; las calificaciones y oportunidades se administran en Ncomplex y no se consultan ni imprimen |

- **Formato CX:** reproduce las actas de Complexivo de referencia (`CX-2026-0106-05-0009`, etc.): portada, constancia con «Modalidad de titulación: Examen Complexivo», nueve requisitos, apartado 3 con la nota sobre Ncomplex, y tercera hoja con «4. Aprobaciones institucionales» y «5. Constancia documental». No existe sección de condiciones académicas.
- **Formato TT:** idéntico al AA, con «Aprobación del trabajo de titulación» y «5. Verificación de las condiciones académicas» para trabajo escrito, defensa, similitud y modalidad.
- **Matrícula:** el acta comprueba que la matrícula siga activa en Firebase antes de emitir.
- **Modalidad registrada:** se lee de `notas.modalidadTitulacion`, y en su defecto de `matriculas.modalidadTitulacion` o `requisitos.modalidadTitulacion`. Si ningún documento la registra, el acta queda bloqueada; nunca se asume por la carrera ni por el proceso desde el que se abrió la pantalla.
- **Numeración:** las tres modalidades comparten el contador mensual `actas_contadores/<AAAA-MM>` y el libro `actas_numeros`, en una sola transacción; cada una conserva identidad y prefijo propios, de modo que un mismo estudiante no puede recibir dos actas de la misma modalidad en un período.
- **Firmas:** la portada deja el espacio en blanco. No se reproducen los sellos «Firmado electrónicamente por…» que aparecen en los PDF de referencia porque esa firma debe aplicarse con el certificado legítimo de cada firmante.
- **SQLite:** nuevas tablas `actas_titulacion` y `actas_titulacion_evidencia` con clave (modalidad, período, cédula). Al abrir una base anterior, las filas de `actas_articulo*` se copian una vez a las tablas nuevas y las tablas antiguas se conservan sin cambios.
- **Descargas:** `ACTA_COMPLEX_<cedula>_<número>.pdf`, `ACTA_TT_<cedula>_<número>.pdf` y `ACTA_AA_<cedula>_<número>.pdf`; ZIP por modalidad (`Actas_Examen_Complexivo_UTET.zip`, `Actas_Trabajo_Titulacion_UTET.zip`, `Actas_Articulo_Academico_UTET.zip`).

## PRO-57 · Acta de Titulación por Artículo Académico (AA)

El documento `acta-articulo` del proceso UTET-PRO-57 tiene una pantalla propia:
**Gestión de artículo académico → Acta de Titulación por Artículo Académico → Datos**.

- **Formato:** tres páginas tamaño **carta**, basadas en las actas de Complexivo suministradas: portada, constancia de nueve requisitos, y aprobaciones/conclusión institucional. Incluye el logotipo ITSQMET, control documental, número individual AA, tres espacios de firmas (MSc. Jefferson Villarreal, Ing. Martha Tomalá, Dr. Alex León T.) y pie en las tres páginas.
- **Código individual:** `AA-AAAA-CCCC-MM-NNNN`, con las cuatro primeras cifras de la cédula en `CCCC`. Ejemplo de forma: `AA-2026-0105-05-0129`. `AT-ITSQMET-UTET-AAAA-MM` es el código **documental**, distinto del número de acta.
- **Fecha:** último día laborable del segundo mes después del cierre del período (octubre 2025–marzo 2026 → 29/05/2026). Se utilizan calendarios nacionales 2026/2027; en otros años el alta oficial queda bloqueada hasta verificar feriados. Pueden requerirse controles adicionales de feriados locales.
- **Contenido:** no imprime notas numéricas del artículo ni de la defensa. Muestra los nueve requisitos, la aprobación de titulación, la aprobación complexivo/proyecto aplicada al artículo y las condiciones documentales cumplidas.
- **Control de emisión:** el botón «Verificar» consulta solo los documentos `requisitos`, `notas`, `matriculas` y `UTET_antiplagio_memorandos` del estudiante seleccionado en Firebase. Requiere 9/9 requisitos CUMPLE, 2/2 aprobaciones CUMPLE, nota de artículo **≥7/10**, nota de defensa **≥7/10**, modalidad Artículo Académico y resultado **real** de similitud **≤20,00 %** (inclusive). La app no inventa ni completa datos ausentes; la emisión vuelve a verificar en el servidor.
- **Numeración única:** el alta se realiza por transacción en las colecciones institucionales `actas_registro`, `actas_contadores` y `actas_numeros`, con identidad `AA__<periodo>__<cedula>`. Comparte el contador mensual de las actas de otras modalidades, pero mantiene su identidad independiente. Sin permiso de escritura en Firebase, no puede emitir un número oficial.
- **SQLite local:** utiliza las tablas `actas_articulo` y `actas_articulo_evidencia` dentro de la base `utet-antiplagio.sqlite` ya existente; migración no destructiva. La lista de estudiantes es compartida por período y se mantiene local para no volver a leerla cada vez.
- **Descarga:** «Emitir» guarda el registro central y descarga directamente el PDF en Descargas. «PDF» reimprime un acta ya emitida sin generar número nuevo. «Recuperar» consulta **una única acta** por cédula desde Firebase, útil en otro equipo. El ZIP incluye únicamente las actas emitidas seleccionadas, nunca estudiantes pendientes.
- **Protección:** las fichas incompletas, los resultados sin origen real y las aprobaciones pendientes bloquean el acta; no se muestran como CUMPLE automáticamente. La fecha de registro corresponde al día de registro efectivo, que puede ser posterior a la fecha académica de emisión.

La conexión real a las colecciones de requisitos, notas y actas debe probarse con permisos institucionales habilitados. Las pruebas CI utilizan datos ficticios y verifican la impresión PDF con Electron.

## PRO-57 · Porcentaje de Plagio de Artículo Académico

El documento `plagio-articulo` del proceso **UTET-PRO-57** abre el mismo formulario compacto y genera exactamente el mismo memorando institucional de dos páginas (membrete, número, destinatario, firma, pie y anexo con tres tarjetas, gráficos y siete fuentes) que `plagio-trabajo` del PRO-164.

- En el memorando y la conclusión todas las referencias específicas al trabajo se sustituyen por **artículo académico**. Asunto: **RESULTADO DEL ANÁLISIS DE SIMILITUD DEL ARTÍCULO ACADÉMICO**.
- Se reutiliza la lista académica de Firebase/SQLite por período; al abrir Artículo por primera vez con el período ya descargado solo se recuperan sus memorandos, sin consultar nuevamente todas las matrículas.
- **Registros independientes:** en Firestore se utiliza la colección existente `UTET_antiplagio_memorandos` con documentos de artículo identificados por `articulo__<periodoId>__<cedula>`, y atributo `tipoDocumento: "articulo"`. Los documentos antiguos de Trabajo continúan usando `<periodoId>__<cedula>` y se interpretan como `tipoDocumento: "trabajo"`.
- En SQLite se añade automáticamente `memorandos_articulo` y `articulos_sync` sin borrar ni migrar destructivamente `memorandos` del PRO-164.
- **Consecutivo mensual compartido:** ambos tipos reservan folio en `UTET_antiplagio_correlativos` y referencia en `UTET_antiplagio_referencias`. No se reinicia la numeración al cambiar de proceso.
- Correcciones, recuperación de registros, PDF individual, carpeta Descargas y ZIP se comportan como en PRO-164; un tipo de documento no sobrescribe el registro del otro.
- Firebase requiere permisos institucionales reales de escritura. Nunca se crean números locales oficiales sin una transacción confirmada.

## PRO-164 · Memorandos individuales de similitud

Cada estudiante seleccionado recibe un memorando distinto; **ya no se emite un consolidado que mezcle estudiantes**.

- **SQLite es la fuente principal de Antiplagio.** Solo en la primera apertura de un período aún no descargado se consulta Firebase (`utet-4387a`: `matriculas` + `Estudiante`). Después, volver a abrir la aplicación, buscar y cambiar a períodos ya cargados utiliza la base local. El buscador funciona por nombre y cédula, con filtro de carrera.
- Los datos académicos que existan incluyen cédula, nombres, carrera, modalidad de estudios, sede y jornada. «Online» se elimina de la presentación de la carrera y se interpreta como modalidad «En línea» cuando Firebase no proporciona otra modalidad; nunca cambia el dato académico almacenado.
- El documento individual se dirige al estudiante, desde MSc. Jefferson Edgar Villarreal Enríquez (Coordinador de Titulación), con el asunto «Notificación del resultado de similitud del trabajo de titulación».
- Cada PDF tiene dos páginas. **La primera respeta la plantilla Word «Memorando No. MEM-ITSQMET-UXXX-20XX-0X-0X-XXX(5)»:** logotipo oficial, título centrado, campos PARA/DE/ASUNTO/FECHA con dos puntos, todo el texto de la primera hoja en negro, párrafos justificados, firma de la Coordinación y pie institucional. **Las tarjetas y gráficos solo aparecen desde la segunda página** como anexo individual. Se preserva la identificación de simulaciones, sin atribuirlas a análisis reales.
- Siete tipos de fuente: Google, sitios web, repositorios académicos, publicaciones, documentos, trabajos académicos y repositorio institucional ITSQMET.
- El resultado se clasifica conforme al criterio configurado para este proceso: **menor de 20 %** en rango; **20 % o superior** requiere corrección y una nueva presentación, sin plazo automático. Un índice de similitud no constituye por sí solo evidencia de plagio.
- La fecha determinista de presentación es el **día 15 del mes siguiente al cierre del período**, trasladada al lunes siguiente si coincide con sábado o domingo. No contempla otros feriados nacionales. La fecha de memorando y del reporte es la misma y permanece constante al corregir.
- Los registros nuevos empiezan con el porcentaje vacío. El PDF y el consecutivo requieren un porcentaje ingresado y origen «Dato real». Para descargar un memorando anterior con origen simulado se debe ingresar el resultado real y confirmar su origen.
- No existe casilla «Verificado», vista previa ni cuadro de confirmación final. La interfaz se mantiene compacta.
- «PDF individuales» guarda automáticamente los archivos en la carpeta Descargas de Windows sin abrir selectores. «Descargar ZIP» guarda un único ZIP directamente en Descargas. El botón «PDF» junto a un estudiante descarga únicamente ese memorando. Si el nombre existe, añade (1), (2), etc., sin sobrescribir.
- Los PDF se generan al descargar, **no se guardan en Firebase ni en SQLite**. Reimprimir un memorando sin cambios usa la copia local, no consulta ni escribe en Firebase.


## SQLite local-first: política de consultas

- **Primera carga de cada período:** si aún no está descargado, Electron consulta una vez las matrículas, fichas y memorandos; valida el lote completo y lo guarda en SQLite. Incluso un período con 0 alumnos se marca como sincronizado.
- **Aperturas siguientes:** la pantalla y sus filtros utilizan exclusivamente SQLite, sin lecturas automáticas en Firebase.
- **Actualizar Firebase:** es el único botón de sincronización **de lectura** del período; actualiza la copia académica local cuando el usuario lo solicita. Muestra la hora de la última sincronización y conserva los datos previos si falla la conexión.
- **Guardado de documentos:** las ediciones se conservan primero como borradores en SQLite. La emisión inicial o una modificación solicita a Firebase el folio institucional, o reemplaza el ya reservado. Esta **escritura al emitir** es distinta de actualizar la lista académica.
- **Reimpresión:** documentos con folio y sin modificaciones se reconstruyen íntegramente desde SQLite. Funcionan sin red; los documentos nuevos o con cambios pendientes requieren conexión y permiso para guardar antes de emitir.
- **Protección frente a fallos:** el reemplazo de listas se hace en una transacción de SQLite y se guarda en disco mediante archivo temporal y renombrado atómico; una falla o respuesta inválida no borra la copia válida. Las modificaciones locales pendientes no se sustituyen al actualizar el período.
- **Ubicación:** \`app.getPath('userData')/UTET/utet-antiplagio.sqlite\`, fuera del repositorio y de la carpeta D: donde se clonó el proyecto. No se almacena PDF en la base.
- **Tecnología:** \`sql.js\` utiliza SQLite WASM para evitar recompilar módulos nativos al actualizar Electron. Los accesos se serializan y el archivo se guarda con permisos de usuario; en equipos institucionales se recomienda activar cifrado de disco y control de acceso a la sesión de Windows.

Un nuevo equipo tendrá que sincronizar por primera vez sus períodos. Los datos localmente editados pendientes de sincronización se identifican como tales; no se asignan folios oficiales sin transacción en Firebase.

## Persistencia y numeración en Firebase

El módulo `electron/antiplagio-store.js` utiliza **colecciones nuevas e independientes**; no escribe en `matriculas` ni en `Estudiante`:

- `UTET_antiplagio_memorandos`: un registro vigente por combinación período + cédula. Guarda datos del estudiante, porcentaje, fuente, origen, fecha, folio y versión de plantilla.
- `UTET_antiplagio_correlativos`: consecutivo mensual de memorandos.
- `UTET_antiplagio_referencias`: consecutivo mensual independiente del identificador `UTET-ANT-AAAA-MM-NNNN`.

Los dos consecutivos se asignan en una **transacción de Firestore**, para evitar colisiones entre equipos, con formato `No. XX MEM-ITSQMET-UTET-AAAA-MM-DD`. La edición de un registro ya existente **sobrescribe sus datos actuales** sin cambiar folio, referencia ni fecha. Al volver a ingresar en el mismo período se recupera la copia SQLite existente y es posible descargarlos nuevamente sin utilizar Firestore si no tienen cambios.

**Seguridad y despliegue:** la configuración pública del SDK no concede autorización de escritura ni equivale a autenticación. Las operaciones solo funcionarán si las reglas de Firestore ya autorizan el acceso. No se han abierto ni alterado reglas: si Firestore deniega el guardado, la aplicación indica el error y no afirma que se guardó. **No es apropiado abrir escrituras públicas para habilitar la función.** Para producción con datos estudiantiles debe existir una política institucional de acceso protegido, aunque el flujo visible no incluya un formulario de usuario.

No se ha verificado desde el código que las reglas de Firebase institucional permitan escribir estas tres colecciones; hay que validar la operación real en un entorno autorizado antes de usarla con estudiantes.

## PRO-57 · Cronograma de Artículo Académico (Memorando)

La entrada **Gestión de artículo académico → Cronograma de Artículo Académico → Datos** abre un módulo propio. Permite cargar simultáneamente hasta 15 archivos Excel `.xlsx`, con varias hojas por archivo. Detecta las columnas **Actividad / Fecha inicio / Fecha fin** aunque la fila de títulos no sea la primera, convierte fechas Excel, reconoce el período y el grupo desde los encabezados y admite correcciones manuales de grupo, fechas, etapas y actividades. El importador identifica hojas de Complexivo/Trabajo de Titulación y las excluye del documento PRO-57; los duplicados por archivo, hoja y período se omiten. Los borradores se guardan en el almacenamiento local del perfil de la aplicación; los Excel originales no se modifican.

El memorando PDF es A4: primera página con membrete, campos PARA/DE/ASUNTO/FECHA, texto institucional y espacio de firma; anexos independientes por grupo con contexto, fechas límite, etapas y tabla de actividades. Se admiten varios anexos del **mismo período** en un único memorando. Puede requerir varias páginas por grupo cuando el cronograma es extenso; la vista previa no reserva un número.

**Folio solicitado:** `Memorando No. MEM-ITSQMET-UTET-AAAA-MM-NN`. `NN` es el consecutivo del **mes de emisión**, no el número del día ni el mes del período académico; crece a 3 dígitos si fuera necesario. La emisión requiere Firestore con permisos institucionales y reserva el correlativo en `UTET_antiplagio_correlativos/<AAAA-MM>` para compartir la secuencia con los memorandos de similitud gestionados en Firebase. El contenido original se conserva en `UTET_cronograma_memorandos/<id>`, y reimprimir el mismo ID conserva el folio y la versión emitida. Los memorandos históricos cuya numeración es **solo local** no están centralizados: deben conciliase con control documental antes del uso institucional. Si Firebase deniega la escritura, no se inventa una emisión oficial.

La aplicación **no envía mensajes automáticamente por Telegram ni publica en la web institucional**; esas actuaciones y sus evidencias deben registrarse fuera del módulo hasta implementar integraciones autorizadas.

## Inicio y comprobaciones

Requiere Node.js 20 o posterior.

```bash
npm install
npm start
```

```bash
npm run check
npm test
```

GitHub Actions ejecuta además pruebas de impresión real en Chromium/Electron, mediante Xvfb.

## Estructura relevante

- `electron/antiplagio-local.js`: SQLite por período, caché persistente, transacciones, borradores y reemplazos atómicos.
- `renderer/acta-titulacion.modalidades.js`: textos, prefijos y controles de las tres modalidades de Acta de Titulación (AA, TT, CX).
- `electron/acta-articulo.js`, `electron/acta-articulo-evidence.js`, `renderer/acta-articulo.model.js`, `renderer/acta-articulo.js`: motor, verificación, plantilla de tres hojas y pantalla compartida de las actas; reciben la modalidad como parámetro.
- `electron/firebase-read.js`: lectura académica Firebase únicamente durante la primera sincronización o actualización explícita.
- `electron/antiplagio-store.js`: documentos personales, reemplazos y dos contadores transaccionales.
- `electron/main.js`: operaciones IPC, impresión aislada en PDF, descarga directa de PDF y ZIP a Descargas.
- `electron/downloads.js`: guardado exclusivo de archivos con nombres únicos y sin sobrescritura.
- `electron/preload.js`: puente seguro desde la interfaz.
- `renderer/antiplagio.js`: lectura local, búsqueda sin red, actualización Firebase manual, selección, borradores y descargas.
- `renderer/antiplagio.model.js`: validación, fuentes, fechas, formato de memorando individual y gráficos.
- `renderer/antiplagio.css`: interfaz compacta y formato A4 de la plantilla institucional en primera hoja.
- `renderer/assets/memorando-pie-itsqmet.svg`: reproducción vectorial del pie institucional que figura en el Word de referencia; el logo con sello original proviene de `renderer/assets/logo-itsqmet.png`.
- `electron/memo-numbering.js`: numerador **local anterior**, conservado solo por compatibilidad del exportador histórico; el nuevo flujo individual utiliza el contador de Firebase.
- `renderer/records.js`, `renderer/records-ui.js`, `electron/excel.js`: formularios y Excel de los otros tipos documentales.

Los otros 19 tipos continúan en la fase de maquetación. Esta ampliación no convierte en documentos aprobados las plantillas institucionales que todavía no se han formalizado. Las firmas electrónicas no se generan automáticamente; la firma queda en blanco hasta su aplicación legítima.
