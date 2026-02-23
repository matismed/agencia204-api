// api/quini6.js — Vercel Serverless Function
// Parser robusto para quini-6-resultados.com.ar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  const result = {
    sorteo:       '',
    fecha:        '',
    tradicional:  [],
    segunda:      [],
    revancha:     [],
    siempreSale:  [],
    pozoPróximo:  '',
    fechaProximo: '',
    actualizado:  new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
  };

  try {
    const response = await fetch('https://www.quini-6-resultados.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.com/',
      },
    });

    const html = await response.text();

    // ── Extraer sorteo y fecha ──────────────────────────
    // Busca en texto plano: "Sorteo del dia 22/02/2026  Nro. Sorteo: 3350"
    const mSorteo = html.match(/Sorteo del dia[^<]*?(\d{2}\/\d{2}\/\d{4})[^<]*?Nro\.?\s*Sorteo:?\s*(\d+)/i);
    if (mSorteo) {
      result.fecha  = mSorteo[1];
      result.sorteo = mSorteo[2];
    }

    // ── Función: extrae números "00 - 05 - 27 - 36 - 39 - 45" ──
    function extractNums(str) {
      const matches = [...str.matchAll(/\b(\d{1,2})\b/g)];
      return matches
        .map(m => m[1].padStart(2, '0'))
        .filter(n => parseInt(n) <= 45)
        .slice(0, 6);
    }

    // ── Estrategia 1: buscar patrón de tabla markdown/text ──
    // El sitio renderiza como: TRADICIONAL \n 00 - 05 - 27 - 36 - 39 - 45
    const texto = html.replace(/<[^>]+>/g, '\n').replace(/&[a-z]+;/gi, ' ');

    const bloques = {
      tradicional: /TRADICIONAL\s*\n+([0-9\s\-]+)/i,
      segunda:     /LA SEGUNDA\s*\n+([0-9\s\-]+)/i,
      revancha:    /REVANCHA\s*\n+([0-9\s\-]+)/i,
      siempreSale: /SIEMPRE SALE\s*\n+([0-9\s\-]+)/i,
    };

    for (const [key, regex] of Object.entries(bloques)) {
      const m = texto.match(regex);
      if (m) {
        const nums = extractNums(m[1]);
        if (nums.length === 6) result[key] = nums;
      }
    }

    // ── Estrategia 2: si alguno quedó vacío, buscar en el HTML crudo ──
    // El HTML tiene celdas td con los números directo
    if (result.tradicional.length === 0) {
      // Busca secuencias de exactamente 6 números del 00-45 separados por " - "
      const seqs = [...html.matchAll(/\b(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{2})\b/g)];
      const valid = seqs.filter(m => 
        [m[1],m[2],m[3],m[4],m[5],m[6]].every(n => parseInt(n) <= 45)
      );

      if (valid.length >= 1) result.tradicional  = [valid[0][1],valid[0][2],valid[0][3],valid[0][4],valid[0][5],valid[0][6]];
      if (valid.length >= 2) result.segunda       = [valid[1][1],valid[1][2],valid[1][3],valid[1][4],valid[1][5],valid[1][6]];
      if (valid.length >= 3) result.revancha      = [valid[2][1],valid[2][2],valid[2][3],valid[2][4],valid[2][5],valid[2][6]];
      if (valid.length >= 4) result.siempreSale   = [valid[3][1],valid[3][2],valid[3][3],valid[3][4],valid[3][5],valid[3][6]];
    }

    // ── Próximo sorteo ──────────────────────────────────
    const mProx = texto.match(/Próximo Sorteo[^0-9]*(\d{2}\/\d{2}\/\d{4})/iu);
    if (mProx) result.fechaProximo = mProx[1];

    const mPozo = texto.match(/POZO ACUMULADO[^$]*\$([\d\.,]+)/i);
    if (mPozo) result.pozoPróximo = '$' + mPozo[1].trim();

    // ── Debug: si aún vacío, devolver fragmento del HTML ──
    if (result.tradicional.length === 0) {
      result._debug = texto.substring(0, 1500);
    }

    res.status(200).json(result);

  } catch (err) {
    result._error = err.message;
    res.status(200).json(result);
  }
}
