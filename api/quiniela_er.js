// api/quiniela_er.js — DIAGNÓSTICO para encontrar Ciudad/Nacional
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const resultado = {
    mensaje: "Buscando quiniela de la Ciudad en loteriasmundiales.com",
    pruebas: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function detectarCodigos(html) {
    const codigos = {};
    const regex = /idQ(\d+)_(\d+)_N(\d+)/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const codigoQuiniela = match[1];
      const codigoSorteo = match[2];
      const posicion = match[3];
      
      if (!codigos[codigoQuiniela]) {
        codigos[codigoQuiniela] = {};
      }
      if (!codigos[codigoQuiniela][codigoSorteo]) {
        codigos[codigoQuiniela][codigoSorteo] = [];
      }
      codigos[codigoQuiniela][codigoSorteo].push(posicion);
    }
    
    return codigos;
  }

  function extraerPrimerNumero(html, codigoQuiniela, codigoSorteo) {
    const id = `idQ${codigoQuiniela}_${codigoSorteo}_N01`;
    const patterns = [
      `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
      `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  // URLs a probar para Ciudad/Nacional
  const urlsAPro bar = [
    'ciudad',
    'Ciudad',
    'ciudad-buenos-aires',
    'Ciudad-Buenos-Aires',
    'ciudad-de-buenos-aires',
    'caba',
    'CABA',
    'capital',
    'Capital',
    'capital-federal',
    'Capital-Federal',
    'nacional',
    'Nacional'
  ];

  for (const urlVariante of urlsAPro bar) {
    const url = `https://www.loteriasmundiales.com.ar/Quinielas/${urlVariante}`;
    
    try {
      const response = await fetch(url, { headers });
      const html = await response.text();
      
      const info = {
        url: url,
        status: response.status,
        funciona: response.status === 200,
        tamañoHTML: html.length
      };

      if (response.status === 200) {
        const codigos = detectarCodigos(html);
        const codigosCount = Object.keys(codigos).length;
        
        if (codigosCount > 0) {
          info.codigosEncontrados = codigos;
          info.totalCodigos = codigosCount;
          
          // Extraer números de ejemplo
          info.ejemplos = {};
          for (const [codQuiniela, sorteos] of Object.entries(codigos)) {
            info.ejemplos[`Q${codQuiniela}`] = {};
            for (const codSorteo of Object.keys(sorteos)) {
              const numero = extraerPrimerNumero(html, codQuiniela, codSorteo);
              if (numero) {
                info.ejemplos[`Q${codQuiniela}`][`sorteo_${codSorteo}`] = numero;
              }
            }
          }
        }
      }

      resultado.pruebas[urlVariante] = info;
      
    } catch (error) {
      resultado.pruebas[urlVariante] = {
        url: url,
        error: error.message
      };
    }
  }

  res.status(200).json(resultado);
}
