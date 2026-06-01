const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');
const lines = html.split('\n');
let viewPainelStart = lines.findIndex(l => l.includes('id="view-painel"'));
let viewDesafiosStart = lines.findIndex(l => l.includes('id="view-desafios"'));

let painelHtml = lines.slice(viewPainelStart, viewDesafiosStart).join('\n');
let openDivs = (painelHtml.match(/<div\b[^>]*>/g) || []).length;
let closeDivs = (painelHtml.match(/<\/div>/g) || []).length;
console.log('Open divs:', openDivs, 'Close divs:', closeDivs, 'Difference:', openDivs - closeDivs);

if (openDivs !== closeDivs) {
  console.log("WARNING: Mismatch in divs for view-painel!");
}
