/* A separate lesson exercise. The learner's main project is never read or changed. */
(function (root) {
  'use strict';
  const KEY = 'pixel-challenge-student:v1';
  let hooks = {}, dialog, opened = false, returnFocus = null, state, past = [], future = [], typing = null, composing = false, checked = false, celebrationTimer = null, activeHint = null, editorPaint = null;
  const $ = id => document.getElementById(id);
  const model = () => root.PixelChallengeModel;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fresh = () => ({version:1, accepted:0, step:0, html:model().initial().html, css:model().initial().css});
  const copy = value => JSON.parse(JSON.stringify(value));
  const focus = node => { if (node && node.focus) node.focus({preventScroll:true}); if (dialog) { dialog.scrollTop = 0; dialog.scrollLeft = 0; } };
  function validState(value) {
    return value && value.version === 1 && Number.isInteger(value.accepted) && value.accepted >= 0 && value.accepted <= 3 && Number.isInteger(value.step) && value.step >= 0 && value.step <= value.accepted && typeof value.html === 'string' && typeof value.css === 'string' && value.html.length < 50000 && value.css.length < 50000;
  }
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY)); return validState(saved) ? saved : fresh(); } catch (_) { return fresh(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function checkpoint() { past.push(copy(state)); if (past.length > 60) past.shift(); future = []; }
  function endTyping() { if (typing) clearTimeout(typing); typing = null; }
  function editState(fn) { endTyping(); checkpoint(); fn(state); checked = false; activeHint = null; save(); render(); }
  function undo() { endTyping(); if (!past.length) return; future.push(copy(state)); state = past.pop(); checked = false; activeHint = null; save(); render(); }
  function redo() { endTyping(); if (!future.length) return; past.push(copy(state)); state = future.pop(); checked = false; activeHint = null; save(); render(); }
  function currentCode() { return state.step < 3 ? model().assembly(Math.min(state.accepted, state.step + 1)) : {html:state.html, css:state.css}; }
  function previewDocument(source) {
    // The empty sandbox and restrictive CSP also apply to manually entered code.
    let html = source.html;
    if (root.PixelCore) html = root.PixelCore.embedAssets(html, root.PIXEL_ART);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const el of parsed.querySelectorAll('script,iframe,object,embed,link,meta,base,style,form')) el.remove();
    for (const el of parsed.querySelectorAll('*')) for (const attr of Array.from(el.attributes)) if (/^on/i.test(attr.name) || /^(?:srcdoc|formaction|href)$/i.test(attr.name)) el.removeAttribute(attr.name);
    const body = parsed.body ? parsed.body.innerHTML : html;
    const css = String(source.css || '').replace(/<\/style/gi, '<\\/style');
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{height:100%}body{margin:0;min-height:100%;box-sizing:border-box}'+css+'</style></head><body>'+body+'</body></html>';
  }
  function updatePreview() {
    $('challenge-live-preview').srcdoc = previewDocument(currentCode());
  }
  function highlight(kind) {
    const editor = $('challenge-'+kind+'-editor'), mirror = $('challenge-'+kind+'-syntax');
    mirror.innerHTML = root.PixelCore && root.PixelCore.highlight ? root.PixelCore.highlight(editor.value, kind) : escape(editor.value)+'\n';
    // A pre inherited the main editor's scroll styles before this dialog existed.
    // Keep the mirror unscrolled; only the textarea owns the scroll position.
    mirror.scrollTop = 0; mirror.scrollLeft = 0;
    mirror.style.transform = 'translate('+(-editor.scrollLeft || 0)+'px,'+(-editor.scrollTop || 0)+'px)';
  }
  function syncEditors() {
    for (const kind of ['html','css']) {
      const editor = $('challenge-'+kind+'-editor');
      if (editor.value !== state[kind]) { editor.value = state[kind]; editor.scrollTop = 0; editor.scrollLeft = 0; }
      highlight(kind);
    }
  }
  function repaintEditors() {
    if (editorPaint) clearTimeout(editorPaint);
    // Safari can change textarea scroll offsets when a formerly hidden dialog
    // or editor is laid out. Resync once it is visible, without moving a caret.
    editorPaint = setTimeout(()=>{ editorPaint = null; if (opened && state.step === 3) { highlight('html'); highlight('css'); } },0);
  }
  function historyButtons() { $('challenge-undo').disabled = !past.length; $('challenge-redo').disabled = !future.length; }
  function announce(text, type) { const node = $('challenge-feedback'); node.textContent = text || ''; node.dataset.tone = type || ''; }
  function checks() { return model().validate({html:state.html, css:state.css}); }
  function updateChecklist() {
    const result = checks();
    for (const item of result.checks) {
      const button = dialog.querySelector('[data-challenge-task="'+item.id+'"]');
      if (!button) continue;
      button.dataset.done = item.ok ? 'true' : 'false';
      button.querySelector('.challenge-task-mark').textContent = item.ok ? '✓' : String(result.checks.indexOf(item)+1);
      button.setAttribute('aria-label', button.dataset.instruction + (item.ok ? ' 達成。ヒントを表示' : ' ヒントを表示'));
    }
    $('challenge-progress').textContent = result.checks.filter(item=>item.ok).length + ' / ' + result.checks.length;
    if (!result.complete || state.accepted < 3) {
      $('challenge-complete').hidden = true;
      dialog.classList.remove('challenge-celebrate', 'challenge-finished');
    }
    return result;
  }
  function renderQuestion() {
    const question = model().questions[state.step], answered = state.accepted > state.step;
    $('challenge-question-number').textContent = 'パーツ '+(state.step+1)+' / 3';
    $('challenge-question-title').textContent = question.prompt;
    $('challenge-choice-hint').textContent = '使うパーツを1つ選ぼう。';
    const options = $('challenge-options'); options.replaceChildren();
    for (const option of question.options) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'challenge-option'; button.dataset.challengeOption = option.id;
      button.disabled = answered;
      button.innerHTML = '<span class="challenge-option-kind">'+escape(option.kind || '')+'</span><strong>'+escape(option.label)+'</strong><code>'+escape(option.code || '')+'</code><span class="challenge-option-mark" aria-hidden="true">'+(answered && option.id === question.answer ? '✓' : '＋')+'</span>';
      if (answered && option.id === question.answer) button.dataset.correct = 'true';
      button.addEventListener('click',()=>choose(option.id)); options.appendChild(button);
    }
    $('challenge-next').hidden = !answered;
    $('challenge-next').textContent = state.step === 2 ? '仕上げに進む →' : '次へ →';
    announce(answered ? question.explanation : '', answered ? 'good' : '');
    $('challenge-left-instruction').textContent = state.step === 0 ? '見本には名前と説明文があります。まずはページの中身を組み立てます。' : state.step === 1 ? '名前の下に説明文を加えます。' : '最後に見た目を整えます。';
  }
  function render() {
    if (!dialog) return;
    const editing = state.step === 3;
    dialog.dataset.stage = editing ? 'edit' : 'assemble';
    for (const button of dialog.querySelectorAll('[data-challenge-step]')) {
      const index = Number(button.dataset.challengeStep);
      button.disabled = index > state.accepted;
      button.setAttribute('aria-current', index === state.step ? 'step' : 'false');
      button.dataset.done = index < state.accepted ? 'true' : 'false';
      button.querySelector('span').textContent = index < state.accepted ? '✓' : String(index+1);
    }
    $('challenge-question').hidden = editing;
    $('challenge-editors').hidden = !editing;
    $('challenge-tasks').hidden = !editing;
    $('challenge-assembly-note').hidden = editing;
    for (const task of dialog.querySelectorAll('[data-challenge-task]')) task.setAttribute('aria-expanded', activeHint === task.dataset.challengeTask ? 'true' : 'false');
    $('challenge-check').hidden = !editing;
    $('challenge-next').hidden = editing;
    $('challenge-complete').hidden = true;
    dialog.classList.remove('challenge-finished');
    $('challenge-reset-confirm').hidden = true;
    $('challenge-live-label').textContent = '自分のページ';
    if (editing) { syncEditors(); updateChecklist(); repaintEditors(); if (activeHint) showHint(activeHint, false); else announce(''); }
    else renderQuestion();
    updatePreview(); historyButtons(); dialog.scrollTop = 0; dialog.scrollLeft = 0;
  }
  function choose(id) {
    if (state.step >= 3 || state.accepted > state.step) return;
    const question = model().questions[state.step];
    if (id !== question.answer) { announce('もう一度。'+question.prompt, 'retry'); const option = dialog.querySelector('[data-challenge-option="'+id+'"]'); if (option) { option.dataset.retry = 'true'; focus(option); } return; }
    editState(s=>{s.accepted = s.step+1;});
    focus($('challenge-next'));
  }
  function next() {
    if (state.accepted <= state.step || state.step >= 3) return;
    endTyping(); state.step++; checked = false; activeHint = null; save(); render();
    if (state.step === 3) focus($('challenge-check')); else focus($('challenge-question-title'));
  }
  function goStep(index) {
    if (!Number.isInteger(index) || index < 0 || index > state.accepted || index > 3) return;
    endTyping(); state.step = index; checked = false; activeHint = null; save(); render();
  }
  const hints = {
    name: '名前はHTMLの見出し。h1 タグにはさまれた文字を探してみよう。',
    description: '説明文はHTMLの文章。p タグにはさまれた文字を探してみよう。',
    background: '背景はCSSで変えます。ページ全体を表す body と background-color が手がかりです。',
    heading: '文字の色はCSSの color。名前の見出しに当たるルールを探してみよう。',
    imageSize: '画像の見た目はCSSで変えます。img の width が横幅です。px は大きさの単位です。',
    border: '枠線はCSSの border。カードの枠を border: 12px outset #334155; にします。outset は出っ張った枠です。'
  };
  function showHint(id, toggle = true) {
    if (!hints[id]) return;
    activeHint = toggle && activeHint === id ? null : id;
    for (const task of dialog.querySelectorAll('[data-challenge-task]')) task.setAttribute('aria-expanded', activeHint === task.dataset.challengeTask ? 'true' : 'false');
    announce(activeHint ? 'ヒント：' + hints[activeHint] : '', activeHint ? 'hint' : '');
  }
  function onInput(kind, event) {
    if (!typing) checkpoint();
    if (typing) clearTimeout(typing);
    typing = setTimeout(()=>{typing=null;},900);
    state[kind] = $('challenge-'+kind+'-editor').value;
    checked = false; save(); highlight(kind); historyButtons();
    if (composing || event && event.isComposing) return;
    updatePreview(); updateChecklist(); if (activeHint) showHint(activeHint, false); else announce('');
  }
  function checkWork() {
    const result = updateChecklist(); checked = true;
    if (state.accepted === 3 && result.complete) {
      $('challenge-complete').hidden = false;
      dialog.classList.add('challenge-finished');
      announce(result.checks.length+'つともできました。', 'good');
      dialog.classList.remove('challenge-celebrate'); void dialog.offsetWidth; dialog.classList.add('challenge-celebrate');
      if (celebrationTimer) clearTimeout(celebrationTimer);
      celebrationTimer = setTimeout(()=>{dialog.classList.remove('challenge-celebrate');celebrationTimer=null;},2400);
    } else {
      const undone = result.checks.filter(item=>!item.ok);
      if (undone.length) {
        announce('あと'+undone.length+'つ。「やること」のチェックを見ながら確かめよう。迷ったらヒントを開けます。', 'retry');
      } else if (result.structureOk === false) {
        announce(result.structureMessage || '組み立てたパーツを確認しよう。「戻す」で前の形に戻せます。', 'retry');
        // A validation message never changes editor focus, selection or scroll.
      } else announce('パーツ選びから進めよう。', 'retry');
    }
  }
  function init(options) {
    hooks = options || {};
    if (dialog) return;
    state = load();
    dialog = document.createElement('dialog'); dialog.id='pixel-challenge'; dialog.className='pixel-challenge'; dialog.setAttribute('aria-labelledby','challenge-title');
    dialog.innerHTML = '<header class="challenge-header"><div class="challenge-title-wrap"><span class="challenge-emblem" aria-hidden="true">▦</span><h2 id="challenge-title">チャレンジ</h2><span class="challenge-time">約15分</span></div><div class="challenge-header-actions"><button type="button" id="challenge-undo" title="1つ前に戻す">↶ 戻す</button><button type="button" id="challenge-redo" title="戻した操作をやり直す">↷ やり直す</button><button type="button" id="challenge-restart">リセット</button><button type="button" id="challenge-close" class="challenge-close">作品に戻る ×</button></div></header>'+
      '<nav class="challenge-steps" aria-label="チャレンジの進み具合">'+['名前のパーツ','説明のパーツ','見た目のパーツ','自分で仕上げる'].map((label,index)=>'<button type="button" data-challenge-step="'+index+'"><span>'+ (index+1)+'</span>'+label+'</button>').join('')+'</nav>'+
      '<div class="challenge-layout"><aside class="challenge-reference" aria-label="見本と課題"><section class="challenge-reference-card"><h3>見本 <span id="challenge-progress" aria-label="できた課題">0 / 6</span></h3><iframe id="challenge-reference-preview" title="完成形の見本" sandbox="" tabindex="-1"></iframe></section>'+
      '<section id="challenge-assembly-note"><h3>組み立ててみよう</h3><p id="challenge-left-instruction"></p><p class="challenge-key"><b>HTML</b> 内容・役割<br><b>CSS</b> 色・大きさなどの見た目</p></section><section id="challenge-tasks" hidden><h3>やること</h3><p class="challenge-task-intro">選ぶとヒントが出ます。</p><div class="challenge-task-grid">'+taskMarkup()+'</div></section></aside>'+
      '<section class="challenge-workspace" aria-label="自分のページとコード"><section class="challenge-live"><h3 id="challenge-live-label">自分のページ</h3><iframe id="challenge-live-preview" title="自分が組み立てているページ" sandbox="" tabindex="-1"></iframe><div id="challenge-complete" hidden tabindex="-1" role="status"><span class="challenge-complete-star" aria-hidden="true">✦</span><strong>COMPLETE!</strong><span>見本と同じページができました。</span></div><div class="challenge-confetti" aria-hidden="true">'+Array.from({length:14},(_,i)=>'<i style="--piece:'+i+'"></i>').join('')+'</div></section>'+
      '<section class="challenge-work"><section id="challenge-question"><span id="challenge-question-number" class="challenge-section-label"></span><h3 id="challenge-question-title" tabindex="-1"></h3><p id="challenge-choice-hint"></p><div id="challenge-options"></div></section>'+
      '<div id="challenge-editors" hidden>'+['html','css'].map(kind=>'<section class="challenge-editor-panel" id="challenge-'+kind+'-panel"><h3>'+kind.toUpperCase()+'</h3><div class="challenge-code-box"><pre class="syntax" id="challenge-'+kind+'-syntax" aria-hidden="true"></pre><textarea id="challenge-'+kind+'-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="チャレンジの'+kind.toUpperCase()+'コード"></textarea></div></section>').join('')+'</div></section></section></div>'+
      '<footer class="challenge-footer"><p id="challenge-feedback" role="status" aria-live="polite"></p><button type="button" id="challenge-next" class="challenge-primary" hidden>次へ →</button><button type="button" id="challenge-check" class="challenge-primary" hidden>できたか確かめる ✓</button></footer>'+
      '<div id="challenge-reset-confirm" class="challenge-reset-confirm" hidden role="alertdialog" aria-modal="false" aria-labelledby="challenge-reset-label"><p id="challenge-reset-label">チャレンジを最初からやり直しますか？</p><span>今の作品には影響しません。「戻す」で取り消せます。</span><button type="button" id="challenge-reset-yes" class="challenge-primary">リセットする</button><button type="button" id="challenge-reset-no">続ける</button></div>';
    document.body.appendChild(dialog);
    $('challenge-reference-preview').srcdoc = previewDocument(model().reference());
    $('challenge-close').addEventListener('click',close);
    $('challenge-undo').addEventListener('click',undo); $('challenge-redo').addEventListener('click',redo);
    $('challenge-next').addEventListener('click',next); $('challenge-check').addEventListener('click',checkWork);
    $('challenge-restart').addEventListener('click',()=>{$('challenge-reset-confirm').hidden=false;focus($('challenge-reset-no'));});
    $('challenge-reset-no').addEventListener('click',()=>{$('challenge-reset-confirm').hidden=true;focus($('challenge-restart'));});
    $('challenge-reset-yes').addEventListener('click',()=>{editState(s=>Object.assign(s,fresh()));focus($('challenge-question-title'));});
    for(const button of dialog.querySelectorAll('[data-challenge-step]'))button.addEventListener('click',()=>goStep(Number(button.dataset.challengeStep)));
    for(const button of dialog.querySelectorAll('[data-challenge-task]'))button.addEventListener('click',()=>showHint(button.dataset.challengeTask));
    for(const kind of ['html','css']) {
      const editor = $('challenge-'+kind+'-editor');
      editor.addEventListener('input',event=>onInput(kind,event));
      editor.addEventListener('scroll',()=>highlight(kind));
      editor.addEventListener('compositionstart',()=>{composing=true;});
      editor.addEventListener('compositionend',()=>{composing=false;state[kind]=editor.value;save();highlight(kind);updatePreview();updateChecklist();});
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape' && !$('challenge-reset-confirm').hidden){event.preventDefault();event.stopPropagation();$('challenge-reset-confirm').hidden=true;focus($('challenge-restart'));return;}
      if((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase()==='z' && !event.isComposing && !composing){event.preventDefault();event.stopPropagation();event.shiftKey?redo():undo();}
    });
    render();
  }
  function taskMarkup() {
    const tasks = [
      ['name','名前','ソラ'],
      ['description','説明文','好きなことはゲームと音楽。'],
      ['background','背景の色','#dbeafe'],
      ['heading','名前の色','#1d4ed8'],
      ['imageSize','画像の幅','64px'],
      ['border','枠線','12px outset #334155']
    ];
    return tasks.map((task,index)=>'<button type="button" id="challenge-task-'+task[0]+'" data-challenge-task="'+task[0]+'" data-instruction="'+escape(task[1]+'を'+task[2]+'にする')+'" aria-expanded="false" aria-controls="challenge-feedback" class="challenge-task"><span class="challenge-task-top"><span class="challenge-task-mark">'+(index+1)+'</span><span>'+escape(task[1])+'</span><span class="challenge-task-hint" title="ヒント" aria-hidden="true">?</span></span><strong>'+(task[0] === 'border' ? '<span>12px outset</span><span>#334155</span>' : escape(task[2]))+'</strong></button>').join('');
  }
  function open() {
    if(!dialog)init({}); if(opened)return;
    returnFocus=document.activeElement; hooks.onOpen && hooks.onOpen(); opened=true;
    document.body.classList.add('challenge-open');
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    render(); focus($('challenge-close')); repaintEditors();
  }
  function close() {
    if(!opened)return;endTyping();save();opened=false;document.body.classList.remove('challenge-open');
    if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
    hooks.onClose && hooks.onClose(); if(returnFocus && returnFocus.isConnected && returnFocus.focus)focus(returnFocus);
  }
  root.PixelChallenge={init,open,close,isOpen:()=>opened};
})(window);
