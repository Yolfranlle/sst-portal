/* ═══════════════════════════════════════════════
   PORTAL SST — CONFIGURACIÓN CENTRAL
   Edita solo este archivo para cambiar la URL
═══════════════════════════════════════════════ */

const SST_CONFIG = {

  // ── URL del Google Apps Script ─────────────
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbznnjKfkA2xLqU4KQQ0jwRTN3qfrVMVyrvVLLvrijz2dyRPYpsl0fZsFpcWi-l3-K64dA/exec",

  // ── Contraseña panel admin ──────────────────
  ADMIN_PASSWORD: "admin123",

  // ── Áreas y requisitos por defecto ─────────
  AREAS_DEFAULT: {
    "Caldera": [
      "Certificado de capacitación en calderas",
      "Licencia operativa actualizada",
      "Seguro de responsabilidad civil",
      "Certificado SGSST",
      "Constancia de no antecedentes penales"
    ],
    "Deshidratado": [
      "Certificado de operador de equipo",
      "Programa de mantenimiento preventivo",
      "Plan de seguridad en proceso",
      "Certificado SGSST",
      "Autorización sanitaria"
    ],
    "Mantenimiento": [
      "Licencia técnica actualizada",
      "Certificado de competencia",
      "Seguro de responsabilidad civil",
      "Programa de SST",
      "Certificado de capacitación"
    ],
    "Servicios Generales": [
      "Cédula de identidad",
      "Certificado laboral",
      "Constancia de afiliación a seguridad social",
      "Certificado de antecedentes",
      "Autorización de datos personales"
    ]
  }
};
