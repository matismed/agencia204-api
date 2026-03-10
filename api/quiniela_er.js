// api/quiniela_er.js — VERSIÓN OPTIMIZADA
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const hoy = ahoraArgentina.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const horaActualMinutos = ahoraArgentina.getHours() * 60 + ahoraArgentina.getMinutes();
  const diaSemana = ahoraArgentina.getDay();

  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

  const horariosSorteos = {
    previa: { hora: 10, minuto: 15, minutosDia: 10 * 60 + 15 },
    primera: { hora: 12, minuto: 0, minutosDia: 12 * 60 },
    matutina: { hora: 15, minuto: 0, minutosDia: 15 * 60 },
    vespertina: { hora: 18, minuto: 0, minutosDia: 18 * 60 },
    nocturna: { hora: 21, minuto: 15, minutosDia: 21 * 60 + 15 }
  };

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

  const sorteos = ['previa', 'primera', 'matutina', 'vespertina', 'nocturna'];
  const sorteoNombres = { previa: 'Previa', primera: 'Primera', matutina: 'Matutina', vespertina: 'Vespertina', nocturna: 'Nocturna' };

  let resultado = {
    actualizado: ahoraArgentina.toLocaleString('es-AR'),
    fecha: hoy,
    provincias: {}
  };

  provincias.forEach(p => {
    resultado.provincias[p.key] = { nombre: p.nombre, sorteos: {} };
  });

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  // --- FUNCIONES DE PARSEO MEJORADAS ---

  function parsearLoteriasMundiales(html, codigos) {
    const rLocal = {};
    for (const [sorteoKey, config] of Object.entries(codigos)) {
      const numeros = [];
      // Buscamos los 20 números
      for (let pos = 1; pos <= 20; pos++) {
        const posStr = pos.toString().padStart(2, '0');
        // Regex flexible para capturar el número dentro del ID específico
        const regex = new RegExp(`id=["']idQ${config.quiniela}_${config.sorteo}_N${posStr}["'][^>]*>\\s*(?:<b>)?\\s*([0-9]{1,4})\\s*(?:<\\/b>)?\\s*<`, 'i');
        const match = html.match(regex);
        if (match && match[1]) {
          numeros.push({ pos, num: match[1].padStart(4, '0') });
        }
      }
      if (numeros.length > 0) rLocal[sorteoKey] = { fecha: hoy, numeros };
    }
    return rLocal;
  }

  // --- LÓGICA DE CARGA ---

  try {
    // 1. SALTA
    const resSalta = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    const htmlSalta = await resSalta.text();
    const dataSalta = parsearLoteriasMundiales(htmlSalta, {
      previa: { quiniela: 10, sorteo: 0 },
      primera: { quiniela: 26, sorteo: 0 },
      matutina: { quiniela: 27, sorteo: 0 },
      vespertina: { quiniela: 23, sorteo: 0 },
      nocturna: { quiniela: 20, sorteo: 0 }
    });

    // 2. JUJUY
    const resJujuy = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    const htmlJujuy = await resJujuy.text();
    const dataJujuy = parsearLoteriasMundiales(htmlJujuy, {
      primera: { quiniela: 23, sorteo: 5 },
      matutina: { quiniela: 26, sorteo: 5 },
      vespertina: { quiniela: 23, sorteo: 0 },
      nocturna: { quiniela: 26, sorteo: 0 }
    });

    // 3. MONTEVIDEO
    const resMVD = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    const htmlMVD = await resMVD.text();
    const dataMVD = parsearLoteriasMundiales(htmlMVD, {
      matutina: { quiniela: 11, sorteo: 1 },
      nocturna: { quiniela: 11, sorteo: 3 }
    });

    // Llenar el objeto de resultados con validación de horarios
    for (const p of provincias) {
      for (const s of sorteos) {
        let datosSorteo = null;
        
        if (p.key === 'salta') datosSorteo = dataSalta[s];
        if (p.key === 'jujuy') datosSorteo = dataJujuy[s];
        if (p.key === 'montevideo') datosSorteo = dataMVD[s];

        if (datosSorteo) {
          resultado.provincias[p.key].sorteos[s] = datosSorteo;
        } else {
          const pasoHora = horaActualMinutos >= horariosSorteos[s].minutosDia;
          resultado.provincias[p.key].sorteos[s] = {
            fecha: hoy,
            numeros: [],
            estado: pasoHora ? "No disponible / En carga" : "Pendiente",
            horaPrevista: `${horariosSorteos[s].hora}:${horariosSorteos[s].minuto.toString().padStart(2,'0')}`
          };
        }
      }
    }

  } catch (error) {
    resultado.error = error.message;
  }

  res.status(200).json(resultado);
}
