/**
 * ============================================================
 *  /api/brinco.js  —  Vercel Serverless Function
 *  Agencia 204 · agencia204-api.vercel.app
 * ============================================================
 *
 *  CÓMO INSTALARLO:
 *  Subí este archivo como "brinco.js" en la carpeta /api/ de
 *  tu proyecto en GitHub. Vercel lo publica en:
 *  → agencia204-api.vercel.app/api/brinco
 *
 *  FUENTE PRINCIPAL (verificada y funcionando):
 *  http://brinco.ruta1000.com.ar/
 *
 *  FUENTE BACKUP:
 *  https://www.lanacion.com.ar/loterias/brinco/
 *
 *  VERIFICADO con datos reales:
 *  Sorteo 1345 · Domingo 15/03/2026
 *    Tradicional: 17 · 18 · 21 · 26 · 36 · 39
 *    Junior:      10 · 14 · 24 · 30 · 36 · 37
 *    Pozo:        $378.807.980
 *
 *  Sorteo 1343 · Domingo 01/03/2026
 *    Tradicional: 04 · 09 · 15 · 17 · 19 · 30
 *    Junior:      00 · 05 · 06 · 27 · 33 · 39
 *
 *  RESPUESTA JSON:
 *  {
 *    sorteo:      "1345",
 *    fecha:       "Domingo 15 de Marzo de 2026",
 *    tradicional: ["17","18","21","26","36","39"],
 *    junior:      ["10","14","24","30","36","37"],
 *    pozo:        "$378.807.980",
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

  // Intentar fuentes en orden de prioridad
  const resultado = await scrapeRuta1000()
                 || await scrapeLaNacion();

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
 * FUENTE PRINCIPAL: brinco.ruta1000.com.ar
 *
 * Estructura HTML verificada (ISO-8859-1):
 *
 * <b>Sorteo N° 1345 - SORTEADO HACE 5 DÍAS Domingo 15 de Marzo de 2026</b>
 * <b>BRINCO TRADICIONAL</b>
 * <td><b>17</b></td><td><b>18</b></td><td><b>21</b></td><td><b>26</b></td><td><b>36</b></td><td><b>39</b></td>
 * Vacante  378.807.980 $
 * <b>BRINCO JUNIORS</b>
 * <td><b>10</b></td><td><b>14</b></td><td><b>24</b></td><td><b>30</b></td><td><b>36</b></td><td><b>37</b></td>
 *
 * NOTAS:
 * - El sitio usa charset ISO-8859-1 → hay que hacer fetch como ArrayBuffer y decodificar
 * - Los números tienen siempre 2 dígitos en <td><b>NN</b></td>
 * - El primer bloque de 6 = Tradicional, el segundo = Junior
 * - El pozo aparece como "378.807.980 $" en la tabla de premios
 */
async function scrapeRuta1000() {
  try {
    // Fetch como ArrayBuffer para manejar correctamente ISO-8859-1
    const resp = await fetch('http://brinco.ruta1000.com.ar/', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!resp.ok) return null;

    // Decodificar ISO-8859-1 correctamente
    const buffer = await resp.arrayBuffer();
    const html   = new TextDecoder('iso-8859-1').decode(buffer);

    // ── Extraer números del PRIMER sorteo (el más reciente) ──
    // Patrón verificado: <td><b>17</b></td>
    // Solo tomamos el primer bloque del HTML (primer sorteo)
    // El separador entre sorteos es "BRINCO | RESULTADOS BRINCO DE ARGENTINA"
    const primerBloque = html.split('RESULTADOS BRINCO DE ARGENTINA')[1] || html;

    // Todos los números en <td><b>NN</b></td> del primer bloque
    const nums = [];
    const patronNum = /<td><b>(\d{2})<\/b><\/td>/gi;
    let m;
    while ((m = patronNum.exec(primerBloque)) !== null) {
      const n = parseInt(m[1]);
      // Validar rango Brinco: 00 al 39
      if (n >= 0 && n <= 39) {
        nums.push(m[1]);
      }
      // Parar después de 12 números (6 Tradicional + 6 Junior)
      if (nums.length >= 12) break;
    }

    if (nums.length < 6) return null;

    // ── Extraer número de sorteo ──
    const sorteoM = primerBloque.match(/Sorteo\s+N[°º\xba]?\s*(\d+)/i);

    // ── Extraer fecha ──
    const fechaM = primerBloque.match(
      /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i
    );

    // ── Extraer pozo (monto del premio mayor) ──
    // Formato: "378.807.980 $" en la tabla de premios del Tradicional
    const pozoM = primerBloque.match(/([\d]+(?:\.\d{3})+)\s*\$/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       fechaM  ? fechaM[1]  : hoy(),
      tradicional: nums.slice(0, 6),
      junior:      nums.slice(6, 12),
      pozo:        pozoM ? '$' + pozoM[1] : '—',
      fuente:      'ruta1000.com.ar'
    };

  } catch (e) {
    console.error('[brinco] ruta1000 error:', e.message);
    return null;
  }
}

/**
 * FUENTE BACKUP: lanacion.com.ar/loterias/brinco/
 *
 * Estructura verificada (texto plano del 01/03/2026):
 * "Domingo 01/03/2026 · 04 · 09 · 15 · 17 · 19 · 30 · Domingo 01/03/2026 · 00 · 05 · 06 · 27 · 33 · 39"
 *
 * Patrón: NOMBRE_DIA DD/MM/YYYY · N · N · N · N · N · N
 */
async function scrapeLaNacion() {
  try {
    const resp = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
      headers: UA,
      signal: AbortSignal.timeout(9000)
    });
    if (!resp.ok) return null;

    const html = await resp.text();

    // Patrón verificado con datos reales
    const patronGrupo = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2}\/\d{2}\/\d{4})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})\s*·\s*(\d{2})/gi;

    const grupos = [];
    let m;
    while ((m = patronGrupo.exec(html)) !== null) {
      const nums = [m[2], m[3], m[4], m[5], m[6], m[7]];
      // Validar rango 00-39
      const validos = nums.filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);
      if (validos.length === 6) {
        grupos.push({ fecha: m[1], nums: validos });
      }
    }

    if (grupos.length === 0) return null;

    const sorteoM = html.match(/[Ss]orteo\s*(?:N[°º]?\s*)?(\d{3,4})/);

    return {
      sorteo:      sorteoM ? sorteoM[1] : '—',
      fecha:       grupos[0]?.fecha || '—',
      tradicional: grupos[0]?.nums  || [],
      junior:      grupos[1]?.nums  || [],
      pozo:        '—',
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
