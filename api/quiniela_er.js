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

  function parsearTujugadaTurista(html) {
    const numeros = [];
    
    // Buscar sección de Turista usando el botón como referencia
    const regexSeccionTurista = /<section[^>]*id=['"]Turista['"][^>]*>([\s\S]*?)<\/section>/i;
    const matchSeccion = regexSeccionTurista.exec(html);
    
    if (!matchSeccion) {
      return { error: "No se encontró la sección de Turista" };
    }
    
    const seccionHTML = matchSeccion[1];
    
    // Buscar la tabla dentro de la sección
    const regexTabla = /<table[^>]*>([\s\S]*?)<\/table>/i;
    const matchTabla = regexTabla.exec(seccionHTML);
    
    if (!matchTabla) {
      return { error: "No se encontró tabla en la sección de Turista" };
    }
    
    const tablaHTML = matchTabla[1];
    
    // Extraer todas las filas <tr> (excepto el header)
    const regexFilas = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let matchFila;
    
    while ((matchFila = regexFilas.exec(tablaHTML)) !== null) {
      const filaHTML = matchFila[1];
      
      // Saltar filas de header que tienen <th>
      if (filaHTML.includes('<th')) continue;
      
      // Extraer celdas <td>
      const celdas = [];
      const regexCeldas = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let matchCelda;
      
      while ((matchCelda = regexCeldas.exec(filaHTML)) !== null) {
        // Limpiar el contenido: quitar tags HTML y trim
        const contenido = matchCelda[1].replace(/<[^>]+>/g, '').trim();
        celdas.push(contenido);
      }
      
      // Cada fila tiene 4 celdas: Ubic | NUMERO | Ubic | NUMERO
      if (celdas.length === 4) {
        // Primera pareja
        const pos1 = parseInt(celdas[0]);
        const num1 = celdas[1];
        if (!isNaN(pos1) && /^\d{4}$/.test(num1)) {
          numeros.push({ pos: pos1, num: num1 });
        }
        
        // Segunda pareja
        const pos2 = parseInt(celdas[2]);
        const num2 = celdas[3];
        if (!isNaN(pos2) && /^\d{4}$/.test(num2)) {
          numeros.push({ pos: pos2, num: num2 });
        }
      }
      
      // Si tiene 2 celdas: Ubic | NUMERO
      if (celdas.length === 2) {
        const pos = parseInt(celdas[0]);
        const num = celdas[1];
        if (!isNaN(pos) && /^\d{4}$/.test(num)) {
          numeros.push({ pos, num });
        }
      }
    }
    
    // Ordenar por posición
    numeros.sort((a, b) => a.pos - b.pos);
    
    if (numeros.length === 0) {
      return { error: "No se encontraron números en la tabla" };
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
      signal: AbortSignal.timeout(10000)
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
      signal: AbortSignal.timeout(10000)
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

  resultado.nota = "URLs de tujugada.com.ar son estáticas, siempre muestran el último sorteo disponible";

  res.status(200).json(resultado);
}
