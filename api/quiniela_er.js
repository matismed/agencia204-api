// DIAGNÓSTICO EXHAUSTIVO - Buscar TODOS los códigos de Salta y Jujuy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Buscando TODOS los códigos posibles en Salta y Jujuy",
    salta: { codigos: {}, html_sample: "" },
    jujuy: { codigos: {}, html_sample: "" }
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function extraerNumero(html, codigoQuiniela, codigoSorteo) {
    const id = `idQ${codigoQuiniela}_${codigoSorteo}_N01`;
    const patterns = [
      `id="${id}"[^>]*>\\s*<b>\\s*([0-9]{3,4})\\s*</b>`,
      `id="${id}"[^>]*>\\s*([0-9]{3,4})\\s*<`
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim().padStart(4, '0');
      }
    }
    return null;
  }

  // SALTA
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Probar códigos de quiniela del 1 al 30
      for (let q = 1; q <= 30; q++) {
        // Probar códigos de sorteo del 0 al 10
        for (let s = 0; s <= 10; s++) {
          const numero = extraerNumero(html, q, s);
          if (numero) {
            resultado.salta.codigos[`Q${q}_${s}`] = numero;
          }
        }
      }

      // Guardar muestra del HTML (primeros 2000 caracteres donde dice "Salta")
      const indexSalta = html.toLowerCase().indexOf('salta');
      if (indexSalta !== -1) {
        resultado.salta.html_sample = html.substring(Math.max(0, indexSalta - 500), indexSalta + 1500);
      }
    }
  } catch(e) {
    resultado.salta.error = e.message;
  }

  // JUJUY
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Probar códigos de quiniela del 1 al 30
      for (let q = 1; q <= 30; q++) {
        // Probar códigos de sorteo del 0 al 10
        for (let s = 0; s <= 10; s++) {
          const numero = extraerNumero(html, q, s);
          if (numero) {
            resultado.jujuy.codigos[`Q${q}_${s}`] = numero;
          }
        }
      }

      // Guardar muestra del HTML
      const indexJujuy = html.toLowerCase().indexOf('jujuy');
      if (indexJujuy !== -1) {
        resultado.jujuy.html_sample = html.substring(Math.max(0, indexJujuy - 500), indexJujuy + 1500);
      }
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  res.status(200).json(resultado);
}

