(function (root) {
  'use strict';
  const TARGETS = [
    {value:'h1', label:'名前・大きな見出し', note:'h1 の文字を変えます。'},
    {value:'.bio', label:'紹介文', note:'.bio の文章を変えます。'},
    {value:'.skills button', label:'特技のボタン', note:'.skills の中の button を変えます。'},
    {value:'body', label:'ページの基本フォント', note:'個別にフォントを指定した部分には引き継がれません。'}
  ];
  const DEFAULT_SAMPLE = {ja:'ノヴァと冒険へ 123', latin:'Nova Adventures 123'};
  let hooks = {}, panel, trigger, chosen, fonts = [], language = 'ja', category = 'all';
  let sampleEdited = false, copyRun = 0, previousFocus = null, selection = null;
  const $ = id => document.getElementById(id);
  const cssString = value => '"' + String(value).replace(/[\\"\n\r\f<>]/g, char => '\\' + char.codePointAt(0).toString(16) + ' ') + '"';
  function family(font) {
    const serif = /明朝|serif/i.test(font.category || '') && !/sans/i.test(font.category || '');
    const fallback = serif ? 'serif' : 'sans-serif';
    if (font.language === 'latin') return cssString(font.family) + ', "Zen Kaku Gothic New", ' + fallback;
    return cssString(font.family) + ', ' + fallback;
  }
  function status(message) { $('font-status').textContent = message; }
  function filtered() { return fonts.filter(font => font.language === language && (category === 'all' || font.category === category)); }
  function sample() { return $('font-sample').value || DEFAULT_SAMPLE[language]; }
  function code() {
    const target = TARGETS.find(item => item.value === $('font-target').value) || TARGETS[0];
    return target.value + ' {\n  font-family: ' + family(chosen) + ';\n}\n';
  }
  function updateSelection() {
    if (!chosen) return;
    const target = TARGETS.find(item => item.value === $('font-target').value) || TARGETS[0];
    $('font-chosen-name').textContent = chosen.label;
    $('font-description').textContent = chosen.description || chosen.category;
    $('font-target-note').textContent = target.note;
    $('font-code').value = code();
    $('font-code').scrollTop = 0; $('font-code').scrollLeft = 0;
    $('font-code').setAttribute('aria-label', chosen.label + 'に変えるCSS');
    for (const button of panel.querySelectorAll('[data-font-id]')) {
      button.setAttribute('aria-pressed', String(button.dataset.fontId === chosen.id));
    }
    status('CSSをコピーして、一番下に貼り付けます。');
  }
  function renderCards() {
    const list = $('font-list');
    list.replaceChildren();
    const available = filtered();
    $('font-count').textContent = available.length + '種類';
    for (const font of available) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'font-card'; button.dataset.fontId = font.id;
      button.setAttribute('aria-pressed', String(chosen?.id === font.id));
      button.setAttribute('aria-label', font.label + 'を選ぶ');
      const name = document.createElement('span'); name.className = 'font-card-name'; name.textContent = font.label;
      const preview = document.createElement('span'); preview.className = 'font-card-sample'; preview.textContent = sample();
      preview.style.fontFamily = family(font); preview.setAttribute('aria-hidden', 'true');
      const type = document.createElement('span'); type.className = 'font-card-type'; type.textContent = font.category;
      button.append(name, preview, type);
      button.addEventListener('click', () => { chosen = font; updateSelection(); });
      list.append(button);
    }
    list.scrollTop = 0;
  }
  function updateCategories() {
    const select = $('font-category'); select.replaceChildren();
    const categories = ['all', ...new Set(fonts.filter(font => font.language === language).map(font => font.category))];
    for (const value of categories) {
      const option = document.createElement('option'); option.value = value;
      option.textContent = value === 'all' ? 'すべての書体' : value; select.append(option);
    }
    category = 'all'; select.value = category;
  }
  function setLanguage(value) {
    language = value === 'latin' ? 'latin' : 'ja';
    if (!sampleEdited) $('font-sample').value = DEFAULT_SAMPLE[language];
    for (const button of panel.querySelectorAll('[data-font-language]')) button.setAttribute('aria-pressed', String(button.dataset.fontLanguage === language));
    $('font-language-note').textContent = language === 'latin' ? '英字・数字が変わります。日本語は標準の書体です。' : 'ひらがな・カタカナ・漢字も使えます。';
    updateCategories();
    if (!chosen || chosen.language !== language) chosen = filtered()[0];
    renderCards(); updateSelection();
  }
  function remember() {
    previousFocus = document.activeElement;
    const node = previousFocus;
    selection = node && ['css-editor', 'html-editor'].includes(node.id) ? {
      node, start:node.selectionStart, end:node.selectionEnd, direction:node.selectionDirection,
      top:node.scrollTop, left:node.scrollLeft
    } : null;
  }
  function restore() {
    if (selection?.node.isConnected) {
      const saved = selection; saved.node.focus({preventScroll:true});
      saved.node.setSelectionRange(saved.start, saved.end, saved.direction || 'none');
      saved.node.scrollTop = saved.top; saved.node.scrollLeft = saved.left;
    } else (previousFocus?.isConnected ? previousFocus : trigger)?.focus({preventScroll:true});
  }
  function place() {
    if (!panel || panel.hidden) return;
    const viewport = root.visualViewport, margin = 10;
    const width = viewport?.width || root.innerWidth, height = viewport?.height || root.innerHeight;
    const leftEdge = (viewport?.offsetLeft || 0) + margin, topEdge = (viewport?.offsetTop || 0) + margin;
    const preview = document.querySelector('.preview-area')?.getBoundingClientRect();
    const panelWidth = Math.min(610, width - 2 * margin, preview?.width >= 410 ? preview.width : 610);
    const top = Math.min(Math.max(topEdge, preview?.top || 64), topEdge + Math.max(0, height - 600));
    const availableHeight = height - (top - topEdge) - 2 * margin;
    panel.style.width = Math.max(240, panelWidth) + 'px';
    panel.style.left = Math.max(leftEdge, leftEdge + width - 2 * margin - panelWidth) + 'px';
    panel.style.top = top + 'px';
    panel.style.height = Math.min(690, availableHeight) + 'px';
  }
  function open() {
    if (!panel) init(hooks);
    if (!panel || !fonts.length) return;
    if (panel.hidden && document.activeElement !== trigger) remember();
    root.PixelPalette?.close(false); root.PixelCodeHelp?.hide(); root.PixelStudio?.close(false);
    root.PixelFontLibrary?.install();
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    place();
  }
  function close(restoreFocus = true) {
    if (!panel || panel.hidden) return;
    const focusedInside = panel.contains(document.activeElement);
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); copyRun++;
    if (restoreFocus && focusedInside) restore();
  }
  function goToPaste(message) {
    close(false); hooks.goToPaste?.();
    hooks.notify?.(message || 'CSSの一番下に貼り付けよう。');
  }
  async function copy() {
    const text = '\n\n' + code(), run = ++copyRun;
    try {
      if (!root.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
      await root.navigator.clipboard.writeText(text);
      if (run !== copyRun || panel.hidden) return;
      goToPaste('CSSをコピーしました。一番下に貼り付けよう。');
    } catch (_) {
      if (run !== copyRun || panel.hidden) return;
      const field = $('font-code'); field.focus({preventScroll:true}); field.select();
      const mac = /Mac|iPhone|iPad/.test(root.navigator?.platform || root.navigator?.userAgent || '');
      status((mac ? '⌘C' : 'Ctrl+C') + 'でコピーすると、貼り付ける場所に移動します。');
    }
  }
  function init(options = {}) {
    hooks = options;
    if (panel) return;
    trigger = $('font-open'); if (!trigger) return;
    fonts = (root.PIXEL_FONT_DATA || []).filter(font => font.id && font.family && font.label && ['ja', 'latin'].includes(font.language));
    panel = document.createElement('section'); panel.id = 'font-picker'; panel.className = 'font-picker'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'font-title');
    panel.innerHTML = `<div class="font-heading"><h2 id="font-title">フォントを変える <span id="font-count"></span></h2><button id="font-close" type="button">閉じる ×</button></div>
      <div class="font-controls"><div class="font-filter-row"><div class="font-languages" role="group" aria-label="使う文字"><button type="button" data-font-language="ja" aria-pressed="true">日本語</button><button type="button" data-font-language="latin" aria-pressed="false">英字</button></div><label class="sr-only" for="font-category">書体の種類</label><select id="font-category"></select></div><label class="font-sample-row" for="font-sample"><span>試し書き</span><input type="text" id="font-sample" maxlength="50" spellcheck="false" value="ノヴァと冒険へ 123"></label><p id="font-language-note"></p></div>
      <div id="font-list" class="font-list" role="group" aria-label="フォントを選ぶ"></div>
      <div class="font-bottom"><div class="font-selected"><strong id="font-chosen-name"></strong><span id="font-description"></span></div><label class="font-target-row" for="font-target"><span>変える文字</span><select id="font-target"></select></label><p id="font-target-note"></p><label class="sr-only" for="font-code">コピーするCSS</label><textarea id="font-code" readonly wrap="off" spellcheck="false"></textarea><div class="font-copy-row"><button id="font-paste-place" type="button">貼り付ける場所へ</button><button id="font-copy" type="button">CSSをコピー</button></div><p id="font-status" role="status" aria-live="polite"></p></div>`;
    document.body.append(panel);
    for (const target of TARGETS) {
      const option = document.createElement('option'); option.value = target.value; option.textContent = target.label; $('font-target').append(option);
    }
    $('font-target').value = 'h1';
    trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('pointerdown', remember);
    trigger.addEventListener('click', () => {
      if (!panel.hidden) return close();
      open(); (panel.querySelector('[data-font-id][aria-pressed="true"]') || $('font-close')).focus({preventScroll:true});
    });
    $('font-close').addEventListener('click', () => close());
    for (const button of panel.querySelectorAll('[data-font-language]')) button.addEventListener('click', () => setLanguage(button.dataset.fontLanguage));
    $('font-category').addEventListener('change', () => {
      category = $('font-category').value;
      const available = filtered(); if (!available.some(font => font.id === chosen?.id)) chosen = available[0];
      renderCards(); updateSelection();
    });
    $('font-sample').addEventListener('input', () => {
      sampleEdited = !!$('font-sample').value;
      for (const preview of panel.querySelectorAll('.font-card-sample')) preview.textContent = sample();
    });
    $('font-target').addEventListener('change', updateSelection);
    $('font-copy').addEventListener('click', copy);
    $('font-paste-place').addEventListener('click', () => goToPaste());
    $('font-code').addEventListener('click', event => event.target.select());
    $('font-code').addEventListener('copy', event => {
      if (event.clipboardData?.setData) { event.clipboardData.setData('text/plain', '\n\n' + $('font-code').value); event.preventDefault(); }
      const run = ++copyRun;
      setTimeout(() => { if (run === copyRun && !panel.hidden) goToPaste('CSSをコピーしました。一番下に貼り付けよう。'); }, 0);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); }
    });
    root.addEventListener('resize', place); root.visualViewport?.addEventListener('resize', place); root.visualViewport?.addEventListener('scroll', place);
    setLanguage('ja');
    if (!fonts.length) { trigger.disabled = true; trigger.title = 'フォントを読み込めませんでした。ページを開き直してください。'; }
  }
  root.PixelFonts = {init, open, close};
})(window);
