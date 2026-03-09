// api/quiniela_er.js — DIAGNÓSTICO de vivitusuerte.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const resultado = {
    mensaje: "Explorando estructura de vivitusuerte.com",
    provincias: {}
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  };

  // URLs a probar
  const urlsProbar = [
    { key: 'home', url: 'https://vivitusuerte.com/' },
    { key: 'nacional', url: 'https://vivitusuerte.com/quiniela/nacional' },
    { key: 'bsas', url: 'https://vivitusuerte.com/quiniela/buenos-aires' },
    { key: 'cordoba', url: 'https://vivitusuerte.com/quiniela/cordoba' },
    { key: 'santafe', url: 'https://vivitusuerte.com/quiniela/santa-fe' },
    { key: 'entrerrios', url: 'https://vivitusuerte.com/quiniela/entre-rios' },
    { key: 'salta', url: 'https://vivitusuerte.com/quiniela/salta' },
    { key: 'jujuy', url: 'https://vivitusuerte.com/quiniela/jujuy' },
    { key: 'montevideo', url: 'https://vivitusuerte.com/quiniela/montevideo' }
  ];

  for (const item of urlsProbar) {
    try {
      const response = await fetch(item.url, { headers });
      const html = await response.text();
      
      resultado.provincias[item.key] = {
        url: item.url,
        status: response.status,
        funciona: response.status === 200,
        tamañoHTML: html.length,
        fragmentoHTML: html.substring(0, 2000) // Primeros 2000 caracteres
      };

      // Buscar patrones comunes en HTML
      const patrones = {
        clases_encontradas: [],
        ids_encontrados: [],
        tiene_json: html.includes('application/json') || html.includes('JSON.parse'),
        tiene_tabla: html.includes('<table'),
        tiene_divs: html.includes('class="numero') || html.includes('class="cabeza'),
        estructura_api: html.includes('/api/') || html.includes('fetch(')
      };

      // Buscar clases CSS que contengan "numero", "cabeza", "sorteo", "quiniela"
      const classRegex = /class="([^"]*(?:numero|cabeza|sorteo|quiniela|result)[^"]*)"/gi;
      let match;
      while ((match = classRegex.exec(html)) !== null && patrones.clases_encontradas.length < 10) {
        if (!patrones.clases_encontradas.includes(match[1])) {
          patrones.clases_encontradas.push(match[1]);
        }
      }

      // Buscar IDs
      const idRegex = /id="([^"]*(?:numero|cabeza|sorteo|quiniela|result)[^"]*)"/gi;
      while ((match = idRegex.exec(html)) !== null && patrones.ids_encontrados.length < 10) {
        if (!patrones.ids_encontrados.includes(match[1])) {
          patrones.ids_encontrados.push(match[1]);
        }
      }

      resultado.provincias[item.key].patrones = patrones;

    } catch (error) {
      resultado.provincias[item.key] = {
        url: item.url,
        error: error.message
      };
    }
  }

  res.status(200).json(resultado);
}
