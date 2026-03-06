// api/quiniela_er.js — Versión MEJORADA con detección automática de códigos
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Mapeo de provincias con múltiples códigos posibles para probar
  const provinciasConfig = {
    nacional: {
      nombre: 'Nacional',
      url: '/Quinielas/ciudad',
      codigosQuiniela: [1, 7, 9]  // Probar múltiples códigos
    },
    bsas: {
      nombre: 'Buenos Aires',
      url: '/Quinielas/buenos-aires',
      codigosQuiniela: [2, 5]
    },
    cordoba: {
      nombre: 'Córdoba',
      url: '/Quinielas/cordoba',
      codigosQuiniela: [4, 3]
    },
    santafe: {
      nombre: 'Santa Fe',
      url: '/Quinielas/santa-fe',
      codigosQuiniela: [6, 10]
    },
    entrerrios: {
      nombre: 'Entre Ríos',
      url: '/Quinielas/entre-rios',
      codigosQuiniela: [8, 12]
    },
    montevideo: {
      nombre: 'Montevideo',
      url: '/Quinielas/uruguaya',
      codigosQuiniela: [11]
    }
  };

  // Mapeo de sorteos - TODOS los códigos posibles
  const sorteosConfig = {
    previa: { nombre: 'Previa', codigosMomento: [5, 4] },
    primera: { nombre: 'Primera', codigosMomento: [0, 2] },
    matutina: { nombre: 'Matutina', codigosMomento: [1] },
    vespertina: { nombre: 'Vespertina', codigosMomento: [2, 0] },
    nocturna: { nombre: 'Nocturna', codigosMomento: [3] }
  };

  const sorteos = Object.keys(sorteosConfig);

  // Inicializar estructura de resultado
  const resultado = { actualizado: ahora, fecha: hoy, provincias: {} };
  for (const [key, config] of Object.entries(provinciasConfig)) {
    resultado.provincias[key] = {
      nombre: config.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }]))
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.google.com/'
  };

  // ── Parser que prueba múltiples códigos ──────────────────────────────────
  function parsearLoteriasMundialesFlexible(html, codigosQuiniela) {
    const resultados = {};

    // Extraer fecha del HTML
    let fecha = hoy;
    const fechaMatch = html.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (fechaMatch) {
      const meses = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
      };
      const dia = fechaMatch[1].padStart(2, '0');
      const mes = meses[fechaMatch[2].toLowerCase()];
      const anio = fechaMatch[3];
      if (mes) {
        fecha = `${dia}/${mes}/${anio}`;
      }
    }

    // Procesar cada sorteo
    for (const [sorteoKey, sorteoInfo] of Object.entries(sorteosConfig)) {
      const numeros = [];
      let encontrado = false;

      // Probar con cada código de quiniela y momento
      for (const codigoQuiniela of codigosQuiniela) {
        if (encontrado) break;

        for (const codigoMomento of sorteoInfo.codigosMomento) {
          // Intentar extraer los 20 números
          const numerosTemp = [];
          
          for (let pos = 1; pos <= 20; pos++) {
            const posStr = pos.toString().padStart(2, '0');
            const idPattern = `idQ${codigoQuiniela}_${codigoMomento}_N${posStr}`;
            
            // Buscar múltiples patrones
            const patterns = [
              `id="${idPattern}"[^>]*>(?:<b>)?\\s*([0-9]{3,4})\\s*(?:</b>)?<`,
              `id='${idPattern}'[^>]*>(?:<b>)?\\s*([0-9]{3,4})\\s*(?:</b>)?<`,
              `id=${idPattern}[^>]*>(?:<b>)?\\s*([0-9]{3,4})\\s*(?:</b>)?<`
            ];

            let match = null;
            for (const pattern of patterns) {
              const regex = new RegExp(pattern, 'i');
              match = html.match(regex);
              if (match) break;
            }
            
            if (match && match[1]) {
              const numero = match[1].trim().padStart(4, '0');
              numerosTemp.push({ pos: pos, num: numero });
            }
          }

          // Si encontramos al menos 10 números, consideramos que es válido
          if (numerosTemp.length >= 10) {
            numeros.push(...numerosTemp);
            encontrado = true;
            break;
          }
        }
      }

      // Solo agregar el sorteo si tiene números
      if (numeros.length > 0) {
        resultados[sorteoKey] = { fecha, numeros };
      }
    }

    return resultados;
  }

  // ── Fetch de todas las provincias ────────────────────────────────────────
  for (const [provinciaKey, config] of Object.entries(provinciasConfig)) {
    try {
      const url = `https://www.loteriasmundiales.com.ar${config.url}`;
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        resultado[`_error_${provinciaKey}`] = `HTTP ${response.status}`;
        continue;
      }
      
      const html = await response.text();
      
      // Intentar parsear con los códigos de quiniela
      const resultadosProvincia = parsearLoteriasMundialesFlexible(html, config.codigosQuiniela);

      // Asignar los resultados a cada sorteo
      for (const [sorteoKey, sorteoData] of Object.entries(resultadosProvincia)) {
        resultado.provincias[provinciaKey].sorteos[sorteoKey] = sorteoData;
      }

      // Si no encontramos ningún número, hacer diagnóstico
      const totalNumeros = Object.values(resultadosProvincia).reduce((sum, s) => sum + s.numeros.length, 0);
      if (totalNumeros === 0) {
        // Buscar TODOS los IDs en el HTML para diagnóstico
        const allIds = [...html.matchAll(/id="(idQ\d+_\d+_N\d+)"/gi)].map(m => m[1]);
        if (allIds.length > 0) {
          resultado[`_debug_${provinciaKey}`] = `IDs encontrados: ${allIds.slice(0, 5).join(', ')}...`;
        } else {
          resultado[`_debug_${provinciaKey}`] = 'No se encontraron IDs con formato idQX_Y_NZZ';
        }
      }

    } catch(e) {
      resultado[`_error_${provinciaKey}`] = e.message;
    }
  }

  res.status(200).json(resultado);
}
