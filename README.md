# Doc de Titulación · UTET (Electron v0.8.0)

Aplicación de escritorio de la Unidad de Titulación y Eficiencia Terminal (ITSQMET). Mantiene 6 períodos, 11 requisitos, 9 procesos y 24 tipos documentales.

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
- Los registros nuevos ofrecen porcentajes y fuentes simulados para revisar el formato. Ese origen se conserva únicamente en los metadatos de la app; el PDF aprobado como plantilla no incluye marcas de agua ni leyendas de simulación. Antes de emitir documentos institucionales reales deben utilizarse porcentajes y fuentes procedentes de un análisis efectivo.
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

Los otros 23 tipos continúan en la fase de maquetación. Esta ampliación no convierte en documentos aprobados las plantillas institucionales que todavía no se han formalizado. Las firmas electrónicas no se generan automáticamente; la firma queda en blanco hasta su aplicación legítima.
