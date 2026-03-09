// api/quiniela_er.js — VERSIÓN CORREGIDA con Salta/Jujuy
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
  const diaSemana = ahoraArgentina.getDay();

  const esDomingo = diaSemana === 0;
  const esSabado = diaSemana === 6;
  const esLunesAViernes = diaSemana >= 1 && diaSemana <= 5;

  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

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

  const provincias = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional'     },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',      label: 'Quiniela Córdoba'      },
    { key: 'santafe',    nombre: 'Santa Fe',     label: 'Quiniela Santa Fe'     },
    { key: 'entrerrios', nombre: 'Entre Ríos',   label: 'Quiniela Entre Rios'   },
    { key: 'salta',      nombre: 'Salta',        label: 'Quiniela Salta'        },
    { key: 'jujuy',      nombre: 'Jujuy',        label: 'Quiniela Jujuy'        },
    { key: 'montevideo', nombre: 'Montevideo',   label: 'Quiniela Montevideo'   },
  ];
  const sorteos       = ['previa','primera','matutina','vespertina','nocturna'];
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna' };
  const nombresDias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  const resultado = { 
    actualizado: ahora, 
    fecha: hoy, 
    horaActual: `${horaActual.toString().padStart(2,'0')}:${minutoActual.toString().padStart(2,'0')}`,
    diaSemana: nombresDias[diaSemana],
    provincias: {}
  };
  
  for (const p of provincias) {
    resultado.provincias[p.key] = {
      nombre: p.nombre,
      sorteos: Object.fromEntries(sorteos.map(s => [s, { fecha: hoy, numeros: [] }]))
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function esFechaHoy(fechaStr) {
    const fechaNormalizada = fechaStr.replace(/-/g, '/');
    return fechaNormalizada === fechaHoyFormato;
  }

  function parsearTexto(textoPlano, label, sorteoNombre) {
    const regex = new RegExp(label + '\\s*' + sorteoNombre + '\\s*(\\d{2}-\\d{2}-\\d{4})', 'i');
    const match = regex.exec(textoPlano);
    if (!match) return null;

    const fechaOriginal = match[1];
    const fecha = fechaOriginal.replace(/-/g, '/');

    if (!esFechaHoy(fecha)) {
      return null;
    }

    const desde = match.index + match[0].length;
    const fragmento = textoPlano.substring(desde, desde + 1000);
    const lineas = fragmento.split('\n').map(l => l.trim()).filter(Boolean);
    
    const numeros = [];
    for (let i = 0; i < lineas.length && numeros.length < 20; i++) {
      const pos = parseInt(lineas[i]);
      if (pos === numeros.length + 1 && lineas[i + 1] && /^\d{3,4}$/.test(lineas[i + 1])) {
        numeros.push({ pos, num: lineas[i + 1].padStart(4, '0') });
        i++;
      }
    }
    
    return numeros.length > 0 ? { fecha, numeros } : null;
  }

  function parsearLoteriasMundiales(html, codigos) {
    const resultados = {};
    let fecha = hoy;
    
    const fechaMatch = html.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (fechaMatch) {
      const meses = {'enero':'01','febrero':'02','marzo':'03','abril':'04','mayo':'05','junio':'06',
        'julio':'07','agosto':'08','septiembre':'09','octubre':'10','noviembre':'11','diciembre':'12'};
      const dia = fechaMatch[1].padStart(2, '0');
      const mes = meses[fechaMatch[2].toLowerCase()];
      const anio = fechaMatch[3];
      if (mes) {
        fecha = `${dia}/${mes}/${anio}`;
        if (!esFechaHoy(fecha)) {
          return {};
        }
      }
    }

    for (const [sorteoKey, config] of Object.entries(codigos)) {
      const numeros = [];
      
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        const id = `idQ${config.quiniela}_${config.sorteo}_N${posStr}`;
        
        const patterns = [
          `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
          `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`,
          `id='${id}'[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
          `id='${id}'[^>]*>\\s*([0-9]{3,4})\\s*<`
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
          numeros.push({ pos, num: numero });
        }
      }

      if (numeros.length > 0) {
        resultados[sorteoKey] = { fecha, numeros };
      }
    }

    return resultados;
  }

  function htmlATexto(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  }

  function sorteoDisponible(provinciaKey, sorteo) {
    if (esDomingo && (provinciaKey === 'salta' || provinciaKey === 'jujuy' || provinciaKey === 'entrerrios')) {
      return sorteo === 'primera' || sorteo === 'matutina';
    }
    
    if (provinciaKey === 'montevideo') {
      if (sorteo === 'previa' || sorteo === 'vespertina' || sorteo === 'primera') {
        return false;
      }
      if (esLunesAViernes || esSabado) {
        return sorteo === 'matutina' || sorteo === 'nocturna';
      }
      if (esDomingo) {
        return false;
      }
    }

    if (provinciaKey === 'jujuy' && sorteo === 'previa') {
      return false;
    }

    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FETCH QUINIELADEHOY.COM (Nacional, Bs As, Córdoba, Santa Fe, Entre Ríos, Salta, Jujuy)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    if (response.ok) {
      const texto = htmlATexto(await response.text());
      
      for (const p of provincias) {
        // Montevideo NO está en quinieladehoy.com
        if (p.key === 'montevideo') continue;

        for (const sorteo of sorteos) {
          if (!sorteoDisponible(p.key, sorteo)) {
            resultado.provincias[p.key].sorteos[sorteo] = {
              fecha: hoy,
              numeros: [],
              noDisponible: true
            };
            continue;
          }

          // SALTA y JUJUY: Solo Primera y Matutina desde quinieladehoy
          // Previa, Vespertina, Nocturna se obtienen de loteriasmundiales
          if ((p.key === 'salta' || p.key === 'jujuy') && 
              sorteo !== 'primera' && sorteo !== 'matutina') {
            continue; // Se procesa después en loteriasmundiales
          }

          if (sorteo === 'nocturna') {
            if (!sorteoYaOcurrio('nocturna')) {
              resultado.provincias[p.key].sorteos.nocturna = {
                fecha: hoy, 
                numeros: [], 
                pendiente: true, 
                horaPrevista: '21:15'
              };
            } else {
              const r = parsearTexto(texto, p.label, sorteoNombres.nocturna);
              resultado.provincias[p.key].sorteos.nocturna = r || { fecha: hoy, numeros: [] };
            }
            continue;
          }

          if (sorteoYaOcurrio(sorteo)) {
            const r = parsearTexto(texto, p.label, sorteoNombres[sorteo]);
            resultado.provincias[p.key].sorteos[sorteo] = r || { fecha: hoy, numeros: [] };
          } else {
            resultado.provincias[p.key].sorteos[sorteo] = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true,
              horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
            };
          }
        }
      }
    }
  } catch(e) {
    resultado._errorQuinielaHoy = e.message;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FETCH LOTERIASMUNDIALES.COM
  // - Montevideo: Matutina + Nocturna
  // - Salta: Previa, Vespertina, Nocturna
  // - Jujuy: Vespertina, Nocturna
  // ════════════════════════════════════════════════════════════════════════

  // SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        previa: { quiniela: 10, sorteo: 0 },
        vespertina: { quiniela: 23, sorteo: 0 },
        nocturna: { quiniela: 20, sorteo: 0 }
      };
      const resultadosSalta = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of ['previa', 'vespertina', 'nocturna']) {
        if (!sorteoDisponible('salta', sorteo)) {
          resultado.provincias.salta.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.salta.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            resultado.provincias.salta.sorteos.nocturna = resultadosSalta.nocturna || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          resultado.provincias.salta.sorteos[sorteo] = resultadosSalta[sorteo] || { fecha: hoy, numeros: [] };
        } else {
          resultado.provincias.salta.sorteos[sorteo] = {
            fecha: hoy, 
            numeros: [], 
            pendiente: true,
            horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    }
  } catch(e) {
    resultado._errorSalta = e.message;
  }

  // JUJUY
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        vespertina: { quiniela: 23, sorteo: 0 },
        nocturna: { quiniela: 23, sorteo: 5 }
      };
      const resultadosJujuy = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of ['vespertina', 'nocturna']) {
        if (!sorteoDisponible('jujuy', sorteo)) {
          resultado.provincias.jujuy.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.jujuy.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            resultado.provincias.jujuy.sorteos.nocturna = resultadosJujuy.nocturna || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          resultado.provincias.jujuy.sorteos[sorteo] = resultadosJujuy[sorteo] || { fecha: hoy, numeros: [] };
        } else {
          resultado.provincias.jujuy.sorteos[sorteo] = {
            fecha: hoy, 
            numeros: [], 
            pendiente: true,
            horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    }
  } catch(e) {
    resultado._errorJujuy = e.message;
  }

  // MONTEVIDEO
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        matutina: { quiniela: 11, sorteo: 1 },
        nocturna: { quiniela: 11, sorteo: 3 }
      };
      const resultadosMVD = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of sorteos) {
        if (!sorteoDisponible('montevideo', sorteo)) {
          resultado.provincias.montevideo.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.montevideo.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            resultado.provincias.montevideo.sorteos.nocturna = resultadosMVD.nocturna || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          resultado.provincias.montevideo.sorteos[sorteo] = resultadosMVD[sorteo] || { fecha: hoy, numeros: [] };
        } else {
          resultado.provincias.montevideo.sorteos[sorteo] = {
            fecha: hoy, 
            numeros: [], 
            pendiente: true,
            horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    }
  } catch(e) {
    resultado._errorMontevideo = e.message;
  }

  res.status(200).json(resultado);
}
