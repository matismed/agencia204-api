// api/quiniela_er.js — quinieladehoy.com.ar — v2 parser robusto
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   label: 'Quiniela Nacional'     },
    { key: 'bsas',       label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    label: 'Quiniela Córdoba'       },
    { key: 'santafe',    label: 'Quiniela Santa Fe'      },
    { key: 'entrerrios', label: 'Quiniela Entre Rios'    },
    { key: 'montevideo', label: 'Quiniela Montevideo'    },
  ];

  const sorteos = ['previa', 'primera', 'matutina', 'vespertina', 'nocturna'];
  const sorteoNombres = {
    previa:     'Previa',
    primera:    'Primera',
    matutina:   'Matutina',
    vespertina: 'Vespertina',
    nocturna:   'Nocturna',
  };

  // Resultado vacío inicial
  const resultado = { actualizado: ahora, fecha: hoy, provincias: {} };
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }])),
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
  };

  // ── Convertir HTML a texto plano limpio ───────────────────────────────────
  function htmlATexto(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6]|section|article|span|header|footer|nav|main)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ ]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  // ── Parser principal ──────────────────────────────────────────────────────
  // Estrategia: encontrar TODAS las ocurrencias de "Label Sorteo DD-MM-YYYY"
  // y extraer los 20 números que siguen inmediatamente.
  //
  // El HTML de quinieladehoy.com.ar tiene este patrón en texto plano:
  //
  //   Quiniela Nacional Previa27-02-2026   ← header (label+sorteo+fecha pegados)
  //   1                                    ← posición
  //   1860                                 ← número
  //   2
  //   9999
  //   ...20 pares...
  //   EOCZ                                 ← código de sorteo (ignorar)
  //
  // Importante: Montevideo tiene números de 3 dígitos (ej: "859", "046")
  // → padStart(4, '0') los normaliza a 4 dígitos

  function extraerTodosLosBloques(texto) {
    // Construir regex que capture cualquier combinación label+sorteo+fecha
    const todoLabels = provincias.map(p => p.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const todoSorteos = Object.values(sorteoNombres).join('|');

    // Buscar encabezados: "Quiniela XXXX TURNO DD-MM-YYYY"
    const headerRe = new RegExp(
      `(${todoLabels})\\s*(${todoSorteos})(\\d{2}-\\d{2}-\\d{4})`,
      'gi'
    );

    const bloques = [];
    let match;
    while ((match = headerRe.exec(texto)) !== null) {
      bloques.push({
        label:    match[1].trim(),
        sorteo:   match[2].trim(),
        fecha:    match[3].replace(/-/g, '/'),
        desde:    match.index + match[0].length,
      });
    }

    // Para cada bloque, el texto termina donde empieza el siguiente
    for (let i = 0; i < bloques.length; i++) {
      const fin = i + 1 < bloques.length ? bloques[i + 1].desde - bloques[i + 1].sorteo.length - 20 : texto.length;
      bloques[i].fragmento = texto.substring(bloques[i].desde, Math.min(fin, bloques[i].desde + 600));
    }

    return bloques;
  }

  function parsearNumeros(fragmento) {
    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;

    while (i < lineas.length && numeros.length < 20) {
      const linea = lineas[i];
      const sig   = lineas[i + 1];

      // La posición debe coincidir exactamente con el siguiente número esperado
      const posNum = parseInt(linea);
      if (
        !isNaN(posNum) &&
        posNum === numeros.length + 1 &&
        sig !== undefined &&
        /^\d{3,4}$/.test(sig.trim())
      ) {
        numeros.push({
          pos: posNum,
          num: sig.trim().padStart(4, '0'),
        });
        i += 2;
        continue;
      }

      // Si encontramos algo que no es un número válido después de tener datos, parar
      // (evita mezclar con el siguiente bloque)
      if (numeros.length > 0) {
        // Verificar si es un código de sorteo (4 letras) o separador — parar
        if (/^[A-Z]{4}$/.test(linea) || linea === '---') break;
        // Si es un número que no corresponde a la secuencia esperada, parar
        if (!isNaN(posNum) && posNum !== numeros.length + 1) break;
      }

      i++;
    }

    return numeros;
  }

  // ── Fetch y parseo ────────────────────────────────────────────────────────
  async function fetchYParsear(url, esArgentina = true) {
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html  = await resp.text();
    const texto = htmlATexto(html);
    const bloques = extraerTodosLosBloques(texto);

    for (const bloque of bloques) {
      // Identificar provincia por label
      const prov = provincias.find(p =>
        p.label.toLowerCase() === bloque.label.toLowerCase()
      );
      if (!prov) continue;

      // Si estamos en la página argentina, saltar Montevideo (tiene su propia página)
      if (esArgentina && prov.key === 'montevideo') continue;
      // Si estamos en la página de Montevideo, procesar solo Montevideo
      if (!esArgentina && prov.key !== 'montevideo') continue;

      // Identificar sorteo
      const sorteoKey = Object.keys(sorteoNombres).find(
        k => sorteoNombres[k].toLowerCase() === bloque.sorteo.toLowerCase()
      );
      if (!sorteoKey) continue;

      const numeros = parsearNumeros(bloque.fragmento);
      if (numeros.length > 0) {
        resultado.provincias[prov.key].sorteos[sorteoKey] = {
          fecha:   bloque.fecha,
          numeros: numeros,
        };
      }
    }
  }

  // ── Ejecutar fetches ──────────────────────────────────────────────────────
  try {
    await fetchYParsear('https://quinieladehoy.com.ar/quiniela', true);
  } catch(e) {
    resultado._errorAR = e.message;
  }

  try {
    await fetchYParsear('https://quinieladehoy.com.ar/quiniela/quiniela-montevideo', false);
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  return res.status(200).json(resultado);
}


