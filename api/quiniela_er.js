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
    // Primero, buscar el índice de "Turista" en el HTML
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
    
    // Buscar TODOS los números de 4 dígitos SOLO dentro de la tabla
    const numerosEnTabla = [];
    const regex = /\b(\d{4})\b/g;
    let match;
    
    while ((match = regex.exec(tablaHTML)) !== null) {
      numerosEnTabla.push(match[1]);
    }
    
    // Buscar el índice del número esperado
    const indiceEsperado = numerosEnTabla.indexOf(numeroEsperado);
    
    if (indiceEsperado === -1) {
      return { 
        error: `No se encontró ${numeroEsperado} en la tabla`,
        numeros_en_tabla: numerosEnTabla.slice(0, 30)
      };
    }
    
    // Extraer 20 números a partir del número esperado
    const numerosExtraidos = numerosEnTabla.slice(indiceEsperado, indiceEsperado + 20);
    
    // Convertir a formato con posición
    const numeros = numerosExtraidos.map((num, idx) => ({
      pos: idx + 1,
      num: num
    }));
    
    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros.length > 0 ? numeros[0].num : null,
      cantidad: numeros.length
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

  resultado.nota = "Parser mejorado: busca tabla HTML después de 'Turista' y extrae números solo de ahí";

  res.status(200).json(resultado);
}
