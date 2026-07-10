// Applies the persisted theme before first paint (prevents light-mode flash).
// Kept as an external file so the CSP needs no 'unsafe-inline' for scripts.
(function () {
  var s = localStorage.getItem('commercejet-theme');
  var t = 'system';
  if (s) { try { t = JSON.parse(s).state?.theme || 'system'; } catch (e) {} }
  var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})();
