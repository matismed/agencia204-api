// api/quiniela_er.js — versión debug para ver el HTML real que llega

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

    // Devolver los primeros 3000 caracteres del HTML crudo para diagnóstico
    res.status(200).json({
      status: response.status,
      longitud: html.length,
      muestra: html.substring(0, 3000),
    });

  } catch (err) {
    res.status(200).json({ _error: err.message });
  }
}
