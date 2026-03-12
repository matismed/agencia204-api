// SCRAPER TURISTA FINAL PRODUCCIÓN
// Córdoba: chequinielas.com
// Entre Ríos: loteriasmundiales.com.ar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper Turista - Producción Final",
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

  // PARSER para chequinielas.com (Córdoba)
  function parsearCheQuinielas(html) {
    const numeros = [];
    const regexNumeros = /(\d{1,2})\.\s*\n\s*(\d{4})/g;
    let match;
    
    while ((match = regexNumeros.exec(html)) !== null && numeros.length < 20) {
      const pos = parseInt(match[1]);
      const num = match[2];
      if (pos >= 1 && pos <= 20) {
        numeros.push({ pos, num });
      }
    }
    
    if (numeros.length === 0) {
      return { error: "No se encontraron números" };
    }
    
    numeros.sort((a, b) => a.pos - b.pos);
    
    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros[0].num,
      cantidad: numeros.length
    };
  }

  // PARSER para loteriasmundiales.com (Entre Ríos)
  function parsearLoteriasMundiales(textoHTML, codigoQ) {
    const numeros = [];
    
    // Buscar patrón Q{codigo}_data con estructura JSON
    const regexData = new RegExp(`Q${codigoQ.quiniela}_${codigoQ.sorteo}_data\\s*=\\s*\\[(.*?)\\]`, 's');
    const matchData = regexData.exec(textoHTML);
    
    if (!matchData) {
      return { error: `No se encontró Q${codigoQ.quiniela}_${codigoQ.sorteo}_data` };
    }
    
    const dataStr = matchData[1];
    const regexNumeros = /"(\d{4})"/g;
    let match;
    let pos = 1;
    
    while ((match = regexNumeros.exec(dataStr)) !== null && pos <= 20) {
      numeros.push({ pos, num: match[1] });
      pos++;
    }
    
    if (numeros.length === 0) {
      return { error: "No se encontraron números en Q_data" };
    }
    
    return {
      fecha: fechaHoyFormato,
      numeros: numeros,
      cabeza: numeros[0].num,
      cantidad: numeros.length
    };
  }

  // CÓRDOBA TURISTA - desde chequinielas.com
  try {
    const response = await fetch('https://chequinielas.com/cordoba/turista', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearCheQuinielas(html);
      resultado.provincias.cordoba.url_usada = 'https://chequinielas.com/cordoba/turista';
      resultado.provincias.cordoba.fuente = 'chequinielas.com';
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA - desde loteriasmundiales.com.ar
  // Código Q para Entre Ríos Turista (necesitamos identificarlo)
  // Por ahora intentamos con el patrón general de loteriasmundiales
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/entre_rios', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Intentar encontrar Turista en el HTML
      // Loteriasmundiales usa códigos Q similares a los otros sorteos
      // Probamos con Q16 (el código de Entre Ríos) sorteo 6 (hipótesis para Turista)
      const intentos = [
        { quiniela: 16, sorteo: 6 },
        { quiniela: 16, sorteo: 4 },
        { quiniela: 16, sorteo: 5 }
      ];
      
      let encontrado = false;
      for (const codigo of intentos) {
        const resultado_parse = parsearLoteriasMundiales(html, codigo);
        if (!resultado_parse.error) {
          resultado.provincias.entrerrios = resultado_parse;
          resultado.provincias.entrerrios.url_usada = 'https://www.loteriasmundiales.com.ar/Quinielas/entre_rios';
          resultado.provincias.entrerrios.fuente = 'loteriasmundiales.com.ar';
          resultado.provincias.entrerrios.codigo_q = `Q${codigo.quiniela}_${codigo.sorteo}`;
          encontrado = true;
          break;
        }
      }
      
      if (!encontrado) {
        resultado.provincias.entrerrios = { 
          error: "No se encontró código Q válido para Turista",
          nota: "Intentados: Q16_6, Q16_4, Q16_5"
        };
      }
      
    } else {
      resultado.provincias.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    cordoba_ok: resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20,
    entrerrios_ok: resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20,
    listo_para_produccion: 
      resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20 &&
      resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20
  };

  resultado.fuentes = {
    cordoba: "chequinielas.com/cordoba/turista",
    entrerrios: "loteriasmundiales.com.ar/Quinielas/entre_rios"
  };

  res.status(200).json(resultado);
}

