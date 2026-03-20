/**
 * ============================================================
 *  /api/brinco.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  CÓMO USARLO (3 pasos):
 *  1. Abrí tu proyecto en GitHub (el mismo donde está quini6.js)
 *  2. Entrá a la carpeta /api/
 *  3. Subí este archivo como "brinco.js"
 *  → Vercel lo publica solo en: agencia204-api.vercel.app/api/brinco
 *
 *  RESPUESTA JSON que devuelve:
 *  {
 *    sorteo:      "1343",
 *    fecha:       "16/03/2026",
 *    tradicional: ["04","09","15","17","19","30"],
 *    junior:      ["00","05","06","27","33","39"],
 *    pozo:        "$865.000.000",
 *    actualizado: "21:05:00"
 *  }
 *
 *  DATOS DEL JUEGO:
 *  - Sorteos: domingos a las 21:00hs
 *  - Números: 6 del 0 al 39
 *  - Operador: Lotería de Santa Fe
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
                 || await fuenteLoteriasMundiales()
                 || await fuenteLaNacion();

  if (resultado) {
    resultado.actualizado = ahora;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
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
    const r = await fetch('https://www.loteriasantafe.gov.ar/index.php/resultados/brinco', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    const grupos = extraerGruposPunto(html, 0, 39);
    if (!grupos[0] || grupos[0].length < 6) return null;

    const sorteoM = html.match(/sorteo\s*n[°º]?\s*(\d+)/i);
    const pozoM   = html.match(/\$\s*([\d\.,]+(?:\s*(?:millones?|mil))?)/i);

    return {
      sorteo:      sorteoM ? sorteoM[1] : estimarSorteoBrinco(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: grupos[0],
      junior:      grupos[1] || [],
      pozo:        pozoM ? pozoM[0] : '—',
      fuente:      'loteriasantafe.gov.ar'
    };
  } catch (_) { return null; }
}

// ── Fuente 2: TuJugada ────────────────────────────────────
async function fuenteTuJugada() {
  try {
    const r = await fetch('https://www.tujugada.com.ar/brinco.asp', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    const grupos = extraerGruposPunto(html, 0, 39);
    const todos  = extraerNumerosBolillas(html, 0, 39);
    if (todos.length < 6 && (!grupos[0] || grupos[0].length < 6)) return null;

    const sorteoM = html.match(/(?:brinco|sorteo)[^>]*?(\d{3,4})/i);
    const pozoM   = html.match(/\$\s*([\d\.,]+(?:\s*(?:millones?|mil))?)/i);

    return {
      sorteo:      sorteoM ? sorteoM[1] : estimarSorteoBrinco(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: grupos[0]?.length >= 6 ? grupos[0] : todos.slice(0, 6),
      junior:      grupos[1]?.length >= 6 ? grupos[1] : todos.slice(6, 12),
      pozo:        pozoM ? pozoM[0] : '—',
      fuente:      'tujugada.com.ar'
    };
  } catch (_) { return null; }
}

// ── Fuente 3: LoteriasMundiales ───────────────────────────
async function fuenteLoteriasMundiales() {
  try {
    const r = await fetch('https://www.loteriasmundiales.com.ar/Juegos/brinco', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Extraer por bolillas
    const todos = extraerNumerosBolillas(html, 0, 39);
    if (todos.length < 6) {
      // Intentar por grupos de punto
      const grupos = extraerGruposPunto(html, 0, 39);
      if (!grupos[0] || grupos[0].length < 6) return null;
      return {
        sorteo:      estimarSorteoBrinco(),
        fecha:       extraerFecha(html) || hoy(),
        tradicional: grupos[0],
        junior:      grupos[1] || [],
        pozo:        '—',
        fuente:      'loteriasmundiales.com.ar'
      };
    }

    return {
      sorteo:      estimarSorteoBrinco(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: todos.slice(0, 6),
      junior:      todos.slice(6, 12),
      pozo:        '—',
      fuente:      'loteriasmundiales.com.ar'
    };
  } catch (_) { return null; }
}

// ── Fuente 4: La Nación ───────────────────────────────────
async function fuenteLaNacion() {
  try {
    const r = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
      headers: UA, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Patrón "04 · 09 · 15 · 17 · 19 · 30"
    // En Brinco los números van del 00 al 39 (pueden empezar con 0)
    const patron = /(\d{2})\s*[·•]\s*(\d{2})\s*[·•]\s*(\d{2})\s*[·•]\s*(\d{2})\s*[·•]\s*(\d{2})\s*[·•]\s*(\d{2})/g;
    const matches = [];
    let m;
    while ((m = patron.exec(html)) !== null) {
      const nums = m.slice(1).filter(n => +n >= 0 && +n <= 39);
      if (nums.length === 6) matches.push(nums);
    }
    if (matches.length === 0) return null;

    return {
      sorteo:      estimarSorteoBrinco(),
      fecha:       extraerFecha(html) || hoy(),
      tradicional: matches[0],
      junior:      matches[1] || [],
      pozo:        '—',
      fuente:      'lanacion.com.ar'
    };
  } catch (_) { return null; }
}

// ── Utilidades ────────────────────────────────────────────

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

function extraerFecha(html) {
  const m = html.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  return m ? m[0] : null;
}

function estimarSorteoBrinco() {
  // Brinco 1 sorteo por semana (domingo)
  // Sorteo base estimado: 1300 el 01/01/2026
  const dias = Math.floor((Date.now() - new Date('2026-01-01').getTime()) / 86400000);
  return String(1300 + Math.floor(dias / 7));
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}
