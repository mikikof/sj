/* ドット絵キャラをつくる — 画面の動き（計算は convert.js、ZIP は pyxel-pack.js）
 * 絵のしくみ: 「たち」は 自動の結果 ＋ 手で塗ったマス。ほかのコマは 「たち」 ＋ そのコマで手で塗ったマス。
 * 手で塗ったマスは edits（コマごとに 256 マス。-1 = 塗っていない、0 = 透明、1〜15 = 色）に持ち、自動の設定を変えても残る。 */
(function () {
  'use strict';
  const C = window.CharaConvert, P = window.PyxelPack;
  const $ = id => document.getElementById(id);
  const MAX_SIDE = 512;   // 計算に使う画像の長い辺（これより大きい画像は縮めてから使う）
  const SIZE = C.SIZE, N = SIZE * SIZE, FRAMES = 4;
  const CELL = 22;        // 3 の絵の 1 マスの大きさ（画面の画素）
  const NB = String.fromCharCode(160);   // 数と単位の間で折り返さない空白
  const FRAME_NAMES = ['たち', 'あるき', 'ジャンプ', 'わざ'];

  // 上の帯のアイコン（自分のキャラができたら、それに差し替わる）
  const DEFAULT_SPRITE = Uint8Array.from([
    '0000001111000000', '0000116666110000', '0001666666661000', '0016666666666100',
    '0166677666776610', '0166671666716610', '0166677666776610', '016e666666666e10',
    '0016666886666100', '0001666666661000', '0000111111110000', '0001cccccccc1000',
    '001cc1cccc1cc100', '0001cccccccc1000', '0000144114410000', '0000111001110000',
  ].join('').split('').map(ch => parseInt(ch, 16)));

  const newEdits = () => Array.from({ length: FRAMES }, () => new Int8Array(N).fill(-1));
  const cloneEdits = e => e.map(a => a.slice());
  const state = {
    img: null, imgCanvas: null, crop: null, marks: [], tool: 'crop',
    opts: Object.assign({}, C.DEFAULTS), result: null, drag: null, autoVivid: false,
    edits: newEdits(), frame: 0, pen: 'paint', color: 1, mirror: false,
    undo: [], redo: [], stroke: null, hover: -1,
    overlay: { on: false, alpha: 45, zoom: 100, dx: 0, dy: 0, move: false },
  };

  /* ── 絵（コマ）の組み立て ── */
  function baseGrid() { return state.result ? state.result.grid : new Uint8Array(N); }
  function withEdits(base, e) {
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) out[i] = e[i] >= 0 ? e[i] : base[i];
    return out;
  }
  function frameGrid(f) {
    const f0 = withEdits(baseGrid(), state.edits[0]);
    return f === 0 ? f0 : withEdits(f0, state.edits[f]);
  }
  function allFrames() {
    const f0 = withEdits(baseGrid(), state.edits[0]);
    return [f0, withEdits(f0, state.edits[1]), withEdits(f0, state.edits[2]), withEdits(f0, state.edits[3])];
  }
  const hasEdits = f => state.edits[f].some(v => v >= 0);

  /* ── 2 自動でととのえる（設定） ── */
  const SWITCHES = ['removeBg', 'removeHoles', 'features', 'outline', 'flip'];
  const SLIDERS = ['tolerance', 'height', 'colors', 'vivid'];
  function readOpts() {
    for (const k of SWITCHES) state.opts[k] = $('opt-' + k).checked;
    for (const k of SLIDERS) state.opts[k] = Number($('opt-' + k).value);
  }
  function writeOpts() {
    for (const k of SWITCHES) $('opt-' + k).checked = !!state.opts[k];
    for (const k of SLIDERS) $('opt-' + k).value = state.opts[k];
  }
  function updateOutputs() {
    $('out-tolerance').textContent = state.opts.tolerance;
    $('out-height').textContent = state.opts.height + NB + 'マス';
    $('out-colors').textContent = state.opts.colors + NB + '色';
    $('out-vivid').textContent = state.opts.vivid;
    $('opt-removeHoles').disabled = !state.opts.removeBg;
  }
  for (const k of SWITCHES.concat(SLIDERS)) {
    $('opt-' + k).addEventListener('input', () => { if (k === 'vivid') state.autoVivid = false; readOpts(); updateOutputs(); recompute(); });
  }
  $('opts-reset').addEventListener('click', () => {
    state.opts = Object.assign({}, C.DEFAULTS);
    writeOpts(); updateOutputs(); recompute();
  });

  /* ── 1 画像を読む ── */
  function loadViaImg(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      im.src = url;
    });
  }
  // 手で描いたコマがあるときは、消える前に確かめる
  function okToReplace() {
    if (![0, 1, 2, 3].some(hasEdits)) return true;
    return window.confirm('3 で手で描いたところが消えます。新しい画像にしますか？');
  }
  async function loadBlob(blob) {
    if (!blob || (blob.type && !/^image\//.test(blob.type))) {
      showStatus('画像のファイルではないようです。PNG か JPEG の画像をえらびます。', true);
      return;
    }
    if (!okToReplace()) return;
    try {
      let src;
      try { src = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { src = await loadViaImg(blob); }
      setImageFrom(src);
    } catch (e) {
      showStatus('この画像は開けませんでした。PNG か JPEG の画像をえらびます。', true);
    }
  }
  function resetDrawing() {
    state.edits = newEdits();
    state.undo = []; state.redo = [];
    state.overlay.dx = 0; state.overlay.dy = 0; state.overlay.zoom = 100;
    $('ov-zoom').value = 100;
  }
  function setImageFrom(src) {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    state.img = { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
    state.imgCanvas = cv;
    state.crop = null;
    state.marks = [];
    state.autoVivid = true;
    resetDrawing();
    $('dropzone').hidden = true;
    $('source-area').hidden = false;
    recompute();
  }
  $('file-input').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadBlob(f); e.target.value = ''; });

  // ページのどこに落としても受け取る（落とした画像でブラウザが別の画面に移らないように）
  let dragDepth = 0;
  document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('dropzone').classList.add('over'); });
  document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('dropzone').classList.remove('over'); });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    dragDepth = 0;
    $('dropzone').classList.remove('over');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) { loadBlob(files[0]); return; }
    showStatus('画像を受け取れませんでした。一度ダウンロードしてから、「画像をえらぶ」でえらびます。', true);
  });
  document.addEventListener('paste', e => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.kind === 'file' && /^image\//.test(it.type)) { e.preventDefault(); loadBlob(it.getAsFile()); return; }
    }
  });
  $('source-clear').addEventListener('click', () => {
    if (!okToReplace()) return;
    state.img = null; state.imgCanvas = null; state.result = null; state.crop = null; state.marks = [];
    resetDrawing();
    state.overlay.on = false; $('ov-on').checked = false;
    $('source-area').hidden = true;
    $('dropzone').hidden = false;
    run();
  });
  $('crop-reset').addEventListener('click', () => { state.crop = null; recompute(); });
  $('mark-undo').addEventListener('click', () => { state.marks.pop(); recompute(); });

  // 元の画像の上でマウスを使う道具（囲む・キャラをえらぶ・クリックで消す）
  const srcCanvas = $('source-canvas');
  const TOOL_CAPTION = {
    crop: '絵の上をドラッグして囲むと、使う範囲を変えられます。',
    select: 'キャラの中をクリックすると、そのキャラだけが残ります。何回かクリックすると、えらぶ所を足せます。',
    erase: '消したい所をクリックすると、似た色でつながる所が消えます。',
  };
  function setTool(t) {
    state.tool = t;
    for (const b of document.querySelectorAll('.tool')) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
    $('tool-caption').textContent = TOOL_CAPTION[t];
    srcCanvas.classList.toggle('pick', t !== 'crop');
  }
  for (const b of document.querySelectorAll('.tool')) b.addEventListener('click', () => setTool(b.dataset.tool));

  /* ── 計算と描画 ── */
  let pending = false;
  function recompute() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; run(); });
  }
  function convertOpts() { return Object.assign({}, state.opts, { crop: state.crop, marks: state.marks }); }
  function run() {
    if (!state.img) {
      state.result = null;
      render();
      showStatus('画像をえらぶと、ここにドット絵が出ます。画像なしで、まっさらから描くこともできます。');
      return;
    }
    state.result = C.convert(state.img, convertOpts());
    // 紙の写真（背景を白にそろえた画像）だと分かったら、はじめの 1 回だけ色をこくする
    if (state.autoVivid) {
      state.autoVivid = false;
      if (state.result.info.photoLike && state.opts.vivid === 0) {
        state.opts.vivid = 50;
        writeOpts(); updateOutputs();
        state.result = C.convert(state.img, convertOpts());
      }
    }
    const r = state.result;
    drawSource();
    render();
    if (r.info.empty && !hasEdits(0)) showStatus('キャラが見つかりません。「消す強さ」を弱くするか、「背景を消す」を外します。3 で手で描くこともできます。', true);
    else if (r.info.autoSelected) showStatus('背景がうまく消せなかったので、まん中のキャラを自動でえらびました。ちがうときは、1 の「キャラをえらぶ」でキャラをクリックします。');
    else showStatus('16×16 のドット絵になりました。3 で、1 マスずつ直せます。');
  }
  function showStatus(text, warn) {
    const el = $('result-status');
    el.textContent = text;
    el.classList.toggle('warn', !!warn);
  }

  function cropRect() {
    const img = state.img;
    return state.crop || { x: 0, y: 0, w: img.width, h: img.height };
  }

  // 元の画像。範囲の外は薄く、背景として消える所は市松模様にする
  let srcScale = 1;
  function drawSource() {
    const img = state.img, r = state.result;
    const w = img.width, h = img.height;
    const comp = new Uint8ClampedArray(img.data);
    const [ox, oy] = r.info.cropOrigin, [mw] = r.info.cropSize;
    const mh = r.info.cropSize[1];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const inside = x >= ox && x < ox + mw && y >= oy && y < oy + mh;
        if (inside && r.mask[(y - oy) * mw + (x - ox)]) {
          const c = (((x >> 3) + (y >> 3)) & 1) ? 255 : 226;
          comp[i] = comp[i + 1] = comp[i + 2] = c; comp[i + 3] = 255;
        } else if (!inside) {
          comp[i] = (comp[i] + 510) / 3; comp[i + 1] = (comp[i + 1] + 510) / 3; comp[i + 2] = (comp[i + 2] + 510) / 3; comp[i + 3] = 255;
        } else if (comp[i + 3] < 255) {
          comp[i + 3] = 255;
        }
      }
    }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d').putImageData(new ImageData(comp, w, h), 0, 0);
    const frame = srcCanvas.parentElement;
    const maxW = Math.max(120, frame.clientWidth - 18), maxH = 380;
    srcScale = Math.min(maxW / w, maxH / h);
    const dw = Math.max(1, Math.round(w * srcScale)), dh = Math.max(1, Math.round(h * srcScale));
    const dpr = window.devicePixelRatio || 1;
    srcCanvas.width = Math.round(dw * dpr); srcCanvas.height = Math.round(dh * dpr);
    srcCanvas.style.width = dw + 'px'; srcCanvas.style.height = dh + 'px';
    const ctx = srcCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = srcScale < 1;
    ctx.drawImage(off, 0, 0, dw, dh);
    const c = cropRect();
    if (state.crop) {
      ctx.strokeStyle = '#1f4a7d'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(c.x * srcScale + 1, c.y * srcScale + 1, c.w * srcScale - 2, c.h * srcScale - 2);
      ctx.setLineDash([]);
    }
    // クリックした所の印（えらぶ＝緑の丸に＋、消す＝赤の丸に×）
    for (const m of state.marks) {
      const x = m.x * srcScale, y = m.y * srcScale, rr = 8;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = m.mode === 'select' ? '#1b8a6b' : '#c0392b';
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if (m.mode === 'select') { ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); }
      else { ctx.moveTo(x - 3.5, y - 3.5); ctx.lineTo(x + 3.5, y + 3.5); ctx.moveTo(x + 3.5, y - 3.5); ctx.lineTo(x - 3.5, y + 3.5); }
      ctx.stroke();
    }
  }

  // 元の画像の上: 囲む（ドラッグ）・えらぶ／消す（クリック）。主のポインタかは pointerdown で見る
  function toImagePoint(e) {
    const rect = srcCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / srcScale, y = (e.clientY - rect.top) / srcScale;
    return { x: Math.max(0, Math.min(state.img.width, x)), y: Math.max(0, Math.min(state.img.height, y)) };
  }
  srcCanvas.addEventListener('pointerdown', e => {
    if (!state.img || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    srcCanvas.setPointerCapture(e.pointerId);
    state.drag = { start: toImagePoint(e), before: state.crop, sx: e.clientX, sy: e.clientY };
  });
  srcCanvas.addEventListener('pointermove', e => {
    if (!state.drag || state.tool !== 'crop') return;
    const a = state.drag.start, b = toImagePoint(e);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
    if (w * srcScale >= 8 && h * srcScale >= 8) { state.crop = { x, y, w, h }; recompute(); }
  });
  srcCanvas.addEventListener('pointerup', e => {
    const d = state.drag;
    state.drag = null;
    // 「キャラをえらぶ」「クリックで消す」は、押した所からほとんど動かさずに離したときだけ、クリックとして数える
    if (!d || state.tool === 'crop') return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) return;
    state.marks.push({ x: d.start.x, y: d.start.y, mode: state.tool });
    recompute();
  });
  srcCanvas.addEventListener('pointercancel', () => { if (state.drag) { state.crop = state.drag.before; state.drag = null; recompute(); } });
  window.addEventListener('resize', () => { if (state.img) recompute(); });

  function paletteCss(i) { const c = C.PALETTE_RGB[i]; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  /* ── 3 手で仕上げる ── */
  const editCanvas = $('edit-canvas');

  // 1 回の操作の前に、いまの手直しを控える（もどす・やりなおすのため）
  function pushUndo() {
    state.undo.push(cloneEdits(state.edits));
    if (state.undo.length > 100) state.undo.shift();
    state.redo = [];
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(cloneEdits(state.edits));
    state.edits = state.undo.pop();
    render();
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(cloneEdits(state.edits));
    state.edits = state.redo.pop();
    render();
  }
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
  });

  function setCell(i, v) {
    const e = state.edits[state.frame];
    e[i] = v;
    if (state.mirror) e[(i - (i % SIZE)) + (SIZE - 1 - (i % SIZE))] = v;
  }
  function penValue() { return state.pen === 'erase' ? 0 : state.color; }
  function cellAt(ev) {
    const r = editCanvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * SIZE), y = Math.floor((ev.clientY - r.top) / r.height * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return -1;
    return y * SIZE + x;
  }
  // 前のマスから今のマスまで、すき間なく塗る
  function paintLine(a, b, v) {
    let x0 = a % SIZE, y0 = (a - x0) / SIZE;
    const x1 = b % SIZE, y1 = (b - x1) / SIZE;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      setCell(y0 * SIZE + x0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function bucket(i, v) {
    const g = frameGrid(state.frame), target = g[i];
    if (target === v) return false;
    const seen = new Uint8Array(N), stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      setCell(p, v);
      const x = p % SIZE;
      for (const q of [x > 0 ? p - 1 : -1, x < SIZE - 1 ? p + 1 : -1, p >= SIZE ? p - SIZE : -1, p < N - SIZE ? p + SIZE : -1]) {
        if (q >= 0 && !seen[q] && g[q] === target) { seen[q] = 1; stack.push(q); }
      }
    }
    return true;
  }
  editCanvas.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    editCanvas.setPointerCapture(e.pointerId);
    if (state.overlay.move && state.overlay.on && state.imgCanvas) {
      state.stroke = { moving: true, x: e.clientX, y: e.clientY };
      return;
    }
    const i = cellAt(e);
    if (i < 0) return;
    if (state.pen === 'pick') {
      const v = frameGrid(state.frame)[i];
      if (v === 0) setPen('erase'); else { state.color = v; setPen('paint'); }
      return;
    }
    pushUndo();
    if (state.pen === 'fill') {
      if (!bucket(i, state.color)) state.undo.pop();
      render();
      return;
    }
    state.stroke = { last: i, v: penValue() };
    setCell(i, state.stroke.v);
    render();
  });
  editCanvas.addEventListener('pointermove', e => {
    const s = state.stroke;
    if (s && s.moving) {
      const r = editCanvas.getBoundingClientRect(), k = (SIZE * CELL) / r.width;
      state.overlay.dx += (e.clientX - s.x) * k; state.overlay.dy += (e.clientY - s.y) * k;
      s.x = e.clientX; s.y = e.clientY;
      drawEditor();
      return;
    }
    const i = cellAt(e);
    if (s && i >= 0 && i !== s.last) { paintLine(s.last, i, s.v); s.last = i; render(); return; }
    if (i !== state.hover) { state.hover = i; drawEditor(); }
  });
  const endStroke = () => { state.stroke = null; };
  editCanvas.addEventListener('pointerup', endStroke);
  editCanvas.addEventListener('pointercancel', endStroke);
  editCanvas.addEventListener('pointerleave', () => { if (state.hover !== -1) { state.hover = -1; drawEditor(); } });

  function setPen(p) {
    state.pen = p;
    for (const b of document.querySelectorAll('.pen')) b.setAttribute('aria-pressed', String(b.dataset.pen === p));
    updatePalette();
  }
  for (const b of document.querySelectorAll('.pen')) b.addEventListener('click', () => setPen(b.dataset.pen));
  $('mirror').addEventListener('click', () => {
    state.mirror = !state.mirror;
    $('mirror').setAttribute('aria-pressed', String(state.mirror));
    drawEditor();
  });

  // 色（とうめい ＋ 1〜15。0 の黒は透明の印なので出さない）
  const palette = $('palette');
  for (const c of ['clear'].concat(Array.from({ length: 15 }, (_, k) => k + 1))) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch-btn' + (c === 'clear' ? ' clear' : '');
    b.dataset.color = String(c);
    if (c === 'clear') { b.title = 'とうめい（消す）'; b.setAttribute('aria-label', 'とうめい（消す）'); }
    else { b.style.background = paletteCss(c); b.title = '色 ' + c; b.setAttribute('aria-label', '色 ' + c); }
    b.addEventListener('click', () => {
      if (c === 'clear') { setPen('erase'); return; }
      state.color = c;
      setPen(state.pen === 'fill' ? 'fill' : 'paint');
    });
    palette.appendChild(b);
  }
  function updatePalette() {
    for (const b of palette.children) {
      const on = b.dataset.color === 'clear' ? state.pen === 'erase' : (state.pen !== 'erase' && Number(b.dataset.color) === state.color);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  // 絵ぜんたいを 1 マスずらす（このコマは、すべてのマスを手で塗った形になる）
  for (const b of document.querySelectorAll('[data-shift]')) {
    b.addEventListener('click', () => {
      const [dx, dy] = b.dataset.shift.split(',').map(Number);
      const g = frameGrid(state.frame), out = new Int8Array(N);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const sx = x - dx, sy = y - dy;
        out[y * SIZE + x] = sx >= 0 && sy >= 0 && sx < SIZE && sy < SIZE ? g[sy * SIZE + sx] : 0;
      }
      pushUndo();
      state.edits[state.frame] = out;
      render();
    });
  }
  $('frame-clear').addEventListener('click', () => {
    if (!hasEdits(state.frame)) return;
    pushUndo();
    state.edits[state.frame].fill(-1);
    render();
  });
  $('frame-blank').addEventListener('click', () => {
    pushUndo();
    state.edits[state.frame].fill(0);
    if (state.imgCanvas && !state.overlay.on) { state.overlay.on = true; $('ov-on').checked = true; }
    render();
  });

  // コマの切り替え
  const tabs = Array.from(document.querySelectorAll('.frame-tab'));
  function setFrame(f) {
    state.frame = f;
    for (const t of tabs) t.setAttribute('aria-selected', String(Number(t.dataset.frame) === f));
    $('frame-clear').textContent = f === 0 ? '手で直したところを消す' : '「たち」と同じにもどす';
    render();
  }
  for (const t of tabs) t.addEventListener('click', () => setFrame(Number(t.dataset.frame)));

  // 元の絵を重ねる
  $('ov-on').addEventListener('input', () => { state.overlay.on = $('ov-on').checked; updateOverlayUi(); drawEditor(); });
  $('ov-alpha').addEventListener('input', () => { state.overlay.alpha = Number($('ov-alpha').value); updateOverlayUi(); drawEditor(); });
  $('ov-zoom').addEventListener('input', () => { state.overlay.zoom = Number($('ov-zoom').value); updateOverlayUi(); drawEditor(); });
  $('ov-move').addEventListener('click', () => { state.overlay.move = !state.overlay.move; updateOverlayUi(); });
  $('ov-reset').addEventListener('click', () => {
    state.overlay.dx = 0; state.overlay.dy = 0; state.overlay.zoom = 100; $('ov-zoom').value = 100;
    updateOverlayUi(); drawEditor();
  });
  function updateOverlayUi() {
    const has = !!state.imgCanvas;
    $('ov-on').disabled = !has;
    for (const id of ['ov-alpha', 'ov-zoom', 'ov-move', 'ov-reset']) $(id).disabled = !has || !state.overlay.on;
    $('out-ov-alpha').textContent = state.overlay.alpha;
    $('out-ov-zoom').textContent = state.overlay.zoom + '%';
    const moving = state.overlay.move && state.overlay.on && has;
    $('ov-move').setAttribute('aria-pressed', String(moving));
    $('ov-move').textContent = moving ? '動かし終わる' : '重ねた絵を動かす';
    editCanvas.classList.toggle('moving', moving);
  }

  // 3 の絵（1 マス 22 画素。透明は市松模様。元の絵をうすく重ねる）
  function drawEditor() {
    const S = SIZE * CELL, dpr = window.devicePixelRatio || 1;
    if (editCanvas.width !== S * dpr) { editCanvas.width = S * dpr; editCanvas.height = S * dpr; }
    const ctx = editCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = frameGrid(state.frame);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = g[y * SIZE + x];
      if (v === C.CLEAR) {
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = ((k + (k >> 1)) & 1) ? '#ffffff' : '#e4e8ef';
          ctx.fillRect(x * CELL + (k & 1) * CELL / 2, y * CELL + (k >> 1) * CELL / 2, CELL / 2, CELL / 2);
        }
      } else {
        ctx.fillStyle = paletteCss(v);
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    if (state.overlay.on && state.imgCanvas) {
      const info = state.result ? state.result.info : null;
      ctx.save();
      ctx.globalAlpha = state.overlay.alpha / 100;
      ctx.translate(S / 2 + state.overlay.dx, S / 2 + state.overlay.dy);
      ctx.scale(state.overlay.zoom / 100, state.overlay.zoom / 100);
      ctx.translate(-S / 2, -S / 2);
      if (state.opts.flip) { ctx.translate(S, 0); ctx.scale(-1, 1); }
      if (info) {
        const k = CELL / info.cell;
        ctx.scale(k, k);
        ctx.translate(-(info.cropOrigin[0] + info.gx), -(info.cropOrigin[1] + info.gy));
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(state.imgCanvas, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(27,38,64,.14)'; ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL + .5, 0); ctx.lineTo(i * CELL + .5, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL + .5); ctx.lineTo(S, i * CELL + .5); ctx.stroke();
    }
    if (state.mirror) {
      ctx.strokeStyle = 'rgba(201,86,124,.75)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.hover >= 0 && !(state.overlay.move && state.overlay.on)) {
      const hx = state.hover % SIZE, hy = (state.hover - hx) / SIZE;
      ctx.strokeStyle = '#c9567c'; ctx.lineWidth = 2;
      ctx.strokeRect(hx * CELL + 1, hy * CELL + 1, CELL - 2, CELL - 2);
      if (state.mirror) ctx.strokeRect((SIZE - 1 - hx) * CELL + 1, hy * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  function drawSprite(canvas, grid, scale) {
    const img = C.gridToRGBA(grid, scale);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  }

  // まとめて描き直す（絵・コマの見本・アイコン・色・ボタンの押せる／押せない）
  let framesCache = allFrames();
  function render() {
    framesCache = allFrames();
    drawEditor();
    tabs.forEach((t, f) => drawSprite(t.querySelector('canvas'), framesCache[f], 2));
    const any = framesCache.some(g => g.some(v => v));
    drawSprite($('brand-sprite'), any ? framesCache[0] : DEFAULT_SPRITE, 1);
    const used = new Set();
    for (const g of framesCache) for (const v of g) if (v) used.add(v);
    const box = $('colors-used');
    box.textContent = '';
    for (const i of Array.from(used).sort((a, b) => a - b)) {
      const s = document.createElement('span');
      s.style.background = paletteCss(i);
      s.title = '色 ' + i;
      box.appendChild(s);
    }
    $('save-zip').disabled = !any;
    $('save-png').disabled = !any;
    $('mark-undo').disabled = !state.marks.length;
    $('undo').disabled = !state.undo.length;
    $('redo').disabled = !state.redo.length;
    $('frame-clear').disabled = !hasEdits(state.frame);
    $('manual-note').hidden = !hasEdits(0);
    updatePalette();
    updateOverlayUi();
  }

  // ゲームの画面（64×32 の Pyxel の画面を 4 倍で見せる）。4 つのコマで、歩く・跳ぶ・わざを見せる
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tick = 0;
  function drawGame() {
    const W = 64, H = 32, GROUND = 26;
    const data = new Uint8ClampedArray(W * H * 4);
    const put = (x, y, v) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4, c = C.PALETTE_RGB[v];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, y >= GROUND ? 3 : 6);
    for (const [cx, cy] of [[8, 6], [50, 9]]) for (let k = -2; k <= 2; k++) { put(cx + k, cy, 7); if (Math.abs(k) < 2) put(cx + k, cy - 1, 7); }
    // 120 コマで 1 回り: 歩く（あるき・たち）→ 跳ぶ（ジャンプ）→ 歩く → わざ
    const t = reduceMotion ? 0 : tick % 120;
    let frame = 0, dy = 0, px = 24, flip = false, ring = 0;
    if (t < 40) { px = 10 + t; frame = (t >> 2) & 1; }
    else if (t < 56) { px = 50; frame = 2; const u = (t - 40) / 15; dy = -Math.round(10 * Math.sin(Math.PI * u)); }
    else if (t < 96) { px = 50 - (t - 56); frame = (t >> 2) & 1; flip = true; }
    else { px = 10; frame = 3; ring = t - 96; }
    if (reduceMotion) { px = 24; frame = 0; }
    const g = framesCache[frame];
    const ox = px - 8, oy = GROUND - SIZE + dy;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = g[y * SIZE + (flip ? SIZE - 1 - x : x)];
      if (v !== C.CLEAR) put(ox + x, oy + y, v);
    }
    if (ring) {
      const r = 9 + (ring % 3);
      for (let a = 0; a < 48; a++) put(Math.round(px + r * Math.cos(a / 48 * 2 * Math.PI)), Math.round(oy + 8 + r * Math.sin(a / 48 * 2 * Math.PI)), 10);
    }
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    off.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
    const cv = $('game-canvas'), dpr = window.devicePixelRatio || 1;
    if (cv.width !== 256 * dpr) { cv.width = 256 * dpr; cv.height = 128 * dpr; }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }
  let lastTime = 0;
  function loop(ts) {
    if (ts - lastTime >= 66) { lastTime = ts; tick++; if (!document.hidden) drawGame(); }
    requestAnimationFrame(loop);
  }

  /* ── 4 保存 ── */
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function ensureAssets() {
    if (window.PYXEL_CHARA_ASSETS) return Promise.resolve(window.PYXEL_CHARA_ASSETS);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'kobo-assets.js?v=1';
      s.onload = () => (window.PYXEL_CHARA_ASSETS ? resolve(window.PYXEL_CHARA_ASSETS) : reject(new Error('assets')));
      s.onerror = () => reject(new Error('assets'));
      document.head.appendChild(s);
    });
  }
  $('save-zip').addEventListener('click', async () => {
    const frames = allFrames();
    if (!frames.some(g => g.some(v => v))) return;
    const btn = $('save-zip'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '用意しています…';
    try {
      const a = await ensureAssets();
      const zip = P.projectZip(frames, { mainPy: a.mainPy, font: a.font });
      download(new Blob([zip], { type: 'application/zip' }), 'chara-kobo.zip');
      showStatus('ZIP を保存しました。「ダウンロード」のフォルダに chara-kobo.zip があります。');
    } catch (e) {
      showStatus('保存できませんでした。ページを開き直して、もう一度押します。', true);
    } finally {
      btn.textContent = label;
      render();
    }
  });
  $('save-png').addEventListener('click', () => {
    const frames = allFrames();
    const cv = document.createElement('canvas');
    cv.width = SIZE * FRAMES; cv.height = SIZE;
    const ctx = cv.getContext('2d');
    frames.forEach((g, f) => { const img = C.gridToRGBA(g, 1); ctx.putImageData(new ImageData(img.data, SIZE, SIZE), f * SIZE, 0); });
    cv.toBlob(b => { if (b) download(b, 'chara-4koma.png'); }, 'image/png');
  });

  /* ── Gemini に頼む文 ── */
  const RULES = [
    '・16×16 マスのドット絵にする。1 マスがはっきり分かる大きなドットで描く',
    '・正面を向いた全身。頭の大きい 2 頭身',
    '・色は 6 色まで。影やグラデーションはつけない',
    '・輪郭は濃い紺色の線',
    '・背景は、キャラに使っていない色 1 色でぬりつぶす（白いキャラなら水色など）。ほかには何も描かない',
    '・文字は入れない',
  ];
  function promptText(idea) {
    return ['レトロゲームに出てくる、ドット絵のキャラクターを 1 体だけ描いてください。'].concat(RULES, ['キャラ：' + (idea || '（ここに、どんなキャラかを書く）')]).join('\n');
  }
  function promptImage(idea) {
    const lines = ['付けた絵のキャラクターを、レトロゲームのドット絵にしてください。', '・形と色は、なるべく元の絵のままにする'].concat(RULES);
    if (idea) lines.push('キャラ：' + idea);
    return lines.join('\n');
  }
  function idea() { return $('chara-idea').value.trim(); }
  function showPrompt(text) { $('prompt-preview').value = text; }
  $('chara-idea').addEventListener('input', () => showPrompt(promptText(idea())));
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 下の手で写す */ }
    const ta = $('prompt-preview');
    ta.value = text; ta.focus(); ta.select();
    try { return document.execCommand('copy'); } catch (e) { return false; }
  }
  async function copyPrompt(text) {
    showPrompt(text);
    const ok = await copyText(text);
    $('copy-state').textContent = ok ? 'コピーしました。Gemini に貼り付けます。' : 'コピーできませんでした。下の文をえらんでコピーします。';
  }
  $('copy-prompt-text').addEventListener('click', () => copyPrompt(promptText(idea())));
  $('copy-prompt-image').addEventListener('click', () => copyPrompt(promptImage(idea())));

  /* ── カメラ ── */
  let stream = null;
  function setCamStatus(t) { $('camera-status').textContent = t; }
  function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    $('camera-video').srcObject = null;
    $('camera-shot').disabled = true;
  }
  $('camera-open').addEventListener('click', async () => {
    const dlg = $('camera-dialog');
    dlg.showModal();
    $('camera-shot').disabled = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setCamStatus('このブラウザではカメラを使えません。「画像をえらぶ」を使います。'); return; }
    setCamStatus('カメラを準備しています…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!dlg.open) { stopCamera(); return; }
      const v = $('camera-video');
      v.srcObject = stream;
      await v.play();
      $('camera-shot').disabled = false;
      setCamStatus('');
    } catch (e) {
      setCamStatus('カメラを使えませんでした。ブラウザの許可を確かめるか、「画像をえらぶ」を使います。');
    }
  });
  $('camera-shot').addEventListener('click', () => {
    const v = $('camera-video');
    if (!v.videoWidth) return;
    if (!okToReplace()) return;
    setImageFrom(v);
    stopCamera();
    $('camera-dialog').close();
  });
  $('camera-close').addEventListener('click', () => $('camera-dialog').close());
  $('camera-dialog').addEventListener('close', stopCamera);

  /* ── 困ったとき ── */
  $('help-open').addEventListener('click', () => $('help-dialog').showModal());
  $('help-close').addEventListener('click', () => $('help-dialog').close());

  // 検査の道具が中を見るための口（画面の動きには使わない）
  window.__chara = {
    grid: () => (state.result ? Array.from(state.result.grid) : null),   // 自動の結果
    frame: f => Array.from(frameGrid(f)),                                 // 手直しを入れたコマ
    frames: () => allFrames().map(g => Array.from(g)),
    edits: () => state.edits.map(a => Array.from(a)),
    info: () => (state.result ? state.result.info : null),
    opts: () => Object.assign({}, state.opts),
    crop: () => state.crop,
    marks: () => state.marks.slice(),
    pen: () => ({ pen: state.pen, color: state.color, mirror: state.mirror, frame: state.frame }),
    overlay: () => Object.assign({}, state.overlay),
  };

  writeOpts(); updateOutputs(); showPrompt(promptText('')); setFrame(0); setPen('paint'); run();
  drawGame();
  requestAnimationFrame(loop);
})();
