/**
 * ============================================================
 *  /api/loto.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  CÓMO USARLO (3 pasos):
 *  1. Abrí tu proyecto en GitHub (el mismo donde está quini6.js)
 *  2. Entrá a la carpeta /api/
 *  3. Subí este archivo como "loto.js"
 *  → Vercel lo publica solo en: agencia204-api.vercel.app/api/loto
 *
 *  RESPUESTA JSON que devuelve:
 *  {
 *    sorteo:      "3866",
 *    fecha:       "15/03/2026",
 *    tradicional: ["02","07","20","28","33","34"],
 *    desquite:    ["01","23","27","29","34","37"],
 *    saleOSale:   ["05","11","18","22","30","41"],
 *    actualizado: "22:10:05"
 *  }
 * ============================================================
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const resultado = await fuenteLoteriaSantaFe()
                 || await fuenteTuJugada()
                 || await fuenteLaNacion();

  if (resultado) {
    resultado.actualizado = ahora;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Loto',
    actualizado: ahora
  });
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9'
};

// ── Fuente 1: Lotería de Santa Fe (oficial) ───────────────
async function fuenteLoteriaSantaFe() {
  try {
    const r = await fetch('https://www.loteriasantafe.gov.ar/index.php/resultados/loto', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Busca bloques de 6 números separados por punto ·
    const grupos = extraerGruposPunto(html, 1, 45);
    if (!grupos[0] || grupos[0].length < 6) return null;

    return {
      sorteo:      extraerSorteo(html) || estimarSorteoLoto(),
      fecha:       extraerFecha(html)  || hoy(),
      tradicional: grupos[0] || [],
      desquite:    grupos[1] || [],
      saleOSale:   grupos[2] || [],
      fuente:      'loteriasantafe.gov.ar'
    };
  } catch (_) { return null; }
}

// ── Fuente 2: TuJugada ────────────────────────────────────
async function fuenteTuJugada() {
  try {
    const r = await fetch('https://www.tujugada.com.ar/loto.asp', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    const grupos = extraerGruposPunto(html, 1, 45);
    const todos  = extraerNumerosBolillas(html, 1, 45);
    if (todos.length < 6 && (!grupos[0] || grupos[0].length < 6)) return null;

    const sorteoM = html.match(/(?:loto|sorteo)[^>]*?(\d{3,4})/i);

    return {
      sorteo:      sorteoM ? sorteoM[1] : estimarSorteoLoto(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: grupos[0]?.length >= 6 ? grupos[0] : todos.slice(0, 6),
      desquite:    grupos[1]?.length >= 6 ? grupos[1] : todos.slice(6, 12),
      saleOSale:   grupos[2]?.length >= 6 ? grupos[2] : todos.slice(12, 18),
      fuente:      'tujugada.com.ar'
    };
  } catch (_) { return null; }
}

// ── Fuente 3: La Nación ───────────────────────────────────
async function fuenteLaNacion() {
  try {
    const r = await fetch('https://www.lanacion.com.ar/loterias/loto-5/', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    const grupos = extraerGruposPunto(html, 1, 45);
    if (!grupos[0] || grupos[0].length < 6) return null;

    const sorteoM = html.match(/[Ll]oto\s*(?:[Pp]lus\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : estimarSorteoLoto(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: grupos[0],
      desquite:    grupos[1] || [],
      saleOSale:   grupos[2] || [],
      fuente:      'lanacion.com.ar'
    };
  } catch (_) { return null; }
}

// ── Utilidades ────────────────────────────────────────────

// Busca grupos de 6 números separados por " · " (formato La Nación / LSF)
function extraerGruposPunto(html, min, max) {
  const patron = /(\d{2})\s*[·•\-]\s*(\d{2})\s*[·•\-]\s*(\d{2})\s*[·•\-]\s*(\d{2})\s*[·•\-]\s*(\d{2})\s*[·•\-]\s*(\d{2})/g;
  const grupos = [];
  let m;
  while ((m = patron.exec(html)) !== null) {
    const nums = m.slice(1).filter(n => +n >= min && +n <= max);
    if (nums.length === 6) grupos.push(nums);
  }
  return grupos;
}

// Busca números en clases CSS típicas de bolillas
function extraerNumerosBolillas(html, min, max) {
  const nums = [];
  const p = /class="[^"]*(?:bolilla|numero|num|ball)[^"]*"[^>]*>\s*(\d{1,2})\s*</gi;
  let m;
  while ((m = p.exec(html)) !== null) {
    const n = +m[1];
    if (n >= min && n <= max) {
      const s = String(n).padStart(2, '0');
      if (!nums.includes(s)) nums.push(s);
    }
  }
  return nums;
}

function extraerSorteo(html) {
  const m = html.match(/sorteo\s*n[°º]?\s*(\d+)/i);
  return m ? m[1] : null;
}

function extraerFecha(html) {
  const m = html.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  return m ? m[0] : null;
}

function estimarSorteoLoto() {
  // Loto Plus arrancó el 04/01/2020 aprox. en sorteo Nº 3500
  // ~2 sorteos por semana (mié y sáb)
  const dias = Math.floor((Date.now() - new Date('2020-01-04').getTime()) / 86400000);
  return String(3500 + Math.floor(dias / 3.5));
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}
