(function (root) {
  'use strict';
  const MAX_FILE = 8 * 1024 * 1024;
  const MAX_ASSETS = 8;
  const MAX_TOTAL = 2000000;
  let hooks, host, selected = 'assets/mint.svg', uploadRun = 0, busy = false, lastRenderedPath = '', targetSnapshot = [], targetPageSnapshot = 'html';
  const $ = id => host.querySelector('#' + id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr = (tag, name) => {
    const node = new DOMParser().parseFromString(tag, 'text/html').querySelector('img');
    return node ? node.getAttribute(name) || '' : '';
  };
  // Keep the author's whitespace and all other attributes exactly as written.
  function setAttribute(tag, name, value) {
    const text = name + '="' + esc(value) + '"';
    let i = tag.search(/<img\b/i) + 4;
    while (i < tag.length) {
      while (/\s/.test(tag[i] || '') && i < tag.length) i++;
      if (i >= tag.length || tag[i] === '>' || tag[i] === '/') break;
      const start = i;
      while (i < tag.length && !/[\s=<>/]/.test(tag[i])) i++;
      if (i === start) {i++; continue;}
      const attrName = tag.slice(start, i).toLowerCase(), nameEnd = i;
      while (/\s/.test(tag[i] || '') && i < tag.length) i++;
      let end = nameEnd;
      if (tag[i] === '=') {
        i++;
        while (/\s/.test(tag[i] || '') && i < tag.length) i++;
        const quote = tag[i];
        if (quote === '"' || quote === "'") {
          i++;
          while (i < tag.length && tag[i] !== quote) i++;
          if (i < tag.length) i++;
        } else {
          while (i < tag.length && !/[\s>]/.test(tag[i])) i++;
        }
        end = i;
      }
      if (attrName === name.toLowerCase()) return tag.slice(0, start) + text + tag.slice(end);
    }
    return tag.replace(/\s*\/?>$/, ending => ' ' + text + ending);
  }

  function images(source) {
    const found = [];
    const re = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
    for (const match of String(source || '').matchAll(re)) {
      if (!/^<img\b/i.test(match[0])) continue;
      found.push({tag:match[0], at:match.index, src:attr(match[0], 'src'), alt:attr(match[0], 'alt'), classes:attr(match[0], 'class').split(/\s+/)});
    }
    return found;
  }
  function replaceImage(source, item, path, alt) {
    const tag = setAttribute(setAttribute(item.tag, 'src', path), 'alt', alt);
    return source.slice(0, item.at) + tag + source.slice(item.at + item.tag.length);
  }
  const pageKey = s => s.activePage === 'about.html' ? 'aboutHtml' : 'html';
  const pageLabel = s => s.activePage === 'about.html' ? 'about.html' : 'index.html';
  function choices() {
    const s = hooks.getState();
    const builtins = Object.entries(root.PixelCore.CHARACTERS).map(([id, meta]) => ({id, path:'assets/' + id + '.svg', name:meta.name, alt:meta.alt, dataURL:root.PIXEL_ART?.[id] || 'assets/' + id + '.svg', builtin:true}));
    return builtins.concat(s.assets || []);
  }
  function used(path) {
    const s = hooks.getState();
    return [s.html, s.aboutHtml, s.css].some(source => String(source || '').includes(path));
  }
  function status(text, error) {
    $('image-status').textContent = text;
    $('image-status').classList.toggle('is-error', !!error);
  }
  function setBusy(value) {
    busy = value;
    $('image-file').disabled = value;
    $('image-upload-button').disabled = value;
    $('image-upload-button').textContent = value ? '画像を読み込み中…' : '画像ファイルを選ぶ';
    $('image-drop').setAttribute('aria-busy', String(value));
    $('image-drop').setAttribute('aria-disabled', String(value));
    $('image-apply').disabled = value || !choices().some(x => x.path === selected);
  }
  function populateTargets() {
    const s = hooks.getState(), select = $('image-target'), old = select.value;
    select.replaceChildren();
    const add = (value, text, disabled = false) => {const option = new Option(text, value); option.disabled = disabled; select.add(option);};
    const paired = images(s.html).some(x => x.classes.includes('character')) || images(s.aboutHtml).some(x => x.classes.includes('character'));
    add('character', 'キャラ画像（2ページ共通）', !paired);
    targetPageSnapshot = pageKey(s);
    targetSnapshot = images(s[targetPageSnapshot]);
    targetSnapshot.forEach((item, index) => add('img:' + index, pageLabel(s) + ' の画像' + (index + 1) + (item.alt ? '：' + item.alt.slice(0, 24) : '')));
    add('append', '新しい画像として追加（' + pageLabel(s) + '）');
    if ([...select.options].some(x => x.value === old && !x.disabled)) select.value = old;
    else select.value = paired ? 'character' : 'append';
    $('image-target-note').textContent = select.value === 'character' ? 'プロフィールとリンク先のキャラが一緒に変わります。' : 'いま開いている ' + pageLabel(s) + ' に使います。';
  }
  function showSelection(keepInputs = false) {
    const item = choices().find(x => x.path === selected);
    if (!item) return;
    $('image-chosen-preview').src = item.dataURL;
    $('image-chosen-preview').alt = item.alt;
    $('image-path').value = item.path;
    $('image-size').textContent = item.width && item.height ? item.width + ' × ' + item.height + ' px' : '教材のキャラ画像';
    if (!keepInputs || lastRenderedPath !== item.path) {
      $('image-name').value = item.name || '';
      $('image-alt').value = item.alt || '';
    }
    lastRenderedPath = item.path;
    $('image-name').readOnly = !!item.builtin;
    $('image-name-row').hidden = !!item.builtin;
    $('image-apply').disabled = busy;
    for (const button of host.querySelectorAll('[data-image-path]')) button.setAttribute('aria-pressed', String(button.dataset.imagePath === selected));
  }
  function choose(path) {
    selected = path;
    showSelection();
    status('選んだ画像を下で確認し「この画像を使う」を押してください。');
  }
  function refresh() {
    if (!host || !hooks) return;
    const items = choices();
    if (!items.some(x => x.path === selected)) selected = items[0]?.path || '';
    const list = $('image-list');
    list.replaceChildren();
    for (const item of items) {
      const cell = document.createElement('div'); cell.className = 'image-choice-cell';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'image-choice'; button.dataset.imagePath = item.path;
      button.setAttribute('aria-pressed', String(item.path === selected));
      const img = document.createElement('img'); img.src = item.dataURL; img.alt = ''; img.loading = 'lazy';
      const name = document.createElement('span'); name.textContent = item.name;
      const label = document.createElement('small'); label.textContent = item.builtin ? '教材の画像' : '追加した画像';
      button.append(img, name, label); button.addEventListener('click', () => choose(item.path)); cell.append(button);
      if (!item.builtin) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'image-remove';
        remove.disabled = used(item.path); remove.textContent = remove.disabled ? '使用中' : '削除';
        remove.title = remove.disabled ? '使っている画像は削除できません。別の画像に変えてから削除できます。' : item.name + 'を削除';
        remove.addEventListener('click', () => {
          if (used(item.path)) {status('この画像はページで使われています。', true); return;}
          hooks.commit(s => {s.assets = (s.assets || []).filter(x => x.path !== item.path);});
          refresh(); status('画像を削除しました。「1つ前に戻す」で戻せます。');
        });
        cell.append(remove);
      }
      list.append(cell);
    }
    $('image-count').textContent = '追加した画像 ' + (hooks.getState().assets || []).length + ' / ' + MAX_ASSETS;
    populateTargets(); showSelection(true);
  }
  function headerDimensions(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return {type:'image/png', width:view.getUint32(16), height:view.getUint32(20)};
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
      const chunk = String.fromCharCode(...bytes.slice(12,16));
      if (chunk === 'VP8X' && bytes.length >= 30) return {type:'image/webp',width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
      if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) return {type:'image/webp',width:1+bytes[21]+((bytes[22]&63)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
      if (chunk === 'VP8 ' && bytes.length >= 30) return {type:'image/webp',width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
      return {type:'image/webp'};
    }
    if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
      let p = 2;
      while (p + 3 < bytes.length) {
        if (bytes[p] !== 255) break;
        while (bytes[p] === 255) p++;
        const marker = bytes[p++];
        if (marker === 0xD9 || marker === 0xDA) break;
        if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
        if (p + 1 >= bytes.length) break;
        const len = view.getUint16(p);
        if (len < 2 || p + len > bytes.length) break;
        if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker) && len >= 7) return {type:'image/jpeg',width:view.getUint16(p+5),height:view.getUint16(p+3)};
        p += len;
      }
      return {type:'image/jpeg'};
    }
    throw new Error('PNG・JPEG・WebPの画像を選んでください。');
  }
  function checkDimensions(width, height) {
    if (width > 8192 || height > 8192 || width * height > 32000000) throw new Error('画像が大きすぎます。縦横8192px以内・3200万画素以内の画像を使ってください。');
    if (width < 1 || height < 1) throw new Error('画像の大きさを読み取れませんでした。別の画像を選んでください。');
  }
  async function processFile(file) {
    if (file.size > MAX_FILE) throw new Error('8MB以下の画像を選んでください。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = headerDimensions(bytes);
    if (header.width && header.height) checkDimensions(header.width, header.height);
    const url = URL.createObjectURL(new Blob([bytes], {type:header.type}));
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => {image.src = ''; reject(new Error('画像の読み込みに時間がかかっています。別の画像を選んでください。'));}, 15000);
        image.onload = () => {clearTimeout(timer); resolve(image);};
        image.onerror = () => {clearTimeout(timer); reject(new Error('画像を開けませんでした。画像が壊れていないか確認してください。'));};
        image.src = url;
      });
      checkDimensions(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('画像を処理できませんでした。ページを開き直して試してください。');
      let dataURL;
      for (const edge of [768, 576, 432]) {
        const ratio = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        context.imageSmoothingEnabled = true;
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataURL = canvas.toDataURL('image/webp', .86);
        if (dataURL.length <= 500000) break;
      }
      if (!dataURL || dataURL === 'data:,' || dataURL.length > 500000) throw new Error('画像を保存できる大きさにできませんでした。小さな画像で試してください。');
      return {dataURL, width:canvas.width, height:canvas.height};
    } finally {URL.revokeObjectURL(url);}
  }
  function uploadSnapshot() {
    const s = hooks.getState();
    return JSON.stringify([s.html, s.aboutHtml, s.activePage, (s.assets || []).map(x => [x.id, x.path, x.dataURL.length])]);
  }
  async function upload(files) {
    if (busy) return;
    const list = [...files];
    if (!list.length) return;
    if (list.length > 1) {status('画像は1枚ずつ追加してください。', true); return;}
    if ((hooks.getState().assets || []).length >= MAX_ASSETS) {status('追加できる画像は8枚までです。使っていない画像を削除してください。', true); return;}
    const run = ++uploadRun, snapshot = uploadSnapshot();
    setBusy(true); status('画像を読み込んでいます…');
    try {
      const processed = await processFile(list[0]);
      if (run !== uploadRun) return;
      if (uploadSnapshot() !== snapshot) throw new Error('読み込み中に編集内容が変わりました。画像をもう一度選んでください。');
      const current = hooks.getState().assets || [];
      if (current.length >= MAX_ASSETS || current.reduce((sum, x) => sum + x.dataURL.length, 0) + processed.dataURL.length > MAX_TOTAL) throw new Error('画像の保存容量がいっぱいです。使っていない画像を削除してください。');
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 12) : Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const name = (list[0].name.replace(/\.[^.]+$/, '') || '自分の画像').slice(0, 50);
      const path = 'uploads/img-' + id + (processed.dataURL.startsWith('data:image/webp;') ? '.webp' : '.png');
      hooks.commit(s => {s.assets = [...(s.assets || []), {id, path, name, alt:'', ...processed}];});
      selected = path; refresh();
      status('画像を追加しました。使う場所と説明を確認して「この画像を使う」を押してください。');
    } catch (error) {
      if (run === uploadRun) status(error.message || '画像を読み込めませんでした。', true);
    } finally {
      if (run === uploadRun) {setBusy(false); $('image-file').value = '';}
    }
  }
  function apply() {
    const item = choices().find(x => x.path === selected);
    if (busy) return;
    if (!item) {refresh(); status('選んだ画像が見つかりません。画像を選び直してください。', true); return;}
    const s = hooks.getState(), target = $('image-target').value, alt = $('image-alt').value.trim().slice(0, 240), name = $('image-name').value.trim().slice(0, 50) || item.name;
    const changes = [];
    if (target !== 'character' && targetPageSnapshot !== pageKey(s)) {populateTargets(); status('開いているページが変わりました。使う場所を選び直してください。', true); return;}
    if (target === 'character') {
      for (const [key, className] of [['html','character'],['aboutHtml','character']]) {
        const found = images(s[key]).find(x => x.classes.includes(className));
        if (found) changes.push([key, replaceImage(s[key], found, item.path, alt)]);
      }
      if (!changes.length) {status('キャラのimgタグが見つかりません。使う場所を選び直してください。', true); populateTargets(); return;}
    } else if (target.startsWith('img:')) {
      const key = pageKey(s), found = images(s[key])[Number(target.slice(4))];
      if (!found || found.tag !== targetSnapshot[Number(target.slice(4))]?.tag) {status('HTMLの画像が変わりました。使う場所を選び直してください。', true); populateTargets(); return;}
      changes.push([key, replaceImage(s[key], found, item.path, alt)]);
    } else {
      const key = pageKey(s), source = s[key] || '';
      const tag = '    <img class="uploaded-image" src="' + esc(item.path) + '" alt="' + esc(alt) + '" width="256">\n';
      const closing = /<\/main\s*>/i.test(source) ? /<\/main\s*>/i : /<\/body\s*>/i;
      changes.push([key, closing.test(source) ? source.replace(closing, match => tag + '  ' + match) : source + '\n' + tag]);
    }
    hooks.commit(next => {
      for (const [key, source] of changes) next[key] = source;
      if (!item.builtin) next.assets = (next.assets || []).map(x => x.path === item.path ? {...x, name, alt} : x);
    });
    hooks.onApplied({path:item.path, htmlNeedle:'src="' + esc(item.path) + '"'});
    hooks.notify('画像を変えました。srcの場所と表示を見比べてみよう。');
  }
  function init(options) {
    hooks = options; host = document.getElementById('image-manager');
    if (!host) throw new Error('Image manager container is missing.');
    host.innerHTML = `<section class="image-step"><div class="image-step-title"><span>1</span><h3>画像を選ぶ・追加する</h3><small id="image-count"></small></div><div id="image-drop" class="image-drop" role="group" aria-label="画像をここにドロップ、または押してファイルを選ぶ"><strong>ここに画像をドロップ</strong><span>PNG・JPEG・WebP / 1枚8MBまで</span><button id="image-upload-button" type="button">画像ファイルを選ぶ</button><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></div><p class="image-privacy">画像はこのブラウザに保存されます。作品を保存すると画像も一緒に入ります。</p><div id="image-list" class="image-list" aria-label="使える画像"></div></section><section class="image-step"><div class="image-step-title"><span>2</span><h3>どこに使うか</h3></div><label class="image-field" for="image-target">使う場所<select id="image-target"></select></label><p id="image-target-note" class="image-hint"></p><div class="image-selection"><div class="image-chosen-box"><img id="image-chosen-preview" alt=""><small id="image-size"></small></div><div class="image-fields"><label id="image-name-row" class="image-field" for="image-name">画像の名前<input id="image-name" maxlength="50" placeholder="画像一覧に表示する名前"></label><label class="image-field" for="image-alt">画像の説明（alt）<input id="image-alt" maxlength="240" placeholder="例：青いマントをつけたキャラ"></label><p class="image-hint">画像が表示されないときなどに使う説明です。飾りだけの画像なら空欄にできます。</p><label class="image-field" for="image-path">HTMLのsrcに書く画像の場所<div class="image-path-row"><input id="image-path" readonly><button id="image-copy-path" type="button">コピー</button></div></label></div></div></section><div class="image-final"><button id="image-apply" type="button"><span>3</span> この画像を使う</button><p>押すとHTMLのsrcとaltが変わります。</p></div><p id="image-status" class="image-status" role="status" aria-live="polite"></p>`;
    const style = document.createElement('style'); style.id = 'image-manager-style'; style.textContent = STYLES;
    if (!document.getElementById(style.id)) document.head.append(style);
    const file = $('image-file'), drop = $('image-drop');
    $('image-upload-button').addEventListener('click', e => {e.stopPropagation(); if (!busy) file.click();});
    drop.addEventListener('click', e => {if (e.target !== file && !busy) file.click();});
    drop.addEventListener('keydown', e => {if (e.target === drop && ['Enter',' '].includes(e.key)) {e.preventDefault(); if (!busy) file.click();}});
    file.addEventListener('change', () => {void upload(file.files || []);});
    for (const kind of ['dragenter','dragover']) drop.addEventListener(kind, e => {e.preventDefault(); drop.classList.add('is-dragging');});
    drop.addEventListener('dragleave', e => {if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-dragging');});
    drop.addEventListener('drop', e => {e.preventDefault(); drop.classList.remove('is-dragging'); void upload(e.dataTransfer?.files || []);});
    $('image-target').addEventListener('change', () => {const s=hooks.getState(); $('image-target-note').textContent = $('image-target').value === 'character' ? 'プロフィールとリンク先のキャラが一緒に変わります。' : 'いま開いている ' + pageLabel(s) + ' に使います。';});
    $('image-apply').addEventListener('click', apply);
    $('image-copy-path').addEventListener('click', async () => {
      try {await navigator.clipboard.writeText($('image-path').value); status('画像の場所をコピーしました。imgタグのsrcに貼り付けて使えます。');}
      catch (_) {$('image-path').focus(); $('image-path').select(); status('画像の場所を選択しました。⌘Cでコピーできます。');}
    });
    host.closest('dialog')?.addEventListener('close', () => {uploadRun++; lastRenderedPath = ''; setBusy(false); file.value = '';});
    refresh();
  }
  const STYLES = `#assets-dialog:has(#image-manager){width:min(820px,calc(100vw - 28px))}#image-manager{font-size:18px;font-weight:500;line-height:1.7;color:var(--ink,#203832)}#image-manager button,#image-manager input,#image-manager select{font:inherit}#image-manager button{cursor:pointer}#image-manager button:disabled{cursor:default;color:#4a5551;background:#e7ebe5;border-color:#a8b3ad}#image-manager .image-step{margin:18px 0 24px}#image-manager .image-step-title{display:flex;align-items:center;gap:10px;margin-bottom:12px}#image-manager .image-step-title>span,#image-manager #image-apply>span{display:inline-grid;place-items:center;min-width:27px;height:27px;background:#263d37;color:white;font-weight:800}#image-manager .image-step-title h3{font-size:20px;margin:0}#image-manager .image-step-title>small{margin-left:auto;font-size:14px;color:#3e5147}#image-manager .image-drop{border:2px dashed #8faca0;padding:15px;background:#f3f7ee;display:grid;grid-template-columns:1fr auto;gap:3px 16px;align-items:center;border-radius:8px}#image-manager .image-drop>strong{font-size:18px}#image-manager .image-drop>span{font-size:16px;color:#3e5147}#image-manager .image-drop>button{grid-column:2;grid-row:1/3;border:1px solid #263d37;padding:10px 14px;background:white;border-radius:5px;min-height:44px}#image-manager .image-drop.is-dragging{border-color:#5c3ad4;background:#ebe6ff}#image-manager .image-privacy{font-size:16px;color:#3e5147;margin:7px 0 13px}#image-manager .image-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}#image-manager .image-choice-cell{min-width:0;position:relative}#image-manager .image-choice{display:flex;flex-direction:column;align-items:center;width:100%;border:2px solid #d6dfd4;background:#fff;padding:8px 4px;border-radius:7px;gap:2px;min-height:133px}#image-manager .image-choice[aria-pressed=true]{border-color:#6543d7;background:#f1edff;box-shadow:0 0 0 1px #6543d7}#image-manager .image-choice>img{width:100%;height:76px;object-fit:contain;image-rendering:pixelated}#image-manager .image-choice>span{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px;font-weight:700}#image-manager .image-choice>small{font-size:14px;color:#3e5147}#image-manager .image-remove{display:block;margin:5px auto 0;border:0;background:transparent;text-decoration:underline;font-size:16px;min-height:28px}#image-manager .image-field{display:flex;flex-direction:column;gap:6px;font-weight:650;font-size:18px}#image-manager .image-field input,#image-manager .image-field select{width:100%;min-width:0;min-height:46px;border:1px solid #aebdb2;border-radius:5px;background:#fff;padding:8px 10px;color:#203832}#image-manager input::placeholder{color:#53655e;opacity:1}#image-manager .image-hint{font-size:16px;color:#3e5147;margin:7px 0 12px}#image-manager .image-selection{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;align-items:start;margin-top:16px}#image-manager .image-chosen-box{background:repeating-conic-gradient(#e7ebe5 0 25%,#f8faf6 0 50%) 0/18px 18px;border:1px solid #d4ddd0;display:flex;flex-direction:column;align-items:center;padding:10px;border-radius:6px}#image-manager .image-chosen-box img{width:100%;height:150px;object-fit:contain;image-rendering:pixelated}#image-manager .image-chosen-box small{font-size:14px;padding:3px 6px;background:#fff;border-radius:3px}#image-manager .image-fields{display:grid;gap:10px}#image-manager .image-fields .image-hint{margin:0}#image-manager .image-path-row{display:flex;gap:6px}#image-manager #image-path{font-family:monospace;font-size:16px;background:#f4f6ef}#image-manager .image-path-row button{border:1px solid #aebdb2;background:#fff;border-radius:5px;flex-shrink:0;padding:7px 10px}#image-manager .image-final{display:flex;align-items:center;gap:14px;padding-top:10px;border-top:1px solid #d4ddd0}#image-manager #image-apply{background:#d7f39a;border:2px solid #263d37;border-radius:5px;padding:10px 16px;font-size:18px;font-weight:800;box-shadow:3px 3px 0 #263d37;display:flex;gap:9px;align-items:center;flex-shrink:0}#image-manager .image-final>p{font-size:16px;color:#3e5147}#image-manager .image-status{font-size:16px;min-height:20px;margin:14px 0 0;color:#466033}#image-manager .image-status.is-error{color:#a12f36}#image-manager :focus-visible{outline:3px solid #8354e6;outline-offset:3px}@media(max-width:600px){#image-manager .image-list{grid-template-columns:repeat(3,minmax(0,1fr))}#image-manager .image-drop{display:flex;flex-direction:column;text-align:center;gap:7px}#image-manager .image-selection{grid-template-columns:110px minmax(0,1fr);gap:12px}#image-manager .image-chosen-box img{height:105px}#image-manager .image-final{flex-direction:column;align-items:stretch;gap:5px}#image-manager #image-apply{justify-content:center}#image-manager .image-step-title>small{font-size:14px}}@media(max-width:410px){#image-manager .image-selection{grid-template-columns:1fr}#image-manager .image-chosen-box{max-width:160px;margin:auto}}`;
  root.PixelImages = {init, refresh};
})(window);
