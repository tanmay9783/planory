const fs = require('fs');
const path = require('path');

function replaceInDir(dir, find, replace) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath, find, replace);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(find) || content.includes('#ba7517')) {
        content = content.replace(new RegExp(find, 'g'), replace);
        content = content.replace(new RegExp('#ba7517', 'g'), replace);
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'mobile', 'src'), '#BA7517', '#C2A878');
replaceInDir(path.join(__dirname, 'mobile', 'src'), '#ba7517', '#C2A878');
console.log('Mobile color replacement done.');
