// BÚSQUEDA MASIVA - Turista en múltiples fuentes
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Búsqueda masiva de Turista en fuentes argentinas",
    objetivo: "Encontrar Córdoba Turista = 0883 y Entre Ríos Turista",
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

  function buscarNumero0883(texto, html) {
    const tiene0883 = texto.includes('0883') || html.includes('0883');
    const tiene8935 = texto.includes('8935') || html.includes('8935'); // segundo número de la imagen
    const tieneTurista = texto.toLowerCase().includes('turista');
    const tiene22_15 = texto.includes('22:15') || texto.includes('22,15');
    const tiene22_30 = texto.includes('22:30') || texto.includes('22,30');

    let fragmentoCon0883 = null;
    if (tiene0883) {
      const idx = texto.indexOf('0883');
      if (idx !== -1) {
        fragmentoCon0883 = texto.substring(Math.max(0, idx - 100), Math.min(texto.length, idx + 100));
      }
    }

    return {
      tiene_0883,
      tiene_8935,
      tiene_turista: tieneTurista,
      tiene_horario_22_15: tiene22_15,
      tiene_horario_22_30: tiene22_30,
      fragmento_con_0883: fragmentoCon0883,
      relevancia: (tiene0883 ? 10 : 0) + (tieneTurista ? 5 : 0) + (tiene22_15 || tiene22_30 ? 3 : 0)
    };
  }

  async function probarFuente(nombre, url) {
    try {
      const response = await fetch(url, { 
        headers,
        signal: AbortSignal.timeout(10000) // timeout 10 seg
      });
      
      if (!response.ok) {
        return { 
          accesible: false, 
          status: response.status 
        };
      }

      const html = await response.text();
      const texto = htmlATexto(html);
      const analisis = buscarNumero0883(texto, html);

      return {
        accesible: true,
        status: 200,
        ...analisis,
        longitud_html: html.length,
        longitud_texto: texto.length
      };

    } catch(e) {
      return { 
        accesible: false, 
        error: e.message 
      };
    }
  }

  // FUENTES A PROBAR
  const fuentes = [
    { nombre: 'quinieladehoy', url: 'https://quinieladehoy.com.ar/quiniela' },
    { nombre: 'loteriasmundiales_cordoba', url: 'https://www.loteriasmundiales.com.ar/Quinielas/cordoba' },
    { nombre: 'loteriasmundiales_entrerrios', url: 'https://www.loteriasmundiales.com.ar/Quinielas/entre-rios' },
    { nombre: 'resultadoquiniela', url: 'https://www.resultadoquiniela.com.ar/' },
    { nombre: 'resultadoquiniela_cordoba', url: 'https://www.resultadoquiniela.com.ar/cordoba' },
    { nombre: 'quinieleros', url: 'https://www.quinieleros.com/' },
    { nombre: 'quinieleros_cordoba', url: 'https://www.quinieleros.com/cordoba' },
    { nombre: 'laquiniela_ar', url: 'https://laquiniela.ar/' },
    { nombre: 'laquiniela_cordoba', url: 'https://laquiniela.ar/cordoba' }
  ];

  // Probar todas las fuentes
  for (const fuente of fuentes) {
    resultado.fuentes[fuente.nombre] = await probarFuente(fuente.nombre, fuente.url);
  }

  // Ranking por relevancia
  const ranking = Object.entries(resultado.fuentes)
    .filter(([_, data]) => data.accesible)
    .sort((a, b) => (b[1].relevancia || 0) - (a[1].relevancia || 0))
    .map(([nombre, data]) => ({
      nombre,
      relevancia: data.relevancia,
      tiene_0883: data.tiene_0883,
      tiene_turista: data.tiene_turista,
      tiene_horario: data.tiene_horario_22_15 || data.tiene_horario_22_30
    }));

  resultado.ranking = ranking;
  resultado.mejor_fuente = ranking.length > 0 ? ranking[0] : null;

  // Si encontramos alguna fuente con 0883, extraer más contexto
  const fuenteCon0883 = Object.entries(resultado.fuentes).find(([_, data]) => data.tiene_0883);
  if (fuenteCon0883) {
    resultado.fuente_exitosa = {
      nombre: fuenteCon0883[0],
      fragmento: fuenteCon0883[1].fragmento_con_0883,
      recomendacion: "Esta fuente tiene el número 0883. Usar esta para Turista."
    };
  }

  res.status(200).json(resultado);
}
