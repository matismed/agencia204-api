/**
 * /api/loto.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * Devuelve resultados del LOTO PLUS y del LOTO 5 en una sola llamada.
 *
 * FUENTE: quini6loto.com (HTTPS, HTML estático, texto plano)
 *  Loto Plus: quini6loto.com/loto-resultados.php
 *  Loto 5:    quini6loto.com/loto5-resultados.php
 *
 * LOTO PLUS — sorteos miércoles y sábados 22:00hs
 *  Datos verificados sorteo 3866 · Miércoles 18 de Marzo de 2026:
 *  Tradicional:  02 · 07 · 20 · 28 · 33 · 34
 *  Desquite:     02 · 03 · 05 · 07 · 38 · 43
 *  Sale o Sale:  01 · 23 · 27 · 29 · 34 · 37
 *  Jack (Plus):  4
 *
 * LOTO 5 — sorteos sábados 22:00hs
 *  Datos verificados sorteo · Sábado 14 de Marzo de 2026:
 *  Números: 00 · 01 · 11 · 30 · 35
 *
 * RESPUESTA JSON:
 * {
 *   loto: {
 *     sorteo:      "3866",
 *     fecha:       "Miércoles 18 de Marzo de 2026",
 *     tradicional: ["02","07","20","28","33","34"],
 *     desquite:    ["02","03","05","07","38","43"],
 *     saleOSale:   ["01","23","27","29","34","37"],
 *     jack:        "4",
 *     fuente:      "quini6loto.com"
 *   },
 *   loto5: {
 *     fecha:   "Sábado 14 de Marzo de 2026",
 *     numeros: ["00","01","11","30","35"],
 *     fuente:  "quini6loto.com"
 *   },
 *   actualizado: "22:10:00"
 * }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Cache hasta el próximo miércoles o sábado a las 22:30hs AR
  const segsCache = calcularSegsHastaProxSorteoLoto();
  res.setHeader('Cache-Control', `s-maxage=${segsCache}, stale-while-revalidate=3600`);

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // Hacer ambos fetches en paralelo
  const [htmlLoto, htmlLoto5] = await Promise.all([
    fetchHTML('https://www.quini6loto.com/loto-resultados.php', 'loto', debug),
    fetchHTML('https://www.quini6loto.com/loto5-resultados.php', 'loto5', debug)
  ]);

  const loto  = htmlLoto  ? parsearLoto(htmlLoto)   : null;
  const loto5 = htmlLoto5 ? parsearLoto5(htmlLoto5) : null;

  if (!loto && !loto5) {
    return res.status(503).json({
      error:       true,
      mensaje:     'No se pudo obtener ningún resultado del Loto',
      debug,
      actualizado: ahora
    });
  }

  return res.status(200).json({
    loto:        loto  || null,
    loto5:       loto5 || null,
    debug,
    actualizado: ahora
  });
}

// ─────────────────────────────────────────────────────────────
//  PARSER LOTO PLUS
//
//  HTML real de quini6loto.com/loto-resultados.php:
//
//  ## Resultado Loto 3866 - Miércoles 18 de Marzo de 2026
//  Números del Loto
//  02 07 20 28 33 34
//  Jack1 4  Jack2
//  Números del Desquite
//  02 03 05 07 38 43
//  Jack1 Jack2
//  Números del Sale o sale
//  01 23 27 29 34 37
//  ---
//  ## Resultado Loto 3865 - Sábado 14 de Marzo de 2026
//  ...
// ─────────────────────────────────────────────────────────────
function parsearLoto(html) {
  if (!html || html.length < 200) return null;

  // Primer sorteo (más reciente)
  const mHead = html.match(
    /Resultado Loto (\d+)\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i
  );
  if (!mHead) return null;

  const sorteo = mHead[1];
  const fecha  = capitalizar(mHead[2]);
  const iIni   = mHead.index;

  // Delimitar bloque del primer sorteo (hasta el "---")
  const iSep   = html.indexOf('---', iIni);
  const iEnd   = iSep > iIni ? iSep : iIni + 800;
  const bloque = html.slice(iIni, iEnd);

  // Extraer cada sección por nombre de etiqueta
  function extraerSeccion(etiqueta) {
    const mi = bloque.search(new RegExp(etiqueta, 'i'));
    if (mi === -1) return [];
    const siguiente = bloque.slice(mi + etiqueta.length).search(
      /Números del |Jack1|---/i
    );
    const fin  = mi + etiqueta.length + (siguiente > -1 ? siguiente : 300);
    const texto = bloque.slice(mi + etiqueta.length, fin);
    // Extraer pares de dígitos 00-45 (sin capturar años ni el número sorteo)
    return [...texto.matchAll(/\b(\d{2})\b/g)]
      .map(m => m[1])
      .filter(n => parseInt(n) >= 0 && parseInt(n) <= 45);
  }

  const tradicional = extraerSeccion('Números del Loto');
  const desquite    = extraerSeccion('Números del Desquite');
  const saleOSale   = extraerSeccion('Números del Sale o sale');

  if (tradicional.length < 6) return null;

  // Jack (Número Plus): aparece entre "Jack1 4 Jack2"
  const jackM = bloque.match(/Jack1\s+(\d)\s+Jack2/);
  const jack  = jackM ? jackM[1] : null;

  return {
    sorteo,
    fecha,
    tradicional: tradicional.slice(0, 6),
    desquite:    desquite.slice(0, 6),
    saleOSale:   saleOSale.slice(0, 6),
    ...(jack && { jack }),
    fuente: 'quini6loto.com'
  };
}

// ─────────────────────────────────────────────────────────────
//  PARSER LOTO 5
//
//  HTML real de quini6loto.com/loto5-resultados.php:
//
//  ## Resultado Loto 5 - Sábado 14 de Marzo de 2026
//  00 01 11 30 35
//  Comprobar Loto5  Lista de Premios
//  ---
//  ## Resultado Loto 5 - Sábado 7 de Marzo de 2026
//  ...
// ─────────────────────────────────────────────────────────────
function parsearLoto5(html) {
  if (!html || html.length < 50) return null;

  const mHead = html.match(
    /Resultado Loto 5\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i
  );
  if (!mHead) return null;

  const fecha = capitalizar(mHead[1]);
  const iIni  = mHead.index + mHead[0].length;
  const iSep  = html.indexOf('---', iIni);
  const iEnd  = iSep > iIni ? iSep : iIni + 300;
  const bloque = html.slice(iIni, iEnd);

  // Loto 5: 5 números de 2 dígitos entre 00 y 36
  // Eliminar fechas tipo DD/MM/YYYY del bloque para no contaminar
  const bloqueClean = bloque.replace(/\d{2}\/\d{2}\/\d{4}/g, '');
  const nums = [...bloqueClean.matchAll(/\b(\d{2})\b/g)]
    .map(m => m[1])
    .filter(n => parseInt(n) >= 0 && parseInt(n) <= 36);

  if (nums.length < 5) return null;

  return {
    fecha,
    numeros: nums.slice(0, 5),
    fuente:  'quini6loto.com'
  };
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────

async function fetchHTML(url, nombre, debugArr) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Cache-Control':   'no-cache'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    debugArr.push({ fuente: nombre, estado: 'OK', chars: html.length });
    return html;
  } catch (e) {
    debugArr.push({ fuente: nombre, estado: 'error', mensaje: e.message });
    return null;
  }
}

function capitalizar(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function ahoraAR() {
  return new Date(new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }));
}

function calcularSegsHastaProxSorteoLoto() {
  // Loto sortea miércoles (3) y sábados (6) a las 22:00hs AR
  const DIAS_SORTEO = [3, 6]; // miércoles y sábado
  const ahora = ahoraAR();
  const diaActual = ahora.getDay();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  const HORA_SORTEO = 22 * 60 + 30; // 22:30 (30 min después del sorteo)

  let minDiff = Infinity;
  for (const dia of DIAS_SORTEO) {
    let offset = (dia - diaActual + 7) % 7;
    // Si es el mismo día pero ya pasaron las 22:30, ir a la próxima semana
    if (offset === 0 && horaActual >= HORA_SORTEO) offset = 7;
    const mins = offset * 24 * 60 + (HORA_SORTEO - horaActual);
    if (mins < minDiff) minDiff = mins;
  }

  return Math.max(minDiff * 60, 300); // mínimo 5 minutos
}

