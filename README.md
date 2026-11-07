# Doc de Titulación · UTET (Electron v0.5.0 · PRO-164 integrado)

Maqueta de escritorio para gestionar documentos de la **Unidad de Titulación y Eficiencia Terminal (ITSQMET)** por período académico, requisito y proceso. Conserva **6 períodos**, **11 requisitos**, **9 procesos** y **24 registros documentales aprobados** por el usuario.

## PRO-164: Memorando de Porcentaje de Antiplagio

El documento **Porcentaje de Plagio** del proceso **PRO-164** dispone ahora de un flujo propio (independiente del editor genérico):
1. Seleccionar uno de los seis períodos en la barra superior.
2. Abrir **Procesos → PRO-164 → Porcentaje de Plagio → Datos**.
3. Pulsar **Consultar estudiantes**. La app lee el proyecto Firebase `utet-4387a` en modo **solo lectura**, filtrando matrículas por período y cruzándolas con documentos `Estudiante`. Si las reglas de Firestore requieren sesión, iniciar sesión en el panel; la contraseña y el token solo permanecen en memoria del proceso.
4. Buscar por nombre, apellido o cédula; añadir estudiantes individualmente o en bloque. Al volver a consultar se descarta la edición de esa sesión.
5. Registrar porcentaje real (0–100), fecha de reporte, referencia si está disponible, herramienta según la evidencia y confirmar cada valor. Configurar fuentes únicamente cuando su presencia/ausencia esté respaldada; **sin información** no equivale a «no detectada».
6. Introducir destinatario, cargo, código institucional definitivo y fechas, revisar la vista previa A4 y exportar **un único PDF**.

**Regla de emisión:** los porcentajes mayores de **19 %** se conservan sin alteración ni ocultamiento, pero bloquean la exportación mientras estén seleccionados. También bloquean la emisión los registros ausentes, sin fecha, sin confirmación o con identificación insuficiente. El 0 % válido no se trata como dato faltante. El memorando ocupa la primera página; las tablas comienzan en la segunda y los gráficos se basan exclusivamente en resultados reales.

**Protección de datos:** esta nueva pantalla mantiene estudiantes, porcentajes y evidencia **solo en memoria**, sin guardarlos en `localStorage` ni escribirlos en Firebase. Los otros 23 documentos y sus tablas Excel siguen intactos. Cerrar la app o consultar de nuevo pierde el trabajo aún no emitido. La identidad y el acceso de lectura dependen de las reglas **realmente desplegadas** en Firebase, que deben verificarse en el entorno institucional; que la configuración exista en GitHub no concede permisos ni garantiza que el servidor sea accesible. Se recomienda activar autenticación y controles institucionales antes de tratar datos personales en producción. El PDF se genera sin firma y requiere firma legítima.

## Numeración mensual de memorandos UTET

La salida de antiplagio utiliza la nomenclatura **`No. XX MEM-ITSQMET-UTET-AAAA-MM-DD`**, por ejemplo **`No. 01 MEM-ITSQMET-UTET-2026-11-07`**. `XX` es el consecutivo mensual con un mínimo de dos cifras (`01`, `02`, ... `99`, `100`). `UTET` sustituye a `UEAI` y la fecha proviene de la **fecha de emisión del memorando**, no del período académico.

- Al entrar, la app consulta el siguiente número y lo muestra como **provisional y no editable**.
- Consultar, cambiar de período o cancelar la ventana de guardar **no reserva un número**.
- Al confirmar la exportación, Electron reserva y persiste el siguiente número en el registro de ese mes, lo inserta en el PDF y conserva el número reservado aunque falle posteriormente la impresión para evitar reuso accidental.
- La numeración se reinicia a `01` el primer día de cada mes nuevo; meses anteriores mantienen su secuencia.
- El registro reside en `app.getPath('userData')/utet-memorandos-numeracion.json` (fuera del repositorio); no almacena estudiantes ni resultados. Una base dañada bloquea la emisión en lugar de volver automáticamente a `01`.
- **Límite actual:** el contador es **local al equipo**, no institucional multiusuario. Si ya se emitieron memorandos en otro sistema o equipo, puede existir una colisión. Antes de declarar el correlativo oficial de toda UTET hace falta conciliar el histórico e implantar un contador central transaccional con autenticación y reglas vigentes en Firebase. No se han modificado las reglas de producción.

## Arranque local

Necesita Node.js 20 o superior y acceso a Internet al instalar Electron por primera vez.

```bash
npm install
npm start
```

Pruebas automáticas de catálogo, familias y portadas:

```bash
npm run check
npm test
```

## Cambios de la v0.4: formularios, Excel y tablas para los 24 documentos

- Cada documento abre su propia **tabla por período académico** desde Inicio o el catálogo.
- **Formulario** para agregar o editar filas individuales; la tabla permanece visible y admite búsqueda y eliminación.
- **Descargar plantilla Excel (.xlsx)**: columnas propias del documento, hojas de datos e instrucciones, formatos de texto y listas de opciones cuando corresponda.
- **Cargar Excel (.xlsx)**: comprobación de encabezados y tipos, vista previa de filas nuevas, duplicadas o erróneas; confirmar con opción de omitir o actualizar duplicados.
- El formulario y Excel comparten **el mismo almacenamiento local**, no generan bases separadas.
- Desde una fila se puede **preparar un documento de maqueta** en el editor existente, o preparar un consolidado con los registros de la tabla.
- Se mantiene el carácter provisional del contenido documental: no se asignan folios ni firmas ni actas oficiales; Firebase desconectado para los otros documentos; lectura bajo demanda únicamente en PRO-164.
- Los datos cargados localmente, especialmente nombres y cédulas, **no deben utilizarse en equipos compartidos** hasta contar con almacenamiento y permisos institucionales apropiados.

## Cambios de la v0.3.1: interfaz más compacta

- Procesos numerados del **01 al 09**, mostrando también sus códigos oficiales (`UTET-PRO-56`, etc.).
- Menos altura en la barra superior, selector de período, indicadores y filas para mostrar más procesos sin desplazamiento.
- Los procesos aparecen plegados al abrir Inicio; al expandir uno se muestra su lista real de documentos.
- Se conserva el selector de período destacado y permanente.

## Cambios de la v0.3: diseño minimalista

- Menú horizontal permanente con Inicio, Procesos, Documentos, Requisitos y Configuración; se eliminó el menú lateral.
- Selector de período académico resaltado y fijo en la parte superior en todas las pantallas.
- Inicio con únicamente los indicadores **9 procesos** y **24 documentos**, más un listado desplegable de procesos y sus documentos reales.
- Cada documento ahora abre su tabla editable mediante **Datos / Abrir tabla**.
- Se mantienen los borradores locales, filtros por requisito, vista previa y exportación de PDF de maqueta.
- Solo PRO-164 puede consultar estudiantes desde Firebase. Ningún módulo escribe datos académicos en Firebase.

## Formatos institucionales incorporados en v0.2

- Portadas **RGI / INF / ACT** conforme a la *Guía de estandarización de portadas institucionales ITSQMET v1.1* (octubre de 2026): **A4**, márgenes de **1,5 cm**, tablas de **18 cm** y anchos específicos para cada familia; tipografía Arial, encabezados con celdas combinadas, bloque de firmas de tres columnas **solo en la primera hoja**.
- Encabezados **RGI**: tres columnas (4,5 / 9 / 4,5 cm), dos filas. **INF**: 4,8 / 9,5 / 3,7 cm, tres filas. **ACT**: 5,2 / 7,6 / 5,2 cm, tres filas.
- Firmantes por defecto **solo para RGI e INF**: Mgs. Jefferson Villarreal (UTET), Ing. Martha Tomalá y Dr. Alex León; datos configurables por documento. ACT deja firmantes variables.
- Correspondencia **OFI / MEM / COM** con campos editables tomados de las muestras institucionales. El certificado CERT aportado como referencia **no se añade al catálogo** de 24 registros.
- Registro de **asistencia a inducción** con tema, fecha, capacitador, jefe inmediato y tabla de asistentes verificados en páginas con numeración continua.
- Distinción explícita entre la **portada ACT de reunión** y el cuerpo, todavía pendiente, del acta de seguimiento UTET-PRO-58. Las **actas de titulación AT** y el **Plan de Estudios del Núcleo Complexivo** siguen con aviso de formato específico pendiente.
- Validación visible de campos y de códigos que contengan marcadores `0X`, `20XX`, `AÑO`, `MES`, etc. Los códigos de referencia del manual no se convierten automáticamente en folios definitivos.
- Exportación de **PDF de maqueta** desde una ventana aislada de Electron que imprime únicamente el documento (no la navegación), con sello visible **«MAQUETA · DOCUMENTO NO APROBADO»**.

## Limitaciones intencionales

**Esta versión es una maqueta.** Los campos de cada documento real se completarán conforme a las plantillas que suministre la unidad. La paginación de contenido se efectúa por bloques para la vista previa; todavía falta validación visual de los formatos definitivos, especialmente con tablas extensas. Los PDF tienen valor de muestra, **no son actas ni aprobaciones oficiales**. Las firmas son espacios sin imágenes ni certificados electrónicos.

La app solo consulta Firebase para PRO-164 bajo demanda; no ejecuta escrituras y no incorpora registros personales del respaldo de demostración. Sus métricas son **resúmenes agregados** suministrados previamente, no lecturas en tiempo real. Borradores y revisiones simuladas permanecen en `localStorage` del equipo.

**Plantillas XLSX**: ya se pueden descargar y cargar. La exportación de documentos terminados en DOCX, la exportación de registros a Excel y el contenido oficial de cada documento siguen pendientes de implementar. El `npm install` no pudo concluir en el entorno de pruebas de esta sesión; sí se verificó la sintaxis de los archivos y el motor mediante pruebas de Node.js.

## Estructura

- `electron/main.js`: ventana Electron y exportación aislada de PDF.
- `electron/firebase-read.js`: lector Firebase de matrículas y estudiantes, solo lectura; sesión opcional en memoria.
- `electron/memo-numbering.js`: contador local de memorandos UTET, secuencial por mes de emisión y persistente.
- `renderer/antiplagio.js`, `renderer/antiplagio.model.js`, `renderer/antiplagio.css`: selección, validación y PDF específico PRO-164.
- `electron/preload.js`: puente IPC restringido.
- `electron/excel.js`: descarga y lectura de plantillas XLSX con ExcelJS.
- `renderer/records.js`: campos específicos, validación y preparación de borradores para los 24 tipos.
- `renderer/records-ui.js`, `renderer/records.css`: formularios, tabla editable e importación confirmada.
- `renderer/index.html`, `renderer/styles.css`, `renderer/app.js`: navegación y formularios de la maqueta.
- `renderer/institutional.js`, `renderer/institutional.css`: motor de formatos, reglas de portada, vista previa y validaciones.
- `renderer/assets/logo-itsqmet.png`: imagen institucional tomada de las plantillas proporcionadas.
- `renderer/data.js`: catálogo y estadísticas agregadas anonimizadas.
- `tests/institutional.test.cjs`, `tests/records.test.cjs` y `tests/ui.test.cjs`: pruebas del catálogo, tipologías, formularios y navegación.

## Próxima etapa

Incorporar, uno por uno, los documentos reales previamente aprobados para completar su cuerpo, tablas, distribución, numeración y automatización desde Firebase, respetando las reglas de seguridad y el control documental de ITSQMET.
