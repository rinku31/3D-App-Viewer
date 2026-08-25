const fs = require('fs');

function extractFunction(content, funcName) {
  const lines = content.split('\n');
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${funcName}(`) || lines[i].includes(`${funcName} = function`)) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) return null;

  let openBraces = 0;
  let endIndex = -1;
  let started = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
      if (char === '{') {
        openBraces++;
        started = true;
      }
      if (char === '}') openBraces--;
    }
    if (started && openBraces === 0) {
      endIndex = i;
      break;
    }
  }

  return lines.slice(startIndex, endIndex + 1).join('\n');
}

const embedHud = fs.readFileSync('Embed/ui/hud.js', 'utf8');
const viewerHud = fs.readFileSync('Viewer/ui/hud.js', 'utf8');

console.log("--- EMBED setupKeyboardShortcuts ---");
console.log(extractFunction(embedHud, 'setupKeyboardShortcuts'));
console.log("\n--- EMBED updateHudSceneInfo ---");
console.log(extractFunction(embedHud, 'updateHudSceneInfo'));

console.log("\n--- VIEWER updateHudSceneInfo ---");
console.log(extractFunction(viewerHud, 'updateHudSceneInfo'));
