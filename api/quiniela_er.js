// SCRAPER TURISTA - tujugada.com.ar ULTRA SIMPLE
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper de Turista - Parser ultra simple",
    provincias: {}
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

  function parsearSimple(html, numeroEsperado) {
    // Buscar TODOS los números de 4 dígitos en TODO el HTML
    const todosLosNumeros = [];
    const regex = /\b(\d{4})\b/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      todosLosNumeros.push(match[1]);
    }
    
    // Buscar el índice donde aparece el número esperado (cabeza de Turista)
    const indiceEsperado = todosLosNumeros.indexOf(numeroEsperado);
    
    if (indiceEsperado === -1) {
      return { 
        error: `No se encontró el número esperado ${numeroEsperado}`,
        total_numeros_encontrados: todosLosNumeros.length,
        primeros_20: todosLosNumeros.slice(0, 20)
      };
    }
    
    // Extraer 20 números a partir del número esperado
    const numerosExtraidos = todosLosNumeros.slice(indiceEsperado, indiceEsperado + 20);
    
    // Convertir a formato con posición
    const numeros = numerosExtraidos.map((num, idx) => ({
      pos: idx + 1,
      num: num
    }));
    
    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros.length > 0 ? numeros[0].num : null,
      cantidad: numeros.length,
      indice_encontrado: indiceEsperado,
      total_numeros_en_html: todosLosNumeros.length
    };
  }

  // CÓRDOBA TURISTA (esperamos 0883)
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_cordoba.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearSimple(html, '0883');
      resultado.provincias.cordoba.url_usada = 'https://www.tujugada.com.ar/quiniela_cordoba.asp';
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA (esperamos 1701)
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_entre_rios.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearSimple(html, '1701');
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

  resultado.nota = "Parser ultra simple: busca TODOS los números de 4 dígitos y extrae 20 a partir del número esperado";

  res.status(200).json(resultado);
}
