// api/quiniela_er.js — DIAGNÓSTICO PROFUNDO de vivitusuerte.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const resultado = {
    mensaje: "Analizando estructura completa de vivitusuerte.com/",
    analisis: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  try {
    const response = await fetch('https://vivitusuerte.com/', { headers });
    const html = await response.text();
    
    resultado.status = response.status;
    resultado.tamañoHTML = html.length;

    // Buscar sección de cabezas
    const seccionCabezasMatch = html.match(/<div[^>]*id="seccionCabezas"[^>]*>([\s\S]*?)<\/div>/i);
    if (seccionCabezasMatch) {
      resultado.seccionCabezas = {
        encontrada: true,
        contenido: seccionCabezasMatch[0].substring(0, 3000)
      };
    }

    // Buscar todas las cajas de resultado
    const cajasResultado = [];
    const cajaRegex = /<div[^>]*class="[^"]*caja-resultado[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    let count = 0;
    while ((match = cajaRegex.exec(html)) !== null && count < 10) {
      cajasResultado.push({
        index: count,
        html: match[0].substring(0, 500)
      });
      count++;
    }
    resultado.cajasResultado = cajasResultado;

    // Buscar menciones de provincias
    const provincias = ['Nacional', 'Buenos Aires', 'Córdoba', 'Santa Fe', 'Santa Fé', 
                       'Entre Ríos', 'Salta', 'Jujuy', 'Montevideo', 'Ciudad'];
    resultado.provinciasEncontradas = {};
    
    for (const prov of provincias) {
      const regex = new RegExp(prov, 'gi');
      const matches = html.match(regex);
      if (matches) {
        resultado.provinciasEncontradas[prov] = {
          veces: matches.length,
          contexto: []
        };
        
        // Extraer contexto (100 caracteres antes y después)
        const contextRegex = new RegExp(`.{0,100}${prov}.{0,100}`, 'gi');
        let contextMatch;
        let contextCount = 0;
        while ((contextMatch = contextRegex.exec(html)) !== null && contextCount < 3) {
          resultado.provinciasEncontradas[prov].contexto.push(contextMatch[0]);
          contextCount++;
        }
      }
    }

    // Buscar patrones de números (4 dígitos)
    const numerosRegex = /\b\d{4}\b/g;
    const numerosEncontrados = html.match(numerosRegex);
    if (numerosEncontrados) {
      resultado.numerosEncontrados = {
        total: numerosEncontrados.length,
        primeros20: numerosEncontrados.slice(0, 20)
      };
    }

    // Buscar scripts que puedan contener datos
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let scriptMatch;
    let scriptCount = 0;
    while ((scriptMatch = scriptRegex.exec(html)) !== null && scriptCount < 5) {
      const contenido = scriptMatch[1];
      // Solo incluir si contiene "quiniela", "sorteo", o "resultado"
      if (/quiniela|sorteo|resultado|provincia/i.test(contenido)) {
        scripts.push({
          index: scriptCount,
          fragmento: contenido.substring(0, 1000)
        });
        scriptCount++;
      }
    }
    resultado.scriptsRelevantes = scripts;

  } catch (error) {
    resultado.error = error.message;
  }

  res.status(200).json(resultado);
}

