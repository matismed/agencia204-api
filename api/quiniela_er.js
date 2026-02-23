// api/quiniela_er.js — Vercel Serverless Function
// Fuente: quinieladehoy.com.ar — parser corregido para 20 números por sorteo

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

    // Texto plano limpio
    const texto = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|tr|td|th|h[1-6]|section|span)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&[a-z#\d]+;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    for (const { key, nombre } of sorteosDef) {
      // El sitio estructura como:
      // "Quiniela Entre Rios Previa21-02-2026\n1\n2773\n2\n3703\n3\n5834..."
      // Buscamos el bloque de cada sorteo hasta el siguiente sorteo o fin
      const escapedNombre = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Captura todo el bloque entre este sorteo y el siguiente
      const blockPattern = new RegExp(
        'Quiniela Entre Rios\\s+' + escapedNombre + '([\\d\\-\\/]+)\\n([\\s\\S]+?)(?=Quiniela Entre Rios|Probá|$)',
        'i'
      );
      const blockMatch = texto.match(blockPattern);

      if (blockMatch) {
        // Extraer fecha
        const fechaRaw = blockMatch[1].trim();
        resultado.sorteos[key].fecha = fechaRaw.replace(/-/g, '/');

        // El bloque tiene líneas: "1\n2773\n2\n3703..."
        // Extraer todos los pares número-de-posición + número-de-4-cifras
        const bloque = blockMatch[2];
        const lineas = bloque.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const numeros = [];
        let i = 0;
        while (i < lineas.length && numeros.length < 20) {
          const pos = parseInt(lineas[i]);
          const num = lineas[i + 1];
          // pos debe ser 1-20, num debe ser exactamente 4 dígitos
          if (!isNaN(pos) && pos >= 1 && pos <= 20 && num && /^\d{4}$/.test(num)) {
            numeros.push({ pos, num });
            i += 2;
          } else {
            i++;
          }
        }
        resultado.sorteos[key].numeros = numeros;
      }
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}

