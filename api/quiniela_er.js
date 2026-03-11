// DIAGNÓSTICO - Todos los códigos Q23 de Jujuy en orden de aparición
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const resultado = {
    mensaje: "Todos los códigos Q23 de Jujuy (quiniela 23)",
    codigos_q23: [],
    mapeo_propuesto: {}
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

  try {
    const response = await fetch('https://www.loteriasmundiales.com.ar/Quinielas/jujena', { headers });
    if (response.ok) {
      const html = await response.text();
      
      // Buscar TODOS los códigos Q23_X (sorteos 0 al 10)
      for (let sorteo = 0; sorteo <= 10; sorteo++) {
        const cabeza = extraerCabeza(html, 23, sorteo);
        if (cabeza) {
          resultado.codigos_q23.push({
            codigo: `Q23_${sorteo}`,
            quiniela: 23,
            sorteo: sorteo,
            cabeza: cabeza,
            posicion_en_lista: resultado.codigos_q23.length
          });
        }
      }

      // Ahora también buscar Q26, Q10, Q11, Q14 por si acaso
      const otrasQuinielas = [26, 10, 11, 14, 15, 20];
      resultado.otros_codigos = {};
      
      for (const q of otrasQuinielas) {
        resultado.otros_codigos[`Q${q}`] = [];
        for (let sorteo = 0; sorteo <= 5; sorteo++) {
          const cabeza = extraerCabeza(html, q, sorteo);
          if (cabeza) {
            resultado.otros_codigos[`Q${q}`].push({
              codigo: `Q${q}_${sorteo}`,
              sorteo: sorteo,
              cabeza: cabeza
            });
          }
        }
      }

      // Mapeo propuesto basado en orden de aparición de Q23
      if (resultado.codigos_q23.length >= 4) {
        resultado.mapeo_propuesto = {
          primera: {
            codigo_sugerido: resultado.codigos_q23[0],
            razon: "Primer código Q23 en el HTML (posición 0)"
          },
          matutina: {
            codigo_sugerido: resultado.codigos_q23[1],
            razon: "Segundo código Q23 en el HTML (posición 1)"
          },
          vespertina: {
            codigo_sugerido: resultado.codigos_q23[2],
            razon: "Tercer código Q23 en el HTML (posición 2)"
          },
          nocturna: {
            codigo_sugerido: resultado.codigos_q23[3],
            razon: "Cuarto código Q23 en el HTML (posición 3)"
          }
        };
      }

      // Verificación con los datos esperados de la imagen
      resultado.verificacion_imagen = {
        esperado_primera: "4242",
        esperado_matutina: "4206", 
        esperado_vespertina: "9555",
        coincide: {
          primera: resultado.codigos_q23[0]?.cabeza === "4242",
          matutina: resultado.codigos_q23[1]?.cabeza === "4206",
          vespertina: resultado.codigos_q23[2]?.cabeza === "9555"
        }
      };
    }
  } catch(e) {
    resultado.error = e.message;
  }

  res.status(200).json(resultado);
}
