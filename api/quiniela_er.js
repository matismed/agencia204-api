// api/quiniela_er.js — DIAGNÓSTICO para Salta y Jujuy en loteriasmundiales.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const resultado = {
    diagnostico: {},
    mensaje: "Probando URLs de Salta y Jujuy en loteriasmundiales.com"
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  // URLs a probar para Salta
  const urlsSalta = [
    'https://www.loteriasmundiales.com.ar/Quinielas/salta',
    'https://www.loteriasmundiales.com.ar/quinielas/salta',
    'https://www.loteriasmundiales.com.ar/Quiniela/Salta',
    'https://www.loteriasmundiales.com.ar/quiniela/salta'
  ];

  // URLs a probar para Jujuy
  const urlsJujuy = [
    'https://www.loteriasmundiales.com.ar/Quinielas/jujuy',
    'https://www.loteriasmundiales.com.ar/quinielas/jujuy',
    'https://www.loteriasmundiales.com.ar/Quiniela/Jujuy',
    'https://www.loteriasmundiales.com.ar/quiniela/jujuy'
  ];

  // Función para detectar códigos de quiniela en el HTML
  function detectarCodigos(html) {
    const codigos = new Set();
    
    // Buscar patrones como idQ12_1_N01, idQ5_2_N03, etc.
    const regex = /idQ(\d+)_(\d+)_N(\d+)/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      codigos.add({
        codigoQuiniela: match[1],
        codigoSorteo: match[2],
        posicion: match[3]
      });
    }
    
    return Array.from(codigos);
  }

  // Función para extraer un fragmento del HTML
  function extraerFragmento(html, buscar, longitudAntes = 200, longitudDespues = 500) {
    const index = html.indexOf(buscar);
    if (index === -1) return null;
    
    const inicio = Math.max(0, index - longitudAntes);
    const fin = Math.min(html.length, index + longitudDespues);
    return html.substring(inicio, fin);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROBAR SALTA
  // ═══════════════════════════════════════════════════════════════════════
  resultado.diagnostico.salta = {};
  
  for (const url of urlsSalta) {
    try {
      const response = await fetch(url, { headers });
      const html = await response.text();
      
      resultado.diagnostico.salta[url] = {
        status: response.status,
        funcionaURL: response.status === 200,
        tamañoHTML: html.length,
        contieneSalta: html.toLowerCase().includes('salta'),
        codigosEncontrados: detectarCodigos(html),
        fragmentoHTML: extraerFragmento(html, 'salta', 100, 300) || extraerFragmento(html, 'Salta', 100, 300)
      };
    } catch (error) {
      resultado.diagnostico.salta[url] = {
        error: error.message
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROBAR JUJUY
  // ═══════════════════════════════════════════════════════════════════════
  resultado.diagnostico.jujuy = {};
  
  for (const url of urlsJujuy) {
    try {
      const response = await fetch(url, { headers });
      const html = await response.text();
      
      resultado.diagnostico.jujuy[url] = {
        status: response.status,
        funcionaURL: response.status === 200,
        tamañoHTML: html.length,
        contieneJujuy: html.toLowerCase().includes('jujuy'),
        codigosEncontrados: detectarCodigos(html),
        fragmentoHTML: extraerFragmento(html, 'jujuy', 100, 300) || extraerFragmento(html, 'Jujuy', 100, 300)
      };
    } catch (error) {
      resultado.diagnostico.jujuy[url] = {
        error: error.message
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REFERENCIA: Montevideo (que ya funciona)
  // ═══════════════════════════════════════════════════════════════════════
  resultado.diagnostico.montevideo_referencia = {};
  
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    const html = await response.text();
    
    resultado.diagnostico.montevideo_referencia = {
      status: response.status,
      codigosEncontrados: detectarCodigos(html).slice(0, 10), // Solo primeros 10
      fragmentoHTML: extraerFragmento(html, 'idQ11', 0, 500)
    };
  } catch (error) {
    resultado.diagnostico.montevideo_referencia = {
      error: error.message
    };
  }

  res.status(200).json(resultado);
}
