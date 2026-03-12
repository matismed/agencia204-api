// SCRAPER TURISTA - ruta1000.com.ar (URL correcta)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Scraper de Turista desde ruta1000.com.ar",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.ruta1000.com.ar/'
  };

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

  // LÓGICA SIMPLE:
  // ruta1000.com en la página de "Viernes" muestra "AYER Jueves"
  // Entonces para obtener el sorteo de HOY, accedemos a la página de MAÑANA
  const mañana = new Date(ahoraArgentina);
  mañana.setDate(mañana.getDate() + 1);
  
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const diaSemanaURL = diasSemana[mañana.getDay()];

  function htmlATexto(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  function parsearRuta1000Turista(html, provincia) {
    const texto = htmlATexto(html);
    
    // Buscar múltiples patrones posibles
    const patronesTurista = [
      new RegExp(`${provincia.toUpperCase()}.*?TURISTA.*?\\d{1,2}\\s*DE\\s*\\w+\\s*DE\\s*\\d{4}`, 'i'),
      new RegExp(`TURISTA.*?${provincia.toUpperCase()}.*?\\d{1,2}\\s*DE\\s*\\w+\\s*DE\\s*\\d{4}`, 'i'),
      /SORTEADO\s*AYER.*?TURISTA.*?\d{1,2}\s*DE\s*\w+\s*DE\s*\d{4}/i,
      /TURISTA\s*DEL\s*\d{1,2}\s*DE\s*\w+\s*DE\s*\d{4}/i
    ];

    let matchTurista = null;
    for (const patron of patronesTurista) {
      matchTurista = patron.exec(texto);
      if (matchTurista) break;
    }
    
    if (!matchTurista) {
      // Buscar simplemente "TURISTA" y extraer desde ahí
      const idxTurista = texto.toUpperCase().indexOf('TURISTA');
      if (idxTurista === -1) {
        return { error: "No se encontró 'TURISTA' en el HTML" };
      }
      matchTurista = { index: idxTurista, 0: 'TURISTA' };
    }

    // Extraer números después del match
    const desde = matchTurista.index + matchTurista[0].length;
    const fragmento = texto.substring(desde, desde + 2000);
    
    // Patrón: 1° 0883 6° 5847 o 1º 0883 6º 5847
    const numeros = [];
    const regex = /(\d{1,2})[°º]\s*(\d{4})/g;
    let match;
    
    while ((match = regex.exec(fragmento)) !== null && numeros.length < 20) {
      const pos = parseInt(match[1]);
      const num = match[2];
      
      if (pos >= 1 && pos <= 20) {
        numeros.push({ pos, num });
      }
    }

    // Ordenar por posición
    numeros.sort((a, b) => a.pos - b.pos);

    // Verificar que tengamos los 20 números en orden
    const numerosCompletos = [];
    for (let i = 1; i <= 20; i++) {
      const encontrado = numeros.find(n => n.pos === i);
      if (encontrado) {
        numerosCompletos.push(encontrado);
      }
    }

    return {
      fecha: fechaHoyFormato,
      numeros: numerosCompletos,
      cabeza: numerosCompletos.length > 0 ? numerosCompletos[0].num : null,
      cantidad: numerosCompletos.length
    };
  }

  // CÓRDOBA TURISTA
  try {
    // URL dinámica según el día de la semana
    const urlCordoba = `https://www.ruta1000.com.ar/index2008.php?Resultado=Quiniela_Cordoba_${diaSemanaURL}`;
    
    const response = await fetch(urlCordoba, { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.cordoba = parsearRuta1000Turista(html, 'CORDOBA');
      resultado.provincias.cordoba.url_usada = urlCordoba;
    } else {
      resultado.provincias.cordoba = { error: `HTTP ${response.status}`, url: urlCordoba };
    }
  } catch(e) {
    resultado.provincias.cordoba = { error: e.message };
  }

  // ENTRE RÍOS TURISTA
  try {
    const urlEntreRios = `https://www.ruta1000.com.ar/index2008.php?Resultado=Quiniela_Entre_Rios_${diaSemanaURL}`;
    
    const response = await fetch(urlEntreRios, { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (response.ok) {
      const html = await response.text();
      resultado.provincias.entrerrios = parsearRuta1000Turista(html, 'ENTRE RIOS');
      resultado.provincias.entrerrios.url_usada = urlEntreRios;
    } else {
      resultado.provincias.entrerrios = { error: `HTTP ${response.status}`, url: urlEntreRios };
    }
  } catch(e) {
    resultado.provincias.entrerrios = { error: e.message };
  }

  // Verificación
  resultado.verificacion = {
    cordoba_tiene_numeros: resultado.provincias.cordoba && resultado.provincias.cordoba.numeros && resultado.provincias.cordoba.numeros.length > 0,
    cordoba_cabeza: resultado.provincias.cordoba && resultado.provincias.cordoba.cabeza,
    entrerrios_tiene_numeros: resultado.provincias.entrerrios && resultado.provincias.entrerrios.numeros && resultado.provincias.entrerrios.numeros.length > 0,
    listo_para_produccion: resultado.provincias.cordoba && resultado.provincias.cordoba.numeros && resultado.provincias.cordoba.numeros.length === 20
  };

  resultado.info = {
    dia_actual: diasSemana[ahoraArgentina.getDay()],
    dia_usado_en_url: diaSemanaURL,
    nota: "ruta1000.com muestra sorteo de AYER, entonces para obtener HOY usamos URL de MAÑANA"
  };

  res.status(200).json(resultado);
}
