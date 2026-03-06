// api/quiniela_er.js — CON Salta y Jujuy desde quinieladehoy.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy   = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const horaActual = ahoraArgentina.getHours();
  const minutoActual = ahoraArgentina.getMinutes();
  const horaActualMinutos = horaActual * 60 + minutoActual;

  const horariosSorteos = {
    previa: { hora: 11, minuto: 15, minutosDia: 11 * 60 + 15 },
    primera: { hora: 12, minuto: 0, minutosDia: 12 * 60 },
    matutina: { hora: 14, minuto: 0, minutosDia: 14 * 60 },
    vespertina: { hora: 17, minuto: 30, minutosDia: 17 * 60 + 30 },
    nocturna: { hora: 21, minuto: 15, minutosDia: 21 * 60 + 15 }
  };

  function sorteoYaOcurrio(sorteo) {
    const horario = horariosSorteos[sorteo];
    if (!horario) return false;
    return horaActualMinutos >= horario.minutosDia;
  }

  // TODAS las provincias argentinas (incluyendo Salta y Jujuy)
  const provinciasQuinielaHoy = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional' },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',      label: 'Quiniela Córdoba' },
    { key: 'santafe',    nombre: 'Santa Fe',     label: 'Quiniela Santa Fe' },
    { key: 'entrerrios', nombre: 'Entre Ríos',   label: 'Quiniela Entre Rios' },
    { key: 'salta',      nombre: 'Salta',        label: 'Quiniela Salta' },
    { key: 'jujuy',      nombre: 'Jujuy',        label: 'Quiniela Jujuy' },
  ];

  const provinciasLoteriasMundiales = [
    { key: 'montevideo', nombre: 'Montevideo', url: '/Quinielas/uruguaya', codigoQuiniela: 11 }
  ];

  const todasProvincias = [...provinciasQuinielaHoy, ...provinciasLoteriasMundiales];
  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna' };
  
  const codigosSorteosMontevideo = {
    matutina: 1,
    nocturna: 3
  };

  const resultado = { 
    actualizado: ahora, 
    fecha: hoy, 
    horaActual: `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`,
    provincias: {}
  };
  
  for (const p of todasProvincias) {
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

  function parsearTexto(textoPlano, label, sorteoNombre) {
    const labelPattern = label.replace(/\s+/g, '\\s*');
    const sorteoPattern = sorteoNombre.replace(/\s+/g, '\\s*');

    let inicioRe = new RegExp(
      labelPattern + '\\s*' + sorteoPattern + '\\s*(\\d{2}-\\d{2}-\\d{4})',
      'i'
    );
    let matchInicio = inicioRe.exec(textoPlano);

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
    const fragmento = textoPlano.substring(desde, desde + 1200);

    const lineas = fragmento.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const numeros = [];
    let i = 0;
    
    while (i < lineas.length && numeros.length < 20) {
      const linea = lineas[i];
      const posiblePos = parseInt(linea);

      if (!isNaN(posiblePos) && posiblePos >= 1 && posiblePos <= 20 && posiblePos === numeros.length + 1) {
        if (i + 1 < lineas.length) {
          const posibleNum = lineas[i + 1];
          if (/^\d{3,4}$/.test(posibleNum)) {
            numeros.push({ pos: posiblePos, num: posibleNum.padStart(4, '0') });
            i += 2;
            continue;
          }
        }
      }

      if (/EOCZ|Quiniela\s+(Nacional|Buenos\s+Aires|Córdoba|Santa\s+Fe|Entre\s+Rios|Salta|Jujuy)/i.test(linea) && numeros.length > 0) {
        break;
      }
      i++;
    }

    if (numeros.length === 0) return null;
    return { fecha, numeros };
  }

  function parsearMontevideo(html) {
    const resultados = {};
    
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

    for (const [sorteoKey, codigoMomento] of Object.entries(codigosSorteosMontevideo)) {
      const numeros = [];

      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const idPattern = `idQ11_${codigoMomento}_N${posStr}`;
        
        const patterns = [
          `id="${idPattern}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
          `id="${idPattern}"[^>]*>\\s*([0-9]{3,4})\\s*<`,
          `id='${idPattern}'[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
          `id='${idPattern}'[^>]*>\\s*([0-9]{3,4})\\s*<`
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
        resultados[sorteoKey] = { fecha, numeros };
      }
    }

    return resultados;
  }

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

  // ── Fetch Argentina (TODAS incluyendo Salta y Jujuy) ────────────────────
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    
    if (!response.ok) {
      resultado._errorAR = `HTTP ${response.status}`;
    } else {
      const html = await response.text();
      const texto = htmlATexto(html);

      for (const p of provinciasQuinielaHoy) {
        for (const sorteo of sorteos) {
          try {
            // LÓGICA ESPECIAL PARA NOCTURNA
            if (sorteo === 'nocturna') {
              if (!sorteoYaOcurrio('nocturna')) {
                resultado.provincias[p.key].sorteos.nocturna = {
                  fecha: hoy, 
                  numeros: [], 
                  pendiente: true, 
                  horaPrevista: '21:15'
                };
                continue;
              } else {
                const r = parsearTexto(texto, p.label, sorteoNombres.nocturna);
                if (r && r.numeros.length > 0) {
                  resultado.provincias[p.key].sorteos.nocturna = { 
                    fecha: r.fecha, 
                    numeros: r.numeros 
                  };
                } else {
                  resultado.provincias[p.key].sorteos.nocturna = {
                    fecha: hoy,
                    numeros: []
                  };
                }
                continue;
              }
            }

            // PARA TODOS LOS DEMÁS SORTEOS
            const r = parsearTexto(texto, p.label, sorteoNombres[sorteo]);
            if (r && r.numeros.length > 0) {
              resultado.provincias[p.key].sorteos[sorteo] = { 
                fecha: r.fecha, 
                numeros: r.numeros 
              };
            } else if (!sorteoYaOcurrio(sorteo)) {
              resultado.provincias[p.key].sorteos[sorteo] = {
                fecha: hoy, 
                numeros: [], 
                pendiente: true,
                horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
              };
            }
          } catch(err) {
            console.error(`Error parsing ${p.key} ${sorteo}:`, err);
          }
        }
      }
    }
  } catch(e) {
    resultado._errorAR = e.message;
  }

  // ── Fetch Montevideo ─────────────────────────────────────────────────────
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    
    if (!response.ok) {
      resultado._errorMVD = `HTTP ${response.status}`;
    } else {
      const html = await response.text();
      const resultadosMVD = parsearMontevideo(html);

      if (sorteoYaOcurrio('matutina')) {
        if (resultadosMVD.matutina) {
          resultado.provincias.montevideo.sorteos.matutina = resultadosMVD.matutina;
        }
      } else {
        resultado.provincias.montevideo.sorteos.matutina = {
          fecha: hoy, numeros: [], pendiente: true, horaPrevista: '14:00'
        };
      }

      if (sorteoYaOcurrio('nocturna')) {
        if (resultadosMVD.nocturna) {
          resultado.provincias.montevideo.sorteos.nocturna = resultadosMVD.nocturna;
        } else {
          resultado.provincias.montevideo.sorteos.nocturna = {
            fecha: hoy,
            numeros: []
          };
        }
      } else {
        resultado.provincias.montevideo.sorteos.nocturna = {
          fecha: hoy, numeros: [], pendiente: true, horaPrevista: '21:15'
        };
      }
    }
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}

