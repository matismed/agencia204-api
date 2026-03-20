// v4 - ruta1000.com.ar - igual que Brinco que ya funciona.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const debug = [];

  // Mismo enfoque que el Brinco: ruta1000 usa HTTP pero Vercel lo permite,
  // y si no, allorigins como fallback
  const [htmlLoto, htmlLoto5] = await Promise.all([
    fetchRuta1000('http://loto.ruta1000.com.ar/',  'loto',  debug),
    fetchRuta1000('http://loto5.ruta1000.com.ar/', 'loto5', debug)
  ]);

  const loto  = htmlLoto  ? parsearLoto(htmlLoto)   : null;
  const loto5 = htmlLoto5 ? parsearLoto5(htmlLoto5) : null;

  if (!loto && !loto5) {
    return res.status(503).json({ error: true, mensaje: 'Sin datos del Loto', debug, actualizado: ahora });
  }
  return res.status(200).json({ loto, loto5, debug, actualizado: ahora });
}

// ── FETCH con fallback allorigins (igual que Brinco) ──────────
async function fetchRuta1000(url, nombre, debugArr) {
  // Intento 1: directo
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(buf);
    if (html.length > 500) {
      debugArr.push({ fuente: nombre, estado: 'OK-directo', chars: html.length });
      return html;
    }
    throw new Error('HTML muy corto');
  } catch (e1) {
    // Intento 2: via allorigins
    try {
      const proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
      const r2 = await fetch(proxy, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124' },
        signal: AbortSignal.timeout(12000)
      });
      if (!r2.ok) throw new Error('proxy HTTP ' + r2.status);
      const json = await r2.json();
      if (!json.contents || json.contents.length < 500) throw new Error('proxy sin contenido');
      debugArr.push({ fuente: nombre, estado: 'OK-proxy', chars: json.contents.length });
      return json.contents;
    } catch (e2) {
      debugArr.push({ fuente: nombre, estado: 'error', directo: e1.message, proxy: e2.message });
      return null;
    }
  }
}

// ── PARSER LOTO ───────────────────────────────────────────────
// Estructura real de loto.ruta1000.com.ar (ISO-8859-1):
//
// Sorteo Nº 3866 - Miércoles 18 de Marzo de 2026
// NUMERO PLUS: 4
// LOTO TRADICIONAL  LOTO MATCH  LOTO DESQUITE  SALE O SALE
// <td><b>2</b></td><td><b>7</b></td><td><b>20</b></td>  <td><b>11</b></td>...
// <td><b>28</b></td><td><b>33</b></td><td><b>34</b></td> <td><b>33</b></td>...
//
// Los 24 números vienen intercalados en 2 filas de (3+3+3+3)
// fila1: trad[0-2] match[0-2] desq[0-2] sale[0-2]
// fila2: trad[3-5] match[3-5] desq[3-5] sale[3-5]
function parsearLoto(html) {
  if (!html || html.length < 200) return null;

  // Primer sorteo (más reciente)
  const sorteos = [...html.matchAll(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/gi)];
  if (!sorteos.length) return null;

  const inicio = sorteos[0].index;
  const fin    = sorteos.length > 1 ? sorteos[1].index : html.length;
  const bloque = html.slice(inicio, fin);

  const sorteoM = bloque.match(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/i);
  const fechaM  = bloque.match(/((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);
  const plusM   = bloque.match(/NUMERO\s+PLUS[:\s]+(\d)/i);

  // Extraer todos los números en <td><b>N</b></td>
  const reNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const todos = [];
  let m;
  while ((m = reNum.exec(bloque)) !== null) {
    todos.push(parseInt(m[1]));
    if (todos.length >= 24) break;
  }

  if (todos.length < 12) return null;

  // Reconstruir los 4 grupos de 6 desde las 2 filas intercaladas
  const trad = [], match_ = [], desq = [], sale = [];
  for (let i = 0; i < 2; i++) {
    const b = i * 12;
    trad.push( ...todos.slice(b,    b+3)  );
    match_.push(...todos.slice(b+3,  b+6) );
    desq.push(  ...todos.slice(b+6,  b+9) );
    sale.push(  ...todos.slice(b+9,  b+12));
  }

  return {
    sorteo:      sorteoM ? sorteoM[1] : '—',
    fecha:       fechaM  ? cap(fechaM[1]) : '—',
    tradicional: trad.map(pad),
    match:       match_.map(pad),
    desquite:    desq.map(pad),
    saleOSale:   sale.map(pad),
    ...(plusM && { jack: plusM[1] }),
    fuente: 'ruta1000.com.ar'
  };
}

// ── PARSER LOTO 5 ─────────────────────────────────────────────
// Estructura real de loto5.ruta1000.com.ar:
//
// Sorteo Nº 1435 - Sábado 14 de Marzo de 2026
// <td><b>1</b></td><td><b>11</b></td><td><b>30</b></td><td><b>35</b></td><td><b>0</b></td>
function parsearLoto5(html) {
  if (!html || html.length < 50) return null;

  const sorteos = [...html.matchAll(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/gi)];
  if (!sorteos.length) return null;

  const inicio = sorteos[0].index;
  const fin    = sorteos.length > 1 ? sorteos[1].index : html.length;
  const bloque = html.slice(inicio, fin);

  const sorteoM = bloque.match(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/i);
  const fechaM  = bloque.match(/((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);

  const reNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const nums = [];
  let m;
  while ((m = reNum.exec(bloque)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 36) nums.push(pad(n));
    if (nums.length >= 5) break;
  }

  if (nums.length < 5) return null;

  return {
    sorteo:  sorteoM ? sorteoM[1] : '—',
    fecha:   fechaM  ? cap(fechaM[1]) : '—',
    numeros: nums,
    fuente:  'ruta1000.com.ar'
  };
}

function pad(n) { return String(n).padStart(2, '0'); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
