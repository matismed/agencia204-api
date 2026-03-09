// api/quiniela_er.js — Ver estructura de una pizarra
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  try {
    const response = await fetch('https://vivitusuerte.com/pizarra/ciudad', { headers });
    const html = await response.text();
    
    res.status(200).json({
      url: 'https://vivitusuerte.com/pizarra/ciudad',
      status: response.status,
      htmlCompleto: html
    });
    
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

