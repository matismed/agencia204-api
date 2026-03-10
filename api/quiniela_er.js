// IDENTIFICADOR AUTOMÁTICO DE CÓDIGOS Q para Salta y Jujuy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Identificación automática de códigos Q por nombre de sorteo",
    salta: { codigos: {}, analisis: {} },
    jujuy: { codigos: {}, analisis: {} }
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  // Función para identificar códigos Q y sus sorteos asociados
  function identificarSorteos(html) {
    const sorteos = {
      previa: null,
      primera: null,
      matutina: null,
      vespertina: null,
      nocturna: null
    };
    
    const analisis = [];

    // Buscar todas las secciones que contienen nombres de sorteos
    // Patrón: buscar texto como "PREVIA", "PRIMERA", "MATUTINA", etc. cerca de códigos idQ
    
    // Estrategia: buscar el patrón completo de una sección de sorteo
    const patronesSorteo = [
      { nombre: 'previa', regex: /(PREVIA|Previa|11:?15)[\s\S]{0,500}?idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i },
      { nombre: 'primera', regex: /(PRIMERA|Primera|12:?00)[\s\S]{0,500}?idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i },
      { nombre: 'matutina', regex: /(MATUTINA|Matutina|14:?00)[\s\S]{0,500}?idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i },
      { nombre: 'vespertina', regex: /(VESPERTINA|Vespertina|17:?30)[\s\S]{0,500}?idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i },
      { nombre: 'nocturna', regex: /(NOCTURNA|Nocturna|21:?15)[\s\S]{0,500}?idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/i }
    ];

    for (const patron of patronesSorteo) {
      const match = html.match(patron.regex);
      if (match) {
        const quiniela = match[2];
        const sorteo = match[3];
        const cabeza = match[4].padStart(4, '0');
        
        sorteos[patron.nombre] = {
          quiniela: parseInt(quiniela),
          sorteo: parseInt(sorteo),
          codigo: `Q${quiniela}_${sorteo}`,
          cabeza: cabeza
        };
        
        analisis.push({
          sorteo: patron.nombre,
          encontrado: true,
          codigo: `Q${quiniela}_${sorteo}`,
          cabeza: cabeza,
          contexto: match[1]
        });
      } else {
        analisis.push({
          sorteo: patron.nombre,
          encontrado: false
        });
      }
    }

    return { sorteos, analisis };
  }

  // Función alternativa: buscar por orden de aparición
  function identificarPorOrden(html) {
    const todosLosCodigos = [];
    const regex = /idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const quiniela = match[1];
      const sorteo = match[2];
      const cabeza = match[3].padStart(4, '0');
      const codigo = `Q${quiniela}_${sorteo}`;
      
      // Evitar duplicados
      if (!todosLosCodigos.find(c => c.codigo === codigo)) {
        todosLosCodigos.push({
          codigo: codigo,
          quiniela: parseInt(quiniela),
          sorteo: parseInt(sorteo),
          cabeza: cabeza,
          posicion: todosLosCodigos.length
        });
      }
    }
    
    return todosLosCodigos;
  }

  // SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Método 1: Identificación por nombre
      const { sorteos, analisis } = identificarSorteos(html);
      resultado.salta.codigos = sorteos;
      resultado.salta.analisis = analisis;
      
      // Método 2: Por orden de aparición (backup)
      resultado.salta.todosLosCodigos = identificarPorOrden(html);
      
      // Guardar fragmento del HTML para análisis manual si es necesario
      const index = html.toLowerCase().indexOf('primera');
      if (index !== -1) {
        resultado.salta.fragmentoHTML = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 1000));
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
      
      // Método 1: Identificación por nombre
      const { sorteos, analisis } = identificarSorteos(html);
      resultado.jujuy.codigos = sorteos;
      resultado.jujuy.analisis = analisis;
      
      // Método 2: Por orden de aparición (backup)
      resultado.jujuy.todosLosCodigos = identificarPorOrden(html);
      
      // Guardar fragmento del HTML para análisis manual si es necesario
      const index = html.toLowerCase().indexOf('primera');
      if (index !== -1) {
        resultado.jujuy.fragmentoHTML = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 1000));
      }
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  // Agregar guía de interpretación
  resultado.guia = {
    mensaje: "Si 'codigos' tiene valores null, usar 'todosLosCodigos' para asignar manualmente",
    ordenEsperado: "Generalmente: [0]=Previa, [1]=Primera, [2]=Matutina, [3]=Vespertina, [4]=Nocturna",
    comoUsar: "Revisar 'analisis' para ver qué sorteos fueron identificados automáticamente"
  };

  res.status(200).json(resultado);
}

