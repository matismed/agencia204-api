// SCRAPER TURISTA ENTRE RÍOS - quinielasya.com.ar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper Turista Entre Ríos desde quinielasya.com.ar",
    provincia: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

  function parsearQuinielasYa(html) {
    const numeros = [];
    
    // Buscar la sección de Turista en el HTML
    const idxTurista = html.toLowerCase().indexOf('turista');
    if (idxTurista === -1) {
      return { error: "No se encontró sección Turista" };
    }
    
    // Extraer fragmento después de "Turista"
    const fragmento = html.substring(idxTurista, idxTurista + 3000);
    
    // Buscar números en el patrón de tabla HTML de quinielasya
    // Patrón: <td>**1.**</td> <td>**1701**</td>
    const regexFilas = /<td>\*\*(\d{1,2})\.\*\*<\/td>\s*<td>\*\*(\d{4})\*\*<\/td>/g;
    let match;
    
    while ((match = regexFilas.exec(fragmento)) !== null && numeros.length < 20) {
      const pos = parseInt(match[1]);
      const num = match[2];
      numeros.push({ pos, num });
    }
    
    if (numeros.length === 0) {
      // Estrategia alternativa: buscar números directamente
      const regexAlt = /\*\*(\d{1,2})\.\*\*[\s\S]*?\*\*(\d{4})\*\*/g;
      let matchAlt;
      
      while ((matchAlt = regexAlt.exec(fragmento)) !== null && numeros.length < 20) {
        const pos = parseInt(matchAlt[1]);
        const num = matchAlt[2];
        if (pos >= 1 && pos <= 20) {
          numeros.push({ pos, num });
        }
      }
    }
    
    if (numeros.length === 0) {
      return { error: "No se encontraron números en Turista" };
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

  // ENTRE RÍOS TURISTA
  try {
    const response = await fetch('https://www.quinielasya.com.ar/quiniela-de-entre-rios.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincia.entrerrios = parsearQuinielasYa(html);
      resultado.provincia.entrerrios.url_usada = 'https://www.quinielasya.com.ar/quiniela-de-entre-rios.asp';
      resultado.provincia.entrerrios.fuente = 'quinielasya.com.ar';
    } else {
      resultado.provincia.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincia.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    entrerrios_ok: resultado.provincia.entrerrios && resultado.provincia.entrerrios.cabeza === '1701',
    entrerrios_tiene_20: resultado.provincia.entrerrios && resultado.provincia.entrerrios.cantidad === 20,
    listo_para_produccion: 
      resultado.provincia.entrerrios && resultado.provincia.entrerrios.cantidad === 20
  };

  resultado.nota = "quinielasya.com.ar tiene Turista en HTML estático - fuente confiable";

  res.status(200).json(resultado);
}
