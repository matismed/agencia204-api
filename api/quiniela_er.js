// DIAGNÓSTICO HTML quinielasya.com.ar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  try {
    const response = await fetch('https://www.quinielasya.com.ar/quiniela-de-entre-rios.asp', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Buscar índice de Turista
      const idxTurista = html.toLowerCase().indexOf('turista');
      
      const resultado = {
        tiene_turista: idxTurista !== -1,
        indice_turista: idxTurista,
        longitud_html: html.length,
        fragmento_turista: null,
        primeros_1000_chars: html.substring(0, 1000),
        ultimos_500_chars: html.substring(html.length - 500)
      };
      
      if (idxTurista !== -1) {
        // Extraer 2000 caracteres alrededor de "Turista"
        resultado.fragmento_turista = html.substring(
          Math.max(0, idxTurista - 200),
          Math.min(html.length, idxTurista + 1800)
        );
      }
      
      res.status(200).json(resultado);
    } else {
      res.status(response.status).json({ error: `HTTP ${response.status}` });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
