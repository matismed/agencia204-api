// api/quiniela_er.js — VERSIÓN FINAL DE PRODUCCIÓN
// Jujuy CON Previa - 5 sorteos completos
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
    nocturna: { hora: 21, minuto: 15, minutosDia: 21 * 60 + 15 },
    turista: { hora: 22, minuto: 15, minutosDia: 22 * 60 + 15 }
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
  const sorteos       = ['previa','primera','matutina','vespertina','nocturna','turista'];
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna', turista:'Turista' };
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
    // TURISTA: Solo disponible en Córdoba y Entre Ríos
    if (sorteo === 'turista') {
      return provinciaKey === 'cordoba' || provinciaKey === 'entrerrios';
    }
    
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

    // SALTA NO TIENE PREVIA
    if (provinciaKey === 'salta' && sorteo === 'previa') {
      return false;
    }

    // JUJUY AHORA SÍ TIENE PREVIA (cambio aquí)
    // Ya no bloqueamos la previa de Jujuy

    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FETCH QUINIELADEHOY.COM (Nacional, Bs As, Santa Fe, Entre Ríos)
  // Córdoba ahora usa loteriasmundiales.com
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    if (response.ok) {
      const texto = htmlATexto(await response.text());
      
      for (const p of provincias) {
        if (p.key === 'salta' || p.key === 'jujuy' || p.key === 'montevideo' || p.key === 'cordoba') continue;

        for (const sorteo of sorteos) {
          if (!sorteoDisponible(p.key, sorteo)) {
            resultado.provincias[p.key].sorteos[sorteo] = {
              fecha: hoy,
              numeros: [],
              noDisponible: true
            };
            continue;
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
  // FETCH LOTERIASMUNDIALES.COM - SALTA
  // CÓDIGOS CONFIRMADOS:
  // Primera (11:30) = Q10_0 ✓
  // Matutina (14:00) = Q10_1 ✓
  // Vespertina (17:30) = Q10_2 ✓
  // Nocturna (21:00) = Q10_3 ✓
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        primera: { quiniela: 10, sorteo: 0 },
        matutina: { quiniela: 10, sorteo: 1 },
        vespertina: { quiniela: 10, sorteo: 2 },
        nocturna: { quiniela: 10, sorteo: 3 }
      };
      const resultadosSalta = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of sorteos) {
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

  // ════════════════════════════════════════════════════════════════════════
  // FETCH LOTERIASMUNDIALES.COM - CÓRDOBA
  // CÓDIGOS CONFIRMADOS:
  // Previa (10:15) = Q6_5 ✓ (9602)
  // Primera (11:30) = Q6_0 ✓ (0815)
  // Matutina (14:00) = Q6_1 ✓ (5588)
  // Vespertina (17:30) = Q6_2 ✓ (7508)
  // Nocturna (21:00) = Q6_3 ✓ (31105)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/cordoba', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        previa: { quiniela: 6, sorteo: 5 },
        primera: { quiniela: 6, sorteo: 0 },
        matutina: { quiniela: 6, sorteo: 1 },
        vespertina: { quiniela: 6, sorteo: 2 },
        nocturna: { quiniela: 6, sorteo: 3 }
      };
      const resultadosCordoba = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of sorteos) {
        if (!sorteoDisponible('cordoba', sorteo)) {
          resultado.provincias.cordoba.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.cordoba.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            resultado.provincias.cordoba.sorteos.nocturna = resultadosCordoba.nocturna || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteo === 'turista') {
          if (!sorteoYaOcurrio('turista')) {
            resultado.provincias.cordoba.sorteos.turista = {
              fecha: hoy,
              numeros: [],
              pendiente: true,
              horaPrevista: '22:30'
            };
          } else {
            resultado.provincias.cordoba.sorteos.turista = resultadosCordoba.turista || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          resultado.provincias.cordoba.sorteos[sorteo] = resultadosCordoba[sorteo] || { fecha: hoy, numeros: [] };
        } else {
          resultado.provincias.cordoba.sorteos[sorteo] = {
            fecha: hoy, 
            numeros: [], 
            pendiente: true,
            horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    }
  } catch(e) {
    resultado._errorCordoba = e.message;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FETCH LOTERIASMUNDIALES.COM - JUJUY
  // CÓDIGOS CONFIRMADOS - AHORA CON PREVIA:
  // Previa (10:15) = Q23_5 ✓ (4242)
  // Primera (11:30) = Q23_0 ✓ (0370)
  // Matutina (14:00) = Q23_1 ✓ (4206)
  // Vespertina (17:30) = Q23_2 ✓ (9555)
  // Nocturna (21:00) = Q23_3 ✓ (2177)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      const codigos = {
        previa: { quiniela: 23, sorteo: 5 },
        primera: { quiniela: 23, sorteo: 0 },
        matutina: { quiniela: 23, sorteo: 1 },
        vespertina: { quiniela: 23, sorteo: 2 },
        nocturna: { quiniela: 23, sorteo: 3 }
      };
      const resultadosJujuy = parsearLoteriasMundiales(html, codigos);

      for (const sorteo of sorteos) {
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

  // ════════════════════════════════════════════════════════════════════════
  // FETCH LOTERIASMUNDIALES.COM - MONTEVIDEO
  // ════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════
  // FETCH CHEQUINIELAS.COM - TURISTA CÓRDOBA
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://chequinielas.com/cordoba/turista', { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Parser específico para chequinielas.com
      const numeros = [];
      const regexNumeros = /(\d{1,2})\.\s*\n\s*(\d{4})/g;
      let match;
      
      while ((match = regexNumeros.exec(html)) !== null && numeros.length < 20) {
        const pos = parseInt(match[1]);
        const num = match[2];
        if (pos >= 1 && pos <= 20) {
          numeros.push({ pos, num });
        }
      }
      
      if (numeros.length === 20) {
        numeros.sort((a, b) => a.pos - b.pos);
        resultado.provincias.cordoba.sorteos.turista = {
          fecha: fechaHoyFormato,
          numeros: numeros
        };
      } else {
        // Si no encontró 20 números, marcar como pendiente
        if (!sorteoYaOcurrio('turista')) {
          resultado.provincias.cordoba.sorteos.turista = {
            fecha: hoy,
            numeros: [],
            pendiente: true,
            horaPrevista: '22:30'
          };
        } else {
          resultado.provincias.cordoba.sorteos.turista = {
            fecha: hoy,
            numeros: [],
            error: 'No se encontraron 20 números en chequinielas.com'
          };
        }
      }
    }
  } catch(e) {
    resultado._errorTuristaCordoba = e.message;
    // Mantener turista vacío en caso de error
    resultado.provincias.cordoba.sorteos.turista = {
      fecha: hoy,
      numeros: []
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // FETCH LOTERIASMUNDIALES - TURISTA ENTRE RÍOS (Q5_4)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const urlTuristaER = 'https://www.loteriasmundiales.com/Quinielas/entrerriana?Q5_4';
    const responseTuristaER = await fetch(urlTuristaER, { 
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (responseTuristaER.ok) {
      const htmlTuristaER = await responseTuristaER.text();
      
      // Parser idéntico al que usamos para otras provincias de loteriasmundiales
      const regexNumeros = /<td class="num">(\d{4})<\/td>/g;
      const numerosTuristaER = [];
      let matchNum;
      
      while ((matchNum = regexNumeros.exec(htmlTuristaER)) !== null) {
        numerosTuristaER.push(matchNum[1]);
      }
      
      if (numerosTuristaER.length === 20) {
        // Convertir a formato con posiciones
        const numerosFormateados = numerosTuristaER.map((num, index) => ({
          pos: index + 1,
          num: num
        }));
        
        resultado.provincias.entrerrios.sorteos.turista = {
          fecha: fechaHoyFormato,
          numeros: numerosFormateados
        };
      } else {
        // Si no encontró 20 números, marcar como pendiente
        if (!sorteoYaOcurrio('turista')) {
          resultado.provincias.entrerrios.sorteos.turista = {
            fecha: hoy,
            numeros: [],
            pendiente: true,
            horaPrevista: '22:15'
          };
        } else {
          resultado.provincias.entrerrios.sorteos.turista = {
            fecha: hoy,
            numeros: [],
            error: 'No se encontraron 20 números en loteriasmundiales (Q5_4)'
          };
        }
      }
    }
  } catch(e) {
    resultado._errorTuristaEntreRios = e.message;
    // Mantener turista pendiente en caso de error de red
    if (!sorteoYaOcurrio('turista')) {
      resultado.provincias.entrerrios.sorteos.turista = {
        fecha: hoy,
        numeros: [],
        pendiente: true,
        horaPrevista: '22:15'
      };
    } else {
      resultado.provincias.entrerrios.sorteos.turista = {
        fecha: hoy,
        numeros: [],
        error: e.message
      };
    }
  }

  res.status(200).json(resultado);
}
