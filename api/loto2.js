// FRESH-FILE - ruta1000.com.ar - v3 - loto5 fix
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const debug = [];

  const [hL, hL5] = await Promise.all([
    get('http://loto.ruta1000.com.ar/',  'loto',  debug),
    get('http://loto5.ruta1000.com.ar/', 'loto5', debug)
  ]);

  const loto  = hL  ? pLoto(hL)   : null;
  const loto5 = hL5 ? pLoto5(hL5) : null;

  if (!loto && !loto5)
    return res.status(503).json({ error: true, debug, actualizado: ahora });

  return res.status(200).json({ loto, loto5, debug, actualizado: ahora });
}

async function get(url, nombre, dbg) {
  try {
    const r    = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf  = await r.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(buf);
    if (html.length < 500) throw new Error('corto');
    dbg.push({ n: nombre, via: 'directo', len: html.length });
    return html;
  } catch (e1) {
    try {
      const r2   = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(12000) });
      const j    = await r2.json();
      if (!j.contents || j.contents.length < 500) throw new Error('sin contenido');
      dbg.push({ n: nombre, via: 'proxy', len: j.contents.length });
      return j.contents;
    } catch (e2) {
      dbg.push({ n: nombre, via: 'error', e1: e1.message, e2: e2.message });
      return null;
    }
  }
}

// ── LOTO PLUS ─────────────────────────────────────────────────
// Separador entre sorteos: "Sorteo N° NNNN"
// 24 números en 2 filas × 4 modalidades × 3 cols
function pLoto(html) {
  const SS = [...html.matchAll(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/gi)];
  if (!SS.length) return null;
  const blk = html.slice(SS[0].index, SS[1]?.index ?? html.length);
  const re  = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const N   = []; let m;
  while ((m = re.exec(blk)) !== null) { N.push(+m[1]); if (N.length >= 24) break; }
  if (N.length < 12) return null;
  const T=[], M=[], D=[], S=[];
  for (let i=0; i<2; i++) {
    const b=i*12;
    T.push(...N.slice(b,   b+3)); M.push(...N.slice(b+3, b+6));
    D.push(...N.slice(b+6, b+9)); S.push(...N.slice(b+9, b+12));
  }
  const sM = blk.match(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/i);
  const fM = blk.match(/((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);
  const pM = blk.match(/NUMERO\s+PLUS[:\s]+(\d)/i);
  return {
    sorteo: sM?.[1]??'—', fecha: fM?cap(fM[1]):'—',
    tradicional:T.map(p2), match:M.map(p2), desquite:D.map(p2), saleOSale:S.map(p2),
    ...(pM&&{jack:pM[1]}), fuente:'ruta1000'
  };
}

// ── LOTO 5 ────────────────────────────────────────────────────
// loto5.ruta1000.com.ar usa "Sorteo Nro" (no "Sorteo N°")
// Separador confiable: "RESULTADOS LOTO 5 DE ARGENTINA"
function pLoto5(html) {
  const SEP = 'RESULTADOS LOTO 5 DE ARGENTINA';
  const i1  = html.indexOf(SEP);
  if (i1 === -1) return null;
  const i2  = html.indexOf(SEP, i1 + SEP.length);
  const blk = html.slice(i1, i2 > i1 ? i2 : i1 + 3000);

  // Cortar antes de PREMIOS para evitar contaminación con 5, 4, 3
  const iP  = blk.toUpperCase().indexOf('PREMIOS');
  const seg  = iP > 0 ? blk.slice(0, iP) : blk;

  // Intentar <td><b>N</b></td> primero, luego <b>N</b> solo
  let N = buscaB(/<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g, seg, 36, 5);
  if (N.length < 5)
    N = buscaB(/<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>/g, seg, 36, 5);
  if (N.length < 5) return null;

  // Número sorteo con regex permisivo (cubre Nro., N°, Nº, etc.)
  const sM = blk.match(/Sorteo\s+N(?:ro\.?|[°º\xb0\xba])?\s*(\d+)/i);
  const fM = blk.match(/((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d+\s+de\s+\w+\s+de\s+\d{4})/i);
  return { sorteo:sM?.[1]??'—', fecha:fM?cap(fM[1]):'—', numeros:N, fuente:'ruta1000' };
}

function buscaB(re, texto, max, limit) {
  const N=[]; let m;
  while ((m=re.exec(texto))!==null) {
    const n=+m[1]; if(n>=0&&n<=max) N.push(p2(n)); if(N.length>=limit) break;
  }
  return N;
}

const p2  = n => String(n).padStart(2,'0');
const cap = s => s?s[0].toUpperCase()+s.slice(1):s;
