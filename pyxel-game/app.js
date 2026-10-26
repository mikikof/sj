const SCHOOL_LABEL = ''; // 空文字にすると学校・学年の表示を外せます。公開版はキャラのページ（mikikof/sj 9db20c6）に合わせて外す（2026-10-26）。

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const P = window.PyxelPrompt;
  const C = window.PyxelChecker;
  const keys = Object.keys(P.FIELD_LABELS);
  const names = {catch:'キャッチ', dodge:'よける', shoot:'シューティング', jump:'ジャンプ', free:'自由'};
  let previousPreset = null;
  let checked = false;

  $('school-label').textContent = SCHOOL_LABEL;
  $('school-label').hidden = !SCHOOL_LABEL;
  const options = () => ({useCharacter:$('use-character').checked});
  const fields = () => Object.fromEntries(keys.map(key => [key, $(key).value]));

  function renderPrompt() {
    $('prompt-preview').textContent = P.buildPrompt(fields(), options());
    $('error-preview').textContent = P.buildErrorPrompt($('error-input').value, options());
    $('feature-preview').textContent = P.buildFeaturePrompt($('feature-input').value, options());
    const character = options().useCharacter;
    $('character-steps').hidden = !character;
    $('shapes-steps').hidden = character;
    $('character-note').textContent = character
      ? 'キャラの ZIP を使います。絵と日本語のフォントも読み込みます。'
      : '絵は図形で描き、画面の文字は英語にします。キャラの ZIP は使いません。';
    $('mode-label').textContent = character ? '自分のキャラを使う' : '図形で描く・文字は英語';
    for (const id of ['prompt-status','error-status','feature-status']) $(id).textContent = '';
  }

  function fillPreset(name, remember) {
    if (remember) {
      previousPreset = {fields:fields(), genre:document.querySelector('[data-genre][aria-pressed="true"]')?.dataset.genre};
      $('undo-genre').disabled = false;
    }
    keys.forEach(key => { $(key).value = P.PRESETS[name][key]; });
    document.querySelectorAll('[data-genre]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.genre === name)));
    $('genre-status').textContent = name === 'free'
      ? '欄を空にしました。書いていない所は、決まりの文をもとに Gemini が考えます。'
      : `${names[name]}の例が入っています。欄は書き換えられます。`;
    renderPrompt();
  }

  function selectForManualCopy(text, output) {
    for (let parent = output.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    output.focus();
    if (output instanceof HTMLTextAreaElement) output.select();
    else {
      const range = document.createRange();
      range.selectNodeContents(output);
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    }
    output.scrollIntoView({block:'center'});
  }

  async function copyText(text, status, output) {
    if (!text.trim()) { status.textContent = 'コピーする内容がまだありません。'; return; }
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('fallback');
      await navigator.clipboard.writeText(text);
      status.textContent = 'コピーしました。貼り付け先の欄に貼れます。';
      return;
    } catch (_) { /* file:// や許可がない環境では選択コピーに進む。 */ }
    const focused = document.activeElement;
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.setAttribute('aria-label', 'コピー用の文');
    temporary.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(temporary);
    temporary.focus(); temporary.select(); temporary.setSelectionRange(0, text.length);
    let success = false;
    try { success = document.execCommand('copy'); } catch (_) { /* 手動コピーを案内 */ }
    temporary.remove();
    if (focused && typeof focused.focus === 'function') focused.focus({preventScroll:true});
    if (success) status.textContent = 'コピーしました。貼り付け先の欄に貼れます。';
    else {
      selectForManualCopy(text, output);
      status.textContent = '自動でコピーできませんでした。文を選択しました。Mac は ⌘＋C、Windows は Ctrl＋C でコピーできます。';
    }
  }

  function addParagraph(parent, content, className) {
    const p = document.createElement('p');
    p.textContent = content;
    if (className) p.className = className;
    parent.appendChild(p);
  }

  function inspectAnswer() {
    const answer = $('answer-input').value;
    const results = $('check-results');
    results.replaceChildren();
    $('code-status').textContent = '';
    if (!answer.trim()) {
      $('code-output').value = '';
      $('copy-code').disabled = true;
      delete results.dataset.stopCount; delete results.dataset.warningCount; delete results.dataset.noticeCount;
      addParagraph(results, 'Gemini の答えを先に貼ってください。');
      $('answer-input').focus(); checked = false;
      return;
    }
    const result = C.inspect(answer, options());
    checked = true;
    $('code-output').value = result.code;
    $('copy-code').disabled = !result.code.trim();
    results.dataset.stopCount = result.stops.length;
    results.dataset.warningCount = result.warnings.length;
    results.dataset.noticeCount = result.notices.length;
    const counts = document.createElement('div'); counts.className = 'check-counts';
    for (const [label, list, className] of [['止まる',result.stops,'has-stops'], ['注意',result.warnings,'has-warnings'], ['お知らせ',result.notices,'has-notices']]) {
      const span = document.createElement('span'); span.textContent = `${label} ${list.length} 件`;
      if (list.length) span.className = className;
      counts.appendChild(span);
    }
    results.appendChild(counts);
    if (!result.stops.length && !result.warnings.length) addParagraph(results, 'この点検で気になる所はありませんでした。Code Maker で動きを確かめます。');
    else {
      const list = document.createElement('ul');
      for (const [label, findings] of [['止まる',result.stops],['注意',result.warnings]]) {
        findings.forEach(finding => {
          const item = document.createElement('li');
          item.textContent = `${label}${finding.line ? `（${finding.line} 行目）` : ''}：${finding.message}`;
          list.appendChild(item);
        });
      }
      results.appendChild(list);
      addParagraph(results, 'コードの書き方で気になる所を Gemini に伝えて直したら、返事をもう一度ここに貼れます。', 'check-note');
    }
    result.notices.forEach(notice => addParagraph(results, 'お知らせ：' + notice.message, 'check-notice'));
    (result.notes || []).forEach(note => addParagraph(results, note, 'check-note'));
  }

  keys.forEach(key => $(key).addEventListener('input', renderPrompt));
  $('game-form').addEventListener('submit', event => event.preventDefault());
  document.querySelectorAll('[data-genre]').forEach(button => button.addEventListener('click', () => fillPreset(button.dataset.genre, true)));
  $('undo-genre').addEventListener('click', () => {
    if (!previousPreset) return;
    keys.forEach(key => { $(key).value = previousPreset.fields[key]; });
    document.querySelectorAll('[data-genre]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.genre === previousPreset.genre)));
    previousPreset = null; $('undo-genre').disabled = true;
    $('genre-status').textContent = '例を入れる前の内容に戻しました。'; renderPrompt();
  });
  $('use-character').addEventListener('change', () => { renderPrompt(); if (checked) inspectAnswer(); });
  $('error-input').addEventListener('input', renderPrompt);
  $('feature-input').addEventListener('input', renderPrompt);
  $('copy-prompt').addEventListener('click', () => copyText($('prompt-preview').textContent, $('prompt-status'), $('prompt-preview')));
  for (const type of ['error','feature']) $('copy-' + type).addEventListener('click', () => {
    if (!$(type + '-input').value.trim()) {
      $(type + '-status').textContent = type === 'error' ? 'エラーの最後の数行を貼ってください。' : '足したいことを 1 つ書いてください。';
      $(type + '-input').focus(); return;
    }
    copyText($(type + '-preview').textContent, $(type + '-status'), $(type + '-preview'));
  });
  $('check-code').addEventListener('click', inspectAnswer);
  $('answer-input').addEventListener('input', () => {
    checked = false;
    $('code-output').value = ''; $('copy-code').disabled = true; $('code-status').textContent = '';
    $('check-results').replaceChildren();
    delete $('check-results').dataset.stopCount; delete $('check-results').dataset.warningCount; delete $('check-results').dataset.noticeCount;
    addParagraph($('check-results'), '「コードを取り出して点検」を押すと、この答えを点検します。');
  });
  $('copy-code').addEventListener('click', () => copyText($('code-output').value, $('code-status'), $('code-output')));
  fillPreset('catch', false);
})();
