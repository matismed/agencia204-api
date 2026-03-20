// loto3 - debug loto5 estructura real
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const r   = await fetch('http://loto5.ruta1000.com.ar/', { headers:{'User-Agent':'Mozilla/5.0'}, signal:AbortSignal.timeout(10000) });
  const buf = await r.arrayBuffer();
  const html= new TextDecoder('iso-8859-1').decode(buf);
  const i   = html.indexOf('Sorteo N');
  const blk = html.slice(i, i+800);
  const tds = [...blk.matchAll(/<[Tt][Dd][^>]*>([\s\S]*?)<\/[Tt][Dd]>/g)].slice(0,15).map(m=>m[1].trim().replace(/<[^>]+>/g,'').trim().slice(0,30));
  return res.status(200).json({ i, blk600: blk.slice(0,600), tds });
}
