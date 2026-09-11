const toast = document.getElementById('toast');
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
}

document.getElementById('printBtn').addEventListener('click', () => {
  showToast('Preparing 47 pages of highly questionable scholarship…');
  window.setTimeout(() => window.print(), 500);
});

document.getElementById('confettiBtn').addEventListener('click', () => {
  showToast('Verdict accepted. Historians everywhere are sighing.');
  for (let i = 0; i < 24; i++) {
    const bit = document.createElement('span');
    bit.textContent = ['🔥', '✦', 'BBQ'][i % 3];
    bit.style.cssText = `position:fixed;left:${Math.random() * 100}vw;top:-20px;font-size:${14 + Math.random() * 20}px;z-index:10;pointer-events:none;transition:transform 1.4s ease-in,opacity 1.4s;`;
    document.body.appendChild(bit);
    requestAnimationFrame(() => { bit.style.transform = `translateY(${window.innerHeight + 60}px) rotate(${Math.random() * 720 - 360}deg)`; bit.style.opacity = '0'; });
    window.setTimeout(() => bit.remove(), 1600);
  }
});
