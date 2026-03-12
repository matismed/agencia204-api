// SCRAPER TURISTA FINAL - ruta1000.com.ar
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
  
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const diaSemanaURL = diasSemana[ahoraArgentina.getDay()];

  function parsearRuta1000(html, numeroEsperado) {
    // Buscar "Turista" en el HTML
    const idxTurista = html.toLowerCase().indexOf('turista');
    
    if (idxTurista === -1) {
      return { error: "No se encontró 'Turista' en el HTML" };
    }
    
    // Extraer fragmento después de "Turista"
    const fragmentoHTML = html.substring(idxTurista, idxTurista + 15000);
    
    // Buscar la primera tabla después de "Turista"
    const regexTabla = /<table[^>]*>([\s\S]*?)<\/table>/i;
    const matchTabla = regexTabla.exec(fragmentoHTML);
    
    if (!matchTabla) {
      return { error: "No se encontró tabla después de 'Turista'" };
    }
    
    const tablaHTML = matchTabla[1];
    
    // ESTRATEGIA MEJORADA: Solo extraer números que estén dentro de <td>...</td>
    // y que NO sean el año 2026
    const numerosEnTabla = [];
    const regexCeldas = /<td[^>]*>([^<]*)<\/td>/gi;
    let matchCelda;
    
    while ((matchCelda = regexCeldas.exec(tablaHTML)) !== null) {
      const contenido = matchCelda[1].trim();
      
      // Si es un número de exactamente 4 dígitos
      if (/^\d{4}$/.test(contenido)) {
        // NO agregar si es el año 2026 o años cercanos
        const num = parseInt(contenido);
        if (num < 2020 || num > 2030) {
          numerosEnTabla.push(contenido);
        }
      }
    }
    
    // Buscar el índice del número esperado
    const indiceEsperado = numerosEnTabla.indexOf(numeroEsperado);
    
    if (indiceEsperado === -1) {
      return { 
        error: `No se encontró ${numeroEsperado} en la tabla`,
        numeros_encontrados: numerosEnTabla.length,
        primeros_10: numerosEnTabla.slice(0, 10),
        todos: numerosEnTabla
      };
    }
    
    // Extraer 20 números a partir del número esperado
    const numerosExtraidos = numerosEnTabla.slice(indiceEsperado, indiceEsperado + 20);
    
    // Convertir a formato con posición
    const numeros = numerosExtraidos.map((num, idx) => ({
      pos: idx + 1,
      num: num
    }));
    
    if (numeros.length < 20) {
      return {
        error: `Solo se encontraron ${numeros.length} números (necesitamos 20)`,
        numeros: numeros,
        todos_encontrados: numerosEnTabla
      };
    }
    
    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros[0].num,
      cantidad: numeros.length
    };
  }

  // CÓRDOBA TURISTA
  try {
    const urlCordoba = `https://www.ruta1000.com.ar/index2008.php?Resultado=Quiniela_Cordoba_${diaSemanaURL}`;
    const response = await fetch(urlCordoba, { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearRuta1000(html, '0883');
      resultado.provincias.cordoba.url_usada = urlCordoba;
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA
  try {
    const urlEntreRios = `https://www.ruta1000.com.ar/index2008.php?Resultado=Quiniela_Entre_Rios_${diaSemanaURL}`;
    const response = await fetch(urlEntreRios, { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearRuta1000(html, '1701');
      resultado.provincias.entrerrios.url_usada = urlEntreRios;
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

  resultado.info = {
    dia_actual: diasSemana[ahoraArgentina.getDay()],
    dia_usado_en_url: diaSemanaURL,
    nota: "Parser forzado: solo extrae números de <td>, excluye años (2020-2030)"
  };

  res.status(200).json(resultado);
}

