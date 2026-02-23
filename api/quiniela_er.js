// api/quiniela_er.js — Vercel Serverless Function
// Parser robusto para quinieladehoy.com.ar — Quiniela Entre Ríos

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
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
    sorteos: Object.fromEntries(sorteosDef.map(s => [s.key, { nombre: s.nombre, fecha: hoy, numeros: [] }])),
  };

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-entre-rios', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
      },
    });

    const html = await response.text();

    // Convertir HTML a texto limpio
    const texto = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|tr|td|th|h[1-6]|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');

    for (const { key, nombre } of sorteosDef) {
      // Busca: "Quiniela Entre Rios Previa" seguido de fecha y 20 pares pos-número
      // Variantes: con/sin tilde, con/sin espacios
      const pattern = new RegExp(
        'Quiniela\\s+Entre\\s+R[ií]os\\s+' + nombre + '[\\s\\d\\-\\/]+((?:\\d+\\s+\\d{4}[\\s\\n]+){1,20})',
        'i'
      );

      const m = texto.match(pattern);
      if (m) {
        // Extraer fecha del bloque
        const fechaM = m[0].match(/(\d{2}[\-\/]\d{2}[\-\/]\d{4})/);
        if (fechaM) {
          resultado.sorteos[key].fecha = fechaM[1].replace(/-/g, '/');
        }

        // Extraer los pares posición-número
        const pares = [...m[1].matchAll(/(\d+)\s+(\d{4})/g)];
        resultado.sorteos[key].numeros = pares.slice(0, 20).map(p => ({
          pos: parseInt(p[1]),
          num: p[2],
        }));
      } else {
        // Estrategia 2: buscar por sección del HTML con número de 4 dígitos
        // "1\n2773\n2\n3703..." patrón alternativo
        const alt = new RegExp(nombre + '[^\\d]{0,80}((?:\\d+\\s+\\d{4}[\\s\\n]+){5,20})', 'i');
        const m2 = texto.match(alt);
        if (m2) {
          const pares = [...m2[1].matchAll(/(\d+)\s+(\d{4})/g)];
          resultado.sorteos[key].numeros = pares.slice(0, 20).map(p => ({
            pos: parseInt(p[1]),
            num: p[2],
          }));
        }
      }
    }

    // Debug: si todos vacíos, incluir fragmento del texto
    const todosVacios = Object.values(resultado.sorteos).every(s => s.numeros.length === 0);
    if (todosVacios) {
      resultado._debug = texto.substring(0, 2000);
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}

