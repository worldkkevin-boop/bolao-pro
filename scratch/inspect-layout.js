const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');

// Find the content inside screen-app
const startToken = '<div id="screen-app"';
const startIndex = html.indexOf(startToken);
if (startIndex === -1) {
  console.log('screen-app not found');
  process.exit(1);
}

// Simple parser to find top-level children of screen-app
let depth = 0;
let pos = startIndex;
// Move to the end of the opening tag of screen-app
while (html[pos] !== '>') {
  pos++;
}
pos++; // skip '>'

const children = [];
let currentTag = '';
let isTag = false;
let tagStart = 0;

while (pos < html.length) {
  if (html[pos] === '<') {
    isTag = true;
    tagStart = pos;
    currentTag = '';
  } else if (html[pos] === '>') {
    isTag = false;
    currentTag += html[pos];
    
    const isClosing = currentTag.startsWith('</');
    const isSelfClosing = currentTag.endsWith('/>') || currentTag.startsWith('<img') || currentTag.startsWith('<input') || currentTag.startsWith('<br') || currentTag.startsWith('<hr');
    
    const tagNameMatch = currentTag.match(/<\/?([a-zA-Z0-9\-]+)/);
    const tagName = tagNameMatch ? tagNameMatch[1] : '';

    if (isClosing) {
      depth--;
      if (depth === 0) {
        // Exited a direct child of screen-app
        break; // reached end of screen-app
      }
    } else if (!isSelfClosing) {
      if (depth === 1) {
        // Found a direct child of screen-app
        const fullTag = html.substring(tagStart, pos + 1);
        const idMatch = fullTag.match(/id="([^"]+)"/);
        const classMatch = fullTag.match(/class="([^"]+)"/);
        children.push({
          tag: tagName,
          id: idMatch ? idMatch[1] : 'no-id',
          class: classMatch ? classMatch[1] : 'no-class',
          full: fullTag
        });
      }
      depth++;
    }
  }
  
  if (isTag) {
    currentTag += html[pos];
  }
  pos++;
}

console.log('Direct children of screen-app:');
children.forEach(c => {
  console.log(`- <${c.tag} id="${c.id}" class="${c.class}">`);
});
