/**
 * /api/loto.js — VERSIÓN DIAGNÓSTICO
 * Subí este archivo, llamá al endpoint y mandame la respuesta completa.
 * Después lo reemplazamos por la versión de producción.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const resultado = {};

  // ── Fetch loto ────────────────────────────────────────────
  try {
    const r = await fetch('https://www.quini6loto.com/loto-resultados.php', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Cache-Control':   'no-cache'
      },
      signal: AbortSignal.timeout(10000)
    });

    const html   = await r.text();
    const limpio = limpiarHTML(html);
    const idx    = limpio.indexOf('Resultado Loto');

    resultado.loto = {
      status:       r.status,
      chars_html:   html.length,
      chars_limpio: limpio.length,
      primeros_500: limpio.slice(0, 500),
      fragmento:    idx >= 0 ? limpio.slice(idx, idx + 400) : 'NO ENCONTRADO',
      match:        limpio.match(/Resultado Loto (\d+)\s*[-–]\s*(\w[^0-9]{3,30}\d{4})/)?.[0] || 'SIN MATCH'
    };
  } catch (e) {
    resultado.loto = { error: e.message };
  }

  // ── Fetch loto5 ───────────────────────────────────────────
  try {
    const r = await fetch('https://www.quini6loto.com/loto5-resultados.php', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Cache-Control':   'no-cache'
      },
      signal: AbortSignal.timeout(10000)
    });

    const html   = await r.text();
    const limpio = limpiarHTML(html);
    const idx    = limpio.indexOf('Resultado Loto 5');

    resultado.loto5 = {
      status:       r.status,
      chars_html:   html.length,
      chars_limpio: limpio.length,
      primeros_500: limpio.slice(0, 500),
      fragmento:    idx >= 0 ? limpio.slice(idx, idx + 200) : 'NO ENCONTRADO',
      match:        limpio.match(/Resultado Loto 5\s*[-–]\s*(\w[^0-9]{3,30}\d{4})/)?.[0] || 'SIN MATCH'
    };
  } catch (e) {
    resultado.loto5 = { error: e.message };
  }

  return res.status(200).json(resultado);
}

function limpiarHTML(html) {
  return html
    .replace(/&eacute;/gi,'é').replace(/&Eacute;/gi,'É')
    .replace(/&aacute;/gi,'á').replace(/&Aacute;/gi,'Á')
    .replace(/&iacute;/gi,'í').replace(/&Iacute;/gi,'Í')
    .replace(/&oacute;/gi,'ó').replace(/&Oacute;/gi,'Ó')
    .replace(/&uacute;/gi,'ú').replace(/&Uacute;/gi,'Ú')
    .replace(/&ntilde;/gi,'ñ').replace(/&Ntilde;/gi,'Ñ')
    .replace(/&uuml;/gi,'ü').replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_,c)=>String.fromCharCode(parseInt(c,16)))
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
