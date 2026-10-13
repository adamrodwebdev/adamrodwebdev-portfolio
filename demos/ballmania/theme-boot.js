// Applies the saved theme and language before the first paint (no flash of the wrong
// theme). Must stay in sync with SettingsService: same storage key, same values.
(function () {
  var root = document.documentElement;
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('ballmania:settings') || '{}') || {};
  } catch {
    saved = {};
  }
  var theme = saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system';
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.dataset.theme = theme;
  if (saved.locale === 'fr' || saved.locale === 'en' || saved.locale === 'id') {
    root.lang = saved.locale;
  }
})();
