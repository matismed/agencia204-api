// DIAGNÓSTICO - Scraper de Turista de tujugada.com.ar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Diagnóstico de scraper Turista - Córdoba y Entre Ríos",
    urls: {
      cordoba: "https://www.tujugada.com.ar/quinielas/cordoba/turista",
      entrerrios: "https://www.tujugada.com.ar/quinielas/entre-rios/turista"
    },
    resultados: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.tujugada.com.ar/'
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

  async function scrapearTurista(provincia, url) {
    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const html = await response.text();
      const texto = htmlATexto(html);

      // Estrategia 1: Buscar patrón "Turista" + fecha
      const regexTurista = /Turista\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
      const matchTurista = regexTurista.exec(texto);

      const analisis = {
        url_accedida: url,
        status: response.status,
        tiene_palabra_turista: texto.toLowerCase().includes('turista'),
        match_turista_fecha: matchTurista ? matchTurista[0] : null,
        fecha_encontrada: matchTurista ? matchTurista[1] : null
      };

      // Estrategia 2: Buscar tabla con números
      // Patrón: buscar secuencia de pares "número_posición número_4_dígitos"
      const numeros = [];
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
      
      analisis.primeras_100_lineas = lineas.slice(0, 100);

      // Buscar patrón: 1 seguido de un número de 4 dígitos
      for (let i = 0; i < lineas.length && numeros.length < 20; i++) {
        const pos = parseInt(lineas[i]);
        
        // Si la línea es un número del 1-20 y la siguiente es un número de 4 dígitos
        if (pos >= 1 && pos <= 20 && pos === numeros.length + 1) {
          if (lineas[i + 1] && /^\d{4}$/.test(lineas[i + 1])) {
            numeros.push({
              pos: pos,
              num: lineas[i + 1],
              linea_pos: lineas[i],
              linea_num: lineas[i + 1]
            });
            i++; // saltar la línea del número
          }
        }
      }

      analisis.numeros_encontrados = numeros;
      analisis.cantidad_numeros = numeros.length;
      analisis.cabeza = numeros.length > 0 ? numeros[0].num : null;

      // Estrategia 3: Buscar en el HTML directamente (sin convertir a texto)
      // Buscar tabla con class o id que contenga "turista"
      const regexTabla = /<table[^>]*>([\s\S]*?)<\/table>/gi;
      const tablas = [];
      let matchTabla;
      while ((matchTabla = regexTabla.exec(html)) !== null && tablas.length < 3) {
        const contenidoTabla = matchTabla[1];
        if (contenidoTabla.toLowerCase().includes('turista') || 
            contenidoTabla.toLowerCase().includes('22:15') ||
            contenidoTabla.toLowerCase().includes('22:30')) {
          tablas.push({
            longitud: contenidoTabla.length,
            fragmento: contenidoTabla.substring(0, 500)
          });
        }
      }
      analisis.tablas_con_turista = tablas;

      // Estrategia 4: Buscar elementos <td> o <div> con números
      const regexTd = /<td[^>]*>(\d{4})<\/td>/gi;
      const numerosTd = [];
      let matchTd;
      while ((matchTd = regexTd.exec(html)) !== null && numerosTd.length < 20) {
        numerosTd.push(matchTd[1]);
      }
      analisis.numeros_en_td = numerosTd.slice(0, 20);

      return analisis;

    } catch (error) {
      return { error: error.message };
    }
  }

  // Scrapear Córdoba Turista
  resultado.resultados.cordoba = await scrapearTurista('Córdoba', resultado.urls.cordoba);

  // Scrapear Entre Ríos Turista
  resultado.resultados.entrerrios = await scrapearTurista('Entre Ríos', resultado.urls.entrerrios);

  res.status(200).json(resultado);
}
