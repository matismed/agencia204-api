// api/quiniela_er.js — quinieladehoy.com.ar — parser corregido al HTML real
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.google.com/',
  };

  // ── Parser ajustado al HTML REAL de quinieladehoy.com.ar ─────────────────
  // El HTML llega como texto plano (sin etiquetas CSS de posicion/numero).
  // Estructura real observada:
  //
  //   Quiniela Nacional Previa27-02-2026   ← label+sorteo+fecha PEGADOS
  //   1                                    ← posición
  //   1860                                 ← número
  //   2
  //   9999
  //   ...
  //   EOCZ                                 ← código al final (ignorar)
  //
  // Separador entre bloques: "---" o el siguiente bloque de quiniela.

  function parsearTexto(textoPlano, label, sorteoNombre, esMontevideo = false) {
    // Escapar caracteres especiales del label para regex
    const labelEsc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sorteoEsc = sorteoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Buscar: "Quiniela Nacional Previa27-02-2026" (fecha pegada, sin espacio)
    const inicioRe = new RegExp(
      labelEsc + '\\s*' + sorteoEsc + '(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );

    const matchInicio = inicioRe.exec(textoPlano);
    if (!matchInicio) return null;

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;

    // Tomar los próximos ~800 caracteres después del encabezado
    const fragmento = textoPlano.substring(desde, desde + 800);

    // Los números están en líneas: posición (1-20) seguida del número (3-4 dígitos)
    // Patrón: líneas con solo dígitos, alternando posición y número
    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;
    while (i < lineas.length && numeros.length < 20) {
      const posiblePos = parseInt(lineas[i]);
      const posibleNum = lineas[i + 1];

      // La posición debe ser 1..20 en orden
      if (
        !isNaN(posiblePos) &&
        posiblePos === numeros.length + 1 &&
        posibleNum
      ) {
        // Para Montevideo: buscar EXACTAMENTE 4 dígitos, no aceptar 3
        if (esMontevideo) {
          if (/^\d{4}$/.test(posibleNum)) {
            numeros.push({ pos: posiblePos, num: posibleNum });
            i += 2;
          } else {
            // Si el número tiene 3 dígitos, puede estar incompleto, buscar en las siguientes líneas
            i++;
          }
        } else {
          // Para el resto: aceptar 3-4 dígitos con padding
          if (/^\d{3,4}$/.test(posibleNum)) {
            numeros.push({ pos: posiblePos, num: posibleNum.padStart(4, '0') });
            i += 2;
          } else {
            i++;
          }
        }
      } else {
        // Si llegamos a una línea que no es número válido y ya tenemos algunos, parar
        if (numeros.length > 0 && isNaN(posiblePos)) break;
        i++;
      }
    }

    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  // ── Convertir HTML a texto plano limpio ──────────────────────────────────
  function htmlATexto(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6]|section|article)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  // ── Parser específico para vivitusuerte.com (Montevideo) ─────────────────
  function parsearVivitusuerte(html, sorteoNombre) {
    // Convertir a texto plano
    const texto = htmlATexto(html);
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Buscar el sorteo (Matutina, Nocturna, etc.)
    const sorteoIdx = lineas.findIndex(l => 
      l.toLowerCase().includes(sorteoNombre.toLowerCase())
    );

    if (sorteoIdx === -1) return null;

    // Buscar la fecha cerca del sorteo
    let fecha = '';
    for (let i = Math.max(0, sorteoIdx - 5); i < Math.min(lineas.length, sorteoIdx + 10); i++) {
      if (/\d{2}-\d{2}-\d{4}/.test(lineas[i])) {
        fecha = lineas[i].match(/\d{2}-\d{2}-\d{4}/)[0].replace(/-/g, '/');
        break;
      }
    }

    // Los números suelen estar después del nombre del sorteo
    // Formato típico: posición (1-20) seguido de número de 4 dígitos
    const numeros = [];
    let i = sorteoIdx + 1;
    let posEsperada = 1;

    while (i < lineas.length && numeros.length < 20) {
      const linea = lineas[i];
      
      // Buscar posición
      if (linea === String(posEsperada)) {
        // La siguiente línea debería ser el número de 4 dígitos
        const siguienteLinea = lineas[i + 1];
        if (siguienteLinea && /^\d{4}$/.test(siguienteLinea)) {
          numeros.push({ pos: posEsperada, num: siguienteLinea });
          posEsperada++;
          i += 2;
          continue;
        }
      }
      
      // Si encontramos otro sorteo o muchas líneas sin números, parar
      if (linea.toLowerCase().match(/matutina|vespertina|nocturna|previa|primera/) && i > sorteoIdx + 5) {
        break;
      }
      
      i++;
    }

    if (numeros.length === 0) return null;
    return { fecha: fecha || hoy, numeros };
  }

  // ── Fetch página principal (todas las provincias menos Montevideo) ────────
  try {
    const html = await fetch('https://quinieladehoy.com.ar/quiniela', { headers })
      .then(r => r.text());
    const texto = htmlATexto(html);

    for (const p of provincias.filter(p => p.key !== 'montevideo')) {
      for (const sorteo of sorteos) {
        const r = parsearTexto(texto, p.label, sorteoNombres[sorteo]);
        if (r && r.numeros.length > 0) {
          resultado.provincias[p.key].sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
        }
      }
    }
  } catch(e) {
    resultado._errorAR = e.message;
  }

  // ── Fetch Montevideo (desde vivitusuerte.com) ────────────────────────────
  try {
    const html = await fetch('https://vivitusuerte.com/pizarra/montevideo', { headers })
      .then(r => r.text());

    for (const sorteo of sorteos) {
      const r = parsearVivitusuerte(html, sorteoNombres[sorteo]);
      if (r && r.numeros.length > 0) {
        resultado.provincias.montevideo.sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
      }
    }
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}
