/* ═══════════════════════════════════════════════
   PORTAL SST — PANEL ADMINISTRATIVO
═══════════════════════════════════════════════ */

let registros   = [];   // todos los registros
let filtrados   = [];   // registros filtrados
let editandoDoc = null; // { idx, registro }
let editandoArea = null;

/* ── LOGIN ─────────────────────────────────── */
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const pwd = document.getElementById("pwdInput").value;
  if (pwd === SST_CONFIG.ADMIN_PASSWORD) {
    document.getElementById("loginPage").style.display  = "none";
    document.getElementById("appLayout").style.display  = "grid";
    iniciarAdmin();
  } else {
    document.getElementById("loginError").style.display = "block";
    document.getElementById("loginError").textContent   = "❌ Contraseña incorrecta";
  }
});

function logout() {
  document.getElementById("appLayout").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("pwdInput").value = "";
  document.getElementById("loginError").style.display = "none";
  registros = []; filtrados = [];
}

/* ── INICIAR ────────────────────────────────── */
function iniciarAdmin() {
  cargarDatos();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  // Auto-refresh cada 90s
  setInterval(() => {
    if (document.getElementById("tabDashboard").classList.contains("active")) cargarDatos();
  }, 90000);
}

function actualizarReloj() {
  const el = document.getElementById("topbarTime");
  if (el) el.textContent = new Date().toLocaleTimeString("es-CO");
}

/* ── TABS ──────────────────────────────────── */
function mostrarTab(nombre) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("tab" + capitalizar(nombre)).classList.add("active");
  document.getElementById("navBtn" + capitalizar(nombre)).classList.add("active");

  const titles = { dashboard: "Dashboard", documentos: "Gestión de Documentos", areas: "Gestionar Áreas", proveedores: "Proveedores" };
  document.getElementById("pageTitle").textContent = titles[nombre] || nombre;

  if (nombre === "documentos")  renderTablaDocumentos();
  if (nombre === "areas")       renderTablaAreas();
  if (nombre === "proveedores") renderProveedores();
  if (nombre === "dashboard")   cargarDatos();
}

function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── CARGAR DATOS ───────────────────────────── */
async function cargarDatos() {
  Loading.show();
  try {
    registros = await SSTApi.getRegistros();
    filtrados = [...registros];
    renderDashboard();
    renderTablaDocumentos();
    renderFiltroAreas();
    document.getElementById("lastUpdate").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-CO");
  } catch(err) {
    console.error(err);
    Toast.err("Error al cargar datos: " + err.message);
    setTextoTabla("tablaUltimos",  7, "❌ Error al cargar. Intenta de nuevo.");
    setTextoTabla("tablaDocumentos", 8, "❌ Error al cargar.");
  } finally {
    Loading.hide();
  }
}

function setTextoTabla(id, cols, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty"><div class="empty-icon">⚠️</div>${msg}</td></tr>`;
}

/* ── DASHBOARD ──────────────────────────────── */
function renderDashboard() {
  const total     = registros.length;
  const pendientes= registros.filter(r => r.Estado === "Pendiente").length;
  const aprobados = registros.filter(r => r.Estado === "Aprobado").length;
  const rechazados= registros.filter(r => r.Estado === "Rechazado").length;

  document.getElementById("statTotal").textContent    = total;
  document.getElementById("statPend").textContent     = pendientes;
  document.getElementById("statApro").textContent     = aprobados;
  document.getElementById("statRech").textContent     = rechazados;

  const ultimos = [...registros].reverse().slice(0, 10);
  const tbody   = document.getElementById("tablaUltimos");

  if (!ultimos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">📭</div>No hay documentos aún</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimos.map((r, i) => {
    const idx = registros.indexOf(r);
    return filaTR(r, idx, false);
  }).join("");
}

/* ── TABLA DOCUMENTOS ───────────────────────── */
function renderTablaDocumentos() {
  const tbody = document.getElementById("tablaDocumentos");
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty"><div class="empty-icon">📭</div>No hay documentos</td></tr>`;
    return;
  }
  tbody.innerHTML = filtrados.map((r, i) => {
    const idx = registros.indexOf(r);
    return filaTR(r, idx, true);
  }).join("");
}

function filaTR(r, idx, conArchivo) {
  const est     = (r.Estado || "Pendiente").toLowerCase();
  const archivo = conArchivo && r["URL Documento"]
    ? `<a class="btn btn-ghost btn-sm" href="${r["URL Documento"]}" target="_blank">📄 Ver</a>`
    : (conArchivo ? "—" : "");
  const archivoCell = conArchivo ? `<td>${archivo}</td>` : "";

  return `
    <tr>
      <td><strong>${r.Proveedor || "—"}</strong></td>
      <td>${r.Nombre || "—"}</td>
      <td>${r.Área   || "—"}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.Requisito||""}">${r.Requisito || "—"}</td>
      ${archivoCell}
      <td>${fmtFecha(r["Fecha Carga"])}</td>
      <td><span class="badge ${est}">${r.Estado || "Pendiente"}</span></td>
      <td>
        <button class="btn btn-accent btn-sm" onclick="abrirModalEstado(${idx})">✏️ Estado</button>
      </td>
    </tr>`;
}

/* ── FILTROS ────────────────────────────────── */
function renderFiltroAreas() {
  const areas  = [...new Set(registros.map(r => r.Área).filter(Boolean))];
  const select = document.getElementById("filtroArea");
  const actual = select.value;
  select.innerHTML = '<option value="">Todas las áreas</option>' +
    areas.map(a => `<option value="${a}">${a}</option>`).join("");
  if (actual) select.value = actual;
}

function filtrar() {
  const estado = document.getElementById("filtroEstado").value;
  const area   = document.getElementById("filtroArea").value;
  filtrados = registros.filter(r =>
    (!estado || r.Estado === estado) && (!area || r.Área === area)
  );
  renderTablaDocumentos();
}

/* ── MODAL ESTADO ───────────────────────────── */
function abrirModalEstado(idx) {
  const r   = registros[idx];
  if (!r) return;
  editandoDoc = { idx, r };

  document.getElementById("meProv").textContent  = r.Proveedor || "—";
  document.getElementById("meReq").textContent   = r.Requisito || "—";
  document.getElementById("meArea").textContent  = r.Área      || "—";
  document.getElementById("meDoc").textContent   = r.Documento || "—";
  document.getElementById("meEstado").value      = r.Estado    || "Pendiente";
  document.getElementById("meComentarios").value = r.Comentarios || "";

  document.getElementById("modalEstado").classList.add("show");
}

function cerrarModalEstado() {
  document.getElementById("modalEstado").classList.remove("show");
  editandoDoc = null;
}

async function guardarEstado() {
  if (!editandoDoc) return;
  const { idx, r }  = editandoDoc;
  const nuevoEstado = document.getElementById("meEstado").value;
  const comentarios = document.getElementById("meComentarios").value.trim();

  Loading.show();
  cerrarModalEstado();

  try {
    await SSTApi.actualizarEstado({
      proveedor:   r.Proveedor,
      documento:   r.Documento,
      requisito:   r.Requisito,
      area:        r.Área,
      estado:      nuevoEstado,
      comentarios,
      fila:        r.Fila || r._fila || ""
    });

    // Actualizar localmente
    registros[idx].Estado      = nuevoEstado;
    registros[idx].Comentarios = comentarios;
    filtrados = registros.filter(r2 => {
      const e = document.getElementById("filtroEstado")?.value || "";
      const a = document.getElementById("filtroArea")?.value   || "";
      return (!e || r2.Estado === e) && (!a || r2.Área === a);
    });

    renderDashboard();
    renderTablaDocumentos();
    Toast.ok(`Estado actualizado a "${nuevoEstado}"`);
  } catch(err) {
    Toast.err("Error al actualizar: " + err.message);
  } finally {
    Loading.hide();
  }
}

/* ── ÁREAS ──────────────────────────────────── */
function renderTablaAreas() {
  const areas = SSTAreas.get();
  const tbody = document.getElementById("tablaAreas");

  if (!Object.keys(areas).length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">No hay áreas registradas</td></tr>`;
    return;
  }

  tbody.innerHTML = Object.entries(areas).map(([nombre, reqs]) => `
    <tr>
      <td><strong>${nombre}</strong></td>
      <td>${reqs.length} requisito${reqs.length !== 1 ? "s" : ""}</td>
      <td>
        <button class="btn btn-accent btn-sm" onclick="abrirModalReqs('${nombre.replace(/'/g,"\\'")}')">📝 Requisitos</button>
        <button class="btn btn-danger  btn-sm" onclick="eliminarArea('${nombre.replace(/'/g,"\\'")}')">🗑️</button>
      </td>
    </tr>
  `).join("");
}

function agregarArea() {
  const nombre = document.getElementById("inputNuevaArea").value.trim();
  const msg    = document.getElementById("msgAreas");
  if (!nombre) { mostrarMsgAreas("Ingresa un nombre para el área", "error"); return; }
  const areas = SSTAreas.get();
  if (areas[nombre]) { mostrarMsgAreas("El área ya existe", "error"); return; }
  areas[nombre] = [];
  SSTAreas.save(areas);
  document.getElementById("inputNuevaArea").value = "";
  mostrarMsgAreas("✅ Área creada. Abre Requisitos para agregar los documentos.", "exito");
  renderTablaAreas();
}

function eliminarArea(nombre) {
  if (!confirm(`¿Eliminar el área "${nombre}" y todos sus requisitos?`)) return;
  const areas = SSTAreas.get();
  delete areas[nombre];
  SSTAreas.save(areas);
  renderTablaAreas();
  Toast.info(`Área "${nombre}" eliminada`);
}

function mostrarMsgAreas(txt, tipo) {
  const el = document.getElementById("msgAreas");
  el.textContent = txt;
  el.className = `msg ${tipo} show`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

/* ── MODAL REQUISITOS ───────────────────────── */
function abrirModalReqs(area) {
  editandoArea = area;
  document.getElementById("mRAreaNombre").textContent = area;
  document.getElementById("mRInput").value = "";
  renderListaReqs();
  document.getElementById("modalReqs").classList.add("show");
}

function cerrarModalReqs() {
  document.getElementById("modalReqs").classList.remove("show");
  editandoArea = null;
}

function renderListaReqs() {
  const areas = SSTAreas.get();
  const reqs  = areas[editandoArea] || [];
  const lista = document.getElementById("mRLista");

  if (!reqs.length) {
    lista.innerHTML = `<p style="color:var(--gray-400);text-align:center;padding:1rem">Sin requisitos aún</p>`;
    return;
  }

  lista.innerHTML = reqs.map((req, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;
                padding:0.75rem 0.9rem;background:var(--off-white);border-radius:6px;margin-bottom:6px;
                border:1px solid var(--gray-100);">
      <span style="font-size:0.88rem;color:var(--navy);">${i + 1}. ${req}</span>
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-ghost btn-sm" onclick="editarReq(${i})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarReq(${i})">🗑️</button>
      </div>
    </div>
  `).join("");
}

function agregarReq() {
  const val   = document.getElementById("mRInput").value.trim();
  if (!val) { alert("Ingresa el nombre del requisito"); return; }
  const areas = SSTAreas.get();
  if (!areas[editandoArea]) areas[editandoArea] = [];
  if (areas[editandoArea].includes(val)) { alert("Este requisito ya existe"); return; }
  areas[editandoArea].push(val);
  SSTAreas.save(areas);
  document.getElementById("mRInput").value = "";
  renderListaReqs();
}

function editarReq(idx) {
  const areas = SSTAreas.get();
  const nuevo = prompt("Editar requisito:", areas[editandoArea][idx]);
  if (nuevo && nuevo.trim()) {
    areas[editandoArea][idx] = nuevo.trim();
    SSTAreas.save(areas);
    renderListaReqs();
  }
}

function eliminarReq(idx) {
  if (!confirm("¿Eliminar este requisito?")) return;
  const areas = SSTAreas.get();
  areas[editandoArea].splice(idx, 1);
  SSTAreas.save(areas);
  renderListaReqs();
}

/* ── PROVEEDORES ────────────────────────────── */
function renderProveedores() {
  const mapa = {};
  registros.forEach(r => {
    if (!r.Proveedor) return;
    if (!mapa[r.Proveedor]) {
      mapa[r.Proveedor] = { nombre: r.Proveedor, responsable: r.Nombre, empresa: r.Empresa, documento: r.Documento, areas: new Set(), total: 0 };
    }
    mapa[r.Proveedor].areas.add(r.Área);
    mapa[r.Proveedor].total++;
  });

  const grid = document.getElementById("provGrid");

  if (!Object.keys(mapa).length) {
    grid.innerHTML = `<p style="color:var(--gray-400);padding:2rem;grid-column:1/-1;text-align:center">No hay proveedores registrados</p>`;
    return;
  }

  grid.innerHTML = Object.values(mapa).map(p => `
    <div class="prov-card">
      <div class="prov-name">🏢 ${p.nombre}</div>
      <div class="prov-detail">👤 ${p.responsable || "—"}</div>
      <div class="prov-detail">🏭 ${p.empresa     || "—"}</div>
      <div class="prov-detail">🪪 ${p.documento   || "—"}</div>
      <div class="prov-stats">
        <span class="prov-tag">📄 ${p.total} docs</span>
        ${[...p.areas].filter(Boolean).map(a => `<span class="prov-tag">${a}</span>`).join("")}
      </div>
    </div>
  `).join("");
}
