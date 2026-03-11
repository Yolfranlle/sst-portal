/* ═══════════════════════════════════════════════════════════════
   PORTAL SST — GOOGLE APPS SCRIPT BACKEND
   
   CONFIGURACIÓN:
   1. Abre script.google.com y crea un proyecto nuevo
   2. Pega todo este código
   3. Rellena SPREADSHEET_ID y CARPETA_DRIVE_ID (ver instrucciones abajo)
   4. Guarda y despliega: Implementar → Nueva implementación
      - Tipo: Aplicación web
      - Ejecutar como: Yo
      - Acceso: Cualquier persona
   5. Copia la URL y pégala en js/config.js → SCRIPT_URL

   CÓMO OBTENER LOS IDs:
   - Sheets ID: abre tu hoja de cálculo y copia el ID de la URL
     https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
   - Drive ID: abre la carpeta en Drive y copia el ID de la URL
     https://drive.google.com/drive/folders/[ESTE_ES_EL_ID]

   Si dejas los IDs vacíos "", la función inicializarSistema() los crea
   automáticamente y los imprime en los logs (Ver → Registros de ejecución).
═══════════════════════════════════════════════════════════════ */

var SPREADSHEET_ID   = "";   // ← pega el ID de tu Google Sheets aquí
var CARPETA_DRIVE_ID = "";   // ← pega el ID de tu carpeta de Drive aquí
var NOMBRE_HOJA      = "Registros";

// Columnas de la hoja (en orden)
var COLUMNAS = [
  "Timestamp", "Proveedor", "Nombre", "Documento", "Empresa",
  "Área", "Requisito", "Nombre Archivo", "URL Documento",
  "Fecha Carga", "Estado", "Comentarios", "Fila"
];

/* ──────────────────────────────────────────────
   CORS HEADERS
────────────────────────────────────────────── */
function setCorsHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader("Access-Control-Allow-Origin", "*")
    .addHeader("Access-Control-Allow-Methods", "GET, POST")
    .addHeader("Access-Control-Allow-Headers", "Content-Type");
}

function responder(obj) {
  return setCorsHeaders(
    ContentService.createTextOutput(JSON.stringify(obj))
  );
}

/* ──────────────────────────────────────────────
   doGet — LEER REGISTROS
────────────────────────────────────────────── */
function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : "";

    if (action === "obtenerRegistros" || action === "") {
      return responder(obtenerRegistros());
    }

    return responder({ success: false, error: "Acción no reconocida: " + action });

  } catch(err) {
    Logger.log("doGet error: " + err.message);
    return responder({ success: false, error: err.message });
  }
}

/* ──────────────────────────────────────────────
   doPost — GUARDAR / ACTUALIZAR
────────────────────────────────────────────── */
function doPost(e) {
  try {
    var datos = parsearDatos(e);
    Logger.log("doPost datos: " + JSON.stringify(datos).substring(0, 500));

    if (!datos) {
      return responder({ success: false, error: "No se recibieron datos" });
    }

    var action = datos.action || "";

    if (action === "guardarDocumento") {
      return responder(guardarDocumento(datos));
    }

    if (action === "actualizarEstado") {
      return responder(actualizarEstado(datos));
    }

    return responder({ success: false, error: "Acción no reconocida: " + action });

  } catch(err) {
    Logger.log("doPost error: " + err.message + "\n" + err.stack);
    return responder({ success: false, éxito: false, error: err.message });
  }
}

/* ──────────────────────────────────────────────
   PARSEAR DATOS DEL REQUEST
   Acepta: campo "data" (JSON string) o params individuales
────────────────────────────────────────────── */
function parsearDatos(e) {
  // 1) Campo "data" enviado desde el formulario iframe
  if (e.parameter && e.parameter.data) {
    try {
      return JSON.parse(e.parameter.data);
    } catch(ex) {
      Logger.log("No se pudo parsear e.parameter.data: " + ex.message);
    }
  }

  // 2) Body JSON directo (fetch normal)
  if (e.postData && e.postData.contents) {
    try {
      var m = e.postData.contents.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch(ex) {
      Logger.log("No se pudo parsear postData: " + ex.message);
    }
  }

  // 3) Parámetros individuales como fallback
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    return e.parameter;
  }

  return null;
}

/* ──────────────────────────────────────────────
   OBTENER REGISTROS
────────────────────────────────────────────── */
function obtenerRegistros() {
  var hoja = getHoja();
  var datos = hoja.getDataRange().getValues();

  if (datos.length <= 1) {
    return { success: true, registros: [] };
  }

  var cabeceras = datos[0];
  var registros = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var obj  = {};
    for (var j = 0; j < cabeceras.length; j++) {
      var val = fila[j];
      if (val instanceof Date) {
        obj[cabeceras[j]] = val.toISOString();
      } else {
        obj[cabeceras[j]] = val !== undefined ? val : "";
      }
    }
    obj["_fila"] = i + 1; // número real de fila en Sheets
    registros.push(obj);
  }

  return { success: true, registros: registros };
}

/* ──────────────────────────────────────────────
   GUARDAR DOCUMENTO
────────────────────────────────────────────── */
function guardarDocumento(datos) {
  var hoja    = getHoja();
  var carpeta = getCarpeta();

  // Resolver campos (acepta distintos nombres de campo)
  var proveedor   = datos.nombreProveedor || datos.Proveedor || datos.proveedor || "";
  var nombre      = datos.Nombre          || datos.nombre      || datos.responsable || "";
  var documento   = datos.Documento       || datos.documento   || "";
  var empresa     = datos.Empresa         || datos.empresa     || "";
  var area        = datos.Área            || datos.area        || datos.Area || "";
  var requisito   = datos.Requisito       || datos.requisito   || "";
  var nombreArch  = datos.NombreArchivo   || datos.nombreArchivo || datos["Nombre Archivo"] || "";
  var base64      = datos.ArchivoBase64   || datos.archivoBase64 || "";
  var fechaCarga  = datos.FechaCarga      || new Date().toISOString();

  // Validaciones mínimas
  if (!proveedor) throw new Error("Falta: nombreProveedor");
  if (!area)      throw new Error("Falta: area");

  // Subir archivo a Drive si viene base64
  var urlDoc = "";
  if (base64 && nombreArch) {
    try {
      var blob    = Utilities.newBlob(Utilities.base64Decode(base64), "application/octet-stream", nombreArch);
      var carpetaProv = obtenerOCrearSubcarpeta(carpeta, proveedor + "_" + area);
      var archivo = carpetaProv.createFile(blob);
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urlDoc = archivo.getUrl();
    } catch(err) {
      Logger.log("Error subiendo archivo: " + err.message);
      urlDoc = "Error al subir: " + err.message;
    }
  }

  // Si viene lista de documentos (formato antiguo), guardar uno por uno
  if (datos.documentos && Array.isArray(datos.documentos)) {
    var resultados = [];
    datos.documentos.forEach(function(doc) {
      var fila = construirFila(proveedor, nombre, documento, empresa, area,
        doc.requisito || requisito, doc.nombreArchivo || nombreArch, urlDoc, fechaCarga);
      hoja.appendRow(fila);
      resultados.push({ requisito: doc.requisito, ok: true });
    });
    return { success: true, éxito: true, guardados: resultados.length };
  }

  // Guardar una fila simple
  var fila = construirFila(proveedor, nombre, documento, empresa, area,
    requisito, nombreArch, urlDoc, fechaCarga);
  hoja.appendRow(fila);

  return { success: true, éxito: true, mensaje: "Documento guardado correctamente" };
}

function construirFila(prov, nombre, doc, empresa, area, req, nombreArch, url, fecha) {
  var totalFilas = getHoja().getLastRow();
  return [
    new Date(),   // Timestamp
    prov,         // Proveedor
    nombre,       // Nombre
    doc,          // Documento
    empresa,      // Empresa
    area,         // Área
    req,          // Requisito
    nombreArch,   // Nombre Archivo
    url,          // URL Documento
    fecha,        // Fecha Carga
    "Pendiente",  // Estado
    "",           // Comentarios
    totalFilas + 1 // Fila (para actualizar después)
  ];
}

/* ──────────────────────────────────────────────
   ACTUALIZAR ESTADO
────────────────────────────────────────────── */
function actualizarEstado(datos) {
  var hoja = getHoja();
  var rows = hoja.getDataRange().getValues();
  var cabs = rows[0];

  var colEstado      = cabs.indexOf("Estado");
  var colComentarios = cabs.indexOf("Comentarios");
  var colProveedor   = cabs.indexOf("Proveedor");
  var colRequisito   = cabs.indexOf("Requisito");
  var colArea        = cabs.indexOf("Área");
  var colDoc         = cabs.indexOf("Documento");
  var colFila        = cabs.indexOf("Fila");

  if (colEstado < 0) throw new Error("Columna 'Estado' no encontrada");

  var proveedor  = datos.Proveedor   || datos.proveedor  || "";
  var requisito  = datos.Requisito   || datos.requisito  || "";
  var area       = datos.Área        || datos.area        || "";
  var documento  = datos.Documento   || datos.documento  || "";
  var nuevoEst   = datos.Estado      || datos.estado      || "Pendiente";
  var comentarios= datos.Comentarios || datos.comentarios || "";
  var filaRef    = parseInt(datos.Fila || datos.fila || "0");

  var actualizados = 0;

  for (var i = 1; i < rows.length; i++) {
    var fila = rows[i];
    var coincide = false;

    // Intentar por número de fila primero
    if (filaRef > 0 && colFila >= 0 && parseInt(fila[colFila]) === filaRef) {
      coincide = true;
    }
    // Luego por combinación de campos
    else if (
      (!proveedor  || String(fila[colProveedor]).trim()  === proveedor.trim())  &&
      (!requisito  || String(fila[colRequisito]).trim()  === requisito.trim())  &&
      (!area       || String(fila[colArea]).trim()       === area.trim())       &&
      (!documento  || String(fila[colDoc]).trim()        === documento.trim())
    ) {
      coincide = true;
    }

    if (coincide) {
      hoja.getRange(i + 1, colEstado + 1).setValue(nuevoEst);
      if (colComentarios >= 0) {
        hoja.getRange(i + 1, colComentarios + 1).setValue(comentarios);
      }
      actualizados++;
      Logger.log("Fila " + (i + 1) + " actualizada → " + nuevoEst);
    }
  }

  if (actualizados === 0) {
    return { success: false, error: "No se encontró el registro para actualizar" };
  }

  return { success: true, éxito: true, actualizados: actualizados };
}

/* ──────────────────────────────────────────────
   HELPERS: HOJA Y CARPETA
────────────────────────────────────────────── */
function getHoja() {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("No hay Spreadsheet. Configura SPREADSHEET_ID.");
  }

  var hoja = ss.getSheetByName(NOMBRE_HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
    Logger.log("Hoja creada: " + NOMBRE_HOJA);
  }
  return hoja;
}

function getCarpeta() {
  if (CARPETA_DRIVE_ID) {
    return DriveApp.getFolderById(CARPETA_DRIVE_ID);
  }
  // Crear carpeta si no hay ID
  var carpetas = DriveApp.getFoldersByName("SST_Documentos_Proveedores");
  if (carpetas.hasNext()) return carpetas.next();
  var nueva = DriveApp.createFolder("SST_Documentos_Proveedores");
  Logger.log("Carpeta Drive creada. ID: " + nueva.getId());
  return nueva;
}

function obtenerOCrearSubcarpeta(padre, nombre) {
  var subs = padre.getFoldersByName(nombre);
  if (subs.hasNext()) return subs.next();
  return padre.createFolder(nombre);
}

/* ──────────────────────────────────────────────
   INICIALIZAR SISTEMA (ejecutar UNA vez a mano)
────────────────────────────────────────────── */
function inicializarSistema() {
  Logger.log("=== INICIALIZANDO SISTEMA SST ===");

  try {
    var hoja = getHoja();
    Logger.log("✅ Hoja OK: " + hoja.getName());
    Logger.log("   → Spreadsheet ID: " + hoja.getParent().getId());
  } catch(e) {
    Logger.log("❌ Error hoja: " + e.message);
  }

  try {
    var carpeta = getCarpeta();
    Logger.log("✅ Carpeta Drive OK: " + carpeta.getName());
    Logger.log("   → Carpeta ID: " + carpeta.getId());
  } catch(e) {
    Logger.log("❌ Error carpeta: " + e.message);
  }

  Logger.log("=== FIN. Copia los IDs de arriba en las variables SPREADSHEET_ID y CARPETA_DRIVE_ID ===");
}

/* ──────────────────────────────────────────────
   PROBAR SISTEMA (ejecutar para verificar)
────────────────────────────────────────────── */
function probarSistema() {
  Logger.log("=== PRUEBA DEL SISTEMA ===");

  // Prueba escritura
  var resultGuardar = guardarDocumento({
    action:       "guardarDocumento",
    Proveedor:    "PRUEBA_SISTEMA",
    Nombre:       "Test Automático",
    Documento:    "00000000",
    Empresa:      "Sistema SST",
    Área:         "Pruebas",
    Requisito:    "Documento de prueba",
    NombreArchivo: "prueba.txt",
    ArchivoBase64: "",
    FechaCarga:   new Date().toISOString()
  });
  Logger.log("Guardar: " + JSON.stringify(resultGuardar));

  // Prueba lectura
  var resultLeer = obtenerRegistros();
  Logger.log("Registros totales: " + (resultLeer.registros || []).length);

  // Prueba actualización
  var resultActualizar = actualizarEstado({
    action:      "actualizarEstado",
    Proveedor:   "PRUEBA_SISTEMA",
    Requisito:   "Documento de prueba",
    Área:        "Pruebas",
    Estado:      "Aprobado",
    Comentarios: "Prueba exitosa"
  });
  Logger.log("Actualizar: " + JSON.stringify(resultActualizar));

  Logger.log("=== PRUEBA TERMINADA ===");
}
