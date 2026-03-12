// DIAGNÓSTICO - Buscar Turista en loteriasmundiales.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Búsqueda de sorteo Turista en loteriasmundiales.com",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function extraerNumeros(html, quiniela, sorteo) {
    const numeros = [];
    
    for (let pos = 1; pos <= 20; pos++) {
      const posStr = pos.toString().padStart(2, '0');
      const id = `idQ${quiniela}_${sorteo}_N${posStr}`;
      
      const patterns = [
        `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
        `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`
      ];

      let numero = null;
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        const match = html.match(regex);
        if (match && match[1]) {
          numero = match[1].trim().padStart(4, '0');
          break;
        }
      }

      if (numero) {
        numeros.push({ pos, num: numero });
      }
    }

    return numeros;
  }

  // CÓRDOBA - Buscar Q6_4 (siguiente después de Q6_3 que es nocturna)
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/cordoba', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Buscar todos los sorteos Q6 posibles
      const sorteos = {};
      for (let i = 0; i <= 10; i++) {
        const nums = extraerNumeros(html, 6, i);
        if (nums.length > 0) {
          sorteos[`Q6_${i}`] = {
            codigo: `Q6_${i}`,
            cabeza: nums[0].num,
            cantidad: nums.length,
            primeros_3: nums.slice(0, 3)
          };
        }
      }
      
      resultado.provincias.cordoba = {
        url: 'https://www.loteriasmundiales.com.ar/Quinielas/cordoba',
        sorteos_encontrados: sorteos,
        tiene_Q6_4: !!sorteos.Q6_4,
        Q6_4_seria_turista: sorteos.Q6_4 ? sorteos.Q6_4.cabeza : null
      };

      // Buscar "22:15" o "22:30" o "Turista" en el HTML
      const tiene22_15 = html.includes('22:15') || html.includes('22,15');
      const tiene22_30 = html.includes('22:30') || html.includes('22,30');
      const tieneTurista = html.toLowerCase().includes('turista');
      
      resultado.provincias.cordoba.horarios_encontrados = {
        '22:15': tiene22_15,
        '22:30': tiene22_30,
        turista_mencionado: tieneTurista
      };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS - Buscar en loteriasmundiales (puede ser otra quiniela)
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/entre-rios', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Buscar TODAS las quinelas posibles
      const todasQuinielas = {};
      for (let q = 1; q <= 30; q++) {
        for (let s = 0; s <= 10; s++) {
          const nums = extraerNumeros(html, q, s);
          if (nums.length > 0) {
            if (!todasQuinielas[`Q${q}`]) {
              todasQuinielas[`Q${q}`] = [];
            }
            todasQuinielas[`Q${q}`].push({
              sorteo: s,
              codigo: `Q${q}_${s}`,
              cabeza: nums[0].num
            });
          }
        }
      }
      
      resultado.provincias.entrerrios = {
        url: 'https://www.loteriasmundiales.com.ar/Quinielas/entre-rios',
        quinelas_encontradas: todasQuinielas,
        cantidad_quinelas: Object.keys(todasQuinielas).length
      };

      // Buscar "22:15" o "22:30" o "Turista"
      const tiene22_15 = html.includes('22:15') || html.includes('22,15');
      const tiene22_30 = html.includes('22:30') || html.includes('22,30');
      const tieneTurista = html.toLowerCase().includes('turista');
      
      resultado.provincias.entrerrios.horarios_encontrados = {
        '22:15': tiene22_15,
        '22:30': tiene22_30,
        turista_mencionado: tieneTurista
      };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  res.status(200).json(resultado);
}
