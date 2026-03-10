// DIAGNÓSTICO DETALLADO - Ver TODOS los códigos de Salta y Jujuy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Códigos completos de Salta y Jujuy con cabezas",
    salta: {},
    jujuy: {}
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

  // SALTA - Probar códigos del 1 al 30 con sorteos 0 al 10
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/salta', { headers });
    if (response.ok) {
      const html = await response.text();
      
      for (let q = 1; q <= 30; q++) {
        for (let s = 0; s <= 10; s++) {
          const cabeza = extraerCabeza(html, q, s);
          if (cabeza) {
            resultado.salta[`Q${q}_${s}`] = cabeza;
          }
        }
      }
    }
  } catch(e) {
    resultado.salta.error = e.message;
  }

  // JUJUY - Probar códigos del 1 al 30 con sorteos 0 al 10
  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      for (let q = 1; q <= 30; q++) {
        for (let s = 0; s <= 10; s++) {
          const cabeza = extraerCabeza(html, q, s);
          if (cabeza) {
            resultado.jujuy[`Q${q}_${s}`] = cabeza;
          }
        }
      }
    }
  } catch(e) {
    resultado.jujuy.error = e.message;
  }

  // Añadir guía de referencia
  resultado.referencia = {
    salta: {
      previa_esperada: "----",
      primera_esperada: "3583",
      matutina_esperada: "----",
      vespertina_esperada: "----",
      nocturna_esperada: "----"
    },
    jujuy: {
      previa_esperada: "no_disponible",
      primera_esperada: "4242", 
      matutina_esperada: "6149",
      vespertina_esperada: "----",
      nocturna_esperada: "----"
    },
    instrucciones: "Busca en los códigos qué Q_S tiene la cabeza esperada"
  };

  res.status(200).json(resultado);
}
