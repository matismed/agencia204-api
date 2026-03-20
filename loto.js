// v3 - quini6loto.com - limpiarHTML fix
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const debug = [];

  const [htmlLoto, htmlLoto5] = await Promise.all([
    fetchHTML('https://www.quini6loto.com/loto-resultados.php',  'loto',  debug),
    fetchHTML('https://www.quini6loto.com/loto5-resultados.php', 'loto5', debug)
  ]);

  const loto  = htmlLoto  ? parsearLoto(limpiarHTML(htmlLoto))   : null;
  const loto5 = htmlLoto5 ? parsearLoto5(limpiarHTML(htmlLoto5)) : null;

  if (!loto && !loto5) {
    return res.status(503).json({ error: true, mensaje: 'Sin datos', debug, actualizado: ahora });
  }
  return res.status(200).json({ loto, loto5, debug, actualizado: ahora });
}

// Decodifica entidades HTML y quita tags → texto plano
function limpiarHTML(html) {
  return html
    .replace(/&eacute;/gi,'é').replace(/&aacute;/gi,'á').replace(/&iacute;/gi,'í')
    .replace(/&oacute;/gi,'ó').replace(/&uacute;/gi,'ú').replace(/&ntilde;/gi,'ñ')
    .replace(/&Eacute;/gi,'É').replace(/&Aacute;/gi,'Á').replace(/&Iacute;/gi,'Í')
    .replace(/&Oacute;/gi,'Ó').replace(/&Uacute;/gi,'Ú').replace(/&Ntilde;/gi,'Ñ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(Number(c)))
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

function extraerSeccion(bloque, etiqueta) {
  const m = bloque.match(new RegExp(etiqueta + '\\s*([\\d\\s]{5,60})', 'i'));
  if (!m) return [];
  return m[1].trim().split(/\s+/).filter(n => /^\d{2}$/.test(n) && +n >= 0 && +n <= 45);
}

function parsearLoto(texto) {
  const mHead = texto.match(/Resultado Loto (\d+)\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);
  if (!mHead) return null;
  const sorteo = mHead[1];
  const fecha  = mHead[2].charAt(0).toUpperCase() + mHead[2].slice(1);
  const iIni   = mHead.index + mHead[0].length;
  const mFin   = texto.slice(iIni).match(/twitter|Comparte|Resultado Loto \d{4}\b/i);
  const bloque = texto.slice(iIni, iIni + (mFin ? mFin.index : 600));
  const trad   = extraerSeccion(bloque, 'Números del Loto');
  const desq   = extraerSeccion(bloque, 'Números del Desquite');
  const sale   = extraerSeccion(bloque, 'Números del Sale o sale');
  if (trad.length < 6) return null;
  const jackM  = bloque.match(/Jack1\s+(\d)\s+Jack2/);
  return { sorteo, fecha, tradicional: trad.slice(0,6), desquite: desq.slice(0,6), saleOSale: sale.slice(0,6), ...(jackM && { jack: jackM[1] }), fuente: 'quini6loto.com' };
}

function parsearLoto5(texto) {
  const mHead = texto.match(/Resultado Loto 5\s*[-–]\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);
  if (!mHead) return null;
  const fecha  = mHead[1].charAt(0).toUpperCase() + mHead[1].slice(1);
  const iIni   = mHead.index + mHead[0].length;
  const mFin   = texto.slice(iIni).match(/Comprobar|---|Resultado Loto 5/i);
  const bloque = texto.slice(iIni, iIni + (mFin ? mFin.index : 200));
  const nums   = bloque.trim().split(/\s+/).filter(n => /^\d{2}$/.test(n) && +n >= 0 && +n <= 36);
  if (nums.length < 5) return null;
  return { fecha, numeros: nums.slice(0,5), fuente: 'quini6loto.com' };
}

async function fetchHTML(url, nombre, debugArr) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124', 'Accept-Language': 'es-AR,es;q=0.9' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    debugArr.push({ fuente: nombre, estado: 'OK', chars: html.length });
    return html;
  } catch (e) {
    debugArr.push({ fuente: nombre, estado: 'error', mensaje: e.message });
    return null;
  }
}
