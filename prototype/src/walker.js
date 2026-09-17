document.getElementById('defsHost').innerHTML = window.BodhiArt.defs();
document.getElementById('fig').innerHTML = window.BodhiArt.standingBuddha();
  window.bodhi.on('walker', ({ facingLeft }) => {
    // artwork faces right by default (sash + bare shoulder on the right)
    document.getElementById('fig').setAttribute('transform', facingLeft ? 'scale(-1,1)' : '');
    document.querySelector('.dust').setAttribute('transform', facingLeft ? 'scale(-1,1)' : '');
  });
