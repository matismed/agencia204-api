// api/quiniela_er.js — Versión OPTIMIZADA (sin timeout)
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

  const provinciasQuinielaHoy = [
    { key: 'nacional',   nombre: 'Nacional',     label: 'Quiniela Nacional' },
    { key: 'bsas',       nombre: 'Buenos Aires', label: 'Quiniela Buenos Aires' },
    { key: 'cordoba',    nombre: 'Córdoba',      label: 'Quiniela Córdoba' },
    { key: 'santafe',    nombre: 'Santa Fe',     label: 'Quiniela Santa Fe' },
    { key: 'entrerrios', nombre: 'Entre Ríos',   label: 'Quiniela Entre Rios' },
    { key: 'salta',      nombre: 'Salta',        label: 'Salta' },
    { key: 'jujuy',      nombre: 'Jujuy',        label: 'Jujuy' },
  ];

  const sorteos = ['previa','primera','matutina','vespertina','nocturna'];
  const sorteoNombres = { previa:'Previa', primera:'Primera', matutina:'Matutina', vespertina:'Vespertina', nocturna:'Nocturna' };

  const resultado = { 
    actualizado: ahora, 
    fecha: hoy, 
    horaActual: `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`,
    provincias: {}
  };
  
  for (const p of provinciasQuinielaHoy) {
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

  function parsearTexto(textoPlano, label, sorteoNombre) {
    const regex = new RegExp(label + '\\s*' + sorteoNombre + '\\s*(\\d{2}-\\d{2}-\\d{4})', 'i');
    const match = regex.exec(textoPlano);
    if (!match) return null;

    const fecha = match[1].replace(/-/g, '/');
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

  function parsearMontevideo(html) {
    const resultados = {};
    let fecha = hoy;
    const fechaMatch = html.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (fechaMatch) {
      const meses = {'enero':'01','febrero':'02','marzo':'03','abril':'04','mayo':'05','junio':'06',
        'julio':'07','agosto':'08','septiembre':'09','octubre':'10','noviembre':'11','diciembre':'12'};
      const dia = fechaMatch[1].padStart(2, '0');
      const mes = meses[fechaMatch[2].toLowerCase()];
      if (mes) fecha = `${dia}/${mes}/${fechaMatch[3]}`;
    }

    for (const [sorteoKey, codigo] of Object.entries({matutina:1, nocturna:3})) {
      const numeros = [];
      for (let pos = 1; pos <= 20; pos++) {
        const id = `idQ11_${codigo}_N${pos.toString().padStart(2,'0')}`;
        const match = html.match(new RegExp(`id="${id}"[^>]*>\\s*(?:<b>)?\\s*([0-9]{3,4})`, 'i'));
        if (match) numeros.push({ pos, num: match[1].trim().padStart(4, '0') });
      }
      if (numeros.length > 0) resultados[sorteoKey] = { fecha, numeros };
    }
    return resultados;
  }

  function htmlATexto(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  }

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { headers });
    if (response.ok) {
      const texto = htmlATexto(await response.text());
      
      for (const p of provinciasQuinielaHoy) {
        for (const sorteo of sorteos) {
          if (sorteo === 'nocturna' && !sorteoYaOcurrio('nocturna')) {
            resultado.provincias[p.key].sorteos.nocturna = { fecha: hoy, numeros: [], pendiente: true, horaPrevista: '21:15' };
          } else {
            const r = parsearTexto(texto, p.label, sorteoNombres[sorteo]);
            if (r) resultado.provincias[p.key].sorteos[sorteo] = r;
            else if (!sorteoYaOcurrio(sorteo)) {
              resultado.provincias[p.key].sorteos[sorteo] = { fecha: hoy, numeros: [], pendiente: true,
                horaPrevista: `${horariosSorteos[sorteo].hora.toString().padStart(2,'0')}:${horariosSorteos[sorteo].minuto.toString().padStart(2,'0')}`
              };
            }
          }
        }
      }
    }
  } catch(e) {
    resultado._errorAR = e.message;
  }

  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/uruguaya', { headers });
    if (response.ok) {
      const resultadosMVD = parsearMontevideo(await response.text());
      resultado.provincias.montevideo = resultado.provincias.montevideo || { nombre: 'Montevideo', sorteos: {} };
      
      for (const sorteo of ['matutina', 'nocturna']) {
        if (sorteoYaOcurrio(sorteo)) {
          if (resultadosMVD[sorteo]) resultado.provincias.montevideo.sorteos[sorteo] = resultadosMVD[sorteo];
        } else {
          resultado.provincias.montevideo.sorteos[sorteo] = { fecha: hoy, numeros: [], pendiente: true, 
            horaPrevista: sorteo === 'matutina' ? '14:00' : '21:15' };
        }
      }
    }
  } catch(e) {
    resultado._errorMVD = e.message;
  }

  res.status(200).json(resultado);
}
