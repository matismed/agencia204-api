// DIAGNÓSTICO - Encontrar códigos Q de Córdoba en loteriasmundiales.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Búsqueda de códigos Q de Córdoba en loteriasmundiales.com",
    url: "https://www.loteriasmundiales.com.ar/Quinielas/cordoba",
    codigos_encontrados: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function extraerCabeza(html, quiniela, sorteo) {
    const id = `idQ${quiniela}_${sorteo}_N01`;
    const patterns = [
      `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
      `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim().padStart(4, '0');
      }
    }
    return null;
  }

  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/cordoba', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Buscar TODOS los códigos Q posibles (probamos quinelas del 1 al 30)
      for (let quiniela = 1; quiniela <= 30; quiniela++) {
        const sorteosEncontrados = [];
        
        // Probar sorteos 0 al 5 para cada quiniela
        for (let sorteo = 0; sorteo <= 5; sorteo++) {
          const cabeza = extraerCabeza(html, quiniela, sorteo);
          if (cabeza) {
            sorteosEncontrados.push({
              sorteo: sorteo,
              codigo: `Q${quiniela}_${sorteo}`,
              cabeza: cabeza
            });
          }
        }
        
        if (sorteosEncontrados.length > 0) {
          resultado.codigos_encontrados[`Q${quiniela}`] = sorteosEncontrados;
        }
      }

      // Análisis: cuál quiniela tiene 5 sorteos (previa, primera, matutina, vespertina, nocturna)
      resultado.analisis = {};
      for (const [qKey, sorteos] of Object.entries(resultado.codigos_encontrados)) {
        resultado.analisis[qKey] = {
          cantidad_sorteos: sorteos.length,
          sorteos_indices: sorteos.map(s => s.sorteo),
          probable_mapeo: sorteos.length === 5 ? "Tiene 5 sorteos - podría ser Córdoba completa" : 
                         sorteos.length === 4 ? "Tiene 4 sorteos - sin previa" : null
        };
      }

      // Buscar horarios en el HTML para ayudar a identificar
      const regexHorarios = /(\d{1,2})[:\.,](\d{2})\s*(?:hs|Hs)/gi;
      const horarios = [];
      let match;
      while ((match = regexHorarios.exec(html)) !== null && horarios.length < 20) {
        horarios.push(`${match[1]}:${match[2]}`);
      }
      resultado.horarios_encontrados = [...new Set(horarios)];

    } else {
      resultado.error = `HTTP ${response.status}`;
    }
  } catch(e) {
    resultado.error = e.message;
  }

  res.status(200).json(resultado);
}
