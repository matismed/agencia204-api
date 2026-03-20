/**
 * /api/brinco.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * RESPUESTA JSON:
 * {
 *   sorteo:      "1345",
 *   fecha:       "Domingo 15 de Marzo de 2026",
 *   tradicional: ["17","18","21","26","36","39"],
 *   junior:      ["10","14","24","30","36","37"],
 *   fuente:      "ruta1000.com.ar",
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

  // Intentar todas las fuentes con log de diagnóstico
  const debug = [];

  // ── FUENTE 1: ruta1000 directo (Vercel SÍ puede hacer fetch a http://) ──
  let resultado = await intentar('ruta1000-directo', async () => {
    const r = await fetch('http://brinco.ruta1000.com.ar/', {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    return parsearRuta1000(html);
  }, debug);

  // ── FUENTE 2: ruta1000 vía allorigins ──
  if (!resultado) {
    resultado = await intentar('ruta1000-allorigins', async () => {
      const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('http://brinco.ruta1000.com.ar/');
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124' },
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      if (!json.contents) throw new Error('allorigins sin contents');
      return parsearRuta1000(json.contents);
    }, debug);
  }

  // ── FUENTE 3: corsproxy.io → ruta1000 ──
  if (!resultado) {
    resultado = await intentar('ruta1000-corsproxy', async () => {
      const url = 'https://corsproxy.io/?' + encodeURIComponent('http://brinco.ruta1000.com.ar/');
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124' },
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return parsearRuta1000(html);
    }, debug);
  }

  // ── FUENTE 4: La Nación (siempre HTTPS, confiable) ──
  if (!resultado) {
    resultado = await intentar('lanacion', async () => {
      const r = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept-Language': 'es-AR' },
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return parsearLaNacion(html);
    }, debug);
  }

  if (resultado) {
    resultado.actualizado = ahora;
    resultado.debug = debug; // ← podés ver qué fuente funcionó/falló
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
    debug,  // ← mirá esto en el JSON para ver qué falló exactamente
    actualizado: ahora
  });
}

// ── Wrapper con catch y log ───────────────────────────────
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

// ── Parser para ruta1000.com.ar ───────────────────────────
// HTML verificado: <td>\n<b>17</b>\n</td> (con saltos de línea)
// Sorteo Nº 1345 · Domingo 15 de Marzo de 2026
function parsearRuta1000(html) {
  if (!html || html.length < 200) return null;

  // Tomar solo el primer sorteo (más reciente)
  // Separador entre sorteos: "RESULTADOS BRINCO DE ARGENTINA"
  const bloques = html.split('RESULTADOS BRINCO DE ARGENTINA');
  const bloque  = bloques.length > 1 ? bloques[1] : html;

  // Extraer números: patrón flexible para <td><b>17</b></td>
  // con o sin espacios y saltos de línea
  const patronNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const nums = [];
  let m;
  while ((m = patronNum.exec(bloque)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 39) nums.push(pad(n));
    if (nums.length >= 12) break;
  }

  if (nums.length < 6) return null;

  // Número de sorteo (el º puede aparecer como °, º, o \xba en latin-1)
  const sorteoM = bloque.match(/Sorteo\s+N[°º\xba]?\s*(\d+)/i);

  // Fecha: "Domingo 15 de Marzo de 2026"
  const fechaM = bloque.match(
    /((?:lunes|martes|mi(?:é|e)rcoles|jueves|viernes|s(?:á|a)bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i
  );

  return {
    sorteo:      sorteoM ? sorteoM[1] : '—',
    fecha:       fechaM  ? fechaM[1]  : hoy(),
    tradicional: nums.slice(0, 6),
    junior:      nums.slice(6, 12),
    fuente:      'ruta1000.com.ar'
  };
}

// ── Parser para lanacion.com.ar ───────────────────────────
// HTML verificado: "Domingo 01/03/2026 · 04 · 09 · 15 · 17 · 19 · 30"
function parsearLaNacion(html) {
  if (!html) return null;

  const pat = /(?:lunes|martes|mi(?:é|e)rcoles|jueves|viernes|s(?:á|a)bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

  const grupos = [];
  let m;
  while ((m = pat.exec(html)) !== null) {
    const nums = [m[2], m[3], m[4], m[5], m[6], m[7]];
    const validos = nums.filter(n => +n >= 0 && +n <= 39);
    if (validos.length === 6) grupos.push({ fecha: m[1], nums: validos });
  }

  if (!grupos.length) return null;

  const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

  return {
    sorteo:      sorteoM ? sorteoM[1] : '—',
    fecha:       grupos[0].fecha,
    tradicional: grupos[0].nums,
    junior:      grupos[1]?.nums || [],
    fuente:      'lanacion.com.ar'
  };
}

function pad(n) { return String(n).padStart(2, '0'); }

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
