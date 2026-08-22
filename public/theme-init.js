// Applies the persisted theme before first paint (prevents a flash on reload).
// Kept as an external file so the CSP needs no 'unsafe-inline' for scripts.
//
// Light is the store's default and is NOT derived from the OS: a visitor who
// has never chosen sees the light store even on a device set to dark. Only an
// explicit 'dark' — or an explicit 'system' on a dark device — darkens it.
(function () {
  var s = localStorage.getItem('aurum-theme');
  var t = 'light';
  if (s) {
    try {
      t = JSON.parse(s).state.theme || 'light';
    } catch (e) {}
  }
  var dark =
    t === 'dark' ||
    (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) {
    document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0E0D0B');
  }
})();
