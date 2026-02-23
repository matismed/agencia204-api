// api/quiniela_er.js — Vercel Serverless Function
// Scrapea quinieladehoy.com.ar y devuelve los resultados de Quiniela Entre Ríos

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cache de 15 minutos en Vercel Edge
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-entre-rios', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    if (!response.ok) throw new Error('Fetch error: ' + response.status);
    const html = await response.text();

    const ahora = new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires'
    });

    const resultado = {
      actualizado: ahora,
      sorteos: {},
    };

    const sorteoKeys = [
      { key: 'previa',     nombre: 'Previa'     },
      { key: 'primera',    nombre: 'Primera'    },
      { key: 'matutina',   nombre: 'Matutina'   },
      { key: 'vespertina', nombre: 'Vespertina' },
      { key: 'nocturna',   nombre: 'Nocturna'   },
    ];

    // Obtener texto plano limpio de la sección de resultados
    // Quitamos tags pero preservamos el texto
    const textoCompleto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    for (const { key, nombre } of sorteoKeys) {
      // Busca: "Quiniela Entre Rios Previa21-02-2026 1 2773 2 3703..."
      const pattern = new RegExp(
        'Quiniela Entre Rios\\s+' + nombre + '([\\d\\-]+)\\s+((?:\\d+\\s+\\d{4}\\s*){1,20})',
        'i'
      );

      const match = textoCompleto.match(pattern);

      if (match) {
        // Formatear fecha 21-02-2026 → 21/02/2026
        const fecha = match[1].trim().replace(/-/g, '/');

        // Extraer pares posición-número "1 2773 2 3703 ..."
        const pairsRaw = match[2].trim();
        const pairMatches = [...pairsRaw.matchAll(/(\d+)\s+(\d{4})/g)];

        const numeros = pairMatches.map(p => ({
          pos: parseInt(p[1]),
          num: p[2],
        }));

        resultado.sorteos[key] = { nombre, fecha, numeros };
      } else {
        // Sorteo no disponible aún
        resultado.sorteos[key] = {
          nombre,
          fecha: new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
          numeros: [],
        };
      }
    }

    res.status(200).json(resultado);

  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener los datos: ' + err.message });
  }
}

