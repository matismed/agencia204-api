// DIAGNÓSTICO COMPLETO - Buscar TODOS los sorteos por horario (incluyendo 17:30, 19:30, 21:00, 22:30)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    salta: { sorteos: {} },
    jujuy: { sorteos: {} }
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function buscarCodigoPorHorario(html, horario) {
    const regexHorario = new RegExp(horario.replace(':', ':?').replace('.', '\\.'), 'gi');
    const matchHorario = regexHorario.exec(html);
    
    if (!matchHorario) return null;

    const fragmento = html.substring(matchHorario.index, matchHorario.index + 800);
    const regexCodigo = /idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i;
    const matchCodigo = fragmento.match(regexCodigo);

    if (matchCodigo) {
      return {
        quiniela: parseInt(matchCodigo[1]),
        sorteo: parseInt(matchCodigo[2]),
        codigo: `Q${matchCodigo[1]}_${matchCodigo[2]}`,
        cabeza: matchCodigo[3].padStart(4, '0')
      };
    }
    return null;
  }

  // SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      const horariosCompletos = {
        primera: ['11:30', '11.30'],
        matutina: ['14:00', '14.00', '15:30', '15.30'],
        vespertina: ['17:30', '17.30', '19:30', '19.30'],
        nocturna: ['21:00', '21.00', '21:15', '21.15', '22:30', '22.30']
      };

      for (const [sorteo, horarios] of Object.entries(horariosCompletos)) {
        for (const horario of horarios) {
          if (!resultado.salta.sorteos[sorteo]) {
            const info = buscarCodigoPorHorario(html, horario);
            if (info) {
              resultado.salta.sorteos[sorteo] = {
                horario_encontrado: horario,
                ...info
              };
              break;
            }
          }
        }
      }
    }
  } catch(e) {
    resultado.salta.error = e.message;
  }

  // JUJUY
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      const horariosCompletos = {
        primera: ['12:00', '12.00'],
        matutina: ['14:00', '14.00', '15:30', '15.30'],
        vespertina: ['17:30', '17.30', '19:30', '19.30'],
        nocturna: ['21:00', '21.00', '21:15', '21.15', '22:30', '22.30']
      };

      for (const [sorteo, horarios] of Object.entries(horariosCompletos)) {
        for (const horario of horarios) {
          if (!resultado.jujuy.sorteos[sorteo]) {
            const info = buscarCodigoPorHorario(html, horario);
            if (info) {
              resultado.jujuy.sorteos[sorteo] = {
                horario_encontrado: horario,
                ...info
              };
              break;
            }
          }
        }
      }
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  // Resumen de mapeo final
  resultado.mapeo_final = {
    salta: {
      previa: { disponible: false },
      primera: resultado.salta.sorteos.primera || null,
      matutina: resultado.salta.sorteos.matutina || null,
      vespertina: resultado.salta.sorteos.vespertina || null,
      nocturna: resultado.salta.sorteos.nocturna || null
    },
    jujuy: {
      previa: { disponible: false },
      primera: resultado.jujuy.sorteos.primera || null,
      matutina: resultado.jujuy.sorteos.matutina || null,
      vespertina: resultado.jujuy.sorteos.vespertina || null,
      nocturna: resultado.jujuy.sorteos.nocturna || null
    }
  };

  res.status(200).json(resultado);
}
