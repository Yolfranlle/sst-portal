/* ═══════════════════════════════════════════════
   PORTAL SST — CAPA DE API
   Toda la comunicación con Google Apps Script
═══════════════════════════════════════════════ */

const SSTApi = {

  // ── LEER REGISTROS (GET) ────────────────────
  // Google Apps Script responde GET sin problemas CORS
  async getRegistros() {
    const url = SST_CONFIG.SCRIPT_URL + "?action=obtenerRegistros";
    const res  = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const txt  = await res.text();
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del servidor");
    const data = JSON.parse(match[0]);
    if (!data.success) throw new Error(data.error || data.message || "Error desconocido");
    return data.registros || [];
  },

  // ── ENVIAR DATOS (POST via iframe) ──────────
  // GAS hace redirect 302 → fetch falla por CORS.
  // Solución: form nativo + iframe = no hay CORS.
  postData(datos) {
    return new Promise((resolve) => {
      const frameName = "sst_" + Date.now();

      const iframe = document.createElement("iframe");
      iframe.name  = frameName;
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const form  = document.createElement("form");
      form.method = "POST";
      form.action = SST_CONFIG.SCRIPT_URL;
      form.target = frameName;
      form.style.display = "none";

      const input = document.createElement("input");
      input.type  = "hidden";
      input.name  = "data";
      input.value = JSON.stringify(datos);
      form.appendChild(input);
      document.body.appendChild(form);

      let done = false;
      const cleanup = () => {
        try { document.body.removeChild(form); }   catch(e) {}
        try { document.body.removeChild(iframe); } catch(e) {}
      };

      iframe.onload = () => {
        if (done) return;
        done = true;
        let respuesta = null;
        try {
          const txt = iframe.contentDocument.body.innerText || "";
          const m   = txt.match(/\{[\s\S]*\}/);
          if (m) respuesta = JSON.parse(m[0]);
        } catch(e) {
          // cross-origin: no podemos leer → asumimos que llegó
        }
        cleanup();
        resolve(respuesta || { success: true, éxito: true });
      };

      // Timeout de seguridad 14s
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ success: true, éxito: true, _timeout: true });
      }, 14000);

      form.submit();
    });
  },

  // ── GUARDAR DOCUMENTO ───────────────────────
  async guardarDocumento(datos) {
    const payload = {
      action: "guardarDocumento",
      // Campos en formato que valida el script
      nombreProveedor: datos.proveedor,
      area:            datos.area,
      documentos:      [{ requisito: datos.requisito, nombreArchivo: datos.nombreArchivo }],
      // Campos para guardar en Sheets
      Proveedor:    datos.proveedor,
      Nombre:       datos.responsable,
      Documento:    datos.documento,
      Empresa:      datos.empresa,
      Área:         datos.area,
      Requisito:    datos.requisito,
      NombreArchivo: datos.nombreArchivo,
      ArchivoBase64: datos.base64,
      FechaCarga:   new Date().toISOString(),
      Estado:       "Pendiente",
      Comentarios:  ""
    };
    return await this.postData(payload);
  },

  // ── ACTUALIZAR ESTADO ────────────────────────
  async actualizarEstado(datos) {
    const payload = {
      action:      "actualizarEstado",
      Proveedor:   datos.proveedor,
      Documento:   datos.documento,
      Requisito:   datos.requisito,
      Área:        datos.area,
      Estado:      datos.estado,
      Comentarios: datos.comentarios || "",
      Fila:        datos.fila || ""
    };
    return await this.postData(payload);
  },

  // ── CONVERTIR ARCHIVO A BASE64 ───────────────
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

/* ── ÁREAS (localStorage) ──────────────────── */
const SSTAreas = {
  get() {
    try {
      const s = localStorage.getItem("areasSST");
      return s ? JSON.parse(s) : JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT));
    } catch(e) {
      return JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT));
    }
  },
  save(areas) {
    localStorage.setItem("areasSST", JSON.stringify(areas));
  },
  init() {
    if (!localStorage.getItem("areasSST")) {
      this.save(JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT)));
    }
  }
};

/* ── TOAST ─────────────────────────────────── */
const Toast = {
  _wrap: null,
  init() {
    this._wrap = document.createElement("div");
    this._wrap.className = "toast-wrap";
    document.body.appendChild(this._wrap);
  },
  show(msg, tipo = "info", ms = 4000) {
    if (!this._wrap) this.init();
    const el = document.createElement("div");
    el.className = "toast-item " + tipo;
    el.textContent = msg;
    this._wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(100%)";
      el.style.transition = "all 0.3s ease";
      setTimeout(() => el.remove(), 300);
    }, ms);
  },
  ok(msg)   { this.show(msg, "success"); },
  err(msg)  { this.show(msg, "error", 6000); },
  info(msg) { this.show(msg, "info"); },
  warn(msg) { this.show(msg, "warning"); }
};

/* ── LOADING OVERLAY ───────────────────────── */
const Loading = {
  _el: null,
  init() {
    this._el = document.getElementById("overlayLoading");
  },
  show() { if (this._el) this._el.classList.add("show"); },
  hide() { if (this._el) this._el.classList.remove("show"); }
};

/* ── FORMATEAR FECHA ───────────────────────── */
function fmtFecha(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("es-CO", {
      year: "numeric", month: "short", day: "numeric"
    });
  } catch(e) { return String(val); }
}

/* ── INIT ──────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  Toast.init();
  Loading.init();
  SSTAreas.init();
});
