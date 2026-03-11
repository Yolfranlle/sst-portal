/* ═══════════════════════════════════════════════
   PORTAL SST — CONSULTA DE ESTADO
═══════════════════════════════════════════════ */

document.getElementById("formBusqueda").addEventListener("submit", buscar);

async function buscar(e) {
  e.preventDefault();
  const nombre   = document.getElementById("bNombre").value.trim();
  const cedula   = document.getElementById("bCedula").value.trim();
  const msgEl    = document.getElementById("msgBusqueda");
  const results  = document.getElementById("resultsArea");
  const btnBuscar= document.getElementById("btnBuscar");

  if (!nombre || !cedula) {
    msgEl.textContent = "Completa los dos campos para buscar";
    msgEl.className   = "msg error show"; msgEl.style.display = "block";
    return;
  }

  msgEl.style.display = "none";
  results.classList.remove("show");
  btnBuscar.disabled  = true;
  Loading.show();

  try {
    const todos = await SSTApi.getRegistros();

    const encontrados = todos.filter(r => {
      if (!r || !r.Proveedor || !r.Documento) return false;
      const okNombre = r.Proveedor.toLowerCase().includes(nombre.toLowerCase());
      const okDoc    = String(r.Documento).trim() === cedula.trim();
      return okNombre && okDoc;
    });

    if (!encontrados.length) {
      msgEl.textContent = "❌ No se encontraron documentos con esos datos. Verifica el nombre exacto del proveedor y tu cédula.";
      msgEl.className   = "msg error show"; msgEl.style.display = "block";
      return;
    }

    renderResultados(encontrados);
    results.classList.add("show");
    results.scrollIntoView({ behavior: "smooth" });
    msgEl.textContent = `✓ Se encontraron ${encontrados.length} documento(s)`;
    msgEl.className   = "msg exito show"; msgEl.style.display = "block";

  } catch(err) {
    msgEl.textContent = "❌ Error al conectar: " + err.message;
    msgEl.className   = "msg error show"; msgEl.style.display = "block";
    console.error(err);
  } finally {
    Loading.hide();
    btnBuscar.disabled = false;
  }
}

/* ── RENDER RESULTADOS ──────────────────────── */
function renderResultados(docs) {
  const primer = docs[0];

  // Info proveedor
  document.getElementById("rNombre").textContent = primer.Proveedor || "—";
  document.getElementById("rResp").textContent   = primer.Nombre    || "—";
  document.getElementById("rEmpresa").textContent= primer.Empresa   || "—";
  document.getElementById("rDoc").textContent    = primer.Documento || "—";
  const areas = [...new Set(docs.map(d => d.Área).filter(Boolean))];
  document.getElementById("rAreas").textContent  = areas.join(", ") || "—";
  document.getElementById("rFecha").textContent  = new Date().toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" });

  // Tarjetas de documentos
  document.getElementById("docCards").innerHTML = docs.map(doc => {
    const est = (doc.Estado || "Pendiente").toLowerCase();
    return `
      <div class="doc-card ${est}">
        <div class="doc-card-top">
          <div>
            <div class="doc-name">${doc.Requisito || "Sin nombre"}</div>
            <span class="doc-area">${doc.Área || "—"}</span>
          </div>
          <span class="badge ${est}">${doc.Estado || "Pendiente"}</span>
        </div>
        <div class="doc-meta">
          <div class="doc-meta-item">
            <span class="lbl">Archivo:</span>
            <span class="val">${doc["Nombre Archivo"] || "—"}</span>
          </div>
          <div class="doc-meta-item">
            <span class="lbl">Cargado:</span>
            <span class="val">${fmtFecha(doc["Fecha Carga"])}</span>
          </div>
        </div>
        ${doc.Comentarios ? `
          <div class="doc-comment">
            <strong>💬 Comentarios del equipo SST:</strong>
            ${doc.Comentarios}
          </div>
        ` : ""}
      </div>`;
  }).join("");

  // Estadísticas
  const total     = docs.length;
  const aprobados = docs.filter(d => d.Estado === "Aprobado").length;
  const pendientes= docs.filter(d => d.Estado === "Pendiente").length;
  const rechazados= docs.filter(d => d.Estado === "Rechazado").length;

  document.getElementById("rsTotal").textContent = total;
  document.getElementById("rsPend").textContent  = pendientes;
  document.getElementById("rsApro").textContent  = aprobados;
  document.getElementById("rsRech").textContent  = rechazados;
}
