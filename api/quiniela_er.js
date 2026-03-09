// DIAGNÓSTICO: Verificar códigos de Salta y Jujuy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    salta: {},
    jujuy: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  // Probar diferentes códigos para SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Buscar TODOS los IDs que empiecen con "idQ"
      const idsEncontrados = [];
      const idRegex = /id="(idQ\d+_\d+_N01)"[^>]*>\s*<b>?\s*(\d{3,4})/g;
      let match;
      
      while ((match = idRegex.exec(html)) !== null) {
        idsEncontrados.push({
          id: match[1],
          numero: match[2],
          // Extraer quiniela y sorteo del ID
          quiniela: match[1].match(/idQ(\d+)_/)[1],
          sorteo: match[1].match(/_(\d+)_N/)[1]
        });
      }
      
      resultado.salta = {
        idsEncontrados,
        totalIDs: idsEncontrados.length
      };
    }
  } catch(e) {
    resultado.salta.error = e.message;
  }

  // Probar diferentes códigos para JUJUY
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      const idsEncontrados = [];
      const idRegex = /id="(idQ\d+_\d+_N01)"[^>]*>\s*<b>?\s*(\d{3,4})/g;
      let match;
      
      while ((match = idRegex.exec(html)) !== null) {
        idsEncontrados.push({
          id: match[1],
          numero: match[2],
          quiniela: match[1].match(/idQ(\d+)_/)[1],
          sorteo: match[1].match(/_(\d+)_N/)[1]
        });
      }
      
      resultado.jujuy = {
        idsEncontrados,
        totalIDs: idsEncontrados.length
      };
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  res.status(200).json(resultado);
}

