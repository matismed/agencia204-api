// api/quiniela_er.js — quinieladehoy.com.ar — v3 parser robusto
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
  const sorteos       = ['previa','primera','matutina','vespertina','nocturna'];
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna' };

  const resultado = { actualizado: ahora, fecha: hoy, provincias: {} };
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
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

  // ── Convertir HTML a texto plano limpio ──────────────────────────────────
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

  // ── Separador entre bloques: próximo encabezado de quiniela ─────────────
  const NEXT_BLOCK_RE = /Quiniela\s+[A-Za-zÁÉÍÓÚáéíóúñÑ ]+\s*(Previa|Primera|Matutina|Vespertina|Nocturna)\d{2}-\d{2}-\d{4}/i;

  // ── Extraer números del fragmento de texto de un bloque ─────────────────
  // Estructura real del sitio:
  //   1\n1860\n2\n9999\n...\n20\n5813\nEOCZ   (4 dígitos AR)
  //   1\n859\n2\n720\n...                      (3 dígitos MVD)
  function parsearNumeros(fragmento) {
    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;

    while (i < lineas.length && numeros.length < 20) {
      const posNum  = parseInt(lineas[i]);
      const siguienteLinea = lineas[i + 1];

      if (
        !isNaN(posNum) &&
        posNum === numeros.length + 1 &&          // posición consecutiva
        siguienteLinea !== undefined &&
        /^\d{3,4}$/.test(siguienteLinea.trim())   // número 3-4 dígitos
      ) {
        numeros.push({
          pos: posNum,
          num: siguienteLinea.trim().padStart(4, '0'),
        });
        i += 2;
        continue;
      }

      // Parar si ya tenemos datos y encontramos algo que no corresponde
      if (numeros.length > 0) {
        if (/^[A-Z]{3,5}$/.test(lineas[i])) { i++; continue; } // código tipo "EOCZ" — saltear
        if (!isNaN(posNum) && posNum !== numeros.length + 1) break; // posición rota
        if (isNaN(posNum) && lineas[i] !== '') break; // texto inesperado
      }

      i++;
    }

    return numeros;
  }

  // ── Parser principal: encuentra un bloque label+sorteo y extrae números ──
  function parsearBloque(textoPlano, label, sorteoNombre) {
    const labelEsc  = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sorteoEsc = sorteoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const inicioRe = new RegExp(
      labelEsc + '\\s*' + sorteoEsc + '(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );

    const matchInicio = inicioRe.exec(textoPlano);
    if (!matchInicio) return null;

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;
    const resto  = textoPlano.substring(desde);

    // Cortar hasta el PRÓXIMO encabezado de quiniela (sin límite de chars)
    const finMatch = NEXT_BLOCK_RE.exec(resto);
    const fragmento = finMatch ? resto.substring(0, finMatch.index) : resto;

    const numeros = parsearNumeros(fragmento);
    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  // ── Fetch y parseo ────────────────────────────────────────────────────────
  async function fetchYParsear(url, filtroKey) {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const texto = htmlATexto(await resp.text());

    for (const p of provincias) {
      // Página principal: parsear todo menos Montevideo
      // Página de Montevideo: parsear solo Montevideo
      if (filtroKey === 'arg'      && p.key === 'montevideo') continue;
      if (filtroKey === 'montevideo' && p.key !== 'montevideo') continue;

      for (const sorteo of sorteos) {
        const r = parsearBloque(texto, p.label, sorteoNombres[sorteo]);
        if (r && r.numeros.length > 0) {
          resultado.provincias[p.key].sorteos[sorteo] = {
            fecha:   r.fecha,
            numeros: r.numeros,
          };
        }
      }
    }
  }

  // ── Ejecutar ambos fetches en paralelo ────────────────────────────────────
  const [errAR, errMVD] = await Promise.all([
    fetchYParsear('https://quinieladehoy.com.ar/quiniela',                       'arg')
      .then(() => null).catch(e => e.message),
    fetchYParsear('https://quinieladehoy.com.ar/quiniela/quiniela-montevideo',   'montevideo')
      .then(() => null).catch(e => e.message),
  ]);

  if (errAR)  resultado._errorAR  = errAR;
  if (errMVD) resultado._errorMVD = errMVD;

  return res.status(200).json(resultado);
}
