(function (root) {
  'use strict';
  const SWATCHES = [
    ['白', '#FFFFFF'], ['黒', '#172B4D'], ['赤', '#E5484D'], ['オレンジ', '#F97316'],
    ['黄', '#FACC15'], ['黄緑', '#84CC16'], ['緑', '#16A34A'], ['ミント', '#2DD4BF'],
    ['水色', '#38BDF8'], ['青', '#2563EB'], ['紫', '#8B5CF6'], ['ピンク', '#EC4899']
  ];
  let panel, trigger, hooks = {}, chosen = '#2563EB', hsv = {h:0,s:0,v:0}, sourceSelection = null, copyRun = 0, drag = null;
  const $ = id => document.getElementById(id);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function normalize(value) {
    const text = String(value || '').trim();
    if (/^#[\da-f]{6}$/i.test(text)) return text.toUpperCase();
    if (/^#[\da-f]{3}$/i.test(text)) return '#' + [...text.slice(1)].map(c => c + c).join('').toUpperCase();
    return null;
  }
  function hexToRGB(hex) {
    const value = normalize(hex);
    if (!value) return null;
    return [1,3,5].map(at => parseInt(value.slice(at,at+2),16));
  }
  function rgbToHSV(rgb) {
    const [r,g,b] = rgb.map(value=>value/255), max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min;
    let h = 0;
    if (delta) {
      if (max === r) h = ((g-b)/delta) % 6;
      else if (max === g) h = (b-r)/delta + 2;
      else h = (r-g)/delta + 4;
      h = (h*60+360)%360;
    }
    return {h,s:max ? delta/max*100 : 0,v:max*100};
  }
  function hsvToRGB({h,s,v}) {
    const hue = ((h%360)+360)%360, sat = clamp(s,0,100)/100, val = clamp(v,0,100)/100;
    const chroma = val*sat, x = chroma*(1-Math.abs(hue/60%2-1)), m = val-chroma;
    const bands = [[chroma,x,0],[x,chroma,0],[0,chroma,x],[0,x,chroma],[x,0,chroma],[chroma,0,x]];
    return bands[Math.floor(hue/60)].map(value=>Math.round((value+m)*255+1e-10));
  }
  function rgbToHex(rgb) { return '#' + rgb.map(n=>clamp(Math.round(n),0,255).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function rgbToHSL(rgb) {
    const color = rgbToHSV(rgb), [r,g,b] = rgb.map(value=>value/255), max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min, l = (max+min)/2;
    return {h:color.h,s:delta ? delta/(1-Math.abs(2*l-1))*100 : 0,l:l*100};
  }
  function rememberSource(node = document.activeElement) {
    if (!node || !['html-editor', 'css-editor'].includes(node.id)) return;
    sourceSelection = {node, start:node.selectionStart || 0, end:node.selectionEnd || 0,
      direction:node.selectionDirection || 'none', top:node.scrollTop, left:node.scrollLeft};
  }
  function restoreSource(saved = sourceSelection) {
    if (!saved || !saved.node.isConnected) return false;
    const {node, start, end, direction, top, left} = saved;
    node.focus({preventScroll:true});
    node.setSelectionRange(start, end, direction);
    node.scrollTop = top;
    node.scrollLeft = left;
    return true;
  }
  function status(text) { $('palette-status').textContent = text; }
  function render(preserveText = false) {
    const rgb = hexToRGB(chosen), actualHSV = rgbToHSV(rgb), hsl = rgbToHSL(rgb);
    if (!preserveText) $('palette-code').value = chosen;
    $('palette-code').removeAttribute('aria-invalid');
    $('palette-custom').value = chosen;
    $('palette-preview').style.backgroundColor = chosen;
    $('palette-preview').setAttribute('aria-label', '選んだ色 ' + chosen);
    $('palette-sv').style.backgroundColor = 'hsl(' + hsv.h + ' 100% 50%)';
    $('palette-cursor').style.left = hsv.s + '%';
    $('palette-cursor').style.top = (100-hsv.v) + '%';
    $('palette-sv').setAttribute('aria-label', '鮮やかさ ' + Math.round(hsv.s) + '%、明るさ ' + Math.round(hsv.v) + '%。左右キーで鮮やかさ、上下キーで明るさを変えます');
    $('palette-hue').value = String(Math.round(hsv.h));
    $('palette-hue').style.setProperty('--hue-color', 'hsl(' + hsv.h + ' 100% 50%)');
    $('palette-hue').setAttribute('aria-valuetext', Math.round(hsv.h) + '度');
    $('palette-rgb').textContent = rgb.join(', ');
    $('palette-hsv').textContent = Math.round(actualHSV.h) + '°, ' + Math.round(actualHSV.s) + '%, ' + Math.round(actualHSV.v) + '%';
    $('palette-hsl').textContent = Math.round(hsl.h) + '°, ' + Math.round(hsl.s) + '%, ' + Math.round(hsl.l) + '%';
    for (const button of panel.querySelectorAll('[data-palette-color]')) button.setAttribute('aria-pressed', String(button.dataset.paletteColor === chosen));
  }
  function choose(value, preserveText = false) {
    const hex = normalize(value);
    if (!hex) return false;
    chosen = hex;
    const next = rgbToHSV(hexToRGB(hex));
    // Grey and black retain the last hue, so dragging out of them remains predictable.
    hsv = {h:next.s ? next.h : hsv.h,s:next.s,v:next.v};
    render(preserveText);
    status('コピーして、CSSの色コード（#〜）に貼り付けよう。');
    return true;
  }
  function chooseHSV(next) {
    hsv = {h:clamp(next.h,0,360),s:clamp(next.s,0,100),v:clamp(next.v,0,100)};
    chosen = rgbToHex(hsvToRGB(hsv));
    render();
    status('コピーして、CSSの色コード（#〜）に貼り付けよう。');
  }
  function commitHex() {
    if (choose($('palette-code').value)) return true;
    $('palette-code').setAttribute('aria-invalid','true');
    status('「#32807E」のように入力しよう。#の後は3桁か6桁です。');
    return false;
  }
  function place() {
    if (!panel || panel.hidden) return;
    const margin = 10, anchor = trigger.getBoundingClientRect(), viewport = root.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0) + margin, topEdge = (viewport?.offsetTop || 0) + margin;
    const width = viewport?.width || root.innerWidth, height = viewport?.height || root.innerHeight;
    const rightEdge = leftEdge + width - 2 * margin, bottomEdge = topEdge + height - 2 * margin;
    panel.style.maxHeight = Math.max(120, height - 2 * margin) + 'px';
    const rect = panel.getBoundingClientRect();
    let left = anchor.right + margin;
    if (left + rect.width > rightEdge) left = anchor.left - rect.width - margin;
    if (left < leftEdge) left = Math.min(anchor.left, rightEdge - rect.width);
    panel.style.left = Math.max(leftEdge, left) + 'px';
    panel.style.top = Math.max(topEdge, Math.min(anchor.top, bottomEdge - rect.height)) + 'px';
  }
  function open(value) {
    if (!panel) init();
    if (!panel) return;
    root.PixelFonts?.close(false);
    root.PixelCodeHelp?.hide();
    rememberSource();
    if (!sourceSelection && $('css-editor')) rememberSource($('css-editor'));
    if (value) choose(value);
    else if (sourceSelection) {
      const {node, start, end} = sourceSelection, selected = normalize(node.value.slice(start, end));
      if (selected) choose(selected);
    }
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
  }
  function stopDrag(event) {
    if (!drag || event && event.pointerId !== undefined && event.pointerId !== drag.id) return;
    const id = drag.id;
    drag = null;
    try { $('palette-sv').releasePointerCapture?.(id); } catch (_) { /* pointer may have ended */ }
  }
  function close(restore = true) {
    if (!panel || panel.hidden) return;
    stopDrag();
    const focusedInside = panel.contains(document.activeElement);
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    copyRun++;
    if (restore && focusedInside && !restoreSource()) trigger.focus({preventScroll:true});
  }
  function pointColor(event) {
    const rect = $('palette-sv').getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    chooseHSV({...hsv,s:clamp((event.clientX-rect.left)/rect.width,0,1)*100,v:(1-clamp((event.clientY-rect.top)/rect.height,0,1))*100});
  }
  async function copy() {
    if (!commitHex()) { $('palette-code').focus({preventScroll:true}); return; }
    const text = chosen, saved = sourceSelection, run = ++copyRun;
    try {
      if (!root.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
      await root.navigator.clipboard.writeText(text);
      if (run !== copyRun || panel.hidden) return;
      status(text + ' をコピーしました。CSSに貼り付けてみよう。');
      restoreSource(saved);
      hooks.notify?.(text + ' をコピーしました。');
    } catch (_) {
      if (run !== copyRun || panel.hidden) return;
      const field = $('palette-code');
      field.focus({preventScroll:true});
      field.select();
      const mac = /Mac|iPhone|iPad/.test(root.navigator?.platform || root.navigator?.userAgent || '');
      status((mac ? '⌘C' : 'Ctrl+C') + 'でコピーして、CSSの色コード（#〜）に貼り付けよう。');
    }
  }
  function init(options = {}) {
    hooks = options;
    if (panel) return;
    trigger = $('palette-open');
    if (!trigger) return;
    panel = document.createElement('section');
    panel.id = 'color-palette';
    panel.className = 'color-palette';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'palette-title');
    panel.innerHTML = `<div class="palette-heading"><h2 id="palette-title">色を選ぶ</h2><button id="palette-close" type="button" aria-label="カラーパレットを閉じる">閉じる ×</button></div>
      <div class="palette-board"><div id="palette-preview" role="img" aria-label="選んだ色"></div><div id="palette-sv" tabindex="0" role="group" aria-describedby="palette-key-help"><span id="palette-cursor" aria-hidden="true"></span></div></div>
      <p id="palette-key-help">面の中をドラッグして選ぶ。矢印キーでも動かせます。</p>
      <div class="palette-hue-row"><label for="palette-hue">色合い</label><input id="palette-hue" type="range" min="0" max="360" step="1" value="0"></div>
      <div class="palette-code-row"><label for="palette-code">HEX</label><input id="palette-code" type="text" spellcheck="false" autocomplete="off" autocapitalize="characters" maxlength="7" value="${chosen}" aria-describedby="palette-status"><button id="palette-copy" type="button">コピー</button></div>
      <div class="palette-values"><div><span>RGB</span><output id="palette-rgb"></output></div><div><span>HSV</span><output id="palette-hsv"></output></div><div><span>HSL</span><output id="palette-hsl"></output></div></div>
      <details id="palette-presets"><summary>色の候補</summary><div class="palette-swatches" role="group" aria-label="色の候補">${SWATCHES.map(([name, hex]) => `<button type="button" class="palette-swatch" data-palette-color="${hex}" aria-pressed="false" aria-label="${name} ${hex}" title="${name} ${hex}"><span style="background:${hex}" aria-hidden="true"></span><span class="sr-only">${name}</span></button>`).join('')}</div></details>
      <input id="palette-custom" type="color" value="${chosen}" aria-label="色を選ぶ" hidden tabindex="-1">
      <p id="palette-status" role="status" aria-live="polite"></p>`;
    document.body.append(panel);
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('pointerdown', () => rememberSource());
    trigger.addEventListener('click', () => {
      if (!panel.hidden) return close();
      open();
      $('palette-sv').focus({preventScroll:true});
    });
    $('palette-close').addEventListener('click', () => close());
    $('palette-copy').addEventListener('click', copy);
    for (const button of panel.querySelectorAll('[data-palette-color]')) button.addEventListener('click', () => choose(button.dataset.paletteColor));
    $('palette-custom').addEventListener('input', event => choose(event.target.value));
    $('palette-custom').addEventListener('change', event => choose(event.target.value));
    $('palette-code').addEventListener('input', event => {
      event.target.removeAttribute('aria-invalid');
      if (/^#[\da-f]{6}$/i.test(event.target.value)) choose(event.target.value,true);
    });
    $('palette-code').addEventListener('change', commitHex);
    $('palette-code').addEventListener('keydown', event => { if (event.key==='Enter') { event.preventDefault(); commitHex(); } });
    $('palette-code').addEventListener('copy', () => {
      const field = $('palette-code');
      if (!normalize(field.value) || field.selectionStart!==0 || field.selectionEnd!==field.value.length) return;
      const saved = sourceSelection, copied = field.value;
      setTimeout(() => {
        if (panel.hidden) return;
        status(copied + ' をコピーしました。CSSに貼り付けてみよう。');
        restoreSource(saved);
      }, 0);
    });
    $('palette-hue').addEventListener('input', event => chooseHSV({...hsv,h:Number(event.target.value)}));
    $('palette-sv').addEventListener('pointerdown', event => {
      if (event.button!==undefined && event.button!==0 || drag) return;
      event.preventDefault();
      $('palette-sv').focus({preventScroll:true});
      drag = {id:event.pointerId};
      try { $('palette-sv').setPointerCapture?.(event.pointerId); } catch (_) { /* document handlers keep dragging available */ }
      pointColor(event);
    });
    // Document listeners also support environments without pointer capture.
    document.addEventListener('pointermove', event => { if (drag && event.pointerId===drag.id) { event.preventDefault(); pointColor(event); } });
    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
    $('palette-sv').addEventListener('lostpointercapture', stopDrag);
    root.addEventListener('blur', () => stopDrag());
    $('palette-sv').addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const step = event.shiftKey ? 10 : 1, next = {...hsv};
      if (event.key==='ArrowLeft') next.s-=step;
      else if (event.key==='ArrowRight') next.s+=step;
      else if (event.key==='ArrowUp') next.v+=step;
      else if (event.key==='ArrowDown') next.v-=step;
      else if (event.key==='Home') { next.s=0; next.v=100; }
      else if (event.key==='End') { next.s=0; next.v=0; }
      else return;
      event.preventDefault();
      chooseHSV(next);
    });
    $('palette-presets').addEventListener('toggle', place);
    document.addEventListener('keydown', event => { if (event.key==='Escape' && !panel.hidden) { event.preventDefault(); close(); } });
    document.addEventListener('selectionchange', () => rememberSource());
    for (const kind of ['html', 'css']) {
      const editor = $(kind + '-editor');
      for (const name of ['focus', 'select', 'keyup', 'mouseup', 'input']) editor?.addEventListener(name, () => rememberSource(editor));
    }
    root.addEventListener('resize', place);
    root.visualViewport?.addEventListener('resize', place);
    root.visualViewport?.addEventListener('scroll', place);
    choose(chosen);
  }
  root.PixelPalette = {init, open, close, color:{normalize,hexToRGB,rgbToHSV,hsvToRGB,rgbToHex,rgbToHSL}};
})(window);
