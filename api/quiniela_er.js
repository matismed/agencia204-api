// api/quiniela_er.js — Usando SOLO loteriasmundiales.com.ar para TODAS las provincias
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Mapeo de provincias a sus URLs y códigos en loteriasmundiales.com.ar
  const provinciasConfig = {
    nacional: {
      nombre: 'Nacional',
      url: '/Quinielas/ciudad',
      codigoQuiniela: 1  // idQ1_X_N01 para Ciudad/Nacional
    },
    bsas: {
      nombre: 'Buenos Aires',
      url: '/Quinielas/buenos-aires',
      codigoQuiniela: 2  // idQ2_X_N01 para Buenos Aires
    },
    cordoba: {
      nombre: 'Córdoba',
      url: '/Quinielas/cordoba',
      codigoQuiniela: 4  // idQ4_X_N01 para Córdoba
    },
    santafe: {
      nombre: 'Santa Fe',
      url: '/Quinielas/santa-fe',
      codigoQuiniela: 6  // idQ6_X_N01 para Santa Fe
    },
    entrerrios: {
      nombre: 'Entre Ríos',
      url: '/Quinielas/entre-rios',
      codigoQuiniela: 8  // idQ8_X_N01 para Entre Ríos
    },
    montevideo: {
      nombre: 'Montevideo',
      url: '/Quinielas/uruguaya',
      codigoQuiniela: 11 // idQ11_X_N01 para Uruguay
    }
  };

  // Mapeo de sorteos (ID de momento en loteriasmundiales)
  const sorteosConfig = {
    previa: { nombre: 'Previa', codigoMomento: 5 },
    primera: { nombre: 'Primera', codigoMomento: 0 },
    matutina: { nombre: 'Matutina', codigoMomento: 1 },
    vespertina: { nombre: 'Vespertina', codigoMomento: 2 },
    nocturna: { nombre: 'Nocturna', codigoMomento: 3 }
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

  // ── Parser universal para loteriasmundiales.com.ar ───────────────────────
  function parsearLoteriasMundiales(html, codigoQuiniela) {
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
      const codigoMomento = sorteoInfo.codigoMomento;

      // Extraer los 20 números para este sorteo
      // Formato: idQ{quiniela}_{momento}_N{posicion}
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const idPattern = `idQ${codigoQuiniela}_${codigoMomento}_N${posStr}`;
        
        // Buscar patrones:
        // <td id="idQX_Y_NZZ" class="..."><b>NNNN</b></td>
        // <td id="idQX_Y_NZZ">NNNN</td>
        // <td id="idQX_Y_NZZ" class="...">NNNN</td>
        const regex = new RegExp(`id="${idPattern}"[^>]*>(?:<b>)?\\s*([0-9]{3,4})\\s*(?:</b>)?<`, 'i');
        const match = html.match(regex);
        
        if (match && match[1]) {
          // Asegurar 4 dígitos (algunos pueden venir con 3)
          const numero = match[1].trim().padStart(4, '0');
          numeros.push({ pos: pos, num: numero });
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
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      
      const resultadosProvincia = parsearLoteriasMundiales(html, config.codigoQuiniela);

      // Asignar los resultados a cada sorteo
      for (const [sorteoKey, sorteoData] of Object.entries(resultadosProvincia)) {
        resultado.provincias[provinciaKey].sorteos[sorteoKey] = sorteoData;
      }

    } catch(e) {
      resultado[`_error_${provinciaKey}`] = e.message;
      console.error(`Error fetching ${provinciaKey}:`, e.message);
    }
  }

  res.status(200).json(resultado);
}

