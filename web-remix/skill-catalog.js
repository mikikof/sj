/* キャラごとの特技。名前と動きの種類をここで決めています。 */
(function (root) {
  'use strict';

  const characters = {
    mint: ['mint-beat', 'mint-wave', 'mint-dash', 'mint-guard', 'mint-moonwalk', 'mint-dance'],
    ember: ['ember-dash', 'ember-fireworks', 'ember-jump', 'ember-ring', 'ember-spin', 'ember-kick'],
    cloud: ['cloud-hop', 'cloud-paw', 'cloud-box', 'cloud-scan', 'cloud-spin', 'cloud-nap'],
    nova: ['nova-rocket', 'nova-meteor', 'nova-orbit', 'nova-gather', 'nova-beam', 'nova-flash'],
    aqua: ['aqua-bubble', 'aqua-wave', 'aqua-ripple', 'aqua-jet', 'aqua-dive', 'aqua-rain']
  };

  // 前に保存したページでも、そのまま特技を使えます。
  const legacy = {
    mint: ['jump', 'dash', 'shield', 'magnet'],
    ember: ['dash', 'highjump', 'shield', 'magnet'],
    cloud: ['jump', 'shield', 'glide', 'magnet'],
    nova: ['highjump', 'dash', 'magnet', 'shield'],
    aqua: ['jump', 'glide', 'shield', 'dash']
  };

  const palettes = {
    mint: { color: '#32cda1', accent: '#d7ff8a', glyph: '♪' },
    ember: { color: '#ff744d', accent: '#ffe594', glyph: '✦' },
    cloud: { color: '#91b9e5', accent: '#f3c2ed', glyph: '✧' },
    nova: { color: '#f4c847', accent: '#d5b4ff', glyph: '★' },
    aqua: { color: '#32bce8', accent: '#b8f7ff', glyph: '●' }
  };
  const skills = {};

  function add(character, effect, name, description, mark, duration, glyph) {
    const palette = palettes[character];
    skills[character + '-' + effect] = {
      character, effect, name, description, mark, duration,
      color: palette.color, accent: palette.accent, glyph: glyph || palette.glyph
    };
  }

  add('mint', 'beat', 'ビート', '音に合わせてポンポン弾む', '♪', 1250);
  add('mint', 'wave', '音のウェーブ', '音の輪をまわりに広げる', '◎', 1400);
  add('mint', 'dash', 'リズムダッシュ', '音符を残して横に走る', '→', 1200);
  add('mint', 'guard', '音のバリア', '音符のバリアで体を包む', '◇', 1400);
  add('mint', 'moonwalk', 'ムーンウォーク', '足踏みしながら後ろへ滑る', '←', 1600);
  add('mint', 'dance', 'ステップダンス', '左右にステップを踏む', '♫', 1700);

  add('ember', 'dash', '火花ダッシュ', '火花を散らして横に走る', '→', 1200);
  add('ember', 'fireworks', 'ミニ花火', '頭の上で花火を打ち上げる', '✦', 1650);
  add('ember', 'jump', '火のジャンプ', '炎を吹き出して高く跳ぶ', '↑', 1350);
  add('ember', 'ring', '炎のリング', '体のまわりに炎の輪を出す', '◎', 1450);
  add('ember', 'spin', '火のスピン', '火花を散らして一回転する', '↻', 1350);
  add('ember', 'kick', '火花キック', '斜めに跳んでキックする', '↗', 1250);

  add('cloud', 'hop', '猫ジャンプ', '軽く身を縮めてぴょんと跳ぶ', '↑', 1250);
  add('cloud', 'paw', 'ねこパンチ', '前に踏み込んでパンチする', '✧', 1150);
  add('cloud', 'box', '箱にかくれる', '箱に入って顔をのぞかせる', '□', 1800);
  add('cloud', 'scan', 'スキャン', '光を走らせてまわりを調べる', '⌕', 1550);
  add('cloud', 'spin', 'しっぽスピン', 'くるりと回って着地する', '↻', 1350);
  add('cloud', 'nap', 'ひとやすみ', '体を丸めて少しだけ眠る', 'z', 1900, 'Z');

  add('nova', 'rocket', 'ロケット', '光を噴き出して上に飛ぶ', '↑', 1450);
  add('nova', 'meteor', '流れ星', '斜めに流れる星を呼ぶ', '☄', 1600);
  add('nova', 'orbit', '星のリング', '小さな星が体のまわりを回る', '◎', 1700);
  add('nova', 'gather', '星あつめ', 'まわりの星を引き寄せる', '★', 1450);
  add('nova', 'beam', 'スタービーム', '横にまっすぐ光を放つ', '→', 1350);
  add('nova', 'flash', 'フラッシュ', '星の光をぱっと広げる', '✦', 1250);

  add('aqua', 'bubble', 'シャボン', 'ふわふわ浮かぶ泡を出す', '○', 1750);
  add('aqua', 'wave', '小さな波', '足元から波を広げる', '～', 1500);
  add('aqua', 'ripple', '波紋', '足元に水の輪を広げる', '◎', 1600);
  add('aqua', 'jet', '水のダッシュ', '水しぶきを残して横に進む', '→', 1250);
  add('aqua', 'dive', 'ダイビング', '水に潜って跳び出す', '↓', 1750);
  add('aqua', 'rain', 'にわか雨', '頭の上から雨を降らせる', '⋮', 1800);

  Object.assign(skills, {
    jump: { name: '二段ジャンプ', description: '空中でもう一度跳ぶ', mark: '↑', effect: 'jump', color: '#a6e69d', accent: '#ffe596', glyph: '✦', duration: 1250, legacy: true },
    dash: { name: 'ダッシュ', description: 'すばやく前へ進む', mark: '→', effect: 'dash', color: '#b49bff', accent: '#e4d9ff', glyph: '✦', duration: 1250, legacy: true },
    shield: { name: 'シールド', description: '光のバリアを出す', mark: '◇', effect: 'shield', color: '#67ccff', accent: '#c2efff', glyph: '◇', duration: 1250, legacy: true },
    highjump: { name: 'ハイジャンプ', description: 'いつもより高く跳ぶ', mark: '⇈', effect: 'highjump', color: '#f4c847', accent: '#ffe39b', glyph: '✦', duration: 1250, legacy: true },
    glide: { name: 'ふわり', description: '少し浮いてゆっくり降りる', mark: '～', effect: 'glide', color: '#76ceee', accent: '#b4efff', glyph: '○', duration: 1900, legacy: true },
    magnet: { name: '星よせ', description: 'まわりの星を引き寄せる', mark: '◎', effect: 'magnet', color: '#f4c847', accent: '#ffe39b', glyph: '★', duration: 1250, legacy: true }
  });

  function allowed(character, skill) {
    return Object.hasOwn(characters, character) && typeof skill === 'string'
      && (characters[character].includes(skill) || legacy[character].includes(skill));
  }

  const api = { skills, characters, legacy, allowed };
  root.PixelSkillCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
