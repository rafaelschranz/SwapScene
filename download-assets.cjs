const https = require('https');
const fs = require('fs');
const path = require('path');

const assets = [
  'model.onnx',
  'ort-wasm.wasm',
  'ort-wasm-simd.wasm',
  'ort-wasm-threaded.wasm'
];

const urlBase = 'https://cdn.img.ly/assets/imgly-background-removal/v1.4/';
const targetDir = path.join(__dirname, 'public', 'assets');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

assets.forEach(asset => {
  const url = urlBase + asset;
  const targetFile = path.join(targetDir, asset);
  const file = fs.createWriteStream(targetFile);
  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${asset}`);
    });
  }).on('error', (err) => {
    fs.unlink(targetFile);
    console.error(`Error downloading ${asset}: ${err.message}`);
  });
});
