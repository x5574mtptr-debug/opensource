const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\Administrator\\Desktop\\xiaomi vela';

fs.readdir(dir, { withFileTypes: true }, (err, files) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('=== Directories ===');
  files.filter(f => f.isDirectory()).forEach(d => {
    console.log('DIR:', d.name);
    const subPath = path.join(dir, d.name);
    if (d.name.includes('伪装')) {
      console.log('  Contents of', d.name + ':');
      try {
        const subFiles = fs.readdirSync(subPath, { withFileTypes: true });
        subFiles.forEach(sf => {
          console.log('    ' + (sf.isDirectory() ? '[DIR]' : '[FILE]') + ' ' + sf.name);
          if (sf.isDirectory()) {
            const subSubPath = path.join(subPath, sf.name);
            try {
              const deepFiles = fs.readdirSync(subSubPath);
              deepFiles.forEach(df => console.log('      - ' + df));
            } catch(e) {}
          }
        });
      } catch(e) {
        console.log('  Error reading:', e.message);
      }
    }
  });
});
