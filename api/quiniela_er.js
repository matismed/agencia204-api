// api/quiniela_er.js — quinieladehoy.com.ar — cache 5 min, datos frescos

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Sin cache de borde — siempre fresco
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional'     },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',       label: 'Quiniela Córdoba'      },
    { key: 'santafe',    nombre: 'Santa Fe',      label: 'Quiniela Santa Fe'     },
    { key: 'entrerrios', nombre: 'Entre Ríos',    label: 'Quiniela Entre Rios'   },
    { key: 'montevideo', nombre: 'Montevideo',    label: 'Quiniela Montevideo'   },
  ];

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];

  const resultado = {
    actualizado: ahora,
    fecha: hoy,
    provincias: {},
  };

  for (const p of provincias) {
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
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  // ── Fetch Argentina — página principal ──────────────────
  try {
    // Agregar timestamp para evitar cache del sitio fuente
    const ts = Date.now();
    const html = await fetch(`https://quinieladehoy.com.ar/quiniela?_=${ts}`, { headers })
      .then(r => r.text());

    const argProv = provincias.filter(p => p.key !== 'montevideo');

    for (const p of argProv) {
      for (const sorteo of sorteos) {
        const nombreSorteo = sorteo.charAt(0).toUpperCase() + sorteo.slice(1);
        
        // Buscar bloque: label + nombre sorteo + fecha + listado-numeros
        const blockRe = new RegExp(
          p.label + '\\s+' + nombreSorteo +
          '[\\s\\S]+?<span[^>]*>([\\d\\-]+)<\\/span>' +
          '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)' +
          '(?=class="datos-sorteo|$)', 'i'
        );
        const m = html.match(blockRe);
        if (m) {
          resultado.provincias[p.key].sorteos[sorteo].fecha = m[1].replace(/-/g, '/');
          const pares = [...m[2].matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{3,4})<\/div>/g)];
          resultado.provincias[p.key].sorteos[sorteo].numeros = pares.slice(0, 20).map(x => ({
            pos: parseInt(x[1]), num: x[2].padStart(4, '0'),
          }));
        }
      }
    }
  } catch(e) {
    resultado._errorAR = e.message;
  }

  // ── Fetch Montevideo — página propia ────────────────────
  try {
    const ts = Date.now();
    const html = await fetch(`https://quinieladehoy.com.ar/quiniela/quiniela-montevideo?_=${ts}`, { headers })
      .then(r => r.text());

    for (const sorteo of sorteos) {
      const nombreSorteo = sorteo.charAt(0).toUpperCase() + sorteo.slice(1);
      const blockRe = new RegExp(
        'Quiniela Montevideo\\s+' + nombreSorteo +
        '[\\s\\S]+?<span[^>]*>([\\d\\-]+)<\\/span>' +
        '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)' +
        '(?=class="datos-sorteo|$)', 'i'
      );
      const m = html.match(blockRe);
      if (m) {
        resultado.provincias.montevideo.sorteos[sorteo].fecha = m[1].replace(/-/g, '/');
        const pares = [...m[2].matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{3,4})<\/div>/g)];
        resultado.provincias.montevideo.sorteos[sorteo].numeros = pares.slice(0, 20).map(x => ({
          pos: parseInt(x[1]), num: x[2].padStart(4, '0'),
        }));
      }
    }
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}

