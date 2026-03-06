// api/quiniela_er.js — Parser mejorado para quinieladehoy.com.ar y loteriasmundiales.com
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

  // ── Parser mejorado para quinieladehoy.com.ar (Argentina) ────────────────
  function parsearTexto(textoPlano, label, sorteoNombre) {
    // Buscar el bloque de texto que contiene el sorteo
    // Patrón más flexible: label + sorteo + fecha (pueden estar pegados o con espacios)
    const labelPattern = label.replace(/\s+/g, '\\s*');
    const sorteoPattern = sorteoNombre.replace(/\s+/g, '\\s*');
    
    // Buscar: "Quiniela Nacional Previa 27-02-2026" o variantes
    const inicioRe = new RegExp(
      labelPattern + '\\s*' + sorteoPattern + '\\s*(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );

    const matchInicio = inicioRe.exec(textoPlano);
    if (!matchInicio) {
      // Intentar patrón alternativo sin espacios
      const inicioRe2 = new RegExp(
        labelPattern + sorteoPattern + '(\\d{2}-\\d{2}-\\d{4})',
        'i'
      );
      const matchInicio2 = inicioRe2.exec(textoPlano);
      if (!matchInicio2) return null;
      
      const fecha = matchInicio2[1].replace(/-/g, '/');
      const desde = matchInicio2.index + matchInicio2[0].length;
      return extraerNumeros(textoPlano, desde, fecha);
    }

    const fecha = matchInicio[1].replace(/-/g, '/');
    const desde = matchInicio.index + matchInicio[0].length;
    return extraerNumeros(textoPlano, desde, fecha);
  }

  function extraerNumeros(textoPlano, desde, fecha) {
    // Tomar más caracteres para asegurar que capturamos todos los números
    const fragmento = textoPlano.substring(desde, desde + 1200);
    
    const lineas = fragmento
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const numeros = [];
    let i = 0;
    
    while (i < lineas.length && numeros.length < 20) {
      const linea = lineas[i];
      
      // Verificar si es una posición (1-20)
      const pos = parseInt(linea);
      
      if (!isNaN(pos) && pos >= 1 && pos <= 20 && pos === numeros.length + 1) {
        // La siguiente línea debería ser el número
        if (i + 1 < lineas.length) {
          const siguienteLinea = lineas[i + 1];
          
          // Validar que sea un número de 3-4 dígitos
          if (/^\d{3,4}$/.test(siguienteLinea)) {
            numeros.push({ 
              pos: pos, 
              num: siguienteLinea.padStart(4, '0') 
            });
            i += 2;
            continue;
          }
        }
      }
      
      // Si encontramos "EOCZ" o un nuevo bloque de quiniela, parar
      if (/EOCZ|Quiniela\s+(Nacional|Buenos\s+Aires|Córdoba|Santa\s+Fe|Entre\s+Rios)/i.test(linea) && numeros.length > 0) {
        break;
      }
      
      i++;
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

    // Extraer fecha del HTML
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

      // Extraer los 20 números
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const idPattern = `idQ11_${sorteoId}_N${posStr}`;
        
        // Buscar patrones más flexibles
        // <td id="idQ11_1_N01" class="..."><b>8222</b></td>
        // <td id="idQ11_1_N01">8222</td>
        const regex = new RegExp(`id="${idPattern}"[^>]*>(?:<b>)?([0-9]{3,4})(?:</b>)?<`, 'i');
        const match = html.match(regex);
        
        if (match && match[1]) {
          // Asegurar 4 dígitos (algunos pueden venir con 3)
          const numero = match[1].padStart(4, '0');
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
      throw new Error(`HTTP ${response.status}`);
    }
    
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
          console.error(`Error parsing ${p.key} ${sorteo}:`, err.message);
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
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
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

