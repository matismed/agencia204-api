// DIAGNÓSTICO RAW - tujugada.com.ar HTML completo
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Diagnóstico HTML raw de tujugada.com.ar",
    urls: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.tujugada.com.ar/'
  };

  // CÓRDOBA
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_cordoba.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      resultado.urls.cordoba = {
        status: 200,
        longitud_html: html.length,
        tiene_turista: html.toLowerCase().includes('turista'),
        tiene_0883: html.includes('0883'),
        tiene_8935: html.includes('8935'),
        tiene_tabla: html.toLowerCase().includes('<table'),
        fragmento_html_inicio: html.substring(0, 1000),
        fragmento_html_fin: html.substring(html.length - 500),
        
        // Buscar índice de "turista"
        indice_turista: html.toLowerCase().indexOf('turista'),
        
        // Si encuentra "turista", extraer 2000 chars alrededor
        contexto_turista: null
      };
      
      const idx = html.toLowerCase().indexOf('turista');
      if (idx !== -1) {
        resultado.urls.cordoba.contexto_turista = html.substring(
          Math.max(0, idx - 200), 
          Math.min(html.length, idx + 1800)
        );
      }
      
    } else {
      resultado.urls.cordoba = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.urls.cordoba = { error: e.message };
  }

  // ENTRE RÍOS
  try {
    const response = await fetch('https://www.tujugada.com.ar/quiniela_entre_rios.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      resultado.urls.entrerrios = {
        status: 200,
        longitud_html: html.length,
        tiene_turista: html.toLowerCase().includes('turista'),
        tiene_1701: html.includes('1701'),
        tiene_9446: html.includes('9446'),
        tiene_tabla: html.toLowerCase().includes('<table'),
        
        indice_turista: html.toLowerCase().indexOf('turista'),
        contexto_turista: null
      };
      
      const idx = html.toLowerCase().indexOf('turista');
      if (idx !== -1) {
        resultado.urls.entrerrios.contexto_turista = html.substring(
          Math.max(0, idx - 200), 
          Math.min(html.length, idx + 1800)
        );
      }
      
    } else {
      resultado.urls.entrerrios = { error: `HTTP ${response.status}` };
    }
  } catch(e) {
    resultado.urls.entrerrios = { error: e.message };
  }

  resultado.conclusion = {
    cordoba_accesible: resultado.urls.cordoba && resultado.urls.cordoba.status === 200,
    cordoba_tiene_datos: resultado.urls.cordoba && resultado.urls.cordoba.tiene_0883,
    entrerrios_accesible: resultado.urls.entrerrios && resultado.urls.entrerrios.status === 200,
    entrerrios_tiene_datos: resultado.urls.entrerrios && resultado.urls.entrerrios.tiene_1701,
    se_puede_scrapear: 
      resultado.urls.cordoba && resultado.urls.cordoba.tiene_0883 &&
      resultado.urls.entrerrios && resultado.urls.entrerrios.tiene_1701
  };

  res.status(200).json(resultado);
}
