// api/quiniela_er.js — loteriasmundiales.com.ar — parser por strong + posición en tabla

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional'     },
    { key: 'bsas',       nombre: 'Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba'       },
    { key: 'entrerrios', nombre: 'Entre Ríos'    },
    { key: 'santafe',    nombre: 'Santa Fe'      },
    { key: 'montevideo', nombre: 'Montevideo'    },
  ];

  const sorteosCols = ['previa','primera','matutina','vespertina','nocturna'];

  const resultado = {
    actualizado: ahora,
    fecha: hoy,
    provincias: {},
  };
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteosCols.map(s => [s, { fecha: hoy, numeros: [] }])),
    };
  }

  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });

    const html = await response.text();

    // La tabla tiene forms con value="/Quinielas/ciudad" etc.
    // Estructura real:
    // <form action="/Quinielas/ciudad">...<input value="2026/...">...</form>
    // Luego las celdas con <b>9964</b> o vacías en la misma fila <tr>

    // Mapeo de quiniela → valor del input hidden de fecha en el form
    const quinielaForms = {
      nacional:   'Quiniela de la Ciudad',
      bsas:       'Quiniela Buenos Aires',
      cordoba:    'Quiniela Córdoba',
      entrerrios: 'Quiniela Entre Ríos',
      santafe:    'Quiniela Santa Fe',
      montevideo: 'Quiniela Uruguay',
    };

    // Estrategia: extraer todas las filas <tr> de la tabla de cabezas
    // y para cada una detectar cuál quiniela es por el value del form
    const tablaStart = html.indexOf('Cabezas del día');
    if (tablaStart === -1) throw new Error('Tabla no encontrada');

    // Tomar sección de la tabla
    const tablaHtml = html.substring(tablaStart, tablaStart + 20000);

    // Extraer filas
    const filas = [...tablaHtml.matchAll(/<tr[\s\S]+?<\/tr>/gi)];

    for (const filaMatch of filas) {
      const fila = filaMatch[0];

      // Detectar qué quiniela es por el action del form o el value
      let quinielaKey = null;
      for (const [key, nombre] of Object.entries(quinielaForms)) {
        if (fila.includes(nombre) || 
            fila.toLowerCase().includes(nombre.toLowerCase())) {
          quinielaKey = key;
          break;
        }
      }

      // También detectar por action="/Quinielas/xxx"
      if (!quinielaKey) {
        if (fila.includes('/Quinielas/ciudad'))        quinielaKey = 'nacional';
        else if (fila.includes('/Quinielas/buenos-aires')) quinielaKey = 'bsas';
        else if (fila.includes('/Quinielas/cordoba'))      quinielaKey = 'cordoba';
        else if (fila.includes('/Quinielas/entre-rios'))   quinielaKey = 'entrerrios';
        else if (fila.includes('/Quinielas/santa-fe'))     quinielaKey = 'santafe';
        else if (fila.includes('/Quinielas/uruguaya'))     quinielaKey = 'montevideo';
      }

      if (!quinielaKey) continue;

      // Extraer los números de la fila — están en <b>XXXX</b> o <strong>XXXX</strong>
      const nums = [...fila.matchAll(/<(?:b|strong)>\s*(\d{3,4})\s*<\/(?:b|strong)>/gi)]
        .map(m => m[1].padStart(4, '0'));

      // Asignar a cada sorteo en orden
      sorteosCols.forEach((sorteo, i) => {
        if (nums[i]) {
          resultado.provincias[quinielaKey].sorteos[sorteo].numeros = [{ pos: 1, num: nums[i] }];
        }
      });
    }

    // Verificar si obtuvimos datos
    const algunoDato = Object.values(resultado.provincias)
      .some(p => Object.values(p.sorteos).some(s => s.numeros.length > 0));

    if (!algunoDato) {
      resultado._debug = tablaHtml.substring(0, 3000);
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}
