// api/quiniela_er.js — quinieladehoy.com.ar
// Correcciones aplicadas:
//  1. Label "Entre Rios" acepta tilde o sin tilde (el sitio no usa tilde)
//  2. Label "Córdoba" acepta "Cordoba" también (tolerancia de tildes)
//  3. htmlATexto agrega \n para <span> además de los tags ya listados
//  4. fragmento ampliado a 1200 chars (margen extra)
//  5. Cache-Control corregido: no cachear en CDN (datos en vivo)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Provincias con el label EXACTO que usa el sitio (sin tilde en Entre Rios)
  // Se usa un campo labelRe para el regex flexible donde haga falta
  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     labelRe: 'Quiniela Nacional'              },
    { key: 'bsas',       nombre: 'Buenos Aires', labelRe: 'Quiniela Buenos Aires'          },
    { key: 'cordoba',    nombre: 'Córdoba',       labelRe: 'Quiniela C[oó]rdoba'            },
    { key: 'santafe',    nombre: 'Santa Fe',      labelRe: 'Quiniela Santa Fe'              },
    { key: 'entrerrios', nombre: 'Entre Ríos',    labelRe: 'Quiniela Entre R[ií]os'         },
    { key: 'montevideo', nombre: 'Montevideo',    labelRe: 'Quiniela Montevideo'            },
  ];
  const sorteos       = ['previa', 'primera', 'matutina', 'vespertina', 'nocturna'];
  const sorteoNombres = {
    previa:     'Previa',
    primera:    'Primera',
    matutina:   'Matutina',
    vespertina: 'Vespertina',
    nocturna:   'Nocturna',
  };

  const resultado = { actualizado: ahora, fecha: hoy, provincias: {} };
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }])),
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
  };

  // ── Convertir HTML a texto plano con saltos de línea correctos ───────────
  // CORRECCIÓN: se agrega <span> a la lista para que los números dentro de spans
  // queden en líneas separadas, no concatenados en la misma línea.
  function htmlATexto(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6]|section|article|span)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  // ── Parser de un bloque de quiniela ─────────────────────────────────────
  // Estructura del texto ya convertido:
  //   Quiniela Nacional Previa02-03-2026   ← label + sorteo + fecha PEGADA
  //   1                                    ← posición (1..20)
  //   2107                                 ← número (3–4 dígitos)
  //   2
  //   0171
  //   ...
  //   UCSW                                 ← código de verificación (ignorar)
  //
  function parsearTexto(textoPlano, labelRe, sorteoNombre) {
    // El sorteo puede aparecer como "Previa", "Primera", etc.
    // La fecha viene pegada inmediatamente: "Previa02-03-2026"
    const sorteoEsc = sorteoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const inicioRe = new RegExp(
      labelRe + '\\s*' + sorteoEsc + '(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );

    const matchInicio = inicioRe.exec(textoPlano);
    if (!matchInicio) return null;

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;

    // CORRECCIÓN: ampliado a 1200 chars para cubrir 20 pares posición+número sin riesgo
    const fragmento = textoPlano.substring(desde, desde + 1200);

    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;

    while (i < lineas.length && numeros.length < 20) {
      const linea     = lineas[i];
      const posiblePos = parseInt(linea, 10);
      const posibleNum = lineas[i + 1];

      // Verificar que sea un par válido: posición consecutiva + número 3–4 dígitos
      if (
        !isNaN(posiblePos) &&
        String(posiblePos) === linea.trim() &&         // solo dígitos, no "3503texto"
        posiblePos === numeros.length + 1 &&
        posibleNum !== undefined &&
        /^\d{3,4}$/.test(posibleNum.trim())
      ) {
        numeros.push({ pos: posiblePos, num: posibleNum.trim().padStart(4, '0') });
        i += 2;
      } else {
        // CORRECCIÓN: solo cortar si la línea contiene texto alfabético (nuevo bloque)
        // No cortar por números fuera de secuencia (código de verificación, etc.)
        if (numeros.length > 0 && /[a-zA-Z]/.test(linea)) break;
        i++;
      }
    }

    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  // ── Fetch página principal (Nacional, Bs.As., Córdoba, Santa Fe, Entre Ríos) ──
  try {
    const html  = await fetch('https://quinieladehoy.com.ar/quiniela', { headers }).then(r => r.text());
    const texto = htmlATexto(html);

    for (const p of provincias.filter(p => p.key !== 'montevideo')) {
      for (const sorteo of sorteos) {
        const r = parsearTexto(texto, p.labelRe, sorteoNombres[sorteo]);
        if (r && r.numeros.length > 0) {
          resultado.provincias[p.key].sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
        }
      }
    }
  } catch (e) {
    resultado._errorAR = e.message;
  }

  // ── Fetch Montevideo ───────────────────────────────────────────────────────
  try {
    const html  = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-montevideo', { headers }).then(r => r.text());
    const texto = htmlATexto(html);

    for (const sorteo of sorteos) {
      const r = parsearTexto(texto, 'Quiniela Montevideo', sorteoNombres[sorteo]);
      if (r && r.numeros.length > 0) {
        resultado.provincias.montevideo.sorteos[sorteo] = { fecha: r.fecha, numeros: r.numeros };
      }
    }
  } catch (e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}

