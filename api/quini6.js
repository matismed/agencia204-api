// api/quini6.js — Vercel Serverless Function
// Fuente: quiniya.com.ar (sin Cloudflare, HTML limpio)

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
    const response = await fetch('https://quiniya.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    const html = await response.text();

    // Convertir a texto limpio
    const texto = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    // Número y fecha del sorteo: "Sorteo #3350 realizado el domingo 22 de febrero de 2026"
    const mSorteo = html.match(/Sorteo #(\d+) realizado el [a-záéíóúñ]+ (\d{1,2} de [a-záéíóúñ]+ de \d{4})/i);
    if (mSorteo) {
      result.sorteo = mSorteo[1];
      result.fecha  = mSorteo[2];
    }

    // Los números aparecen en secciones h3 seguidas de divs con los números
    // Estructura: ### Tradicional \n 39 \n 00 \n 45 \n 27 \n 36 \n 05
    function extractSection(label) {
      // Busca el h3/h2/heading con el label y captura los siguientes números
      const pattern = new RegExp(
        label + '[\\s\\S]{0,50}?(' +
        '(?:\\s*\\d{1,2}\\s*){6}' +
        ')',
        'i'
      );
      const m = texto.match(pattern);
      if (!m) return [];
      const nums = [...m[1].matchAll(/\b(\d{1,2})\b/g)]
        .map(n => n[1].padStart(2, '0'))
        .filter(n => parseInt(n) <= 45)
        .slice(0, 6);
      return nums;
    }

    result.tradicional = extractSection('Tradicional');
    result.segunda     = extractSection('La Segunda');
    result.revancha    = extractSection('Revancha');
    result.siempreSale = extractSection('Siempre Sale');

    // Próximo sorteo
    const mProx = texto.match(/Próximo Sorteo[\s\S]{0,200}?(\d{1,2}\/\d{2}\/\d{4})/i);
    if (mProx) result.fechaProximo = mProx[1];

    // Pozo: buscar en la página de próximo sorteo si no está en la principal
    const mPozo = texto.match(/\$([\d\.,]+(?:\s*millones?|\.000\.000\.000|\.000\.000)?)/i);
    if (mPozo) result.pozoPróximo = '$' + mPozo[1].trim();

    res.status(200).json(result);

  } catch (err) {
    result._error = err.message;
    res.status(200).json(result);
  }
}

