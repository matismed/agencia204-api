/**
 * /api/brinco.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * FUENTES:
 *  1. nacionalloteria.com/argentina/brinco.php  ← PRINCIPAL (HTTPS, HTML simple)
 *  2. tujugada.com.ar/brinco.asp                ← BACKUP   (HTTPS)
 *
 * VERIFICADO con datos reales (20/03/2026):
 *  Sorteo 1345 · 15/03/2026
 *  Tradicional: 17 · 18 · 21 · 26 · 36 · 39
 *  Junior:      10 · 14 · 24 · 30 · 36 · 37
 *
 * RESPUESTA JSON:
 * {
 *   sorteo:      "1345",
 *   fecha:       "Domingo 15 de Marzo de 2026",
 *   tradicional: ["17","18","21","26","36","39"],
 *   junior:      ["10","14","24","30","36","37"],
 *   fuente:      "nacionalloteria.com",
 *   actualizado: "21:05:00"
 * }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // ── FUENTE 1: nacionalloteria.com (HTTPS, HTML limpio) ────
  let resultado = await intentar('nacionalloteria', async () => {
    const r = await fetch('https://www.nacionalloteria.com/argentina/brinco.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
        'Accept': 'text/html',
        'Accept-Language': 'es-AR,es;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    return parsearNacionalLoteria(html);
  }, debug);

  // ── FUENTE 2: tujugada.com.ar (HTTPS, backup) ─────────────
  if (!resultado) {
    resultado = await intentar('tujugada', async () => {
      const r = await fetch('https://www.tujugada.com.ar/brinco.asp', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
          'Accept': 'text/html',
          'Accept-Language': 'es-AR,es;q=0.9'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return parsearTuJugada(html);
    }, debug);
  }

  if (resultado) {
    resultado.actualizado = ahora;
    resultado.debug = debug;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
    debug,
    actualizado: ahora
  });
}

async function intentar(nombre, fn, debugArr) {
  try {
    const r = await fn();
    if (r) {
      debugArr.push({ fuente: nombre, estado: 'OK' });
      return r;
    }
    debugArr.push({ fuente: nombre, estado: 'sin datos' });
    return null;
  } catch (e) {
    debugArr.push({ fuente: nombre, estado: 'error', mensaje: e.message });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  PARSER NACIONAL LOTERIA
//
//  Estructura HTML verificada (UTF-8, HTTPS):
//
//  # Brinco 1345 - Domingo 15 de Marzo de 2026
//  Resultados del Brinco 1345[Lista de Premios](...)
//  * 17
//  * 18
//  * 21
//  * 26
//  * 36
//  * 39
//  Resultados del Brinco Junior 1345
//  * 10
//  * 14
//  * 24
//  * 30
//  * 36
//  * 37
//  ---
//  # Brinco 1344 - ...  ← sorteos anteriores siguen abajo
// ─────────────────────────────────────────────────────────────
function parsearNacionalLoteria(html) {
  if (!html || html.length < 200) return null;

  // Encontrar el primer "Resultados del Brinco NNNN" (sorteo más reciente)
  const mTrad = html.match(/Resultados del Brinco (\d+)/);
  if (!mTrad) return null;

  const sorteo    = mTrad[1];
  const iTrad     = html.indexOf(mTrad[0]);

  // Encontrar "Resultados del Brinco Junior NNNN"
  const textoJr   = 'Resultados del Brinco Junior ' + sorteo;
  const iJr       = html.indexOf(textoJr, iTrad);
  if (iJr === -1) return null;

  // Fin del bloque Junior: próximo "---" o siguiente sorteo
  const iSep      = html.indexOf('---', iJr);
  const iEnd      = iSep > iJr ? iSep : iJr + 300;

  // Bloques de texto para cada modalidad
  const bloqueTrad = html.slice(iTrad, iJr);
  const bloqueJr   = html.slice(iJr + textoJr.length, iEnd);

  // Extraer números: líneas "* NN" o "<li>NN</li>"
  const extraer = (bloque) => {
    const matches = [...bloque.matchAll(/[*\-•]\s*(\d{1,2})\b|<li[^>]*>\s*(\d{1,2})\s*<\/li>/g)];
    return matches
      .map(m => m[1] || m[2])
      .filter(n => n !== undefined && parseInt(n) >= 0 && parseInt(n) <= 39)
      .map(n => String(parseInt(n)).padStart(2, '0'));
  };

  const numsTrad = extraer(bloqueTrad);
  const numsJr   = extraer(bloqueJr);

  if (numsTrad.length < 6) return null;

  // Fecha del encabezado: "Brinco 1345 - Domingo 15 de Marzo de 2026"
  const fechaM = html.match(
    new RegExp(
      'Brinco\\s+' + sorteo + '\\s*[-–]\\s*' +
      '((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\\s+\\d+\\s+de\\s+\\w+\\s+de\\s+\\d{4})',
      'i'
    )
  );

  return {
    sorteo,
    fecha:       fechaM ? fechaM[1] : hoy(),
    tradicional: numsTrad.slice(0, 6),
    junior:      numsJr.slice(0, 6),
    fuente:      'nacionalloteria.com'
  };
}

// ─────────────────────────────────────────────────────────────
//  PARSER TUJUGADA
//
//  Estructura HTML (verificada de búsqueda):
//  "BRINCO SORTEO 1345 del: 15/3/2026"
//  Números en spans/divs con clase de bolilla o en <td><b>NN</b></td>
// ─────────────────────────────────────────────────────────────
function parsearTuJugada(html) {
  if (!html || html.length < 200) return null;

  // Buscar el sorteo más reciente
  const mSorteo = html.match(/BRINCO\s+SORTEO\s+(\d+)\s+del[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!mSorteo) return null;

  const sorteo = mSorteo[1];
  const fecha  = mSorteo[2];

  // Tomar bloque desde ese sorteo hasta el siguiente
  const iInicio = html.indexOf(mSorteo[0]);
  const mNext   = html.match(new RegExp('BRINCO\\s+SORTEO\\s+(?!' + sorteo + ')\\d+', 'i'));
  const iNext   = mNext ? html.indexOf(mNext[0]) : html.length;
  const bloque  = html.slice(iInicio, iNext);

  // Extraer números en <b>NN</b> dentro de <td>
  const reNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const nums  = [];
  let m;
  while ((m = reNum.exec(bloque)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 39) nums.push(String(n).padStart(2, '0'));
    if (nums.length >= 12) break;
  }

  if (nums.length < 6) return null;

  return {
    sorteo,
    fecha,
    tradicional: nums.slice(0, 6),
    junior:      nums.slice(6, 12),
    fuente:      'tujugada.com.ar'
  };
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
