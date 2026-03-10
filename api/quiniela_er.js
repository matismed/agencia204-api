// DIAGNÓSTICO EXHAUSTIVO - Códigos Q1-50, Sorteos 0-15
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    salta: {},
    jujuy: {},
    busqueda: {
      salta_primera_3583: null,
      jujuy_primera_4242: null,
      jujuy_matutina_6149: null
    }
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  function extraerCabeza(html, quiniela, sorteo) {
    const id = `idQ${quiniela}_${sorteo}_N01`;
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
      
      for (let q = 1; q <= 50; q++) {
        for (let s = 0; s <= 15; s++) {
          const cabeza = extraerCabeza(html, q, s);
          if (cabeza) {
            resultado.salta[`Q${q}_${s}`] = cabeza;
            if (cabeza === '3583') {
              resultado.busqueda.salta_primera_3583 = `Q${q}_${s}`;
            }
          }
        }
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
      
      for (let q = 1; q <= 50; q++) {
        for (let s = 0; s <= 15; s++) {
          const cabeza = extraerCabeza(html, q, s);
          if (cabeza) {
            resultado.jujuy[`Q${q}_${s}`] = cabeza;
            if (cabeza === '4242') {
              resultado.busqueda.jujuy_primera_4242 = `Q${q}_${s}`;
            }
            if (cabeza === '6149') {
              resultado.busqueda.jujuy_matutina_6149 = `Q${q}_${s}`;
            }
          }
        }
      }
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  res.status(200).json(resultado);
}

