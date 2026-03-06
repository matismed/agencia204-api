// api/quiniela_er.js — Usando loteriasmundiales.com SOLO para Montevideo
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

  // ── Parser para quinieladehoy.com.ar (Argentina) ─────────────────────────
  function parsearTexto(textoPlano, label, sorteoNombre) {
    const labelEsc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sorteoEsc = sorteoNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const inicioRe = new RegExp(
      labelEsc + '\\s*' + sorteoEsc + '(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );

    const matchInicio = inicioRe.exec(textoPlano);
    if (!matchInicio) return null;

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;
    const fragmento = textoPlano.substring(desde, desde + 800);

    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;
    while (i < lineas.length && numeros.length < 20) {
      const posiblePos = parseInt(lineas[i]);
      const posibleNum = lineas[i + 1];

      if (
        !isNaN(posiblePos) &&
        posiblePos === numeros.length + 1 &&
        posibleNum &&
        /^\d{3,4}$/.test(posibleNum)
      ) {
        numeros.push({ pos: posiblePos, num: posibleNum.padStart(4, '0') });
        i += 2;
      } else {
        if (numeros.length > 0 && isNaN(posiblePos)) break;
        i++;
      }
    }

    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  // ── Parser para loteriasmundiales.com.ar (Montevideo) ────────────────────
  function parsearLoteriasMundiales(html) {
    const sorteoMap = {
      'matutina': '1',   // idQ11_1_N01
      'nocturna': '3'    // idQ11_3_N01
    };

    const resultados = {};

    for (const [sorteoNombre, sorteoId] of Object.entries(sorteoMap)) {
      const numeros = [];
      let fecha = hoy;

      // Extraer fecha
      const fechaMatch = html.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
      if (fechaMatch) {
        const meses = {
          'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
          'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
          'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };
        const dia = fechaMatch[1].padStart(2, '0');
        const mes = meses[fechaMatch[2].toLowerCase()];
        const anio = fechaMatch[3];
        if (mes) {
          fecha = `${dia}/${mes}/${anio}`;
        }
      }

      // Extraer los 20 números
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const idPattern = `idQ11_${sorteoId}_N${posStr}`;
        
        // Buscar: <td id="idQ11_1_N01" class="w3-theme-l1"><b>8222</b></td>
        const regex = new RegExp(`id="${idPattern}"[^>]*>(<b>)?([0-9]{4})(</b>)?<`, 'i');
        const match = html.match(regex);
        
        if (match && match[2]) {
          numeros.push({ pos: pos, num: match[2] });
        }
      }

      if (numeros.length > 0) {
        resultados[sorteoNombre] = { fecha, numeros };
      }
    }

    return resultados;
  }

  // ── Convertir HTML a texto plano ─────────────────────────────────────────
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

  // ── Fetch Argentina (todas menos Montevideo) ─────────────────────────────
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

  // ── Fetch Montevideo (desde loteriasmundiales.com.ar) ────────────────────
  try {
    const html = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers })
      .then(r => r.text());
    
    const resultadosMVD = parsearLoteriasMundiales(html);

    // Mapear matutina y nocturna a los sorteos
    if (resultadosMVD.matutina) {
      resultado.provincias.montevideo.sorteos.matutina = resultadosMVD.matutina;
    }
    if (resultadosMVD.nocturna) {
      resultado.provincias.montevideo.sorteos.nocturna = resultadosMVD.nocturna;
    }

  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}
