// api/quiniela_er.js — debug v2: muestra la parte del medio del HTML

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const response = await fetch('https://quinieladehoy.com.ar/quiniela/quiniela-entre-rios', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });

    const html = await response.text();
    const total = html.length;
    const medio = Math.floor(total / 2);

    // Buscar donde dice "Previa" o "Quiniela Entre" para encontrar los datos
    const idxPrevia = html.indexOf('Previa');
    const idxQuiniela = html.indexOf('Quiniela Entre');

    res.status(200).json({
      total,
      idxPrevia,
      idxQuiniela,
      // Muestra 2000 chars desde donde aparece "Previa"
      desdePrevia: idxPrevia > 0 ? html.substring(idxPrevia - 100, idxPrevia + 2000) : 'NO ENCONTRADO',
    });

  } catch (err) {
    res.status(200).json({ _error: err.message });
  }
}
