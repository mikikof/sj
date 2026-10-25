/* ドット絵キャラをつくる — 画像を 16×16 マス・Pyxel の 16 色に落とす計算（画面には触らない）
 * ブラウザでは window.CharaConvert、Node では require で読む。
 * 入力の画像は { width, height, data }（data は RGBA の並び。ImageData と同じ形）。
 * 出力の grid は 16×16 の色番号（0 は透明。Pyxel の blt で colkey=0 にする前提）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharaConvert = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 16;
  const CLEAR = 0;   // 透明（Pyxel の色 0 は黒だが、キャラには使わず透明の印にする）
  const OUTLINE = 1; // ふちの色（紺）
  // Pyxel の標準の 16 色（pyxel.colors の初期値。2.9.9 で確かめた）
  const PALETTE = [0x000000, 0x2b335f, 0x7e2072, 0x19959c, 0x8b4852, 0x395c98, 0xa9c1ff, 0xeeeeee,
    0xd4186c, 0xd38441, 0xe9c35b, 0x70c6a9, 0x7696de, 0xa3a3a3, 0xff9798, 0xedc7b0];
  const PALETTE_RGB = PALETTE.map(c => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);

  function toLinear(v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function labF(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  function rgbToLab(r, g, b) {
    const R = toLinear(r), G = toLinear(g), B = toLinear(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const fx = labF(X), fy = labF(Y), fz = labF(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function dist2(a, b) {
    const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
    return d0 * d0 + d1 * d1 + d2 * d2;
  }
  const PALETTE_LAB = PALETTE_RGB.map(c => rgbToLab(c[0], c[1], c[2]));

  // いちばん近い色の番号（0 の黒は透明の印なので選ばない）。15 ビットに丸めて覚えておく
  const nearestCache = new Int8Array(32768).fill(-1);
  function nearestIndex(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = nearestCache[key];
    if (hit >= 0) return hit;
    const lab = rgbToLab((r & 0xf8) | 4, (g & 0xf8) | 4, (b & 0xf8) | 4);
    let best = 1, bestD = Infinity;
    for (let i = 1; i < 16; i++) {
      const d = dist2(lab, PALETTE_LAB[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    nearestCache[key] = best;
    return best;
  }

  // 色をこくしてから近い色を探す（k は a・b を何倍にするか）。k が変わったら覚えた答えを捨てる。
  // 色みのある画素は少し暗くもする（淡い色は明るさが白に近く、色みを広げるだけでは白のままになるため）。白・灰・黒は変えない
  let vividK = 1, vividCache = null;
  function nearestVivid(r, g, b, k) {
    if (k <= 1.001) return nearestIndex(r, g, b);
    if (k !== vividK || !vividCache) { vividK = k; vividCache = new Int8Array(32768).fill(-1); }
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = vividCache[key];
    if (hit >= 0) return hit;
    const lab = rgbToLab((r & 0xf8) | 4, (g & 0xf8) | 4, (b & 0xf8) | 4);
    const chroma = Math.hypot(lab[1], lab[2]);
    if (chroma < 6) { vividCache[key] = nearestIndex(r, g, b); return vividCache[key]; }   // 白・灰・黒は濃くしない
    lab[0] -= (k - 1) * 10 * Math.min(1, chroma / 20);
    lab[1] *= k; lab[2] *= k;
    let best = 1, bestD = Infinity;
    for (let i = 1; i < 16; i++) {
      const d = dist2(lab, PALETTE_LAB[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    vividCache[key] = best;
    return best;
  }

  const DEFAULTS = {
    crop: null,          // { x, y, w, h }（画像の座標）。null なら全体
    removeBg: true,      // 背景を消す
    tolerance: 40,       // 0〜100。大きいほど、背景に近い色まで消す
    removeHoles: false,  // 囲まれた所に残った背景の色も消す
    height: 16,          // キャラの高さ（マス）
    colors: 6,           // 使う色の数（ふちの色は別）
    vivid: 0,            // 0〜100。色のこさ（色鉛筆のうすい色が白にならないようにする）
    outline: true,       // ふちを濃くする
    flip: false,         // 左右を反転
    features: true,      // 目などの、顔の中の小さな黒い点を残す
    autoSelect: true,    // 背景がうまく消せなかったら、まん中のキャラを自動でえらぶ
    marks: [],           // クリックした所 [{ x, y, mode: 'select' | 'erase' }]（画像の座標）。順に当てる
  };

  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  // 切り出した範囲を、作業用の配列に写す
  function cropImage(img, crop) {
    const c = crop || { x: 0, y: 0, w: img.width, h: img.height };
    const x0 = Math.max(0, Math.floor(c.x)), y0 = Math.max(0, Math.floor(c.y));
    const x1 = Math.min(img.width, Math.ceil(c.x + c.w)), y1 = Math.min(img.height, Math.ceil(c.y + c.h));
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const from = ((y0 + y) * img.width + x0) * 4;
      data.set(img.data.subarray(from, from + w * 4), y * w * 4);
    }
    return { width: w, height: h, data, x0, y0 };
  }

  // ふちの画素から背景の色を見積もる（透明な画素は数えない）
  function estimateBackground(img) {
    const { width: w, height: h, data } = img;
    const band = Math.max(1, Math.round(Math.min(w, h) * 0.02));
    const rs = [], gs = [], bs = [];
    let clear = 0;
    const step = Math.max(1, Math.floor((w + h) / 400));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (x >= band && x < w - band && y >= band && y < h - band) continue;
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) { clear++; continue; }
        rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
      }
    }
    // ふちの多くが透明なら、背景は透明そのもの。ふちに触れたキャラの色を背景と取り違えないよう、色では探さない
    if (!rs.length || clear >= rs.length) return null;
    return [median(rs), median(gs), median(bs)];
  }

  function labToRgb(L, A, B) {
    const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
    const inv = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
    const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
    const lin = [X * 3.2406 - Y * 1.5372 - Z * 0.4986, -X * 0.9689 + Y * 1.8758 + Z * 0.0415, X * 0.0557 - Y * 0.2040 + Z * 1.0570];
    return lin.map(v => {
      const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(c * 255)));
    });
  }

  // 紙の写真のように背景が明るい灰色・生成りのときは、背景が白になるようにそろえる。
  // 明るさは同じ割合で上げ、色みは紙の色みの半分だけを差し引く（赤・緑・青を別々に上げたり、紙の色みを全部引いたりすると、
  // 淡いピンクが薄紫に寄る。半分は手作りの見本で決めた値で、本物の写真で確かめる）
  const TINT = 0.5;
  function whiteBalance(img, bg) {
    const none = { img, bg, applied: false, photoLike: false };
    if (!bg) return none;
    const [Lb, ab, bb] = rgbToLab(bg[0], bg[1], bg[2]);
    if (Lb < 45 || Math.hypot(ab, bb) > 25) return none;   // 暗い背景・色のついた背景はそのまま
    if (Lb >= 92) return none;   // 白に近い明るさの背景（うすい黄色などの、描いた背景）はそのまま。紙の写真は白より暗い
    const scale = Math.min(1.5, Math.max(1, 94 / Lb));
    if (scale < 1.02 && Math.hypot(ab, bb) < 3) return none;
    const cache = new Map();
    const data = new Uint8ClampedArray(img.data.length);
    for (let i = 0; i < data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const key = (r << 16) | (g << 8) | b;
      let out = cache.get(key);
      if (!out) {
        const [L, A, B] = rgbToLab(r, g, b);
        out = labToRgb(Math.min(100, L * scale), A - ab * TINT, B - bb * TINT);
        cache.set(key, out);
      }
      data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2]; data[i + 3] = img.data[i + 3];
    }
    const nb = labToRgb(Math.min(100, Lb * scale), ab * (1 - TINT), bb * (1 - TINT));
    return { img: { width: img.width, height: img.height, data }, bg: nb, applied: true, photoLike: scale >= 1.06 };
  }

  // 背景の印（1 = 背景）。ふちから、背景に近い色をたどって塗りつぶす
  function backgroundMask(img, bg, opts) {
    const { width: w, height: h, data } = img;
    const n = w * h;
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (data[p * 4 + 3] < 128) mask[p] = 1;
    if (!opts.removeBg || !bg) return mask;
    const thr = 4 + opts.tolerance * 0.5;
    const thr2 = thr * thr;
    const bgLab = rgbToLab(bg[0], bg[1], bg[2]);
    const similar = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      if (data[i + 3] < 128) { similar[p] = 1; continue; }
      if (dist2(rgbToLab(data[i], data[i + 1], data[i + 2]), bgLab) <= thr2) similar[p] = 1;
    }
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    let top = 0;
    const push = p => { if (!seen[p] && similar[p]) { seen[p] = 1; stack[top++] = p; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (top) {
      const p = stack[--top];
      mask[p] = 1;
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < n - w) push(p + w);
    }
    if (opts.removeHoles) {
      // 囲まれた背景の色のかたまりも消す（目の白のような小さい所は残すため、ある程度の広さがあるものだけ）
      const minArea = Math.max(4, Math.round(n * 0.002));
      for (let s = 0; s < n; s++) {
        if (seen[s] || !similar[s]) continue;
        const comp = [];
        seen[s] = 1; stack[0] = s; top = 1;
        while (top) {
          const p = stack[--top];
          comp.push(p);
          const x = p % w;
          const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
          for (const q of nb) if (q >= 0 && !seen[q] && similar[q]) { seen[q] = 1; stack[top++] = q; }
        }
        if (comp.length >= minArea) for (const p of comp) mask[p] = 1;
      }
    }
    return dropStrayParts(mask, w, h);
  }

  // 背景でない所をかたまりに分け、いちばん大きいかたまり以外で、ふちに触れているもの（写真に写った机や紙の端）と、
  // ごく小さい点（紙のよごれ）を背景にする
  function dropStrayParts(mask, w, h) {
    const n = w * h;
    const label = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    const sizes = [], touches = [];
    for (let s = 0; s < n; s++) {
      if (mask[s] || label[s] >= 0) continue;
      const id = sizes.length;
      let size = 0, touch = false, top = 0;
      label[s] = id; stack[top++] = s;
      while (top) {
        const p = stack[--top];
        size++;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch = true;
        if (x > 0 && !mask[p - 1] && label[p - 1] < 0) { label[p - 1] = id; stack[top++] = p - 1; }
        if (x < w - 1 && !mask[p + 1] && label[p + 1] < 0) { label[p + 1] = id; stack[top++] = p + 1; }
        if (y > 0 && !mask[p - w] && label[p - w] < 0) { label[p - w] = id; stack[top++] = p - w; }
        if (y < h - 1 && !mask[p + w] && label[p + w] < 0) { label[p + w] = id; stack[top++] = p + w; }
      }
      sizes.push(size); touches.push(touch);
    }
    if (sizes.length < 2) return mask;
    let big = 0;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
    const minSize = Math.max(2, Math.round(n * 0.0005));
    const drop = sizes.map((s, i) => i !== big && (touches[i] || s < minSize));
    if (!drop.some(Boolean)) return mask;
    const out = mask.slice();
    for (let p = 0; p < n; p++) if (label[p] >= 0 && drop[label[p]]) out[p] = 1;
    return out;
  }

  // クリックした所から、似た色でつながる所をたどる（返すのは 1 = たどれた所）
  function growRegion(work, x0, y0, thr2, labAt) {
    const { width: w, height: h, data } = work;
    const n = w * h;
    const region = new Uint8Array(n);
    const p0 = y0 * w + x0;
    if (data[p0 * 4 + 3] < 128) return region;
    const seed = labAt(p0);
    const stack = new Int32Array(n);
    let top = 0;
    region[p0] = 1; stack[top++] = p0;
    while (top) {
      const p = stack[--top];
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
      for (const q of nb) {
        if (q < 0 || region[q]) continue;
        if (data[q * 4 + 3] >= 128 && dist2(labAt(q), seed) <= thr2) { region[q] = 1; stack[top++] = q; }
      }
    }
    return region;
  }

  // えらんだ所を r 画素ぶん外へ広げ（輪郭の線を入れるため）、中の穴（目・線のすき間）を埋める
  function closeRegion(region, w, h, r) {
    const n = w * h, INF = 1 << 20;
    const d = new Int32Array(n);
    for (let p = 0; p < n; p++) d[p] = region[p] ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x > 0) d[p] = Math.min(d[p], d[p - 1] + 1);
      if (y > 0) d[p] = Math.min(d[p], d[p - w] + 1);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (x < w - 1) d[p] = Math.min(d[p], d[p + 1] + 1);
      if (y < h - 1) d[p] = Math.min(d[p], d[p + w] + 1);
    }
    const grown = new Uint8Array(n);
    for (let p = 0; p < n; p++) grown[p] = d[p] <= r ? 1 : 0;
    // ふちからたどれない「えらんでいない所」は穴なので、えらんだ所に入れる
    const outside = new Uint8Array(n), stack = new Int32Array(n);
    let top = 0;
    const push = p => { if (!grown[p] && !outside[p]) { outside[p] = 1; stack[top++] = p; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (top) {
      const p = stack[--top];
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < n - w) push(p + w);
    }
    for (let p = 0; p < n; p++) if (!outside[p]) grown[p] = 1;
    return grown;
  }

  function makeLabAt(work) {
    const data = work.data, labCache = new Map();
    return p => {
      const i = p * 4, key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      let v = labCache.get(key);
      if (!v) { v = rgbToLab(data[i], data[i + 1], data[i + 2]); labCache.set(key, v); }
      return v;
    };
  }

  function selectRadius(region) {
    let area = 0;
    for (let p = 0; p < region.length; p++) area += region[p];
    return Math.max(2, Math.min(14, Math.round(Math.sqrt(area) * 0.03)));
  }

  // 自動の背景消しがうまくいかなかったとき（キャラが画像のほぼ全体になったとき）は、まん中のあたりから
  // 「キャラをえらぶ」と同じやり方でキャラを探す。ふちにほとんど触れず（触れる長さがふち全体の 12% 未満）、
  // 広すぎず狭すぎない、いちばん大きい所を使う（輪郭の小さな切れ目から、ふちへ少し漏れることはある）
  function autoSelect(work, tolerance) {
    const { width: w, height: h } = work;
    const n = w * h;
    const thr = 4 + tolerance * 0.5, thr2 = thr * thr;
    const labAt = makeLabAt(work);
    let best = null, bestArea = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.62], [0.38, 0.55], [0.62, 0.55], [0.5, 0.4]]) {
      const region = growRegion(work, Math.floor(w * fx), Math.floor(h * fy), thr2, labAt);
      let area = 0, edge = 0;
      for (let p = 0; p < n; p++) {
        if (!region[p]) continue;
        area++;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++;
      }
      if (edge > 0.12 * 2 * (w + h) || area < n * 0.03 || area > n * 0.7) continue;
      if (area > bestArea) { best = region; bestArea = area; }
    }
    if (!best) return null;
    const closed = closeRegion(best, w, h, selectRadius(best));
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) mask[p] = closed[p] ? 0 : 1;
    return mask;
  }

  // クリックを順に当てる。select（キャラをえらぶ）が 1 つでもあれば、えらんだ所だけを残す。erase（消す）はその上で消す
  function applyMarks(work, mask, marks, ox, oy, tolerance) {
    const { width: w, height: h } = work;
    const n = w * h;
    const thr = 4 + tolerance * 0.5, thr2 = thr * thr;
    const labAt = makeLabAt(work);
    if (marks.some(m => m.mode === 'select')) mask.fill(1);
    for (const m of marks) {
      const x0 = Math.round(m.x - ox), y0 = Math.round(m.y - oy);
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) continue;
      let region = growRegion(work, x0, y0, thr2, labAt);
      if (m.mode === 'select') {
        region = closeRegion(region, w, h, selectRadius(region));
        for (let p = 0; p < n; p++) if (region[p]) mask[p] = 0;
      } else {
        for (let p = 0; p < n; p++) if (region[p]) mask[p] = 1;
      }
    }
    return mask;
  }

  // 目のような、絵の中にある小さくまとまった黒い点を探す（背景に触れていない・2.2 マスより小さい・細い線ではない）。
  // 16×16 に縮めると、1 マスより小さい目は多数決で消えるため、点の中心のマスを暗い色にして残す
  function smallDarkFeatures(work, mask, cell) {
    const { width: w, height: h, data } = work;
    const n = w * h;
    const dark = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      if (mask[p]) continue;
      const i = p * 4;
      if (PALETTE_LAB[nearestIndex(data[i], data[i + 1], data[i + 2])][0] < 40) dark[p] = 1;   // マスの色を決めるときと同じ「暗い」
    }
    const seen = new Uint8Array(n), stack = new Int32Array(n);
    const found = [];
    for (let s = 0; s < n; s++) {
      if (!dark[s] || seen[s]) continue;
      let top = 0, area = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, touch = false;
      seen[s] = 1; stack[top++] = s;
      while (top) {
        const p = stack[--top];
        const x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        if (nb.includes(-1)) touch = true;
        for (const q of nb) {
          if (q < 0) continue;
          if (mask[q]) { touch = true; continue; }
          if (dark[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (touch || Math.max(bw, bh) > 2.2 * cell || Math.min(bw, bh) < 0.25 * cell) continue;
      if (area < 0.08 * cell * cell || area / (bw * bh) < 0.35) continue;
      found.push({ x: sx / area, y: sy / area });
    }
    return found;
  }

  function boundingBox(mask, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // 1 マスの色を決める。マスの中の画素の多数決。太い線が消えないよう、暗い画素が 4 割を超えたら暗い色を取る
  // （15% だと口やひげの細い線までマスを黒くして、目と口が 1 本の黒い帯になり、3 割でも口が目に混ざった。目は smallDarkFeatures で残す）
  function pickCellColor(img, mask, rx0, ry0, rx1, ry1, k) {
    const { width: w, height: h, data } = img;
    const counts = new Int32Array(16), darkCounts = new Int32Array(16);
    let total = 0, fg = 0, dark = 0;
    const xa = Math.floor(rx0), xb = Math.ceil(rx1), ya = Math.floor(ry0), yb = Math.ceil(ry1);
    const stepX = Math.max(1, Math.floor((xb - xa) / 12)), stepY = Math.max(1, Math.floor((yb - ya) / 12));
    for (let y = ya; y < yb; y += stepY) {
      for (let x = xa; x < xb; x += stepX) {
        total++;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const p = y * w + x;
        if (mask[p]) continue;
        fg++;
        const i = p * 4;
        const idx = nearestVivid(data[i], data[i + 1], data[i + 2], k);
        counts[idx]++;
        if (PALETTE_LAB[idx][0] < 40) { dark++; darkCounts[idx]++; }
      }
    }
    if (!total || fg / total < 0.4) return CLEAR;
    let best = 1;
    for (let i = 1; i < 16; i++) if (counts[i] > counts[best]) best = i;
    if (dark / fg >= 0.4 && PALETTE_LAB[best][0] >= 40) {
      let d = 1;
      for (let i = 1; i < 16; i++) if (darkCounts[i] > darkCounts[d]) d = i;
      if (darkCounts[d] > 0) best = d;
    }
    return best;
  }

  function reduceColors(grid, k) {
    const counts = new Int32Array(16);
    for (const v of grid) if (v !== CLEAR) counts[v]++;
    const used = [];
    for (let i = 1; i < 16; i++) if (counts[i]) used.push(i);
    if (used.length <= k) return grid;
    used.sort((a, b) => counts[b] - counts[a] || a - b);
    const keep = used.slice(0, k);
    const map = new Int8Array(16);
    for (let i = 1; i < 16; i++) {
      if (keep.includes(i)) { map[i] = i; continue; }
      let best = keep[0], bestD = Infinity;
      for (const j of keep) {
        const d = dist2(PALETTE_LAB[i], PALETTE_LAB[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      map[i] = best;
    }
    return grid.map(v => (v === CLEAR ? CLEAR : map[v]));
  }

  function filled(grid, x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE && grid[y * SIZE + x] !== CLEAR;
  }

  // まわりに 1 マスもつながっていない点は、背景の残りとみなして消す
  function removeSpecks(grid) {
    const out = grid.slice();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!filled(grid, x, y)) continue;
        if (!filled(grid, x - 1, y) && !filled(grid, x + 1, y) && !filled(grid, x, y - 1) && !filled(grid, x, y + 1)) out[y * SIZE + x] = CLEAR;
      }
    }
    return out;
  }

  // ふちのマス（となりが透明か、絵の外）を紺にする
  function addOutline(grid) {
    const out = grid.slice();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!filled(grid, x, y)) continue;
        if (!filled(grid, x - 1, y) || !filled(grid, x + 1, y) || !filled(grid, x, y - 1) || !filled(grid, x, y + 1)) out[y * SIZE + x] = OUTLINE;
      }
    }
    return out;
  }

  function flipGrid(grid) {
    const out = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out[y * SIZE + x] = grid[y * SIZE + (SIZE - 1 - x)];
    return out;
  }

  function vividFactor(v) { return 1 + Math.max(0, Math.min(100, Number(v) || 0)) / 50; }

  function convert(img, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    const cropped = cropImage(img, opts.crop);
    const bg0 = estimateBackground(cropped);
    const wb = whiteBalance(cropped, bg0);
    const work = wb.img;
    let mask = backgroundMask(work, wb.bg, opts);
    let autoSelected = false;
    if (opts.marks && opts.marks.length) applyMarks(work, mask, opts.marks, cropped.x0, cropped.y0, opts.tolerance);
    else if (opts.removeBg && opts.autoSelect && wb.bg) {
      // 背景を色で消していて、残った所が画像のほぼ全体に広がり、しかも「ほとんど何も消えなかった」か
      // 「線だけが残った」ときに、うまくいかなかったとみなす（キャラが大きく写っただけの絵は、その間に入る）
      const b0 = boundingBox(mask, work.width, work.height);
      let fg = 0;
      for (let p = 0; p < mask.length; p++) if (!mask[p]) fg++;
      const fill = b0 ? fg / (b0.w * b0.h) : 0;
      if (b0 && b0.w * b0.h >= 0.85 * work.width * work.height && (fill >= 0.9 || fill <= 0.45)) {
        const sel = autoSelect(work, opts.tolerance);
        if (sel) { mask = sel; autoSelected = true; }
      }
    }
    const box = boundingBox(mask, work.width, work.height);
    let grid = new Uint8Array(SIZE * SIZE);
    // photoLike: 背景を白にそろえるのに 6% 以上明るくした画像（紙を撮った写真に多い。描いた背景の色は白に近い明るさなので入らない）
    const info = { empty: !box, background: wb.bg, whiteBalanced: wb.applied, photoLike: wb.photoLike, autoSelected, box, cropOrigin: [cropped.x0, cropped.y0], cropSize: [cropped.width, cropped.height] };
    // 16×16 のマスと画像の対応（元の絵を重ねて見せるときに使う）。キャラが見つからなければ、範囲全体をまん中に置く
    {
      const cw = work.width, ch = work.height;
      const c0 = Math.max(cw, ch) / SIZE;
      info.cell = c0; info.gx = (cw - SIZE * c0) / 2; info.gy = (ch - SIZE * c0) / 2;
    }
    if (box) {
      const rows = Math.max(4, Math.min(SIZE, Math.round(opts.height)));
      const cell = Math.max(box.h / rows, box.w / SIZE);
      const gx = box.x - (SIZE * cell - box.w) / 2;  // 左右はまん中
      const gy = box.y + box.h - SIZE * cell;         // 足もとをいちばん下の段にそろえる
      info.gx = gx; info.gy = gy;
      for (let cy = 0; cy < SIZE; cy++) {
        for (let cx = 0; cx < SIZE; cx++) {
          grid[cy * SIZE + cx] = pickCellColor(work, mask, gx + cx * cell, gy + cy * cell, gx + (cx + 1) * cell, gy + (cy + 1) * cell, vividFactor(opts.vivid));
        }
      }
      info.cell = cell;
      grid = removeSpecks(grid);
      grid = Uint8Array.from(reduceColors(grid, Math.max(1, Math.round(opts.colors))));
      info.features = 0;
      if (opts.features) {
        for (const f of smallDarkFeatures(work, mask, cell)) {
          const cx = Math.floor((f.x - gx) / cell), cy = Math.floor((f.y - gy) / cell);
          if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) continue;
          const v = grid[cy * SIZE + cx];
          if (v === CLEAR || PALETTE_LAB[v][0] < 40) continue;
          grid[cy * SIZE + cx] = OUTLINE;
          info.features++;
        }
      }
      if (opts.outline) grid = addOutline(grid);
      if (opts.flip) grid = flipGrid(grid);
    }
    info.colorsUsed = Array.from(new Set(Array.from(grid).filter(v => v !== CLEAR))).sort((a, b) => a - b);
    return { grid, mask, maskWidth: work.width, maskHeight: work.height, info };
  }

  // 16×16 の絵を RGBA に（透明は透明のまま）。scale 倍に広げる
  function gridToRGBA(grid, scale) {
    const s = scale || 1, w = SIZE * s;
    const data = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const v = grid[Math.floor(y / s) * SIZE + Math.floor(x / s)];
        const i = (y * w + x) * 4;
        if (v === CLEAR) continue;
        const c = PALETTE_RGB[v];
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    return { width: w, height: w, data };
  }

  return { SIZE, CLEAR, OUTLINE, PALETTE, PALETTE_RGB, DEFAULTS, convert, gridToRGBA, nearestIndex, rgbToLab,
    _inner: { labToRgb, nearestVivid, whiteBalance, estimateBackground, smallDarkFeatures, applyMarks, autoSelect } };  // _inner は検査の道具だけが使う
});
