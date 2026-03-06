// api/quini6.js — Vercel Serverless Function
// Fuente: quiniya.com.ar
// Parser reescrito para el HTML real del sitio (marzo 2026)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cache de 30 min en CDN, revalida en background hasta 1 hora
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const html = await response.text();

    // ── 1. NÚMERO Y FECHA DEL SORTEO ─────────────────────────────────────────
    // "Sorteo #3352 realizado el domingo 01 de marzo de 2026"
    const mSorteo = html.match(/Sorteo\s+#(\d+)\s+realizado\s+el\s+[a-záéíóúñ]+\s+(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/i);
    if (mSorteo) {
      result.sorteo = mSorteo[1];
      result.fecha  = mSorteo[2];
    }

    // ── 2. EXTRACCIÓN DE NÚMEROS POR SECCIÓN ─────────────────────────────────
    // Estructura HTML real:
    //   <h3>Tradicional</h3>
    //   <p>27</p><p>12</p><p>19</p><p>10</p><p>20</p><p>18</p>
    //
    // Buscamos el bloque entre el <h3/h2> del label y el siguiente heading.
    function extractSection(labelPattern) {
      const re = new RegExp(
        '<h[23][^>]*>\\s*' + labelPattern + '\\s*<\\/h[23]>' +
        '([\\s\\S]*?)' +
        '(?=<h[23]|<hr|###|$)',
        'i'
      );
      const m = html.match(re);
      if (!m) return [];

      const texto = m[1].replace(/<[^>]+>/g, ' ');
      const nums = [...texto.matchAll(/\b(\d{1,2})\b/g)]
        .map(n => n[1].padStart(2, '0'))
        .filter(n => parseInt(n, 10) <= 45)   // Quini 6: 00–45
        .slice(0, 6);
      return nums;
    }

    result.tradicional = extractSection('Tradicional');
    result.segunda     = extractSection('La\\s+Segunda');
    result.revancha    = extractSection('Revancha');
    result.siempreSale = extractSection('Siempre\\s+Sale');

    // ── 3. FECHA DEL PRÓXIMO SORTEO ───────────────────────────────────────────
    // Buscar cerca de "Próximo Sorteo" en el HTML
    const idxProx = html.search(/Pr[oó]ximo\s+Sorteo/i);
    if (idxProx !== -1) {
      const ventana = html.substring(idxProx, idxProx + 500).replace(/<[^>]+>/g, ' ');
      const mFecha  = ventana.match(/(\d{1,2}\/\d{2}\/\d{4})/)
                   || ventana.match(/(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/i);
      if (mFecha) result.fechaProximo = mFecha[1];
    }

    // ── 4. POZO PRÓXIMO ───────────────────────────────────────────────────────
    // Buscar montos en el texto completo y quedarnos con el mayor
    // (el pozo del próximo sorteo siempre es el valor más grande)
    const textoLimpio = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    function parseMonto(str) {
      const s = str.replace(/\$/g, '').trim();
      if (/millones?/i.test(s)) {
        return parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) * 1_000_000;
      }
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }

    const rePozo = /\$\s*([\d\.]+(?:\s*(?:millones?|mil millones?))?)/gi;
    const montos = [];
    let mp;
    while ((mp = rePozo.exec(textoLimpio)) !== null) {
      const val = parseMonto(mp[0]);
      if (val >= 1_000_000) montos.push({ txt: mp[0].trim(), val });
    }

    if (montos.length > 0) {
      montos.sort((a, b) => b.val - a.val);
      // Formatear de forma legible
      const mayor = montos[0].val;
      if (mayor >= 1_000_000_000) {
        result.pozoPróximo = '$' + (mayor / 1_000_000_000).toFixed(1).replace('.0', '') + ' mil millones';
      } else {
        result.pozoPróximo = '$' + (mayor / 1_000_000).toFixed(0) + ' millones';
      }
    }

    res.status(200).json(result);

  } catch (err) {
    result._error = err.message;
    res.status(200).json(result);
  }
}

