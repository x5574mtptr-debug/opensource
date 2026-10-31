const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\Administrator\\Desktop\\xiaomi vela';

console.log('Reading base directory...');
fs.readdir(baseDir, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('Base dir error:', err);
    return;
  }
  
  const target = entries.find(e => e.name === '伪装软件 v1' && e.isDirectory());
  if (!target) {
    console.error('Target directory not found');
    return;
  }
  
  const fullPath = path.join(baseDir, target.name);
  console.log('Found:', target.name);
  console.log('Full path:', fullPath);
  
  // Read src
  const srcPath = path.join(fullPath, 'src');
  console.log('Reading src:', srcPath);
  
  fs.readdir(srcPath, { withFileTypes: true }, (err2, srcEntries) => {
    if (err2) {
      console.error('Src error:', err2.message);
      return;
    }
    
    console.log('=== SRC Contents ===');
    srcEntries.forEach(e => {
      console.log((e.isDirectory() ? '[DIR] ' : '[FILE] ') + e.name);
    });
    
    // Read pages
    const pagesPath = path.join(srcPath, 'pages');
    fs.readdir(pagesPath, { withFileTypes: true }, (err3, pagesEntries) => {
      if (err3) {
        console.error('Pages error:', err3.message);
        return;
      }
      
      console.log('=== PAGES Contents ===');
      pagesEntries.forEach(e => {
        console.log((e.isDirectory() ? '[DIR] ' : '[FILE] ') + e.name);
      });
    });
  });
});
