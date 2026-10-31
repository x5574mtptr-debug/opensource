// 安装后处理：国内网络下切换 Electron 二进制下载源，避免 install 卡死
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mirrors = [
  'https://npmmirror.com/mirrors/electron/',
  'https://cdn.npmmirror.com/binaries/electron/'
];

function setMirror() {
  if (process.env.ELECTRON_MIRROR) return; // 用户已指定，尊重
  for (const m of mirrors) {
    try {
      execSync(`node -e "require('https').get('${m}',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"`, {
        stdio: 'ignore',
        timeout: 15000
      });
      process.env.ELECTRON_MIRROR = m;
      fs.writeFileSync(
        path.join(__dirname, '..', '.electron-mirror'),
        m,
        'utf8'
      );
      console.log('[postinstall] Electron 镜像已设置:', m);
      return;
    } catch (e) {
      // 试下一个
    }
  }
  console.log('[postinstall] 未找到可用镜像，使用默认源');
}

setMirror();
