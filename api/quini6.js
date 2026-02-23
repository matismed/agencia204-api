// api/quini6.js — Vercel Serverless Function
// Scrapea quini-6-resultados.com.ar y devuelve JSON con los resultados

export default async function handler(req, res) {
  // CORS — permite que cualquier dominio consuma este endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cache de 30 minutos en Vercel Edge
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    const response = await fetch('https://www.quini-6-resultados.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    if (!response.ok) throw new Error('Fetch error: ' + response.status);
    const html = await response.text();

    // ── PARSEO ────────────────────────────────────────────
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

    // Número y fecha del sorteo
    const sorteoMatch = html.match(/Sorteo del dia\s+([\d\/]+)\s+Nro\. Sorteo:\s*(\d+)/i);
    if (sorteoMatch) {
      result.fecha  = sorteoMatch[1].trim();
      result.sorteo = sorteoMatch[2].trim();
    }

    // Extrae números de una línea "00 - 02 - 23 - 26 - 30 - 40"
    function parseNums(line) {
      const matches = [...line.matchAll(/\b(\d{1,2})\b/g)];
      return matches.map(m => m[1].padStart(2, '0'));
    }

    // Parsear cada modalidad buscando el patrón de tabla
    const sections = {
      tradicional:  'TRADICIONAL',
      segunda:      'LA SEGUNDA',
      revancha:     'REVANCHA',
      siempreSale:  'SIEMPRE SALE',
    };

    for (const [key, label] of Object.entries(sections)) {
      const regex = new RegExp(label.replace(' ', '\\s*') + '\\s*\\|\\s*([\\d\\s\\-]+)\\|', 'i');
      const match = html.match(regex);
      if (match) result[key] = parseNums(match[1]);
    }

    // Próximo sorteo y pozo
    const proxMatch = html.match(/Próximo Sorteo el día\s+\w+\s+([\d\/]+)/iu);
    if (proxMatch) result.fechaProximo = proxMatch[1].trim();

    const pozoMatch = html.match(/POZO ACUMULADO:\s*\$([\d\.\,]+)/i);
    if (pozoMatch) result.pozoPróximo = '$' + pozoMatch[1].trim();

    res.status(200).json(result);

  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener los datos: ' + err.message });
  }
}

