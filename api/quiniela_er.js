// DIAGNÓSTICO POR HORARIOS - Identificar códigos Q según horario del sorteo
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Identificación de códigos Q de Salta/Jujuy por HORARIO",
    salta: {
      sorteos_por_horario: {},
      todos_horarios_encontrados: [],
      fragmentos_html: {}
    },
    jujuy: {
      sorteos_por_horario: {},
      todos_horarios_encontrados: [],
      fragmentos_html: {}
    }
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function buscarCodigoPorHorario(html, horario) {
    // Buscar el horario en el HTML y encontrar el código Q más cercano
    const regexHorario = new RegExp(horario.replace(':', ':?'), 'gi');
    const matchHorario = regexHorario.exec(html);
    
    if (!matchHorario) return null;

    // Buscar el código Q después del horario (los primeros 800 caracteres)
    const fragmento = html.substring(matchHorario.index, matchHorario.index + 800);
    const regexCodigo = /idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i;
    const matchCodigo = fragmento.match(regexCodigo);

    if (matchCodigo) {
      return {
        quiniela: parseInt(matchCodigo[1]),
        sorteo: parseInt(matchCodigo[2]),
        codigo: `Q${matchCodigo[1]}_${matchCodigo[2]}`,
        cabeza: matchCodigo[3].padStart(4, '0'),
        posicion_horario: matchHorario.index,
        fragmento: fragmento.substring(0, 400)
      };
    }

    return null;
  }

  function extraerTodosLosHorarios(html) {
    const horarios = [];
    const regexHorarios = /(\d{1,2}):?(\d{2})?\s*(Hs?\.?|hs?\.?|horas?)?/gi;
    let match;
    
    while ((match = regexHorarios.exec(html)) !== null) {
      const hora = match[1].padStart(2, '0');
      const minuto = match[2] ? match[2].padStart(2, '0') : '00';
      const horarioFormato = `${hora}:${minuto}`;
      
      // Guardar contexto
      const inicio = Math.max(0, match.index - 100);
      const fin = Math.min(html.length, match.index + 300);
      
      horarios.push({
        horario: horarioFormato,
        posicion: match.index,
        contexto: html.substring(inicio, fin).replace(/\s+/g, ' ')
      });
    }
    
    return horarios;
  }

  // SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Mapeo de horarios a sorteos
      const horariosEsperados = {
        '11:30': 'primera',
        '11.30': 'primera',
        '14:00': 'matutina',
        '14.00': 'matutina',
        '15:30': 'matutina',
        '15.30': 'matutina',
        '17:30': 'vespertina',
        '17.30': 'vespertina',
        '19:30': 'vespertina',
        '19.30': 'vespertina',
        '21:00': 'nocturna',
        '21.00': 'nocturna',
        '21:15': 'nocturna',
        '21.15': 'nocturna',
        '22:30': 'nocturna',
        '22.30': 'nocturna'
      };

      // Buscar por cada horario
      for (const [horario, sorteo] of Object.entries(horariosEsperados)) {
        const info = buscarCodigoPorHorario(html, horario);
        if (info && !resultado.salta.sorteos_por_horario[sorteo]) {
          resultado.salta.sorteos_por_horario[sorteo] = {
            horario: horario,
            ...info
          };
          resultado.salta.fragmentos_html[sorteo] = info.fragmento;
        }
      }

      // Extraer TODOS los horarios encontrados
      resultado.salta.todos_horarios_encontrados = extraerTodosLosHorarios(html).slice(0, 20);
    }
  } catch(e) {
    resultado.salta.error = e.message;
  }

  // JUJUY
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Mapeo de horarios a sorteos
      const horariosEsperados = {
        '12:00': 'primera',
        '12.00': 'primera',
        '14:00': 'matutina',
        '14.00': 'matutina',
        '15:30': 'matutina',
        '15.30': 'matutina',
        '17:30': 'vespertina',
        '17.30': 'vespertina',
        '19:30': 'vespertina',
        '19.30': 'vespertina',
        '21:00': 'nocturna',
        '21.00': 'nocturna',
        '21:15': 'nocturna',
        '21.15': 'nocturna',
        '22:30': 'nocturna',
        '22.30': 'nocturna'
      };

      // Buscar por cada horario
      for (const [horario, sorteo] of Object.entries(horariosEsperados)) {
        const info = buscarCodigoPorHorario(html, horario);
        if (info && !resultado.jujuy.sorteos_por_horario[sorteo]) {
          resultado.jujuy.sorteos_por_horario[sorteo] = {
            horario: horario,
            ...info
          };
          resultado.jujuy.fragmentos_html[sorteo] = info.fragmento;
        }
      }

      // Extraer TODOS los horarios encontrados
      resultado.jujuy.todos_horarios_encontrados = extraerTodosLosHorarios(html).slice(0, 20);
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  // Guía de interpretación
  resultado.guia = {
    mapeo_esperado: {
      salta: {
        primera: "11:30 Hs",
        matutina: "14:00-15:30 Hs",
        vespertina: "17:30-19:30 Hs",
        nocturna: "21:00-22:30 Hs"
      },
      jujuy: {
        primera: "12:00 Hs",
        matutina: "14:00-15:30 Hs",
        vespertina: "17:30-19:30 Hs",
        nocturna: "21:00-22:30 Hs"
      }
    },
    instrucciones: "Revisar 'sorteos_por_horario' para ver qué código Q corresponde a cada horario"
  };

  res.status(200).json(resultado);
}
