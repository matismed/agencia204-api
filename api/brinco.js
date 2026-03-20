/**
 * /api/brinco.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * LÓGICA:
 *  - El Brinco sortea los DOMINGOS a las 21:00hs
 *  - Los datos se obtienen de nacionalloteria.com (HTTPS, HTML estático)
 *  - Se cachean hasta el PRÓXIMO DOMINGO después de las 21:30hs
 *  - La fecha mostrada es SIEMPRE la del domingo del sorteo (no la de hoy)
 *
 * DATOS CORRECTOS (verificados 20/03/2026):
 *  Sorteo 1345 · Domingo 15 de Marzo de 2026
 *  Tradicional: 17 · 18 · 21 · 26 · 36 · 39
 *  Junior:      10 · 14 · 24 · 30 · 36 · 37
 *
 * RESPUESTA JSON:
 * {
 *   sorteo:      "1345",
 *   fecha:       "Domingo 15 de Marzo de 2026",
 *   tradicional: ["17","18","21","26","36","39"],
 *   junior:      ["10","14","24","30","36","37"],
 *   proximo:     "Domingo 22 de Marzo de 2026",
 *   fuente:      "nacionalloteria.com",
 *   actualizado: "21:05:00"
 * }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── Cache dinámico: expira el próximo domingo a las 21:30hs AR ──
  // Así Vercel sirve los mismos datos toda la semana sin re-scrapear
  const segundosHastaProxDomingo = calcularSegsHastaProxSorteo();
  res.setHeader('Cache-Control',
    `s-maxage=${segundosHastaProxDomingo}, stale-while-revalidate=3600`
  );

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // ── Fuente 1: nacionalloteria.com ─────────────────────────
  let resultado = await intentar('nacionalloteria', async () => {
    const r = await fetch('https://www.nacionalloteria.com/argentina/brinco.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
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

  // ── Fuente 2: tujugada.com.ar ──────────────────────────────
  if (!resultado) {
    resultado = await intentar('tujugada', async () => {
      const r = await fetch('https://www.tujugada.com.ar/brinco.asp', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
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
    error:     true,
    mensaje:   'No se pudo obtener el resultado del Brinco',
    sugerencia:'El sorteo es los domingos a las 21:00hs.',
    debug,
    actualizado: ahora
  });
}

// ─────────────────────────────────────────────────────────────
//  PARSER NACIONAL LOTERIA
//
//  HTML real (UTF-8, HTTPS, verificado 20/03/2026):
//
//  # Brinco 1345 - Domingo 15 de Marzo de 2026
//  Resultados del Brinco 1345Lista de Premios
//  * 17
//  * 18
//  * 21
//  * 26
//  * 36
//  * 39
//  Resultados del Brinco Junior 1345
//  * 10
//  * 14
//  ...
// ─────────────────────────────────────────────────────────────
function parsearNacionalLoteria(html) {
  if (!html || html.length < 200) return null;

  // Encontrar el primer bloque (sorteo más reciente)
  const mTrad = html.match(/Resultados del Brinco (\d+)/);
  if (!mTrad) return null;

  const sorteo  = mTrad[1];
  const iTrad   = html.indexOf(mTrad[0]);
  const textoJr = 'Resultados del Brinco Junior ' + sorteo;
  const iJr     = html.indexOf(textoJr, iTrad);
  if (iJr === -1) return null;

  // Fin del bloque Junior: primer "---" o próximo sorteo
  const iSep = html.indexOf('---', iJr);
  const iEnd = iSep > iJr ? iSep : iJr + 300;

  const bloqueTrad = html.slice(iTrad, iJr);
  const bloqueJr   = html.slice(iJr + textoJr.length, iEnd);

  // Extraer números de listas "* NN" o "<li>NN</li>"
  const extraer = (bloque) =>
    [...bloque.matchAll(/[*\-•]\s*(\d{1,2})\b|<li[^>]*>\s*(\d{1,2})\s*<\/li>/g)]
      .map(m => m[1] ?? m[2])
      .filter(n => n !== undefined && parseInt(n) >= 0 && parseInt(n) <= 39)
      .map(n => String(parseInt(n)).padStart(2, '0'));

  const numsTrad = extraer(bloqueTrad);
  const numsJr   = extraer(bloqueJr);

  if (numsTrad.length < 6) return null;

  // ── FECHA: siempre del domingo del sorteo, nunca de hoy ──
  // Estrategia 1: texto "Brinco 1345 - Domingo 15 de Marzo de 2026"
  const fechaTxt = html.match(
    new RegExp(
      'Brinco\\s+' + sorteo + '\\s*[-–]\\s*' +
      '((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)' +
      '\\s+\\d+\\s+de\\s+\\w+\\s+de\\s+\\d{4})',
      'i'
    )
  );

  // Estrategia 2: URL ?del-dia=2026-03-15 → formatear
  const fechaURL = html.match(/del-dia[=\-](\d{4}-\d{2}-\d{2})/);

  let fechaSorteo;
  if (fechaTxt) {
    fechaSorteo = fechaTxt[1];
    // Capitalizar primera letra
    fechaSorteo = fechaSorteo.charAt(0).toUpperCase() + fechaSorteo.slice(1);
  } else if (fechaURL) {
    fechaSorteo = formatearFechaISO(fechaURL[1]);
  } else {
    // Fallback: calcular el último domingo sorteado
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
  const mNext   = html.slice(iInicio + 1).match(
    new RegExp('BRINCO\\s+SORTEO\\s+(?!' + sorteo + ')\\d+', 'i')
  );
  const iNext  = mNext ? iInicio + 1 + html.slice(iInicio + 1).indexOf(mNext[0]) : html.length;
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

  // Fecha desde DD/MM/YYYY
  const fechaPartes = mSorteo[2].split('/');
  const d = parseInt(fechaPartes[0]);
  const mo = parseInt(fechaPartes[1]);
  const y  = parseInt(fechaPartes[2]);
  const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dt = new Date(y, mo - 1, d);
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
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
//  UTILIDADES DE FECHA
// ─────────────────────────────────────────────────────────────

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function ahoraAR() {
  // Devuelve un Date con la hora de Argentina (UTC-3)
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
}

function formatearFechaISO(iso) {
  // "2026-03-15" → "Domingo 15 de Marzo de 2026"
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m]} de ${y}`;
}

function fechaUltimoDomingo() {
  const ahora = ahoraAR();
  const dia   = ahora.getDay(); // 0=domingo
  // Si hoy es domingo Y ya pasaron las 21:30 = hoy es el sorteo
  // Si hoy es domingo Y no pasaron las 21:30 = el domingo pasado
  const esHoy = dia === 0 && ahora.getHours() >= 22;
  const offset = esHoy ? 0 : (dia === 0 ? 7 : dia);
  const dom = new Date(ahora);
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
  // Calcula cuántos segundos faltan hasta el próximo domingo 21:30hs AR
  // Esto le dice a Vercel cuánto cachear la respuesta
  const ahora  = ahoraAR();
  const dom    = new Date(ahora);
  const dia    = ahora.getDay();
  const offset = dia === 0 ? 7 : (7 - dia);
  dom.setDate(ahora.getDate() + offset);
  dom.setHours(21, 30, 0, 0);

  const segs = Math.max(Math.floor((dom - ahora) / 1000), 300);
  return segs; // mínimo 5 minutos, máximo ~7 días
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
