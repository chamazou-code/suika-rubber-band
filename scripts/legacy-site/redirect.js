// The destination is owned by this page, never taken from an incoming URL.
(() => {
  const link = document.getElementById('destination');
  const destination = new URL(link.href);
  try {
    const best = Number(localStorage.getItem('rubber-band-best'));
    if (Number.isInteger(best) && best > 0 && best <= 70) destination.hash = `best=${best}`;
  } catch { /* Continue to the game when browser storage is blocked. */ }
  link.href = destination.href;
  location.replace(destination.href);
})();
