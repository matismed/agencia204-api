// api/quiniela_er.js — DIAGNÓSTICO COMPLETO - Todos los códigos
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const resultado = {
    actualizado: ahora,
    fecha: hoy,
    mensaje: "Diagnóstico completo - Mostrando TODOS los códigos encontrados",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function extraerPrimerNumero(html, codigoQuiniela, codigoSorteo) {
    const id = `idQ${codigoQuiniela}_${codigoSorteo}_N01`;
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

  // Configuración de provincias
  const provincias = [
    { 
      key: 'nacional', 
      nombre: 'Nacional (Ciudad)',
      url: '/Quinielas/ciudad', 
      codigosQuiniela: [6, 14, 15, 26, 27],
      codigosSorteo: [0, 1, 5]
    },
    { 
      key: 'bsas', 
      nombre: 'Buenos Aires',
      url: '/Quinielas/buenos-aires', 
      codigosQuiniela: [6, 15, 26, 27],
      codigosSorteo: [0, 5]
    },
    { 
      key: 'cordoba', 
      nombre: 'Córdoba',
      url: '/Quinielas/cordoba', 
      codigosQuiniela: [6, 26, 27],
      codigosSorteo: [0, 5]
    },
    { 
      key: 'santafe', 
      nombre: 'Santa Fe',
      url: '/Quinielas/santa-fe', 
      codigosQuiniela: [15, 26, 27],
      codigosSorteo: [0, 5]
    },
    { 
      key: 'entrerrios', 
      nombre: 'Entre Ríos',
      url: '/Quinielas/entre-rios', 
      codigosQuiniela: [14, 15, 26, 27],
      codigosSorteo: [0, 5]
    },
    { 
      key: 'salta', 
      nombre: 'Salta',
      url: '/Quinielas/salta', 
      codigosQuiniela: [10, 20, 23, 26, 27],
      codigosSorteo: [0]
    },
    { 
      key: 'jujuy', 
      nombre: 'Jujuy',
      url: '/Quinielas/jujena', 
      codigosQuiniela: [23, 26, 27],
      codigosSorteo: [0, 5]
    },
    { 
      key: 'montevideo', 
      nombre: 'Montevideo',
      url: '/Quinielas/uruguaya', 
      codigosQuiniela: [11],
      codigosSorteo: [1, 3]
    }
  ];

  for (const prov of provincias) {
    try {
      const response = await fetch(`https://www.loteriasmundiales.com.ar${prov.url}`, { headers });
      
      if (response.ok) {
        const html = await response.text();
        
        resultado.provincias[prov.key] = {
          nombre: prov.nombre,
          url: prov.url,
          codigos: {}
        };

        // Probar todas las combinaciones posibles
        for (const codQuiniela of prov.codigosQuiniela) {
          for (const codSorteo of prov.codigosSorteo) {
            const cabeza = extraerPrimerNumero(html, codQuiniela, codSorteo);
            
            if (cabeza) {
              const clave = `Q${codQuiniela}_${codSorteo}`;
              resultado.provincias[prov.key].codigos[clave] = cabeza;
            }
          }
        }
      }
    } catch (error) {
      resultado.provincias[prov.key] = { 
        nombre: prov.nombre,
        error: error.message 
      };
    }
  }

  // Instrucciones para el usuario
  resultado.instrucciones = {
    mensaje: "Compara estos resultados con quinieladehoy.com",
    pasos: [
      "1. Ve a https://quinieladehoy.com/quiniela",
      "2. Busca la Quiniela de la Ciudad y anota las cabezas de cada sorteo",
      "3. Busca en este JSON qué código (Q6_0, Q14_1, etc.) tiene la misma cabeza",
      "4. Comparte el mapeo correcto"
    ],
    ejemplo: {
      "Si en quinieladehoy.com ves": "Ciudad Previa = 9921",
      "Y en este JSON encuentras": "Q6_0 = 9921",
      "Entonces": "Previa usa el código Q6_0"
    }
  };

  res.status(200).json(resultado);
}
