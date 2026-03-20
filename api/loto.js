/**
 * ============================================================
 *  /api/loto.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  CÓMO INSTALARLO:
 *  Subí este archivo como "loto.js" dentro de la carpeta /api/
 *  de tu proyecto en GitHub. Vercel lo publica automáticamente en:
 *  → agencia204-api.vercel.app/api/loto
 *
 *  VERIFICADO con datos reales del 11/03/2026 (Sorteo 3864):
 *  Tradicional: 14 · 15 · 26 · 34 · 39 · 45
 *  Desquite:    00 · 01 · 04 · 08 · 16 · 45
 *  Poceada:     14 · 17 · 21 · 27 · 43 · 44
 *  Sale o Sale: 02 · 07 · 20 · 32 · 39 · 40
 *
 *  RESPUESTA JSON:
 *  {
 *    sorteo:      "3864",
 *    fecha:       "Miércoles 11/03/2026",
 *    tradicional: ["14","15","26","34","39","45"],
 *    desquite:    ["00","01","04","08","16","45"],
 *    poceada:     ["14","17","21","27","43","44"],
 *    saleOSale:   ["02","07","20","32","39","40"],
 *    fuente:      "lanacion.com.ar",
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

  // Intentar fuentes en orden
  const resultado = await scrapeLaNacionLoto()
                 || await scrapeLoteriaSantaFe();

  if (resultado) {
    resultado.actualizado = ahora;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Loto',
    sugerencia: 'El sorteo es los miércoles y sábados a las 22:00hs. Si es antes del sorteo, los datos aún no están disponibles.',
    actualizado: ahora
  });
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
};

/**
 * FUENTE PRINCIPAL: lanacion.com.ar/loterias/loto/
 *
 * Estructura HTML verificada (texto plano):
 * "Miércoles 11/03/2026 · 14 · 15 · 26 · 34 · 39 · 45 · Miércoles 11/03/2026 · ..."
 *
 * El patrón exacto es: NOMBRE_DIA DD/MM/YYYY · N · N · N · N · N · N
 * con 4 grupos correspondientes a: Tradicional, Desquite, Poceada, Sale o Sale
 */
async function scrapeLaNacionLoto() {
  try {
    const r = await fetch('https://www.lanacion.com.ar/loterias/loto/', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) return null;

    const html = await r.text();

    // Patrón verificado con datos reales:
    // "Miércoles 11/03/2026 · 14 · 15 · 26 · 34 · 39 · 45"
    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const fecha = m[1];
      const nums  = [m[2], m[3], m[4], m[5], m[6], m[7]];
      // Validar rango Loto: 00 al 45
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 45);
      if (validos.length === 6) {
        grupos.push({ fecha, nums: validos });
      }
    }

    if (grupos.length === 0) return null;

    // Extraer número de sorteo
    const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       grupos[0]?.fecha || '—',
      tradicional: grupos[0]?.nums  || [],
      desquite:    grupos[1]?.nums  || [],
      poceada:     grupos[2]?.nums  || [],
      saleOSale:   grupos[3]?.nums  || [],
      fuente:      'lanacion.com.ar'
    };

  } catch (e) {
    console.error('[loto] lanacion error:', e.message);
    return null;
  }
}

/**
 * FUENTE BACKUP: loteriasantafe.gov.ar
 * Mismo patrón de números separados por ·
 */
async function scrapeLoteriaSantaFe() {
  try {
    const r = await fetch('https://www.loteriasantafe.gov.ar/index.php/resultados/loto', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) return null;

    const html = await r.text();

    // Buscar el mismo patrón que en La Nacion
    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const nums = [m[2], m[3], m[4], m[5], m[6], m[7]];
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 45);
      if (validos.length === 6) grupos.push({ fecha: m[1], nums: validos });
    }

    // Si no encontró con día, intentar solo con el patrón numérico puro
    if (grupos.length === 0) {
      const patronNumerico = /(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/g;
      while ((m = patronNumerico.exec(html)) !== null) {
        const nums = [m[1], m[2], m[3], m[4], m[5], m[6]];
        const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 45);
        if (validos.length === 6) grupos.push({ fecha: hoy(), nums: validos });
      }
    }

    if (grupos.length === 0) return null;

    const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       grupos[0]?.fecha || hoy(),
      tradicional: grupos[0]?.nums  || [],
      desquite:    grupos[1]?.nums  || [],
      poceada:     grupos[2]?.nums  || [],
      saleOSale:   grupos[3]?.nums  || [],
      fuente:      'loteriasantafe.gov.ar'
    };

  } catch (e) {
    console.error('[loto] loteriasantafe error:', e.message);
    return null;
  }
}

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
