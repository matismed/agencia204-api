// DEBUG v2 - ver exactamente que hay despues de "Sorteo N"
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const r    = await fetch('http://loto5.ruta1000.com.ar/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
  const buf  = await r.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buf);

  const iSorteo  = html.indexOf('Sorteo N');
  const iSorteo2 = html.indexOf('Sorteo N', iSorteo + 10);
  const iPremios = html.toUpperCase().indexOf('PREMIOS', iSorteo);

  // El bloque entre sorteo1 y min(sorteo2, premios)
  const iFin = Math.min(
    iSorteo2 > iSorteo ? iSorteo2 : Infinity,
    iPremios > iSorteo ? iPremios : Infinity,
    iSorteo + 3000
  );
  const blk = html.slice(iSorteo, iFin);

  // Todos los <td>...</td> en el bloque
  const tds = [];
  const re  = /<[Tt][Dd][^>]*>([\s\S]*?)<\/[Tt][Dd]>/g;
  let m, count=0;
  while ((m = re.exec(blk)) !== null && count < 20) {
    tds.push({ raw: m[0].slice(0,80), inner: m[1].trim().slice(0,40) });
    count++;
  }

  return res.status(200).json({
    iSorteo, iSorteo2, iPremios, iFin,
    blk_len: blk.length,
    blk_primeros_600: blk.slice(0, 600),
    todos_tds: tds
  });
}
