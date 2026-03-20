/**
 * /api/brinco.js — Vercel Serverless Function
 * Agencia 204 · agencia204-api.vercel.app
 *
 * FUENTES (en orden):
 *  1. ruta1000.com.ar  — directo (Vercel puede hacer fetch a HTTP)
 *  2. lanacion.com.ar  — backup HTTPS
 *
 * PARSERS VERIFICADOS con datos reales:
 *  - ruta1000 sorteo 1345 (15/03/2026): 17·18·21·26·36·39 / Jr: 10·14·24·30·36·37
 *  - lanacion sorteo 1340 (08/02/2026): 01·05·13·22·23·30 / Jr: 19·22·30·32·34·37
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ahora = new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });

  const debug = [];

  // ── Fuente 1: ruta1000.com.ar directo ────────────────────
  let resultado = await intentar('ruta1000', async () => {
    const r = await fetch('http://brinco.ruta1000.com.ar/', {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    return parsearRuta1000(html);
  }, debug);

  // ── Fuente 2: lanacion.com.ar ─────────────────────────────
  if (!resultado) {
    resultado = await intentar('lanacion', async () => {
      const r = await fetch('https://www.lanacion.com.ar/loterias/brinco/', {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept-Language': 'es-AR' },
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return parsearLaNacion(html);
    }, debug);
  }

  if (resultado) {
    resultado.actualizado = ahora;
    resultado.debug = debug;
    return res.status(200).json(resultado);
  }

  return res.status(503).json({
    error: true,
    mensaje: 'No se pudo obtener el resultado del Brinco',
    debug,
    actualizado: ahora
  });
}

async function intentar(nombre, fn, debugArr) {
  try {
    const r = await fn();
    if (r) { debugArr.push({ fuente: nombre, estado: 'OK' }); return r; }
    debugArr.push({ fuente: nombre, estado: 'sin datos' });
    return null;
  } catch (e) {
    debugArr.push({ fuente: nombre, estado: 'error', mensaje: e.message });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  PARSER RUTA1000
//
//  Estructura HTML real (ISO-8859-1, pero text() lo lee igual):
//
//  Sorteo N° 1345 - Domingo 15 de Marzo de 2026
//  <td align="center"><b>17</b></td>
//  <td align="center"><b>18</b></td>  ...6 números...
//  BRINCO JUNIORS
//  <td align="center"><b>10</b></td>  ...6 números...
//  Sorteo N° 1344 - ...  ← inicio del sorteo anterior
//
//  Estrategia: tomar HTML entre el primer "Sorteo N°" y el segundo
// ─────────────────────────────────────────────────────────────
function parsearRuta1000(html) {
  if (!html || html.length < 200) return null;

  // Encontrar todas las ocurrencias de "Sorteo N°"
  // El ° puede venir como °, º, \xb0 o \xba según el encoding
  const reSorteo = /Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/gi;
  const matches  = [...html.matchAll(reSorteo)];
  if (matches.length === 0) return null;

  // Tomar bloque entre primer y segundo sorteo (el más reciente)
  const inicio  = matches[0].index;
  const fin     = matches.length > 1 ? matches[1].index : html.length;
  const bloque  = html.slice(inicio, fin);

  // Extraer números del sorteo: <td ...><b>17</b></td>
  // Patrón flexible: maneja atributos en td y espacios/saltos de línea
  const reNum = /<[Tt][Dd][^>]*>\s*<[Bb]>\s*(\d{1,2})\s*<\/[Bb]>\s*<\/[Tt][Dd]>/g;
  const nums  = [];
  let m;
  while ((m = reNum.exec(bloque)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 0 && n <= 39) nums.push(pad(n));
    if (nums.length >= 12) break;  // 6 Tradicional + 6 Junior
  }

  if (nums.length < 6) return null;

  // Número de sorteo
  const sorteoM = bloque.match(/Sorteo\s+N[°º\xb0\xba]?\s*(\d+)/i);

  // Fecha: "Domingo 15 de Marzo de 2026"
  const fechaM = bloque.match(
    /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i
  );

  return {
    sorteo:      sorteoM ? sorteoM[1] : '—',
    fecha:       fechaM  ? fechaM[1]  : hoy(),
    tradicional: nums.slice(0, 6),
    junior:      nums.slice(6, 12),
    fuente:      'ruta1000.com.ar'
  };
}

// ─────────────────────────────────────────────────────────────
//  PARSER LA NACION
//
//  Estructura HTML real (verificada del fetch 20/03/2026):
//
//  ## Brinco
//  Domingo 08/02/2026
//  01
//  05
//  13
//  22
//  23
//  30
//  | Aciertos | Ganadores | Premios |   ← tabla de premios (ignorar)
//  ## Junior
//  Domingo 08/02/2026
//  19
//  22
//  ...
//  Información provista por Data Factory
//
//  Estrategia: buscar ## Brinco y ## Junior como separadores,
//  eliminar la fecha del bloque (para no confundirla con números),
//  cortar antes de la tabla "|", y extraer los 2 dígitos restantes
// ─────────────────────────────────────────────────────────────
function parsearLaNacion(html) {
  if (!html) return null;

  // Buscar las secciones usando los headers ## Brinco / ## Junior
  const mBrinco = html.search(/##\s*Brinco/i);
  const mJunior = html.search(/##\s*Junior/i);
  const mInfo   = html.search(/Informaci[oó]n\s+provista/i);

  if (mBrinco === -1) return null;

  const iTrad = mBrinco;
  const iJr   = mJunior > mBrinco ? mJunior : html.length;
  const iEnd  = mInfo   > mBrinco ? mInfo   : html.length;

  let bloqueTrad = html.slice(iTrad, iJr);
  let bloqueJr   = mJunior > -1 ? html.slice(iJr, iEnd) : '';

  // Guardar la fecha ANTES de limpiar el bloque
  const fechaM = bloqueTrad.match(/(\d{2}\/\d{2}\/\d{4})/);

  // Eliminar fechas DD/MM/YYYY del bloque para no confundirlas con números
  bloqueTrad = bloqueTrad.replace(/\d{2}\/\d{2}\/\d{4}/g, '');
  bloqueJr   = bloqueJr.replace(/\d{2}\/\d{2}\/\d{4}/g, '');

  // Cortar antes de la tabla de premios (primer "|")
  const cleanTrad = bloqueTrad.split('|')[0];
  const cleanJr   = bloqueJr.split('|')[0];

  // Extraer números 00-39 en el rango del Brinco
  const numsTrad = [...cleanTrad.matchAll(/\b(\d{2})\b/g)]
    .map(m => m[1])
    .filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);

  const numsJr = [...cleanJr.matchAll(/\b(\d{2})\b/g)]
    .map(m => m[1])
    .filter(n => parseInt(n) >= 0 && parseInt(n) <= 39);

  if (numsTrad.length < 6) return null;

  // Número de sorteo (está en el título de la página)
  const sorteoM = html.match(/sorteo\s+(\d{3,4})/i);

  return {
    sorteo:      sorteoM ? sorteoM[1] : '—',
    fecha:       fechaM  ? fechaM[1]  : hoy(),
    tradicional: numsTrad.slice(0, 6),
    junior:      numsJr.length >= 6 ? numsJr.slice(0, 6) : numsJr,
    fuente:      'lanacion.com.ar'
  };
}

function pad(n) { return String(n).padStart(2, '0'); }

function hoy() {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
