// api/quiniela_er.js — Todas las quinielas desde quinieladehoy.com.ar/quiniela

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',    nombre: 'Nacional',     label: 'Quiniela Nacional'     },
    { key: 'bsas',        nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',     nombre: 'Córdoba',      label: 'Quiniela Córdoba'      },
    { key: 'santafe',     nombre: 'Santa Fe',     label: 'Quiniela Santa Fe'     },
    { key: 'entrerrios',  nombre: 'Entre Ríos',   label: 'Quiniela Entre Rios'   },
    { key: 'montevideo',  nombre: 'Montevideo',   label: 'Quiniela Montevideo'   },
  ];

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];

  // Estructura resultado
  const resultado = {
    actualizado: ahora,
    provincias: {},
  };
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }])),
    };
  }

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });

    const html = await response.text();

    // Parsear cada provincia × cada sorteo
    // Estructura HTML: class="posicion">N</div><div class="numero">XXXX</div>
    for (const p of provincias) {
      for (const sorteo of sorteos) {
        // Buscar bloque: "<span>Quiniela Nacional Previa23-02-2026</span>..."
        // El label en HTML: "Quiniela Nacional Previa" o "Quiniela Buenos Aires Previa" etc.
        const labelPattern = p.label + '\\s+' + 
          sorteo.charAt(0).toUpperCase() + sorteo.slice(1);
        
        const blockRe = new RegExp(
          labelPattern + '[\\s\\S]+?<span[^>]*>([\\d\\-]+)<\\/span>' +
          '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)' +
          '(?=class="datos-sorteo|$)',
          'i'
        );

        const m = html.match(blockRe);
        if (m) {
          resultado.provincias[p.key].sorteos[sorteo].fecha = m[1].replace(/-/g, '/');
          const bloque = m[2];
          const pares = [...bloque.matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{4})<\/div>/g)];
          resultado.provincias[p.key].sorteos[sorteo].numeros = pares.slice(0, 20).map(p => ({
            pos: parseInt(p[1]),
            num: p[2],
          }));
        } else {
          // Fallback: buscar solo por label+sorteo sin fecha
          const altRe = new RegExp(
            p.label + '[^<]*' + sorteo.charAt(0).toUpperCase() + sorteo.slice(1) +
            '[\\s\\S]{0,200}?class="listado-numeros"([\\s\\S]+?)(?=class="datos-sorteo|$)',
            'i'
          );
          const m2 = html.match(altRe);
          if (m2) {
            const pares = [...m2[1].matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{4})<\/div>/g)];
            resultado.provincias[p.key].sorteos[sorteo].numeros = pares.slice(0, 20).map(p => ({
              pos: parseInt(p[1]),
              num: p[2],
            }));
          }
        }
      }
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}

