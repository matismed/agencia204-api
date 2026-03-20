/**
 * ============================================================
 *  /api/brinco.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  FUENTE: brinco.ruta1000.com.ar (vía proxy allorigins.win)
 *
 *  POR QUÉ EL PROXY:
 *  ruta1000 usa http:// sin SSL. Vercel bloquea requests
 *  salientes a HTTP puro. allorigins.win actúa de intermediario
 *  HTTPS y devuelve el HTML dentro de json.contents.
 *
 *  RESPUESTA JSON:
 *  {
 *    sorteo:      "1345",
 *    fecha:       "Domingo 15 de Marzo de 2026",
 *    tradicional: ["17","18","21","26","36","39"],
 *    junior:      ["10","14","24","30","36","37"],
 *    fuente:      "ruta1000.com.ar",
 *    actualizado: "21:05:00"
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

  const resultado = await scrapeRuta1000()
                 || await scrapeLaNacion();

  if (resultado) {
    resultado.actualizado = ahora;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
    sugerencia: 'El sorteo es los domingos a las 21:00hs.',
    actualizado: ahora
  });
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9'
};

// ── FUENTE PRINCIPAL: ruta1000 vía proxy allorigins ───────
async function scrapeRuta1000() {
  try {
    // Vercel bloquea HTTP puro → usamos allorigins.win como proxy HTTPS
    const proxyUrl = 'https://api.allorigins.win/get?url='
      + encodeURIComponent('http://brinco.ruta1000.com.ar/');

    const resp = await fetch(proxyUrl, {
      headers: UA,
      signal: AbortSignal.timeout(12000)
    });
    if (!resp.ok) return null;

    const json = await resp.json();
    const html = json.contents;
    if (!html || html.length < 100) return null;

    // Tomar solo el PRIMER bloque (sorteo más reciente)
    // Los bloques están separados por "RESULTADOS BRINCO DE ARGENTINA"
    const bloques = html.split('RESULTADOS BRINCO DE ARGENTINA');
    const bloque  = bloques[1] || html;

    // Extraer números: <td><b>17</b></td>  (con posibles espacios/saltos)
    // Patrón flexible verificado con HTML real de ruta1000
    const patronNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
    const nums = [];
    let m;
    while ((m = patronNum.exec(bloque)) !== null) {
      const n = parseInt(m[1]);
      if (n >= 0 && n <= 39) {          // rango válido del Brinco
        nums.push(String(n).padStart(2, '0'));
      }
      if (nums.length >= 12) break;     // 6 Tradicional + 6 Junior
    }

    if (nums.length < 6) return null;

    // Número de sorteo: "Sorteo Nº 1345" (el º puede venir como \xba en latin-1)
    const sorteoM = bloque.match(/Sorteo\s+N[°º\xba]?\s*(\d+)/i);

    // Fecha: "Domingo 15 de Marzo de 2026"
    const fechaM = bloque.match(
      /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i
    );

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       fechaM  ? fechaM[1]  : hoy(),
      tradicional: nums.slice(0, 6),
      junior:      nums.slice(6, 12),
      fuente:      'ruta1000.com.ar'
    };

  } catch (e) {
    console.error('[brinco] ruta1000 error:', e.message);
    return null;
  }
}

// ── FUENTE BACKUP: lanacion.com.ar ────────────────────────
// Patrón verificado: "Domingo 01/03/2026 · 04 · 09 · 15 · 17 · 19 · 30"
async function scrapeLaNacion() {
  try {
    const resp = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!resp.ok) return null;

    const html = await resp.text();

    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const nums = [m[2], m[3], m[4], m[5], m[6], m[7]];
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);
      if (validos.length === 6) grupos.push({ fecha: m[1], nums: validos });
    }

    if (grupos.length === 0) return null;

    const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       grupos[0]?.fecha || '—',
      tradicional: grupos[0]?.nums  || [],
      junior:      grupos[1]?.nums  || [],
      fuente:      'lanacion.com.ar'
    };

  } catch (e) {
    console.error('[brinco] lanacion error:', e.message);
    return null;
  }
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
