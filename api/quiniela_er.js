// SCRAPER TURISTA - chequinielas.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper de Turista desde chequinielas.com",
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

  function parsearCheQuinielas(html) {
    const numeros = [];
    
    // Buscar todos los números dentro de la estructura de resultados
    // Patrón: <número>\n<nombre> en secuencia del 1 al 20
    
    // Buscar todos los divs o elementos que contengan números de 4 dígitos
    const regexNumeros = /(\d{1,2})\.\s*\n\s*(\d{4})/g;
    let match;
    
    while ((match = regexNumeros.exec(html)) !== null && numeros.length < 20) {
      const pos = parseInt(match[1]);
      const num = match[2];
      
      if (pos >= 1 && pos <= 20) {
        numeros.push({ pos, num });
      }
    }
    
    // Si no encontró con ese patrón, intentar otro
    if (numeros.length === 0) {
      // Buscar números en cualquier parte del HTML (fallback)
      const todosNumeros = [];
      const regex = /\b(\d{4})\b/g;
      let m;
      
      while ((m = regex.exec(html)) !== null && todosNumeros.length < 100) {
        const num = parseInt(m[1]);
        // Excluir años
        if (num < 2020 || num > 2030) {
          todosNumeros.push(m[1]);
        }
      }
      
      // Tomar los primeros 20 únicos
      const unicos = [...new Set(todosNumeros)];
      for (let i = 0; i < Math.min(20, unicos.length); i++) {
        numeros.push({ pos: i + 1, num: unicos[i] });
      }
    }
    
    if (numeros.length === 0) {
      return { error: "No se encontraron números" };
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
    const response = await fetch('https://chequinielas.com/cordoba/turista', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearCheQuinielas(html);
      resultado.provincias.cordoba.url_usada = 'https://chequinielas.com/cordoba/turista';
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA
  try {
    const response = await fetch('https://chequinielas.com/entre-rios/turista', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearCheQuinielas(html);
      resultado.provincias.entrerrios.url_usada = 'https://chequinielas.com/entre-rios/turista';
    } else {
      resultado.provincias.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    cordoba_tiene_numeros: resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad > 0,
    cordoba_tiene_20: resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20,
    entrerrios_tiene_numeros: resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad > 0,
    entrerrios_tiene_20: resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20,
    listo_para_produccion: 
      resultado.provincias.cordoba && resultado.provincias.cordoba.cantidad === 20 &&
      resultado.provincias.entrerrios && resultado.provincias.entrerrios.cantidad === 20
  };

  resultado.nota = "Usando chequinielas.com - URLs estáticas que siempre muestran último sorteo";

  res.status(200).json(resultado);
}
