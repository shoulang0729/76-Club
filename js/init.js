/* ============================ INIT ============================ */
document.documentElement.lang = (LANG==='zh' ? 'zh-CN' : LANG);
setTheme(THEME);   // 属性セット＋旧 'a'/'b' の永続値を light に置き換え
applyStaticI18n();
document.getElementById('langSel').value = LANG;
document.getElementById('themeSel').value = THEME;
render();
