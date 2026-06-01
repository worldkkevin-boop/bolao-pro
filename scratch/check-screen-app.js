const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

const screenAppStart = html.indexOf('<div id="screen-app"');
if (screenAppStart === -1) {
  console.log("Could not find screen-app");
  process.exit(1);
}

// We will use a simple stack to find the matching closing div for screen-app
let divCount = 0;
let currentIndex = screenAppStart;
let insideScreenApp = true;

const regex = /<\/?div\b[^>]*>/g;
regex.lastIndex = screenAppStart;

let match;
while ((match = regex.exec(html)) !== null) {
  if (match[0].startsWith('</div')) {
    divCount--;
  } else if (match[0].startsWith('<div')) {
    divCount++;
  }
  
  if (divCount === 0) {
    console.log("Found closing div for screen-app at index", match.index);
    console.log("End of screen-app HTML:");
    console.log(html.substring(match.index - 100, match.index + 20));
    break;
  }
}
