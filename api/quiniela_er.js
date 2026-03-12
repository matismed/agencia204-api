// SCRAPER TURISTA - tujugada.com.ar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper de Turista desde tujugada.com.ar",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.tujugada.com.ar/'
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

  function parsearTujugadaTurista(html) {
    // Buscar directamente en el HTML los números dentro de la tabla
    // Patrón según las imágenes: tabla con Ubic | NUMERO
    
    const numeros = [];
    
    // Estrategia 1: Buscar elementos <td> con números de 4 dígitos después de encontrar "Turista"
    const idxTurista = html.toLowerCase().indexOf('turista');
    if (idxTurista === -1) {
      return { error: "No se encontró 'Turista' en el HTML" };
    }

    // Extraer fragmento HTML después de "Turista"
    const fragmento = html.substring(idxTurista, idxTurista + 5000);
    
    // Buscar números dentro de <td> o texto plano
    // Patrón: <td>0883</td> o similar
    const regexTd = /<td[^>]*>\s*(\d{4})\s*<\/td>/gi;
    let match;
    
    while ((match = regexTd.exec(fragmento)) !== null && numeros.length < 20) {
      const num = match[1];
      numeros.push({ 
        pos: numeros.length + 1, 
        num: num 
      });
    }

    // Si no encontró con <td>, intentar con texto plano
    if (numeros.length === 0) {
      const texto = htmlATexto(fragmento);
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
      
      for (let i = 0; i < lineas.length && numeros.length < 20; i++) {
        // Buscar patrón: número posición seguido de número de 4 dígitos
        if (/^\d{1,2}$/.test(lineas[i])) {
          const pos = parseInt(lineas[i]);
          if (pos === numeros.length + 1 && lineas[i + 1] && /^\d{4}$/.test(lineas[i + 1])) {
            numeros.push({ 
              pos: pos, 
              num: lineas[i + 1] 
            });
            i++; // saltar la línea del número
          }
        }
      }
    }

    if (numeros.length === 0) {
      return { error: "No se encontraron números en el HTML" };
    }

    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros.length > 0 ? numeros[0].num : null,
      cantidad: numeros.length
    };
  }

  // CÓRDOBA TURISTA
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_cordoba.asp', { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearTujugadaTurista(html);
      resultado.provincias.cordoba.url_usada = 'https://www.tujugada.com.ar/quiniela_cordoba.asp';
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_entre_rios.asp', { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearTujugadaTurista(html);
      resultado.provincias.entrerrios.url_usada = 'https://www.tujugada.com.ar/quiniela_entre_rios.asp';
    } else {
      resultado.provincias.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    cordoba_ok: resultado.provincias.cordoba && resultado.provincias.cordoba.cabeza === '0883',
    cordoba_tiene_20: resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20,
    entrerrios_ok: resultado.provincias.entrerrios && resultado.provincias.entrerrios.cabeza === '1701',
    entrerrios_tiene_20: resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20,
    listo_para_produccion: 
      resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20 &&
      resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20
  };

  resultado.nota = "URLs de tujugada.com.ar son estáticas (no cambian por día), siempre muestran el último sorteo disponible";

  res.status(200).json(resultado);
}
