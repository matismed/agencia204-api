// DEBUG LOTO5 - para ver que hay en el HTML real
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const r    = await fetch('http://loto5.ruta1000.com.ar/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
  const buf  = await r.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buf);

  // Buscar indices de cosas clave
  const find = (s) => ({ txt: s, pos: html.indexOf(s) });

  // Mostrar 400 chars alrededor de "1435" (numero del ultimo sorteo)
  const i1435 = html.indexOf('1435');
  const ctx   = i1435 >= 0 ? html.slice(Math.max(0, i1435-100), i1435+300) : 'NO ENCONTRADO';

  // Mostrar 400 chars alrededor de "RESULTADOS LOTO 5"
  const iRES = html.toUpperCase().indexOf('RESULTADOS LOTO 5');
  const ctxR = iRES >= 0 ? html.slice(iRES, iRES+500) : 'NO ENCONTRADO';

  // Buscar todos los <b> en el bloque de resultados
  const iBs = [];
  const reB = /<[Bb]>([^<]{1,5})<\/[Bb]>/g;
  let m, count=0;
  const start = iRES >= 0 ? iRES : 0;
  const sub   = html.slice(start, start+2000);
  while ((m=reB.exec(sub))!==null && count<30) { iBs.push(m[1]); count++; }

  return res.status(200).json({
    total_len: html.length,
    busquedas: {
      RESULTADOS_LOTO_5: find('RESULTADOS LOTO 5 DE ARGENTINA'),
      sorteo_1435:       find('1435'),
      sorteo_nro:        find('Sorteo Nro'),
      sorteo_n_upper:    find('SORTEO N'),
      sorteo_n_lower:    find('Sorteo N'),
    },
    ctx_1435:       ctx,
    ctx_resultados: ctxR,
    bold_tags_en_bloque: iBs
  });
}
