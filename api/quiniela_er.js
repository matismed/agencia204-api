// api/quiniela_er.js — VERSIÓN FINAL desde vivitusuerte.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const horaActual = ahoraArgentina.getHours();
  const minutoActual = ahoraArgentina.getMinutes();
  const horaActualMinutos = horaActual * 60 + minutoActual;
  const diaSemana = ahoraArgentina.getDay();

  const esDomingo = diaSemana === 0;
  const esSabado = diaSemana === 6;
  const esLunesAViernes = diaSemana >= 1 && diaSemana <= 5;

  const horariosSorteos = {
    previa: { hora: 11, minuto: 15, minutosDia: 11 * 60 + 15 },
    primera: { hora: 12, minuto: 0, minutosDia: 12 * 60 },
    matutina: { hora: 14, minuto: 0, minutosDia: 14 * 60 },
    vespertina: { hora: 17, minuto: 30, minutosDia: 17 * 60 + 30 },
    nocturna: { hora: 21, minuto: 15, minutosDia: 21 * 60 + 15 }
  };

  function sorteoYaOcurrio(sorteo) {
    const horario = horariosSorteos[sorteo];
    if (!horario) return false;
    return horaActualMinutos >= horario.minutosDia;
  }

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];
  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const resultado = { 
    actualizado: ahora, 
    fecha: hoy, 
    horaActual: `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`,
    diaSemana: nombresDias[diaSemana],
    provincias: {}
  };

  // Provincias a scrapear
  const provincias = [
    { key: 'nacional', url: '/pizarra/ciudad', nombre: 'Nacional' },
    { key: 'bsas', url: '/pizarra/buenos-aires', nombre: 'Buenos Aires' },
    { key: 'cordoba', url: '/pizarra/cordoba', nombre: 'Córdoba' },
    { key: 'santafe', url: '/pizarra/santa-fe', nombre: 'Santa Fe' },
    { key: 'entrerrios', url: '/pizarra/entre-rios', nombre: 'Entre Ríos' },
    { key: 'salta', url: '/pizarra/salta', nombre: 'Salta' },
    { key: 'jujuy', url: '/pizarra/jujuy', nombre: 'Jujuy' },
    { key: 'montevideo', url: '/pizarra/montevideo', nombre: 'Montevideo' }
  ];

  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }]))
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function sorteoDisponible(provinciaKey, sorteo) {
    if (esDomingo && (provinciaKey === 'salta' || provinciaKey === 'jujuy' || provinciaKey === 'entrerrios')) {
      return sorteo === 'primera' || sorteo === 'matutina';
    }
    
    if (provinciaKey === 'montevideo') {
      if (sorteo === 'previa' || sorteo === 'vespertina') return false;
      if (esLunesAViernes) return sorteo === 'matutina' || sorteo === 'nocturna';
      if (esSabado) return sorteo === 'nocturna';
      if (esDomingo) return false;
    }

    return true;
  }

  function parsearPizarra(html) {
    const resultados = {};
    
    // Mapeo de data-pizarra-momento a nombre de sorteo
    const momentoMap = {
      '5': 'previa',      // La Previa
      '1': 'primera',     // Primera
      '2': 'matutina',    // Matutina
      '3': 'vespertina',  // Vespertina
      '4': 'nocturna'     // Nocturna
    };

    for (const [momento, sorteoKey] of Object.entries(momentoMap)) {
      // Buscar tabla con data-pizarra-momento
      const tableRegex = new RegExp(`<table[^>]*data-pizarra-momento="${momento}"[^>]*>([\\s\\S]*?)<\\/table>`, 'i');
      const tableMatch = html.match(tableRegex);
      
      if (tableMatch) {
        const tablaHTML = tableMatch[1];
        
        // Extraer todos los números con clase "caja-resultado"
        const numerosRegex = /<span[^>]*class="caja-resultado"[^>]*data-texto="momento_dato_(\d+)"[^>]*>(\d{4})<\/span>/g;
        const numeros = [];
        let match;
        
        while ((match = numerosRegex.exec(tablaHTML)) !== null) {
          const posicion = parseInt(match[1]);
          const numero = match[2];
          
          // Verificar que no sea "----" (pendiente)
          if (numero && numero !== '----' && /^\d{4}$/.test(numero)) {
            numeros.push({ pos: posicion, num: numero });
          }
        }
        
        // Solo guardar si tenemos los 20 números
        if (numeros.length === 20) {
          // Ordenar por posición
          numeros.sort((a, b) => a.pos - b.pos);
          resultados[sorteoKey] = { fecha: hoy, numeros };
        }
      }
    }

    return resultados;
  }

  // Fetch de cada provincia
  for (const provincia of provincias) {
    try {
      const url = `https://vivitusuerte.com${provincia.url}`;
      const response = await fetch(url, { headers });
      
      if (response.ok) {
        const html = await response.text();
        const resultadosProv = parsearPizarra(html);

        for (const sorteo of sorteos) {
          if (!sorteoDisponible(provincia.key, sorteo)) {
            resultado.provincias[provincia.key].sorteos[sorteo] = {
              fecha: hoy,
              numeros: [],
              noDisponible: true
            };
            continue;
          }

          if (sorteo === 'nocturna') {
            if (!sorteoYaOcurrio('nocturna')) {
              resultado.provincias[provincia.key].sorteos.nocturna = {
                fecha: hoy, 
                numeros: [], 
                pendiente: true, 
                horaPrevista: '21:15'
              };
            } else {
              resultado.provincias[provincia.key].sorteos.nocturna = resultadosProv.nocturna || { fecha: hoy, numeros: [] };
            }
            continue;
          }

          if (sorteoYaOcurrio(sorteo)) {
            resultado.provincias[provincia.key].sorteos[sorteo] = resultadosProv[sorteo] || { fecha: hoy, numeros: [] };
          } else {
            resultado.provincias[provincia.key].sorteos[sorteo] = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true,
              horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
            };
          }
        }
      }
    } catch(e) {
      resultado[`_error_${provincia.key}`] = e.message;
    }
  }

  res.status(200).json(resultado);
}

