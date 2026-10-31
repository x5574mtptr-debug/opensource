const fs = require('fs');

const srcDir = 'C:\\Users\\Administrator\\Desktop\\xiaomi vela\\伪装软件 v1\\src';

console.log('Contents of src:');
try {
  const files = fs.readdirSync(srcDir);
  files.forEach(f => console.log(f));
} catch(e) {
  console.error('Error:', e.message);
}
