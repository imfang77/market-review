const fs = require('fs');
const f = process.argv[2];
const html = fs.readFileSync(f, 'utf8');
const idxs = [];
let m, re = /class="ml-judgement"/g;
while ((m = re.exec(html))) idxs.push(m.index);
function tagStripped(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/ {2,}/g, ' ').trim();
}
for (let k = 0; k < idxs.length; k++) {
  const start = idxs[k];
  const end = (k + 1 < idxs.length) ? idxs[k + 1] : html.length;
  const seg = html.slice(start, end);
  function grab(cls) {
    const marker = 'class="ml-block ' + cls + '"';
    const bi = seg.indexOf(marker);
    if (bi < 0) return [];
    const olStart = seg.indexOf('<ol class="ml-list">', bi);
    if (olStart < 0) return [];
    const olEnd = seg.indexOf('</ol>', olStart);
    const listHtml = seg.slice(olStart, olEnd);
    return listHtml.split('<li').slice(1).map(function (s) {
      const gt = s.indexOf('>');
      let content = s.slice(gt + 1);
      const liEnd = content.indexOf('</li>');
      if (liEnd >= 0) content = content.slice(0, liEnd);
      return tagStripped(content);
    });
  }
  console.log('--- block ' + (k + 1) + ' ---');
  console.log('主线:', grab('ml-main').join(' || '));
  console.log('候选:', grab('ml-cand').join(' || '));
}
