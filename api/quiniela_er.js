// api/quiniela_er.js — Todas las quinielas + Montevideo (página propia, números 3 dígitos)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional'     },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',       label: 'Quiniela Córdoba'      },
    { key: 'santafe',    nombre: 'Santa Fe',      label: 'Quiniela Santa Fe'     },
    { key: 'entrerrios', nombre: 'Entre Ríos',    label: 'Quiniela Entre Rios'   },
  ];

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];

  const resultado = {
    actualizado: ahora,
    provincias: {},
  };

  // Inicializar todas las provincias incluyendo Montevideo
  for (const p of [...provincias, { key: 'montevideo', nombre: 'Montevideo' }]) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }])),
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.google.com/',
  };

  // ── Fetch Argentina (página principal con todas las quinielas) ──
  try {
    const html = await fetch('https://quinieladehoy.com.ar/quiniela', { headers })
      .then(r => r.text());

    for (const p of provincias) {
      for (const sorteo of sorteos) {
        const labelPattern = p.label + '\\s+' + sorteo.charAt(0).toUpperCase() + sorteo.slice(1);
        const blockRe = new RegExp(
          labelPattern + '[\\s\\S]+?<span[^>]*>([\\d\\-]+)<\\/span>' +
          '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)(?=class="datos-sorteo|$)', 'i'
        );
        const m = html.match(blockRe);
        if (m) {
          resultado.provincias[p.key].sorteos[sorteo].fecha = m[1].replace(/-/g, '/');
          const pares = [...m[2].matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{3,4})<\/div>/g)];
          resultado.provincias[p.key].sorteos[sorteo].numeros = pares.slice(0, 20).map(p => ({
            pos: parseInt(p[1]), num: p[2],
          }));
        }
      }
    }
  } catch(e) { resultado._errorAR = e.message; }

  // ── Fetch Montevideo (página propia, números de 3 dígitos) ──
  try {
    const html = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-montevideo', { headers })
      .then(r => r.text());

    // Montevideo solo tiene Matutina y Nocturna
    for (const sorteo of sorteos) {
      const nombre = sorteo.charAt(0).toUpperCase() + sorteo.slice(1);
      const blockRe = new RegExp(
        'Quiniela Montevideo\\s+' + nombre +
        '[\\s\\S]+?<span[^>]*>([\\d\\-]+)<\\/span>' +
        '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)(?=class="datos-sorteo|$)', 'i'
      );
      const m = html.match(blockRe);
      if (m) {
        resultado.provincias.montevideo.sorteos[sorteo].fecha = m[1].replace(/-/g, '/');
        // Números de 3 dígitos — los mostramos con padding a 4 (ej: 421 → 0421)
        const pares = [...m[2].matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{3,4})<\/div>/g)];
        resultado.provincias.montevideo.sorteos[sorteo].numeros = pares.slice(0, 20).map(p => ({
          pos: parseInt(p[1]),
          num: p[2].padStart(4, '0'),
        }));
      }
    }
  } catch(e) { resultado._errorMVD = e.message; }

  res.status(200).json(resultado);
}

