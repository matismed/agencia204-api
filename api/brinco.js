/**
 * /api/brinco.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * BUG CORREGIDO: el "-" en URLs como "2026-03-15" se interpretaba
 * como separador de lista y capturaba "03" y "15" como números del sorteo.
 * Solución: usar <li>NN</li> como extractor principal (sin riesgo),
 * y "* NN" anclado a línea completa como fallback.
 *
 * LÓGICA SEMANAL:
 *  - Sortea los DOMINGOS a las 21:00hs AR
 *  - El cache expira el próximo domingo a las 21:30hs → se auto-actualiza
 *  - La fecha mostrada es SIEMPRE la del domingo del sorteo
 *
 * DATOS VERIFICADOS (20/03/2026):
 *  Sorteo 1345 · Domingo 15 de Marzo de 2026
 *  Tradicional: 17 · 18 · 21 · 26 · 36 · 39  ✅
 *  Junior:      10 · 14 · 24 · 30 · 36 · 37  ✅
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Cache hasta el próximo domingo 21:30hs AR
  const segsCache = calcularSegsHastaProxSorteo();
  res.setHeader('Cache-Control', `s-maxage=${segsCache}, stale-while-revalidate=3600`);

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // ── Fuente 1: nacionalloteria.com (HTTPS, HTML estático) ──
  let resultado = await intentar('nacionalloteria', async () => {
    const r = await fetch('https://www.nacionalloteria.com/argentina/brinco.php', {
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
    return parsearNacionalLoteria(html);
  }, debug);

  // ── Fuente 2: tujugada.com.ar (HTTPS, backup) ─────────────
  if (!resultado) {
    resultado = await intentar('tujugada', async () => {
      const r = await fetch('https://www.tujugada.com.ar/brinco.asp', {
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
          'Accept':          'text/html',
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
    resultado.debug       = debug;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error:       true,
    mensaje:     'No se pudo obtener el resultado del Brinco',
    sugerencia:  'El sorteo es los domingos a las 21:00hs.',
    debug,
    actualizado: ahora
  });
}

// ─────────────────────────────────────────────────────────────
//  PARSER NACIONAL LOTERIA
//  URL: nacionalloteria.com/argentina/brinco.php
//
//  HTML crudo real:
//    Resultados del Brinco 1345<a href="...del-dia=2026-03-15#lista">Lista...</a>
//    <ul><li>17</li><li>18</li><li>21</li><li>26</li><li>36</li><li>39</li></ul>
//    Resultados del Brinco Junior 1345
//    <ul><li>10</li><li>14</li><li>24</li><li>30</li><li>36</li><li>37</li></ul>
//
//  BUG ANTERIOR: [*\-•]\s*(\d{1,2}) capturaba "03" y "15" del URL "2026-03-15"
//  FIX: usar <li>NN</li> como extractor principal (el "-" no aparece en <li>)
// ─────────────────────────────────────────────────────────────
function parsearNacionalLoteria(html) {
  if (!html || html.length < 200) return null;

  // Primer sorteo (más reciente): "Resultados del Brinco 1345"
  const mTrad = html.match(/Resultados del Brinco (\d+)/);
  if (!mTrad) return null;

  const sorteo  = mTrad[1];
  const iTrad   = html.indexOf(mTrad[0]);
  const textoJr = 'Resultados del Brinco Junior ' + sorteo;
  const iJr     = html.indexOf(textoJr, iTrad);
  if (iJr === -1) return null;

  // Delimitador fin del Junior: primer "---" o +400 chars
  const iSep = html.indexOf('---', iJr);
  const iEnd = iSep > iJr ? iSep : iJr + 400;

  const bloqueTrad = html.slice(iTrad, iJr);
  const bloqueJr   = html.slice(iJr + textoJr.length, iEnd);

  const numsTrad = extraerNumeros(bloqueTrad);
  const numsJr   = extraerNumeros(bloqueJr);

  if (numsTrad.length < 6) return null;

  // Fecha del sorteo: del texto "Brinco 1345 - Domingo 15 de Marzo de 2026"
  const fechaTxt = html.match(
    new RegExp(
      'Brinco\\s+' + sorteo + '\\s*[-–]\\s*' +
      '((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)' +
      '\\s+\\d+\\s+de\\s+\\w+\\s+de\\s+\\d{4})',
      'i'
    )
  );

  // Fallback: URL ?del-dia=2026-03-15
  const fechaURL = html.match(/del-dia[=](\d{4}-\d{2}-\d{2})/);

  let fechaSorteo;
  if (fechaTxt) {
    const f = fechaTxt[1].trim();
    fechaSorteo = f.charAt(0).toUpperCase() + f.slice(1);
  } else if (fechaURL) {
    fechaSorteo = formatearFechaISO(fechaURL[1]);
  } else {
    fechaSorteo = fechaUltimoDomingo();
  }

  return {
    sorteo,
    fecha:       fechaSorteo,
    tradicional: numsTrad.slice(0, 6),
    junior:      numsJr.slice(0, 6),
    proximo:     fechaProximoDomingo(),
    fuente:      'nacionalloteria.com'
  };
}

// ─────────────────────────────────────────────────────────────
//  PARSER TUJUGADA (backup)
// ─────────────────────────────────────────────────────────────
function parsearTuJugada(html) {
  if (!html || html.length < 200) return null;

  const mSorteo = html.match(/BRINCO\s+SORTEO\s+(\d+)\s+del[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!mSorteo) return null;

  const sorteo  = mSorteo[1];
  const iInicio = html.indexOf(mSorteo[0]);
  const mNext   = html.slice(iInicio + 10).match(
    new RegExp('BRINCO\\s+SORTEO\\s+(?!' + sorteo + ')\\d+', 'i')
  );
  const iNext  = mNext
    ? iInicio + 10 + html.slice(iInicio + 10).indexOf(mNext[0])
    : html.length;
  const bloque = html.slice(iInicio, iNext);

  const reNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const nums  = [];
  let m;
  while ((m = reNum.exec(bloque)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 39) nums.push(String(n).padStart(2, '0'));
    if (nums.length >= 12) break;
  }

  if (nums.length < 6) return null;

  const partes = mSorteo[2].split('/');
  const d = parseInt(partes[0]), mo = parseInt(partes[1]), y = parseInt(partes[2]);
  const dt = new Date(y, mo - 1, d);
  const fechaSorteo = `${DIAS[dt.getDay()]} ${d} de ${MESES[mo]} de ${y}`;

  return {
    sorteo,
    fecha:       fechaSorteo,
    tradicional: nums.slice(0, 6),
    junior:      nums.slice(6, 12),
    proximo:     fechaProximoDomingo(),
    fuente:      'tujugada.com.ar'
  };
}

// ─────────────────────────────────────────────────────────────
//  EXTRACTOR DE NÚMEROS — CORREGIDO
//
//  Prioridad 1: <li>NN</li>  → el "-" de URLs nunca aparece aquí ✅
//  Prioridad 2: líneas "* NN" ancladas a línea completa (markdown)
//               NO incluye "-" como separador → no captura "03" del "2026-03-15"
// ─────────────────────────────────────────────────────────────
function extraerNumeros(bloque) {
  // Intento 1: <li>NN</li> (HTML crudo del servidor)
  const liMatches = [...bloque.matchAll(/<li[^>]*>[ \t]*(\d{1,2})[ \t]*<\/li>/gi)];
  if (liMatches.length >= 6) {
    return liMatches
      .map(m => m[1])
      .filter(n => parseInt(n) >= 0 && parseInt(n) <= 39)
      .map(n => String(parseInt(n)).padStart(2, '0'));
  }

  // Intento 2: líneas "* NN" ancladas — SOLO asterisco como marcador (NO guión)
  // Regex: inicio de línea + espacios + "*" + espacio + 1-2 dígitos + fin de línea
  // Esto NO captura "2026-03-15" ni "Lista de Premios"
  const mdMatches = [...bloque.matchAll(/^[ \t]*\*[ \t]+(\d{1,2})[ \t]*$/gm)];
  return mdMatches
    .map(m => m[1])
    .filter(n => parseInt(n) >= 0 && parseInt(n) <= 39)
    .map(n => String(parseInt(n)).padStart(2, '0'));
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function ahoraAR() {
  return new Date(new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }));
}

function formatearFechaISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m]} de ${y}`;
}

function fechaUltimoDomingo() {
  const ahora  = ahoraAR();
  const dia    = ahora.getDay();
  const yaSorteo = dia === 0 && ahora.getHours() >= 22;
  const offset = yaSorteo ? 0 : (dia === 0 ? 7 : dia);
  const dom    = new Date(ahora);
  dom.setDate(ahora.getDate() - offset);
  return `${DIAS[0]} ${dom.getDate()} de ${MESES[dom.getMonth() + 1]} de ${dom.getFullYear()}`;
}

function fechaProximoDomingo() {
  const ahora  = ahoraAR();
  const dia    = ahora.getDay();
  const offset = dia === 0 ? 7 : (7 - dia);
  const dom    = new Date(ahora);
  dom.setDate(ahora.getDate() + offset);
  return `${DIAS[0]} ${dom.getDate()} de ${MESES[dom.getMonth() + 1]} de ${dom.getFullYear()}`;
}

function calcularSegsHastaProxSorteo() {
  const ahora  = ahoraAR();
  const dia    = ahora.getDay();
  const offset = dia === 0 ? 7 : (7 - dia);
  const dom    = new Date(ahora);
  dom.setDate(ahora.getDate() + offset);
  dom.setHours(21, 30, 0, 0);
  return Math.max(Math.floor((dom - ahora) / 1000), 300);
}

async function intentar(nombre, fn, debugArr) {
  try {
    const r = await fn();
    if (r) { debugArr.push({ fuente: nombre, estado: 'OK' }); return r; }
    debugArr.push({ fuente: nombre, estado: 'sin datos' });
    return null;
  } catch (e) {
    debugArr.push({ fuente: nombre, estado: 'error', mensaje: e.message });
    return null;
  }
}
