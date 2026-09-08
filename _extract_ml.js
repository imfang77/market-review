const fs = require('fs');
const f = process.argv[2];
const html = fs.readFileSync(f, 'utf8');
const blocks = html.split('ml-judgement');
for (let i = 1; i < blocks.length; i++) {
  const seg = blocks[i];
  function grab(cls) {
    const m = seg.match(new RegExp('ml-block ' + cls + '">[\\s\\S]*?ml-list">([\\s\\S]*?)</ol>'));
    if (!m) return [];
    return (m[1].match(/<li[^>]*>([\\s\\S]*?)<\/li>/g) || []).map(function (li) {
      return li.replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim();
    });
  }
  console.log('--- block ' + i + ' ---');
  console.log('主线:', grab('ml-main').join(' || '));
  console.log('候选:', grab('ml-cand').join(' || '));
}
