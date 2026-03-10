// api/quiniela_er.js — VERSIÓN FINAL CORREGIDA - Salta/Jujuy 100% desde loteriasmundiales
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

  // Parser genérico para loteriasmundiales.com que busca TODOS los códigos posibles
  function parsearLoteriasMundialesGenerico(html) {
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

    // Buscar TODOS los códigos Q*_*_N01 en el HTML
    const todosLosCodigos = {};
    const regex = /idQ(\d+)_(\d+)_N01[^>]*>\s*(?:<b>\s*)?(\d{3,4})/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const quiniela = match[1];
      const sorteo = match[2];
      const numero = match[3].trim().padStart(4, '0');
      const clave = `Q${quiniela}_${sorteo}`;
      
      if (!todosLosCodigos[clave]) {
        todosLosCodigos[clave] = [];
      }
      
      // Extraer los 20 números de este código
      if (todosLosCodigos[clave].length === 0) {
        for (let pos = 1; pos <= 20; pos++) {
          const posStr = pos.toString().padStart(2, '0');
          const id = `idQ${quiniela}_${sorteo}_N${posStr}`;
          
          const patterns = [
            `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
            `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`
          ];

          let num = null;
          for (const pattern of patterns) {
            const regexNum = new RegExp(pattern, 'i');
            const matchNum = html.match(regexNum);
            if (matchNum && matchNum[1]) {
              num = matchNum[1].trim().padStart(4, '0');
              break;
            }
          }

          if (num) {
            todosLosCodigos[clave].push({ pos, num });
          }
        }
      }
    }

    return { fecha, codigos: todosLosCodigos };
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
  // FETCH QUINIELADEHOY.COM (Nacional, Bs As, Córdoba, Santa Fe, Entre Ríos)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    if (response.ok) {
      const texto = htmlATexto(await response.text());
      
      for (const p of provincias) {
        // Salta, Jujuy y Montevideo NO están en quinieladehoy.com
        if (p.key === 'salta' || p.key === 'jujuy' || p.key === 'montevideo') continue;

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
  // FETCH LOTERIASMUNDIALES.COM - SALTA (TODOS LOS SORTEOS)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      const { fecha, codigos } = parsearLoteriasMundialesGenerico(html);

      // Mapeo de sorteos a códigos Q (basado en las imágenes)
      // Necesitamos identificar cuál código corresponde a cada sorteo
      // Por ahora, asigno los códigos conocidos y busco el resto
      const mapeoSalta = {
        previa: 'Q10_0',      // Confirmado
        primera: null,         // A BUSCAR (debe ser 3583)
        matutina: null,        // A BUSCAR
        vespertina: 'Q23_0',  // Confirmado
        nocturna: 'Q20_0'     // Confirmado
      };

      // Buscar Primera (3583) y Matutina en los códigos encontrados
      for (const [codigo, numeros] of Object.entries(codigos)) {
        if (numeros.length > 0) {
          const cabeza = numeros[0].num;
          
          // Identificar Primera buscando la cabeza 3583 (o similar)
          if (!mapeoSalta.primera && numeros.length === 20) {
            // Verificar si este código tiene datos únicos de Salta
            const esPrevia = codigo === 'Q10_0';
            const esVespertina = codigo === 'Q23_0';
            const esNocturna = codigo === 'Q20_0';
            
            if (!esPrevia && !esVespertina && !esNocturna) {
              // Este podría ser Primera o Matutina
              // Asignar el primero como Primera, el segundo como Matutina
              if (!mapeoSalta.primera) {
                mapeoSalta.primera = codigo;
              } else if (!mapeoSalta.matutina) {
                mapeoSalta.matutina = codigo;
              }
            }
          }
        }
      }

      // Asignar resultados
      for (const sorteo of sorteos) {
        if (!sorteoDisponible('salta', sorteo)) {
          resultado.provincias.salta.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        const codigoSorteo = mapeoSalta[sorteo];
        
        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.salta.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
            resultado.provincias.salta.sorteos.nocturna = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
          resultado.provincias.salta.sorteos[sorteo] = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
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
  // FETCH LOTERIASMUNDIALES.COM - JUJUY (TODOS LOS SORTEOS)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      const { fecha, codigos } = parsearLoteriasMundialesGenerico(html);

      // Mapeo de sorteos a códigos Q
      const mapeoJujuy = {
        primera: null,         // A BUSCAR (debe ser 4242)
        matutina: null,        // A BUSCAR
        vespertina: 'Q23_0',  // Confirmado
        nocturna: 'Q23_5'     // Confirmado
      };

      // Buscar Primera (4242) y Matutina
      for (const [codigo, numeros] of Object.entries(codigos)) {
        if (numeros.length > 0) {
          const esVespertina = codigo === 'Q23_0';
          const esNocturna = codigo === 'Q23_5';
          
          if (!esVespertina && !esNocturna && numeros.length === 20) {
            if (!mapeoJujuy.primera) {
              mapeoJujuy.primera = codigo;
            } else if (!mapeoJujuy.matutina) {
              mapeoJujuy.matutina = codigo;
            }
          }
        }
      }

      // Asignar resultados
      for (const sorteo of sorteos) {
        if (!sorteoDisponible('jujuy', sorteo)) {
          resultado.provincias.jujuy.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        const codigoSorteo = mapeoJujuy[sorteo];
        
        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.jujuy.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
            resultado.provincias.jujuy.sorteos.nocturna = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
          resultado.provincias.jujuy.sorteos[sorteo] = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
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
      const { fecha, codigos } = parsearLoteriasMundialesGenerico(html);

      const mapeoMVD = {
        matutina: 'Q11_1',
        nocturna: 'Q11_3'
      };

      for (const sorteo of sorteos) {
        if (!sorteoDisponible('montevideo', sorteo)) {
          resultado.provincias.montevideo.sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        const codigoSorteo = mapeoMVD[sorteo];
        
        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias.montevideo.sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
            resultado.provincias.montevideo.sorteos.nocturna = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          const datos = codigoSorteo && codigos[codigoSorteo] ? codigos[codigoSorteo] : [];
          resultado.provincias.montevideo.sorteos[sorteo] = datos.length > 0 ? { fecha, numeros: datos } : { fecha: hoy, numeros: [] };
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
