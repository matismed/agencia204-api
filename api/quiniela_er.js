// api/quiniela_er.js — quinieladehoy.com (Argentina) + loteriasmundiales.com (Montevideo)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional'     },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',      label: 'Quiniela Córdoba'      },
    { key: 'santafe',    nombre: 'Santa Fe',     label: 'Quiniela Santa Fe'     },
    { key: 'entrerrios', nombre: 'Entre Ríos',   label: 'Quiniela Entre Rios'   },
    { key: 'montevideo', nombre: 'Montevideo',   label: 'Quiniela Montevideo'   },
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

  // ── Parser MEJORADO para quinieladehoy.com.ar (Argentina) ────────────────
  function parsearTexto(textoPlano, label, sorteoNombre) {
    // Patrón más flexible para manejar espacios variables
    const labelPattern = label.replace(/\s+/g, '\\s*');
    const sorteoPattern = sorteoNombre.replace(/\s+/g, '\\s*');

    // Intentar primero con espacio entre sorteo y fecha
    let inicioRe = new RegExp(
      labelPattern + '\\s*' + sorteoPattern + '\\s*(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );
    let matchInicio = inicioRe.exec(textoPlano);

    // Si no funciona, intentar sin espacio (fecha pegada)
    if (!matchInicio) {
      inicioRe = new RegExp(
        labelPattern + sorteoPattern + '(\\d{2}-\\d{2}-\\d{4})',
        'i'
      );
      matchInicio = inicioRe.exec(textoPlano);
    }

    if (!matchInicio) return null;

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;
    
    // Aumentar el tamaño del fragmento para asegurar capturar todos los números
    const fragmento = textoPlano.substring(desde, desde + 1200);

    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;
    
    while (i < lineas.length && numeros.length < 20) {
      const linea = lineas[i];
      const posiblePos = parseInt(linea);

      // Verificar si es una posición válida (1-20) y consecutiva
      if (!isNaN(posiblePos) && posiblePos >= 1 && posiblePos <= 20 && posiblePos === numeros.length + 1) {
        // La siguiente línea debería ser el número
        if (i + 1 < lineas.length) {
          const posibleNum = lineas[i + 1];
          
          // Validar que sea un número de 3-4 dígitos
          if (/^\d{3,4}$/.test(posibleNum)) {
            numeros.push({ 
              pos: posiblePos, 
              num: posibleNum.padStart(4, '0') 
            });
            i += 2;
            continue;
          }
        }
      }

      // Si encontramos "EOCZ" o inicio de otra quiniela, detener
      if (/EOCZ|Quiniela\s+(Nacional|Buenos\s+Aires|Córdoba|Santa\s+Fe|Entre\s+Rios)/i.test(linea) && numeros.length > 0) {
        break;
      }

      i++;
    }

    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  // ── Parser MEJORADO para loteriasmundiales.com.ar (Montevideo) ───────────
  function parsearLoteriasMundiales(html) {
    const sorteoMap = {
      'matutina': '1',   // idQ11_1_N01
      'nocturna': '3'    // idQ11_3_N01
    };

    const resultados = {};

    // Extraer fecha
    let fecha = hoy;
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

    for (const [sorteoNombre, sorteoId] of Object.entries(sorteoMap)) {
      const numeros = [];

      // Extraer los 20 números con patrones más flexibles
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const idPattern = `idQ11_${sorteoId}_N${posStr}`;
        
        // Intentar múltiples patrones
        const patterns = [
          `id="${idPattern}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,  // Con <b> tag
          `id="${idPattern}"[^>]*>\\s*([0-9]{3,4})\\s*<`,            // Sin <b> tag
          `id='${idPattern}'[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`, // Comillas simples
          `id='${idPattern}'[^>]*>\\s*([0-9]{3,4})\\s*<`             // Comillas simples sin <b>
        ];

        let numero = null;
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'i');
          const match = html.match(regex);
          if (match && match[1]) {
            numero = match[1].trim().padStart(4, '0');
            break;
          }
        }

        if (numero) {
          numeros.push({ pos: pos, num: numero });
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
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  // ── Fetch Argentina (todas menos Montevideo) ─────────────────────────────
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    
    if (!response.ok) {
      resultado._errorAR = `HTTP ${response.status}`;
    } else {
      const html = await response.text();
      const texto = htmlATexto(html);

      for (const p of provincias.filter(p => p.key !== 'montevideo')) {
        for (const sorteo of sorteos) {
          try {
            const r = parsearTexto(texto, p.label, sorteoNombres[sorteo]);
            if (r && r.numeros.length > 0) {
              resultado.provincias[p.key].sorteos[sorteo] = { 
                fecha: r.fecha, 
                numeros: r.numeros 
              };
            }
          } catch(err) {
            // Error en un sorteo específico, continuar con los demás
            console.error(`Error parsing ${p.key} ${sorteo}:`, err);
          }
        }
      }
    }
  } catch(e) {
    resultado._errorAR = e.message;
  }

  // ── Fetch Montevideo (desde loteriasmundiales.com.ar) ────────────────────
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    
    if (!response.ok) {
      resultado._errorMVD = `HTTP ${response.status}`;
    } else {
      const html = await response.text();
      const resultadosMVD = parsearLoteriasMundiales(html);

      // Mapear matutina y nocturna a los sorteos
      if (resultadosMVD.matutina) {
        resultado.provincias.montevideo.sorteos.matutina = resultadosMVD.matutina;
      }
      if (resultadosMVD.nocturna) {
        resultado.provincias.montevideo.sorteos.nocturna = resultadosMVD.nocturna;
      }
    }
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}
