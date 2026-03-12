// BÚSQUEDA RÁPIDA - Solo fuentes principales de Turista
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Búsqueda rápida de Turista",
    fuentes: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function htmlATexto(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  // FUENTE 1: quinieladehoy.com.ar
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { 
      headers,
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const html = await response.text();
      const texto = htmlATexto(html);
      
      const tiene0883 = texto.includes('0883');
      const tieneTurista = texto.toLowerCase().includes('turista');
      
      resultado.fuentes.quinieladehoy = {
        accesible: true,
        tiene_0883,
        tiene_turista: tieneTurista,
        relevancia: (tiene0883 ? 10 : 0) + (tieneTurista ? 5 : 0)
      };

      if (tiene0883) {
        const idx = texto.indexOf('0883');
        resultado.fuentes.quinieladehoy.fragmento = texto.substring(Math.max(0, idx - 150), Math.min(texto.length, idx + 150));
      }
    }
  } catch(e) {
    resultado.fuentes.quinieladehoy = { error: e.message };
  }

  // FUENTE 2: resultadoquiniela.com.ar
  try {
    const response = await fetch('https://www.resultadoquiniela.com.ar/', { 
      headers,
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const html = await response.text();
      const texto = htmlATexto(html);
      
      const tiene0883 = texto.includes('0883');
      const tieneTurista = texto.toLowerCase().includes('turista');
      
      resultado.fuentes.resultadoquiniela = {
        accesible: true,
        tiene_0883,
        tiene_turista: tieneTurista,
        relevancia: (tiene0883 ? 10 : 0) + (tieneTurista ? 5 : 0)
      };

      if (tiene0883) {
        const idx = texto.indexOf('0883');
        resultado.fuentes.resultadoquiniela.fragmento = texto.substring(Math.max(0, idx - 150), Math.min(texto.length, idx + 150));
      }
    }
  } catch(e) {
    resultado.fuentes.resultadoquiniela = { error: e.message };
  }

  // FUENTE 3: loteriasmundiales Córdoba (buscar Q6_4)
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/cordoba', { 
      headers,
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Buscar Q6_4 (podría ser Turista)
      const regexQ6_4 = /idQ6_4_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i;
      const matchQ6_4 = html.match(regexQ6_4);
      
      resultado.fuentes.loteriasmundiales_cordoba = {
        accesible: true,
        tiene_Q6_4: !!matchQ6_4,
        Q6_4_cabeza: matchQ6_4 ? matchQ6_4[1].padStart(4, '0') : null,
        es_0883: matchQ6_4 && matchQ6_4[1].padStart(4, '0') === '0883',
        relevancia: (matchQ6_4 && matchQ6_4[1].padStart(4, '0') === '0883') ? 10 : 0
      };
    }
  } catch(e) {
    resultado.fuentes.loteriasmundiales_cordoba = { error: e.message };
  }

  // Determinar mejor fuente
  const ranking = Object.entries(resultado.fuentes)
    .filter(([_, data]) => data.accesible || data.tiene_Q6_4)
    .sort((a, b) => (b[1].relevancia || 0) - (a[1].relevancia || 0));

  resultado.mejor_fuente = ranking.length > 0 ? ranking[0][0] : null;
  resultado.recomendacion = ranking.length > 0 && ranking[0][1].relevancia > 0 
    ? `Usar ${ranking[0][0]} - tiene datos de Turista`
    : "No se encontró ninguna fuente con Turista (0883)";

  res.status(200).json(resultado);
}
