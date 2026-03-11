// DIAGNÓSTICO ESPECÍFICO JUJUY - Buscar por horarios exactos
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Mapeo de horarios de Jujuy a sorteos de mi página",
    jujuy_loteriasmundiales: {},
    mapeo_a_mi_pagina: {}
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

  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Horarios que aparecen en loteriasmundiales
      const horariosLoteriasMundiales = {
        '10:15': null,  // 4242
        '11:30': null,  // 0370
        '14:00': null,  // 4206
        '15:30': null,  // podría ser el mismo que 14:00
        '17:30': null,  // 9555
        '19:30': null,  // podría ser el mismo que 17:30
        '21:00': null,
        '22:30': null
      };

      // Buscar cada horario
      for (const horario of Object.keys(horariosLoteriasMundiales)) {
        const info = buscarCodigoPorHorario(html, horario);
        if (info) {
          horariosLoteriasMundiales[horario] = info;
        }
      }

      resultado.jujuy_loteriasmundiales = horariosLoteriasMundiales;

      // Mapeo a mi página
      // En mi página Jujuy tiene: Primera (12:00), Matutina (14:00), Vespertina (17:30), Nocturna (21:15)
      // Pero en loteriasmundiales los horarios son: 10:15, 11:30, 14:00, 17:30, 21:00
      
      // ESTRATEGIA: Mapear según el horario más cercano
      resultado.mapeo_a_mi_pagina = {
        primera: {
          horario_mi_pagina: "12:00",
          horario_loteriasmundiales: "10:15 o 11:30",
          sugerencia: "Usar 10:15 (4242) porque es el primer sorteo del día",
          codigo_sugerido: horariosLoteriasMundiales['10:15']
        },
        matutina: {
          horario_mi_pagina: "14:00",
          horario_loteriasmundiales: "14:00",
          sugerencia: "Usar 14:00 directamente",
          codigo_sugerido: horariosLoteriasMundiales['14:00']
        },
        vespertina: {
          horario_mi_pagina: "17:30",
          horario_loteriasmundiales: "17:30",
          sugerencia: "Usar 17:30 directamente",
          codigo_sugerido: horariosLoteriasMundiales['17:30']
        },
        nocturna: {
          horario_mi_pagina: "21:15",
          horario_loteriasmundiales: "21:00 o 22:30",
          sugerencia: "Usar 21:00 o el último sorteo del día",
          codigo_sugerido: horariosLoteriasMundiales['21:00'] || horariosLoteriasMundiales['22:30']
        }
      };
    }
  } catch(e) {
    resultado.error = e.message;
  }

  res.status(200).json(resultado);
}
