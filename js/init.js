/* ============================ INIT ============================ */
document.documentElement.lang = (LANG==='zh' ? 'zh-CN' : LANG);
setTheme(THEME);   // 属性セット＋旧 'a'/'b' の永続値を light に置き換え
applyStaticI18n();
document.getElementById('langSel').value = LANG;
document.getElementById('themeSel').value = THEME;
// 起動時はトップ（§11.12 B）。「次回から表示しない」時は基本設定（どのコンペか）から開始
if(seenTop()) activeTab='basic';
render();
