// api/quiniela_er.js — quinieladehoy.com.ar — parser corregido

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna' };

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
  };

  function parsearBloque(html, label, sorteoNombre) {
    // En el HTML el texto aparece como: "Quiniela Nacional Previa23-02-2026"
    // SIN espacio entre nombre del sorteo y la fecha
    // Buscamos: label + sorteoNombre + fecha (pegada) + listado-numeros
    const blockRe = new RegExp(
      label + '\\s+' + sorteoNombre + '(\\d{2}-\\d{2}-\\d{4})' +
      '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)' +
      '(?=class="datos-sorteo|---)', 'i'
    );
    const m = html.match(blockRe);
    if (!m) return null;

    const fecha = m[1].replace(/-/g, '/');
    // Extraer pares posicion-numero
    const pares = [...m[2].matchAll(
      /class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{3,4})<\/div>/g
    )];
    const numeros = pares.slice(0, 20).map(p => ({
      pos: parseInt(p[1]),
      num: p[2].padStart(4, '0'),
    }));

    return { fecha, numeros };
  }

  // ── Fetch página principal (Argentina) ──────────────────
  try {
    const html = await fetch('https://quinieladehoy.com.ar/quiniela', { headers }).then(r => r.text());

    for (const p of provincias.filter(p => p.key !== 'montevideo')) {
      for (const sorteo of sorteos) {
        const r = parsearBloque(html, p.label, sorteoNombres[sorteo]);
        if (r && r.numeros.length > 0) {
          resultado.provincias[p.key].sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
        }
      }
    }
  } catch(e) { resultado._errorAR = e.message; }

  // ── Fetch Montevideo (página propia) ────────────────────
  try {
    const html = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-montevideo', { headers }).then(r => r.text());

    for (const sorteo of sorteos) {
      const r = parsearBloque(html, 'Quiniela Montevideo', sorteoNombres[sorteo]);
      if (r && r.numeros.length > 0) {
        resultado.provincias.montevideo.sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
      }
    }
  } catch(e) { resultado._errorMVD = e.message; }

  res.status(200).json(resultado);
}
