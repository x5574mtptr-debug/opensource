const fs = require('fs');
const path = require('path');

const srcPages = 'C:\\Users\\Administrator\\Desktop\\xiaomi vela\\伪装软件 v1\\src\\pages';

console.log('Contents of src/pages:');
try {
  const files = fs.readdirSync(srcPages, { withFileTypes: true });
  files.forEach(f => {
    console.log((f.isDirectory() ? '[DIR] ' : '[FILE] ') + f.name);
  });
} catch(e) {
  console.error('Error:', e.message);
}
