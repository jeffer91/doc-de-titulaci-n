# Doc de Titulación · UTET (Electron v0.6.0)

Aplicación de escritorio de la Unidad de Titulación y Eficiencia Terminal (ITSQMET). Mantiene 6 períodos, 11 requisitos, 9 procesos y 24 tipos documentales.

## PRO-164 · Memorandos individuales de similitud

Cada estudiante seleccionado recibe un memorando distinto; **ya no se emite un consolidado que mezcle estudiantes**.

- Se consulta automáticamente Firebase (proyecto `utet-4387a`) desde las colecciones académicas `matriculas` y `Estudiante` filtrando por período. El buscador funciona por nombre y cédula, con filtro de carrera.
- Los datos académicos que existan incluyen cédula, nombres, carrera, modalidad de estudios, sede y jornada. «Online» se elimina de la presentación de la carrera y se interpreta como modalidad «En línea» cuando Firebase no proporciona otra modalidad; nunca cambia el dato académico almacenado.
- El documento individual se dirige al estudiante, desde MSc. Jefferson Edgar Villarreal Enríquez (Coordinador de Titulación), con el asunto «Notificación del resultado de similitud del trabajo de titulación».
- Cada PDF tiene dos páginas: memorando con tres tarjetas (información académica; resultado; fuentes y referencia), conclusión y espacio de firma; segunda página con gráficos e indicadores de las fuentes.
- Siete tipos de fuente: Google, sitios web, repositorios académicos, publicaciones, documentos, trabajos académicos y repositorio institucional ITSQMET.
- El resultado se clasifica conforme al criterio configurado para este proceso: **menor de 20 %** en rango; **20 % o superior** requiere corrección y una nueva presentación, sin plazo automático. Un índice de similitud no constituye por sí solo evidencia de plagio.
- La fecha determinista de presentación es el **día 15 del mes siguiente al cierre del período**, trasladada al lunes siguiente si coincide con sábado o domingo. No contempla otros feriados nacionales. La fecha de memorando y del reporte es la misma y permanece constante al corregir.
- Los registros nuevos incluyen un ejemplo de maquetación con un porcentaje **simulado** entre 0 y 19,99 % y fuentes ilustrativas. El PDF indica visiblemente que son datos ilustrativos; **no se debe comunicar ni usar como evidencia de un análisis real**. El origen «Dato real» permite incorporar la medición efectiva y su evidencia conforme al procedimiento institucional.
- No existe casilla «Verificado», vista previa ni cuadro de confirmación final. La interfaz se mantiene compacta.
- «PDF individuales» guarda archivos por separado dentro de una carpeta elegida. «Descargar ZIP» crea un archivo comprimido con esos mismos documentos. El botón «PDF» junto a un estudiante descarga únicamente ese memorando.
- Los PDF se generan al descargar, **no se guardan en Firebase**.

## Persistencia y numeración en Firebase

El módulo `electron/antiplagio-store.js` utiliza **colecciones nuevas e independientes**; no escribe en `matriculas` ni en `Estudiante`:

- `UTET_antiplagio_memorandos`: un registro vigente por combinación período + cédula. Guarda datos del estudiante, porcentaje, fuente, origen, fecha, folio y versión de plantilla.
- `UTET_antiplagio_correlativos`: consecutivo mensual de memorandos.
- `UTET_antiplagio_referencias`: consecutivo mensual independiente del identificador `UTET-ANT-AAAA-MM-NNNN`.

Los dos consecutivos se asignan en una **transacción de Firestore**, para evitar colisiones entre equipos, con formato `No. XX MEM-ITSQMET-UTET-AAAA-MM-DD`. La edición de un registro ya existente **sobrescribe sus datos actuales** sin cambiar folio, referencia ni fecha. Al volver a ingresar en el mismo período se recuperan registros existentes y es posible descargarlos nuevamente.

**Seguridad y despliegue:** la configuración pública del SDK no concede autorización de escritura ni equivale a autenticación. Las operaciones solo funcionarán si las reglas de Firestore ya autorizan el acceso. No se han abierto ni alterado reglas: si Firestore deniega el guardado, la aplicación indica el error y no afirma que se guardó. **No es apropiado abrir escrituras públicas para habilitar la función.** Para producción con datos estudiantiles debe existir una política institucional de acceso protegido, aunque el flujo visible no incluya un formulario de usuario.

No se ha verificado desde el código que las reglas de Firebase institucional permitan escribir estas tres colecciones; hay que validar la operación real en un entorno autorizado antes de usarla con estudiantes.

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

- `electron/firebase-read.js`: lectura académica Firebase por período; se mantiene separada de las escrituras de memorandos.
- `electron/antiplagio-store.js`: documentos personales, reemplazos y dos contadores transaccionales.
- `electron/main.js`: operaciones IPC, impresión aislada en PDF, descarga por carpeta y ZIP.
- `electron/preload.js`: puente seguro desde la interfaz.
- `renderer/antiplagio.js`: selección, edición, consulta de memorandos anteriores y descargas.
- `renderer/antiplagio.model.js`: validación, fuentes, fechas, formato de memorando individual y gráficos.
- `renderer/antiplagio.css`: interfaz compacta y documento A4.
- `electron/memo-numbering.js`: numerador **local anterior**, conservado solo por compatibilidad del exportador histórico; el nuevo flujo individual utiliza el contador de Firebase.
- `renderer/records.js`, `renderer/records-ui.js`, `electron/excel.js`: formularios y Excel de los otros tipos documentales.

Los otros 23 tipos continúan en la fase de maquetación. Esta ampliación no convierte en documentos aprobados las plantillas institucionales que todavía no se han formalizado. Las firmas electrónicas no se generan automáticamente; la firma queda en blanco hasta su aplicación legítima.
