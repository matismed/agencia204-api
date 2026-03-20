/**
 * ============================================================
 *  /api/brinco.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  CÓMO INSTALARLO:
 *  Subí este archivo como "brinco.js" dentro de la carpeta /api/
 *  de tu proyecto en GitHub. Vercel lo publica automáticamente en:
 *  → agencia204-api.vercel.app/api/brinco
 *
 *  VERIFICADO con datos reales del 01/03/2026 (Sorteo 1343):
 *  Tradicional: 04 · 09 · 15 · 17 · 19 · 30
 *  Junior:      00 · 05 · 06 · 27 · 33 · 39
 *
 *  RESPUESTA JSON:
 *  {
 *    sorteo:      "1343",
 *    fecha:       "Domingo 01/03/2026",
 *    tradicional: ["04","09","15","17","19","30"],
 *    junior:      ["00","05","06","27","33","39"],
 *    fuente:      "lanacion.com.ar",
 *    actualizado: "21:05:00"
 *  }
 *
 *  DATOS DEL JUEGO:
 *  - Sorteos: domingos a las 21:00hs
 *  - Números: 6 del 00 al 39
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

  const resultado = await scrapeLaNacionBrinco()
                 || await scrapeLoteriaSantaFe();

  if (resultado) {
    resultado.actualizado = ahora;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
    sugerencia: 'El sorteo es los domingos a las 21:00hs. Si es antes del sorteo, los datos aún no están disponibles.',
    actualizado: ahora
  });
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
};

/**
 * FUENTE PRINCIPAL: lanacion.com.ar/loterias/brinco/
 *
 * Estructura HTML verificada (texto plano del 01/03/2026):
 * "Domingo 01/03/2026 · 04 · 09 · 15 · 17 · 19 · 30 · Domingo 01/03/2026 · 00 · 05 · 06 · 27 · 33 · 39"
 *
 * Patrón: NOMBRE_DIA DD/MM/YYYY · N · N · N · N · N · N
 * 1er grupo = Brinco Tradicional (00-39)
 * 2do grupo = Brinco Junior (00-39)
 */
async function scrapeLaNacionBrinco() {
  try {
    const r = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) return null;

    const html = await r.text();

    // Patrón verificado con datos reales del 01/03/2026
    // "Domingo 01/03/2026 · 04 · 09 · 15 · 17 · 19 · 30"
    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const fecha = m[1];
      const nums  = [m[2], m[3], m[4], m[5], m[6], m[7]];
      // Brinco: rango 00 al 39
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);
      if (validos.length === 6) {
        grupos.push({ fecha, nums: validos });
      }
    }

    if (grupos.length === 0) return null;

    // Extraer número de sorteo del título o texto
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

/**
 * FUENTE BACKUP: loteriasantafe.gov.ar/index.php/resultados/brinco
 * Mismo patrón de números separados por ·
 */
async function scrapeLoteriaSantaFe() {
  try {
    const r = await fetch('https://www.loteriasantafe.gov.ar/index.php/resultados/brinco', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) return null;

    const html = await r.text();

    // Intento 1: patrón con nombre del día (mismo que La Nacion)
    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const nums = [m[2], m[3], m[4], m[5], m[6], m[7]];
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);
      if (validos.length === 6) grupos.push({ fecha: m[1], nums: validos });
    }

    // Intento 2: patrón solo numérico si el sitio usa otro formato
    if (grupos.length === 0) {
      const patronNumerico = /(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/g;
      while ((m = patronNumerico.exec(html)) !== null) {
        const nums = [m[1], m[2], m[3], m[4], m[5], m[6]];
        const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);
        if (validos.length === 6) grupos.push({ fecha: hoy(), nums: validos });
      }
    }

    if (grupos.length === 0) return null;

    const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       grupos[0]?.fecha || hoy(),
      tradicional: grupos[0]?.nums  || [],
      junior:      grupos[1]?.nums  || [],
      fuente:      'loteriasantafe.gov.ar'
    };

  } catch (e) {
    console.error('[brinco] loteriasantafe error:', e.message);
    return null;
  }
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
