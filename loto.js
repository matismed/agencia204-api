/**
 * /api/loto.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * FUENTE: quini6loto.com (HTTPS, HTML estático)
 *  Loto Plus: quini6loto.com/loto-resultados.php
 *  Loto 5:    quini6loto.com/loto5-resultados.php
 *
 * BUG CORREGIDO: el HTML real tiene entidades como &eacute; &aacute; etc.
 * La función limpiarHTML() las decodifica y elimina los tags antes de parsear.
 *
 * DATOS VERIFICADOS (20/03/2026):
 *  Loto 3866 · Miércoles 18/03/2026:
 *    Tradicional:  02 07 20 28 33 34  ✅
 *    Desquite:     02 03 05 07 38 43  ✅
 *    Sale o Sale:  01 23 27 29 34 37  ✅
 *    Jack (Plus):  4                  ✅
 *  Loto 5 · Sábado 14/03/2026:
 *    Números: 00 01 11 30 35          ✅
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

  // Cache hasta el próximo miércoles o sábado 22:30hs AR
  const segsCache = calcularSegsHastaProxSorteoLoto();
  res.setHeader('Cache-Control', `s-maxage=${segsCache}, stale-while-revalidate=3600`);

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // Fetch en paralelo
  const [htmlLoto, htmlLoto5] = await Promise.all([
    fetchHTML('https://www.quini6loto.com/loto-resultados.php',  'loto',  debug),
    fetchHTML('https://www.quini6loto.com/loto5-resultados.php', 'loto5', debug)
  ]);

  // Limpiar HTML y parsear
  const loto  = htmlLoto  ? parsearLoto(limpiarHTML(htmlLoto))   : null;
  const loto5 = htmlLoto5 ? parsearLoto5(limpiarHTML(htmlLoto5)) : null;

  if (!loto && !loto5) {
    return res.status(503).json({
      error:       true,
      mensaje:     'No se pudo obtener ningún resultado del Loto',
      debug,
      actualizado: ahora
    });
  }

  return res.status(200).json({ loto, loto5, debug, actualizado: ahora });
}

// ─────────────────────────────────────────────────────────────
//  LIMPIEZA HTML
//  El HTML real de quini6loto tiene entidades como &eacute;, &aacute;
//  que rompen los regex de acentos. Esta función:
//  1. Decodifica entidades HTML → texto con acentos
//  2. Elimina todos los tags <...> → texto plano
//  3. Normaliza espacios múltiples → espacio simple
// ─────────────────────────────────────────────────────────────
function limpiarHTML(html) {
  return html
    // Decodificar entidades HTML comunes
    .replace(/&eacute;/gi, 'é').replace(/&Eacute;/gi, 'É')
    .replace(/&aacute;/gi, 'á').replace(/&Aacute;/gi, 'Á')
    .replace(/&iacute;/gi, 'í').replace(/&Iacute;/gi, 'Í')
    .replace(/&oacute;/gi, 'ó').replace(/&Oacute;/gi, 'Ó')
    .replace(/&uacute;/gi, 'ú').replace(/&Uacute;/gi, 'Ú')
    .replace(/&ntilde;/gi, 'ñ').replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&uuml;/gi,   'ü')
    .replace(/&amp;/gi,    '&')
    .replace(/&lt;/gi,     '<')
    .replace(/&gt;/gi,     '>')
    .replace(/&nbsp;/gi,   ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    // Eliminar todos los tags HTML
    .replace(/<[^>]+>/g, ' ')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────
//  PARSER LOTO PLUS
//
//  Texto limpio real (verificado 20/03/2026):
//  "Resultado Loto 3866 - Miércoles 18 de Marzo de 2026
//   Números del Loto 02 07 20 28 33 34 Jack1 4 Jack2
//   Números del Desquite 02 03 05 07 38 43 Jack1 Jack2
//   Números del Sale o sale 01 23 27 29 34 37
//   --- twitter facebook
//   Resultado Loto 3865 - Sábado 14 de Marzo de 2026 ..."
// ─────────────────────────────────────────────────────────────
function parsearLoto(texto) {
  if (!texto || texto.length < 50) return null;

  // Encontrar primer sorteo
  const mHead = texto.match(
    /Resultado Loto (\d+)\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i
  );
  if (!mHead) return null;

  const sorteo = mHead[1];
  const fecha  = capitalizar(mHead[2]);
  const iIni   = mHead.index + mHead[0].length;

  // Delimitar bloque: hasta "twitter" (que aparece tras el "---") o próximo sorteo
  const mFin = texto.slice(iIni).match(/twitter|Comparte|Resultado Loto \d{4}\b/i);
  const bloque = texto.slice(iIni, iIni + (mFin ? mFin.index : 600));

  // Extraer sección por etiqueta: captura los números que le siguen
  function extraerSeccion(etiqueta) {
    const re = new RegExp(etiqueta + '\\s*([\\d\\s]{5,60})', 'i');
    const m  = bloque.match(re);
    if (!m) return [];
    return m[1].trim().split(/\s+/)
      .filter(n => /^\d{2}$/.test(n) && parseInt(n) >= 0 && parseInt(n) <= 45);
  }

  const tradicional = extraerSeccion('Números del Loto');
  const desquite    = extraerSeccion('Números del Desquite');
  const saleOSale   = extraerSeccion('Números del Sale o sale');

  if (tradicional.length < 6) return null;

  // Jack (Número Plus): texto "Jack1 4 Jack2"
  const jackM = bloque.match(/Jack1\s+(\d)\s+Jack2/);

  return {
    sorteo,
    fecha,
    tradicional: tradicional.slice(0, 6),
    desquite:    desquite.slice(0, 6),
    saleOSale:   saleOSale.slice(0, 6),
    ...(jackM && { jack: jackM[1] }),
    fuente: 'quini6loto.com'
  };
}

// ─────────────────────────────────────────────────────────────
//  PARSER LOTO 5
//
//  Texto limpio real (verificado 20/03/2026):
//  "Resultado Loto 5 - Sábado 14 de Marzo de 2026
//   00 01 11 30 35
//   Comprobar Loto5 Lista de Premios ---
//   Resultado Loto 5 - Sábado 7 de Marzo de 2026 ..."
// ─────────────────────────────────────────────────────────────
function parsearLoto5(texto) {
  if (!texto || texto.length < 50) return null;

  const mHead = texto.match(
    /Resultado Loto 5\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i
  );
  if (!mHead) return null;

  const fecha = capitalizar(mHead[1]);
  const iIni  = mHead.index + mHead[0].length;

  // Fin del bloque: "Comprobar" o "---"
  const mFin = texto.slice(iIni).match(/Comprobar|---|Resultado Loto 5/i);
  const bloque = texto.slice(iIni, iIni + (mFin ? mFin.index : 200));

  // Loto 5: 5 números de 00 a 36
  const nums = bloque.trim().split(/\s+/)
    .filter(n => /^\d{2}$/.test(n) && parseInt(n) >= 0 && parseInt(n) <= 36);

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
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function ahoraAR() {
  return new Date(new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }));
}

function calcularSegsHastaProxSorteoLoto() {
  // Loto sortea miércoles (3) y sábados (6) a las 22:00hs
  const ahora      = ahoraAR();
  const diaActual  = ahora.getDay();
  const minActual  = ahora.getHours() * 60 + ahora.getMinutes();
  const CORTE      = 22 * 60 + 30; // 22:30hs

  let minDiff = Infinity;
  for (const dia of [3, 6]) {
    let offset = (dia - diaActual + 7) % 7;
    if (offset === 0 && minActual >= CORTE) offset = 7;
    const mins = offset * 24 * 60 + (CORTE - minActual);
    if (mins < minDiff) minDiff = mins;
  }

  return Math.max(minDiff * 60, 300); // mínimo 5 minutos
}
