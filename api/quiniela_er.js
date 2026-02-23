// api/quiniela_er.js — Fuente: loteriasmundiales.com.ar
// Busca cada quiniela por su URL en la tabla de cabezas del día

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     url: '/Quinielas/ciudad'        },
    { key: 'bsas',       nombre: 'Buenos Aires', url: '/Quinielas/buenos-aires'  },
    { key: 'cordoba',    nombre: 'Córdoba',       url: '/Quinielas/cordoba'       },
    { key: 'entrerrios', nombre: 'Entre Ríos',    url: '/Quinielas/entre-rios'    },
    { key: 'santafe',    nombre: 'Santa Fe',      url: '/Quinielas/santa-fe'      },
    { key: 'montevideo', nombre: 'Montevideo',    url: '/Quinielas/uruguaya'      },
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

    // Estrategia: cada fila de la tabla tiene un <a href="/Quinielas/ciudad"> (o similar)
    // seguido de exactamente 5 celdas con los números <strong>XXXX</strong>
    // Las celdas vacías son &nbsp; o simplemente vacías

    for (const p of provincias) {
      // Buscar la fila que contiene el link a esta quiniela
      // Patrón: href="/Quinielas/ciudad" ... hasta </tr>
      const escapedUrl = p.url.replace(/\//g, '\\/');
      const rowRe = new RegExp(
        '<tr[^>]*>[\\s\\S]*?href="' + escapedUrl + '"[\\s\\S]*?<\\/tr>',
        'i'
      );
      const rowMatch = html.match(rowRe);
      if (!rowMatch) continue;

      const row = rowMatch[0];

      // Extraer las 5 celdas de números de esta fila
      // Cada celda tiene <strong>XXXX</strong> si hay número, o está vacía/&nbsp;
      const celdas = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

      // Filtrar solo las celdas numéricas (las que tienen <strong> con 4 dígitos o están vacías)
      const valores = [];
      for (const c of celdas) {
        const strongMatch = c[1].match(/<strong>\s*(\d{3,4})\s*<\/strong>/i);
        if (strongMatch) {
          valores.push(strongMatch[1].padStart(4, '0'));
        } else if (/^\s*(&nbsp;)?\s*$/.test(c[1].replace(/<[^>]+>/g, ''))) {
          valores.push(null); // celda vacía = sorteo no disponible aún
        }
      }

      // Asignar a cada sorteo
      sorteosCols.forEach((sorteo, i) => {
        const num = valores[i];
        resultado.provincias[p.key].sorteos[sorteo].numeros = num
          ? [{ pos: 1, num }]
          : [];
      });
    }

    // Debug si todo vacío
    const algunoDato = Object.values(resultado.provincias)
      .some(p => Object.values(p.sorteos).some(s => s.numeros.length > 0));
    if (!algunoDato) {
      // Devolver fragmento del HTML para diagnóstico
      const tablaIdx = html.indexOf('Cabezas del día');
      resultado._debug = tablaIdx > 0 ? html.substring(tablaIdx, tablaIdx + 3000) : html.substring(0, 3000);
    }

    res.status(200).json(resultado);

  } catch (err) {
    resultado._error = err.message;
    res.status(200).json(resultado);
  }
}
