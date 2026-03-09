// api/quiniela_er.js — VERSIÓN HÍBRIDA (vivitusuerte + loteriasmundiales)
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

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];
  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // CONFIGURACIÓN DE PROVINCIAS CON FUENTES
  const provincias = [
    { 
      key: 'nacional', 
      nombre: 'Nacional',
      fuente: 'vivitusuerte',  // ✅ Funciona en vivitusuerte
      urlVivi: '/pizarra/ciudad'
    },
    { 
      key: 'bsas', 
      nombre: 'Buenos Aires',
      fuente: 'loteriasmundiales',  // ❌ NO funciona en vivitusuerte
      urlLoterias: '/Quinielas/buenos-aires',
      codigos: {
        previa: { quiniela: 6, sorteo: 0 },
        primera: { quiniela: 15, sorteo: 0 },
        matutina: { quiniela: 26, sorteo: 0 },
        vespertina: { quiniela: 27, sorteo: 0 },
        nocturna: { quiniela: 27, sorteo: 5 }
      }
    },
    { 
      key: 'cordoba', 
      nombre: 'Córdoba',
      fuente: 'vivitusuerte',  // ✅ Funciona en vivitusuerte
      urlVivi: '/pizarra/cordoba'
    },
    { 
      key: 'santafe', 
      nombre: 'Santa Fe',
      fuente: 'loteriasmundiales',  // ❌ NO funciona en vivitusuerte
      urlLoterias: '/Quinielas/santa-fe',
      codigos: {
        primera: { quiniela: 15, sorteo: 0 },
        matutina: { quiniela: 26, sorteo: 0 },
        vespertina: { quiniela: 27, sorteo: 0 },
        nocturna: { quiniela: 27, sorteo: 5 }
      }
    },
    { 
      key: 'entrerrios', 
      nombre: 'Entre Ríos',
      fuente: 'loteriasmundiales',  // ❌ NO funciona en vivitusuerte
      urlLoterias: '/Quinielas/entre-rios',
      codigos: {
        previa: { quiniela: 14, sorteo: 0 },
        primera: { quiniela: 15, sorteo: 0 },
        matutina: { quiniela: 26, sorteo: 0 },
        vespertina: { quiniela: 27, sorteo: 0 },
        nocturna: { quiniela: 27, sorteo: 5 }
      }
    },
    { 
      key: 'salta', 
      nombre: 'Salta',
      fuente: 'loteriasmundiales',  // ⚠️ Parcial en vivitusuerte, mejor loteriasmundiales
      urlLoterias: '/Quinielas/salta',
      codigos: {
        previa: { quiniela: 10, sorteo: 0 },
        primera: { quiniela: 26, sorteo: 0 },
        matutina: { quiniela: 27, sorteo: 0 },
        vespertina: { quiniela: 23, sorteo: 0 },
        nocturna: { quiniela: 20, sorteo: 0 }
      }
    },
    { 
      key: 'jujuy', 
      nombre: 'Jujuy',
      fuente: 'vivitusuerte',  // ✅ Funciona en vivitusuerte
      urlVivi: '/pizarra/jujuy'
    },
    { 
      key: 'montevideo', 
      nombre: 'Montevideo',
      fuente: 'vivitusuerte',  // ✅ Funciona en vivitusuerte
      urlVivi: '/pizarra/montevideo'
    }
  ];

  const resultado = { 
    actualizado: ahora, 
    fecha: hoy, 
    horaActual: `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`,
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

  function sorteoDisponible(provinciaKey, sorteo, tieneCodigoEnFuente = true) {
    if (!tieneCodigoEnFuente) {
      return false;
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

    return true;
  }

  // PARSER DE VIVITUSUERTE
  function parsearVivitusuerte(html) {
    const resultados = {};
    const momentoMap = {
      '5': 'previa',
      '1': 'primera',
      '2': 'matutina',
      '3': 'vespertina',
      '4': 'nocturna'
    };

    for (const [momento, sorteoKey] of Object.entries(momentoMap)) {
      const tableRegex = new RegExp(`<table[^>]*data-pizarra-momento="${momento}"[^>]*>([\\s\\S]*?)<\\/table>`, 'i');
      const tableMatch = html.match(tableRegex);
      
      if (tableMatch) {
        const tablaHTML = tableMatch[1];
        let numeros = [];
        
        // Método 1: Con data-texto
        const numerosRegex1 = /<span[^>]*class="caja-resultado"[^>]*data-texto="momento_dato_(\d+)"[^>]*>(\d{4})<\/span>/g;
        let match;
        
        while ((match = numerosRegex1.exec(tablaHTML)) !== null) {
          const posicion = parseInt(match[1]);
          const numero = match[2];
          if (numero && numero !== '----' && /^\d{4}$/.test(numero)) {
            numeros.push({ pos: posicion, num: numero });
          }
        }
        
        // Método 2: Sin data-texto (fallback)
        if (numeros.length === 0) {
          const numerosRegex2 = /<span[^>]*class="caja-resultado"[^>]*>(\d{4})<\/span>/g;
          let pos = 1;
          while ((match = numerosRegex2.exec(tablaHTML)) !== null && pos <= 20) {
            const numero = match[1];
            if (numero && numero !== '----' && /^\d{4}$/.test(numero)) {
              numeros.push({ pos, num: numero });
              pos++;
            }
          }
        }
        
        if (numeros.length === 20) {
          numeros.sort((a, b) => a.pos - b.pos);
          resultados[sorteoKey] = { fecha: hoy, numeros };
        }
      }
    }

    return resultados;
  }

  // PARSER DE LOTERIASMUNDIALES
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
        const fechaNormalizada = fecha.replace(/-/g, '/');
        if (fechaNormalizada !== fechaHoyFormato) {
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

  // FETCH DE CADA PROVINCIA
  for (const provincia of provincias) {
    try {
      let html = '';
      let resultadosProv = {};

      // Decidir de qué fuente scrapear
      if (provincia.fuente === 'vivitusuerte') {
        const url = `https://vivitusuerte.com${provincia.urlVivi}`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          html = await response.text();
          resultadosProv = parsearVivitusuerte(html);
        }
      } else if (provincia.fuente === 'loteriasmundiales') {
        const url = `https://www.loteriasmundiales.com.ar${provincia.urlLoterias}`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          html = await response.text();
          resultadosProv = parsearLoteriasMundiales(html, provincia.codigos);
        }
      }

      // Procesar sorteos
      for (const sorteo of sorteos) {
        const tieneCodigoEnFuente = provincia.fuente === 'vivitusuerte' || 
                                    (provincia.codigos && provincia.codigos.hasOwnProperty(sorteo));
        
        if (!sorteoDisponible(provincia.key, sorteo, tieneCodigoEnFuente)) {
          resultado.provincias[provincia.key].sorteos[sorteo] = {
            fecha: hoy,
            numeros: [],
            noDisponible: true
          };
          continue;
        }

        if (sorteo === 'nocturna') {
          if (!sorteoYaOcurrio('nocturna')) {
            resultado.provincias[provincia.key].sorteos.nocturna = {
              fecha: hoy, 
              numeros: [], 
              pendiente: true, 
              horaPrevista: '21:15'
            };
          } else {
            resultado.provincias[provincia.key].sorteos.nocturna = resultadosProv.nocturna || { fecha: hoy, numeros: [] };
          }
          continue;
        }

        if (sorteoYaOcurrio(sorteo)) {
          resultado.provincias[provincia.key].sorteos[sorteo] = resultadosProv[sorteo] || { fecha: hoy, numeros: [] };
        } else {
          resultado.provincias[provincia.key].sorteos[sorteo] = {
            fecha: hoy, 
            numeros: [], 
            pendiente: true,
            horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    } catch(e) {
      resultado[`_error_${provincia.key}`] = e.message;
    }
  }

  res.status(200).json(resultado);
}

