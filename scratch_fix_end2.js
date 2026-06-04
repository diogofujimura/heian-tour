const fs = require('fs');
let lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');

// Find the line that starts with "} catch(e) {" around 2070
let catchLineIndex = -1;
for(let i = lines.length - 1; i >= 0; i--) {
  if(lines[i].includes('} catch(e) {')) {
    catchLineIndex = i;
    break;
  }
}

if(catchLineIndex > -1) {
  lines = lines.slice(0, catchLineIndex);
  lines.push('        } catch(e) {');
  lines.push('          console.error(e);');
  lines.push('        }');
  lines.push('      };');
  lines.push('    }');
  lines.push('  });');
  lines.push('}');
  lines.push('');
  
  fs.writeFileSync('public/js/app.js', lines.join('\n'));
  console.log('Fixed end block!');
} else {
  console.log('Could not find catch line');
}
