// BÚSQUEDA CORREGIDA - Turista en quinieladehoy.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Búsqueda de Turista en quinieladehoy.com",
    analisis: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

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

  const ahoraArgentina = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const diaHoy = ahoraArgentina.getDate().toString().padStart(2, '0');
  const mesHoy = (ahoraArgentina.getMonth() + 1).toString().padStart(2, '0');
  const anioHoy = ahoraArgentina.getFullYear();
  const fechaHoyFormato = `${diaHoy}/${mesHoy}/${anioHoy}`;

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela', { 
      headers,
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      resultado.error = `HTTP ${response.status}`;
      res.status(200).json(resultado);
      return;
    }

    const html = await response.text();
    const texto = htmlATexto(html);
    
    // ANÁLISIS 1: Buscar "Turista" en el texto
    const menciones_turista = [];
    const regexTurista = /(.{0,100}turista.{0,100})/gi;
    let match;
    while ((match = regexTurista.exec(texto)) !== null && menciones_turista.length < 5) {
      menciones_turista.push(match[1].trim());
    }
    
    resultado.analisis.menciones_turista = {
      cantidad: menciones_turista.length,
      fragmentos: menciones_turista
    };

    // ANÁLISIS 2: Buscar patrón "Quiniela Córdoba Turista"
    const regexCordobaTurista = /Quiniela Córdoba\s*Turista\s*(\d{1,2}-\d{1,2}-\d{4})/i;
    const matchCordoba = regexCordobaTurista.exec(texto);
    
    resultado.analisis.cordoba_turista = {
      encontrado: !!matchCordoba,
      match_completo: matchCordoba ? matchCordoba[0] : null,
      fecha: matchCordoba ? matchCordoba[1] : null
    };

    if (matchCordoba) {
      // Intentar parsear números
      const desde = matchCordoba.index + matchCordoba[0].length;
      const fragmento = texto.substring(desde, desde + 1000);
      const lineas = fragmento.split('\n').map(l => l.trim()).filter(Boolean);
      
      const numeros = [];
      for (let i = 0; i < lineas.length && numeros.length < 20; i++) {
        const pos = parseInt(lineas[i]);
        if (pos === numeros.length + 1 && lineas[i + 1] && /^\d{3,4}$/.test(lineas[i + 1])) {
          numeros.push({ pos, num: lineas[i + 1].padStart(4, '0') });
          i++;
        }
      }
      
      resultado.analisis.cordoba_turista.numeros_encontrados = numeros;
      resultado.analisis.cordoba_turista.cabeza = numeros.length > 0 ? numeros[0].num : null;
    }

    // ANÁLISIS 3: Buscar patrón "Quiniela Entre Rios Turista"
    const regexEntreRiosTurista = /Quiniela Entre Rios\s*Turista\s*(\d{1,2}-\d{1,2}-\d{4})/i;
    const matchEntreRios = regexEntreRiosTurista.exec(texto);
    
    resultado.analisis.entrerrios_turista = {
      encontrado: !!matchEntreRios,
      match_completo: matchEntreRios ? matchEntreRios[0] : null,
      fecha: matchEntreRios ? matchEntreRios[1] : null
    };

    if (matchEntreRios) {
      const desde = matchEntreRios.index + matchEntreRios[0].length;
      const fragmento = texto.substring(desde, desde + 1000);
      const lineas = fragmento.split('\n').map(l => l.trim()).filter(Boolean);
      
      const numeros = [];
      for (let i = 0; i < lineas.length && numeros.length < 20; i++) {
        const pos = parseInt(lineas[i]);
        if (pos === numeros.length + 1 && lineas[i + 1] && /^\d{3,4}$/.test(lineas[i + 1])) {
          numeros.push({ pos, num: lineas[i + 1].padStart(4, '0') });
          i++;
        }
      }
      
      resultado.analisis.entrerrios_turista.numeros_encontrados = numeros;
      resultado.analisis.entrerrios_turista.cabeza = numeros.length > 0 ? numeros[0].num : null;
    }

    // ANÁLISIS 4: Buscar número 0883 en cualquier parte
    const tiene0883 = texto.includes('0883');
    resultado.analisis.busqueda_0883 = {
      encontrado: tiene0883
    };

    if (tiene0883) {
      const idx = texto.indexOf('0883');
      resultado.analisis.busqueda_0883.contexto = texto.substring(Math.max(0, idx - 200), Math.min(texto.length, idx + 200));
    }

    // RESUMEN
    resultado.resumen = {
      quinieladehoy_tiene_turista: menciones_turista.length > 0,
      cordoba_turista_disponible: !!matchCordoba,
      entrerrios_turista_disponible: !!matchEntreRios,
      cordoba_cabeza: matchCordoba && resultado.analisis.cordoba_turista.cabeza ? resultado.analisis.cordoba_turista.cabeza : null,
      entrerrios_cabeza: matchEntreRios && resultado.analisis.entrerrios_turista.cabeza ? resultado.analisis.entrerrios_turista.cabeza : null,
      recomendacion: (matchCordoba || matchEntreRios) 
        ? "✅ quinieladehoy.com TIENE Turista - usar parsearTexto() con 'Turista'"
        : "❌ quinieladehoy.com NO tiene Turista - buscar otra fuente"
    };

  } catch(e) {
    resultado.error = e.message;
  }

  res.status(200).json(resultado);
}
