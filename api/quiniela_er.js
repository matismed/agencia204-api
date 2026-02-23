// api/quiniela_er.js — Vercel Serverless Function
// Parser definitivo basado en estructura real del HTML de quinieladehoy.com.ar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const sorteosDef = [
    { key: 'previa',     nombre: 'Previa'     },
    { key: 'primera',    nombre: 'Primera'    },
    { key: 'matutina',   nombre: 'Matutina'   },
    { key: 'vespertina', nombre: 'Vespertina' },
    { key: 'nocturna',   nombre: 'Nocturna'   },
  ];

  const resultado = {
    actualizado: ahora,
    sorteos: Object.fromEntries(
      sorteosDef.map(s => [s.key, { nombre: s.nombre, fecha: hoy, numeros: [] }])
    ),
  };

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-entre-rios', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });

    const html = await response.text();

    // La estructura real del HTML es:
    // <div class="datos-sorteo nombre-jugada entre-rios-0">
    //   <span>Quiniela Entre Rios Previa</span>
    //   <span style="display: block">23-02-2026</span>
    // </div>
    // <div class="listado-numeros">
    //   <div class="columna primera">
    //     <div class="numero-posicion">
    //       <div class="posicion">1</div>
    //       <div class="numero">6871</div>
    //     </div>
    //     ...

    for (const { key, nombre } of sorteosDef) {
      // Buscar el bloque del sorteo por nombre
      const escapedNombre = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Encontrar el bloque que contiene este sorteo
      const sorteoPattern = new RegExp(
        'Quiniela Entre Rios ' + escapedNombre +
        '[\\s\\S]+?<span[^>]*>(\\d{2}-\\d{2}-\\d{4})<\\/span>' +
        '[\\s\\S]+?class="listado-numeros"([\\s\\S]+?)' +
        '(?=class="datos-sorteo|$)',
        'i'
      );

      const sorteoMatch = html.match(sorteoPattern);
      if (!sorteoMatch) continue;

      // Extraer fecha
      resultado.sorteos[key].fecha = sorteoMatch[1].replace(/-/g, '/');

      // Extraer todos los pares posicion-numero del bloque listado-numeros
      const bloque = sorteoMatch[2];
      const posiciones = [...bloque.matchAll(/class="posicion">(\d+)<\/div>\s*<div class="numero">(\d{4})<\/div>/g)];

      resultado.sorteos[key].numeros = posiciones.slice(0, 20).map(m => ({
        pos: parseInt(m[1]),
        num: m[2],
      }));
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}

