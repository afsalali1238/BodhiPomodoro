const fs = require('fs');
const toIco = require('png-to-ico').default || require('png-to-ico');

fs.readFile('src/icon.png', (err, buffer) => {
  if (err) throw err;
  toIco([buffer], 512)
    .then(ico => {
      fs.writeFileSync('src/icon.ico', ico);
      console.log('Created src/icon.ico');
    })
    .catch(err => { throw err; });
});
