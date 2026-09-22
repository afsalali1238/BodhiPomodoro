const fs = require('fs');
const toIco = require('png-to-ico').default || require('png-to-ico');

fs.readFile('src/icon.png', (err, buffer) => {
  if (err) throw err;
toIco('src/icon.png')
  .then(ico => {
    fs.writeFileSync('src/icon.ico', ico);
    console.log('Created src/icon.ico (standard 256x256 valid Windows icon)');
  })
  .catch(err => { throw err; });
});
