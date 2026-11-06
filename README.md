# Doc de Titulación · UTET (maqueta Electron v0.3.1)

Maqueta de escritorio para gestionar documentos de la **Unidad de Titulación y Eficiencia Terminal (ITSQMET)** por período académico, requisito y proceso. Conserva **6 períodos**, **11 requisitos**, **9 procesos** y **24 registros documentales aprobados** por el usuario.

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

## Cambios de la v0.3.1: interfaz más compacta

- Procesos numerados del **01 al 09**, mostrando también sus códigos oficiales (`UTET-PRO-56`, etc.).
- Menos altura en la barra superior, selector de período, indicadores y filas para mostrar más procesos sin desplazamiento.
- Los procesos aparecen plegados al abrir Inicio; al expandir uno se muestra su lista real de documentos.
- Se conserva el selector de período destacado y permanente.

## Cambios de la v0.3: diseño minimalista

- Menú horizontal permanente con Inicio, Procesos, Documentos, Requisitos y Configuración; se eliminó el menú lateral.
- Selector de período académico resaltado y fijo en la parte superior en todas las pantallas.
- Inicio con únicamente los indicadores **9 procesos** y **24 documentos**, más un listado desplegable de procesos y sus documentos reales.
- Cada documento se puede abrir en el editor existente mediante **Crear**.
- Se mantienen los borradores locales, filtros por requisito, vista previa y exportación de PDF de maqueta.
- Firebase continúa desconectado y no se escriben datos académicos.

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

La app no conecta aún a Firebase, no ejecuta escrituras y no incorpora registros personales del respaldo. Sus métricas son **resúmenes agregados** suministrados previamente, no lecturas en tiempo real. Borradores y revisiones simuladas permanecen en `localStorage` del equipo.

**DOCX y XLSX** no se exportan todavía: se añadirán tras integrar las plantillas oficiales de cada registro. El `npm install` no pudo concluir en el entorno de pruebas de esta sesión; sí se verificó la sintaxis de los archivos y el motor mediante pruebas de Node.js.

## Estructura

- `electron/main.js`: ventana Electron y exportación aislada de PDF.
- `electron/preload.js`: puente IPC restringido.
- `renderer/index.html`, `renderer/styles.css`, `renderer/app.js`: navegación y formularios de la maqueta.
- `renderer/institutional.js`, `renderer/institutional.css`: motor de formatos, reglas de portada, vista previa y validaciones.
- `renderer/assets/logo-itsqmet.png`: imagen institucional tomada de las plantillas proporcionadas.
- `renderer/data.js`: catálogo y estadísticas agregadas anonimizadas.
- `tests/institutional.test.cjs`: pruebas del catálogo, tipologías, firmas y asistencia.

## Próxima etapa

Incorporar, uno por uno, los documentos reales previamente aprobados para completar su cuerpo, tablas, distribución, numeración y automatización desde Firebase, respetando las reglas de seguridad y el control documental de ITSQMET.
