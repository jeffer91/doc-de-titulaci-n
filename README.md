# Doc de Titulación — Maqueta UTET

Maqueta **navegable** de una aplicación de escritorio Electron para la Unidad de Titulación y Eficiencia Terminal (ITSQMET), organizada por **período académico**, **requisitos** y **procesos/documentos**.

## Arrancar

Se requiere Node.js 20 o superior y conexión a Internet la primera vez para instalar Electron.

```bash
npm install
npm start
```

Para revisar sintaxis de los archivos JavaScript:

```bash
npm run check
```

## Contenido de la maqueta

- Seis períodos del respaldo proporcionado el 6 de noviembre de 2026, con **indicadores agregados sin información personal**.
- Once campos de requisitos, con filtros, porcentajes, estado de cumplimiento y sus documentos relacionados.
- Nueve procesos y exactamente **24 registros documentales** aprobados por la UTET, con sus códigos.
- Listado documental y filtro por proceso, requisito, estado y período.
- Editor demostrativo de documentos con vista previa, campos manuales, borradores y simulación de estados.
- PDF real de la vista previa desde Electron (impresión local).
- Historial de acciones de demostración, guardado en el almacenamiento local de la aplicación.

## Alcance y límites de esta versión

**MAQUETA / DATOS DE PRUEBA.** No se conecta a Firebase y **no modifica** ningún dato institucional. Los indicadores corresponden a un resumen estadístico local del respaldo, no a una lectura en tiempo real. Los nombres de ejemplo (si se muestran) no corresponden a personas reales. Los borradores y las aprobaciones simuladas se guardan solo en el equipo mediante `localStorage` y no constituyen actos oficiales.

Las plantillas aún son provisionales: el usuario entregará las versiones institucionales para configurar contenido, requisitos, firmas, formatos y automatización. La generación de DOCX y la autenticación/sincronización Firestore quedan para una etapa posterior.

No se incluyen datos personales ni credenciales administrativas en este repositorio público.

## Estructura

- `electron/main.js`: proceso principal y exportación a PDF.
- `electron/preload.js`: API restringida expuesta a la interfaz.
- `renderer/index.html`: estructura del escritorio.
- `renderer/styles.css`: diseño adaptable e impresión.
- `renderer/data.js`: catálogo y estadísticas agregadas anonimizadas.
- `renderer/app.js`: navegación, formularios, filtros y guardado local.

## Datos Firebase que servirán más adelante

Proyecto `utet-4387a`; colecciones observadas en el respaldo: `Estudiante`, `carreras`, `historial`, `importaciones`, `matriculas`, `periodos` y `requisitos`. Cada matrícula y sus requisitos se relacionan por `cedula + periodoId`. Algunos campos pueden faltar: no se deben inventar notas, modalidades ni aprobaciones.

**No modificar en producción** `Estudiante`, `matriculas`, `requisitos` o colecciones de otras aplicaciones sin una especificación y reglas de acceso aprobadas.
