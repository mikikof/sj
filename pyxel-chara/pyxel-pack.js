/* ドット絵キャラをつくる — Pyxel Code Maker で開ける ZIP を組む（画面には触らない）
 * ZIP の中身: chara-kobo/main.py（キャラ工房）・my_resource.pyxres（キャラの 4 コマ）・
 *            .pyxapp_startup_script・umplus_j10r.bdf（日本語の字）
 * .pyxres は「pyxel_resource.toml を 1 つ入れた ZIP」（Pyxel の docs/pyxres-format.md）。
 * Pyxel が保存するときと同じ並び（画像 3・タイルマップ 8・音 64・曲 8）で書く。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PyxelPack = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 16;
  const BANK = 256;
  const FRAMES = 4;          // たち・あるき・ジャンプ・わざ（画像 0 のいちばん上の段に、左から）
  const PROJECT = 'chara-kobo';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();
  function bytesOf(x) { return typeof x === 'string' ? enc.encode(x) : x; }

  // 圧縮しない ZIP（stored）。Pyxel・Code Maker（JSZip）・Mac の展開のどれでも読める形
  function zipStore(files, date) {
    const d = date || new Date(2026, 0, 1, 0, 0, 0);
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = bytesOf(f.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);   // 名前は UTF-8
      lv.setUint16(8, 0, true);        // stored
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      central.set(name, 46);
      locals.push(local, data);
      centrals.push(central);
      offset += local.length + data.length;
    }
    const cdSize = centrals.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    const parts = locals.concat(centrals, [end]);
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // 4 コマの並び。16×16 の絵 1 つなら、同じ絵を 4 つにする
  function framesOf(x) {
    return Array.isArray(x) && x.length === FRAMES && x[0] && x[0].length === SIZE * SIZE ? x : [x, x, x, x];
  }

  // 画像 0（256×256）に、16×16 の絵を左上から 4 つ並べる（たち・あるき・ジャンプ・わざ）
  function bankWithFrames(gridOrFrames) {
    const frames = framesOf(gridOrFrames);
    const bank = new Uint8Array(BANK * BANK);
    for (let f = 0; f < FRAMES; f++) {
      const grid = frames[f];
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) bank[y * BANK + f * SIZE + x] = grid[y * SIZE + x];
      }
    }
    return bank;
  }

  // Pyxel の書き方で縮める: 行の終わりで同じ値が続く所は 1 つに、終わりで同じ行が続く所は 1 行に
  function imageDataToml(bank) {
    const rows = [];
    for (let y = 0; y < BANK; y++) {
      const row = Array.from(bank.subarray(y * BANK, (y + 1) * BANK));
      while (row.length > 1 && row[row.length - 1] === row[row.length - 2]) row.pop();
      rows.push(row);
    }
    while (rows.length > 1 && rows[rows.length - 1].join(',') === rows[rows.length - 2].join(',')) rows.pop();
    return '[' + rows.map(r => '[' + r.join(', ') + ']').join(', ') + ']';
  }

  function pyxresToml(gridOrFrames) {
    const out = ['format_version = 1', ''];
    out.push('[[images]]', 'width = 256', 'height = 256', 'data = ' + imageDataToml(bankWithFrames(gridOrFrames)), '');
    for (let i = 0; i < 2; i++) out.push('[[images]]', 'width = 256', 'height = 256', 'data = [[0]]', '');
    for (let i = 0; i < 8; i++) out.push('[[tilemaps]]', 'width = 256', 'height = 256', 'imgsrc = 0', 'data = [[0]]', '');
    for (let i = 0; i < 64; i++) out.push('[[sounds]]', 'notes = []', 'tones = []', 'volumes = []', 'effects = []', 'speed = 30', '');
    for (let i = 0; i < 8; i++) out.push('[[musics]]', 'seqs = []', '');
    return out.join('\n');
  }

  function pyxres(gridOrFrames) {
    return zipStore([{ name: 'pyxel_resource.toml', data: pyxresToml(gridOrFrames) }]);
  }

  // Code Maker の Load → File で開く ZIP（フォルダ名の下に main.py と my_resource.pyxres が要る）。
  // 渡すのは 16×16 の絵 1 つか、4 コマの並び
  function projectZip(gridOrFrames, assets) {
    const files = [
      { name: PROJECT + '/main.py', data: assets.mainPy },
      { name: PROJECT + '/my_resource.pyxres', data: pyxres(gridOrFrames) },
      { name: PROJECT + '/.pyxapp_startup_script', data: 'main.py' },
    ];
    if (assets.font) files.push({ name: PROJECT + '/umplus_j10r.bdf', data: assets.font });
    return zipStore(files);
  }

  return { SIZE, FRAMES, PROJECT, crc32, zipStore, framesOf, bankWithFrames, pyxresToml, pyxres, projectZip };
});
