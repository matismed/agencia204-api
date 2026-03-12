// SCRAPER TURISTA - ruta1000.com.ar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper de Turista desde ruta1000.com.ar",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.ruta1000.com.ar/'
  };

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

  function htmlATexto(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  function parsearRuta1000Turista(html) {
    const texto = htmlATexto(html);
    
    // Buscar patrón: "TURISTA" seguido de fecha
    const regexTurista = /TURISTA\s*DEL\s*\d{1,2}\s*DE\s*\w+\s*DE\s*\d{4}/i;
    const matchTurista = regexTurista.exec(texto);
    
    if (!matchTurista) {
      return { error: "No se encontró el patrón TURISTA en el HTML" };
    }

    // Extraer números después del match
    const desde = matchTurista.index + matchTurista[0].length;
    const fragmento = texto.substring(desde, desde + 2000);
    
    // Buscar tabla con números
    // Patrón: 1° 0883 6° 5847 11° 9245...
    const numeros = [];
    const regex = /(\d{1,2})°\s*(\d{4})/g;
    let match;
    
    while ((match = regex.exec(fragmento)) !== null && numeros.length < 20) {
      const pos = parseInt(match[1]);
      const num = match[2];
      
      if (pos >= 1 && pos <= 20) {
        numeros.push({ pos, num });
      }
    }

    // Ordenar por posición
    numeros.sort((a, b) => a.pos - b.pos);

    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros.length > 0 ? numeros[0].num : null,
      cantidad: numeros.length
    };
  }

  // CÓRDOBA TURISTA
  try {
    const response = await fetch('https://www.ruta1000.com.ar/quiniela-de-cordoba/turista', { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearRuta1000Turista(html);
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA
  try {
    const response = await fetch('https://www.ruta1000.com.ar/quiniela-de-entre-rios/turista', { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearRuta1000Turista(html);
    } else {
      resultado.provincias.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    cordoba_ok: resultado.provincias.cordoba && resultado.provincias.cordoba.cabeza === '0883',
    entrerrios_ok: resultado.provincias.entrerrios && resultado.provincias.entrerrios.numeros && resultado.provincias.entrerrios.numeros.length > 0,
    listo_para_produccion: resultado.provincias.cordoba && resultado.provincias.cordoba.cabeza === '0883'
  };

  res.status(200).json(resultado);
}
