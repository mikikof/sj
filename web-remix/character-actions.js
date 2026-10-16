/* 特技のボタンを押すと、このページのキャラが動きます。 */
(function (global) {
  'use strict';
  global.PixelActions?.destroy();
  let current = null;
  const SKILL_NAMES = {
    jump: '二段ジャンプ', dash: 'ダッシュ', shield: 'シールド',
    highjump: 'ハイジャンプ', glide: 'ふわり', magnet: '星よせ'
  };
  const STYLE = `
.pa-effect-layer{position:fixed;inset:0;pointer-events:none;z-index:2147482000;overflow:hidden}
.pa-effect-label{position:absolute;transform:translateX(-50%);padding:7px 11px;background:#17233c;color:#f7ffef;border:2px solid #bcecc6;font:700 17px/1.3 system-ui,"Yu Gothic",sans-serif;white-space:nowrap;box-shadow:3px 3px 0 #17233c33}
.pa-effect-pixel{position:absolute;width:7px;height:7px;background:#9bf1c8}
.pa-effect-ring{position:absolute;border:5px solid #87e0ff;box-shadow:0 0 0 3px #183858,0 0 0 7px #8fe5ff40;border-radius:30%;background:#82dfff22;box-sizing:border-box}
.pa-effect-ghost{position:absolute;object-fit:contain;image-rendering:pixelated;opacity:.3}
.pa-effect-glyph{position:absolute;font:900 28px/1 ui-monospace,monospace;text-shadow:2px 2px #17233c44;white-space:pre;transform-origin:center}
.pa-effect-hoop{position:absolute;border:4px solid;box-sizing:border-box;border-radius:50%}
.pa-effect-streak{position:absolute;box-sizing:border-box;box-shadow:0 0 0 2px #ffffff55}
.pa-effect-box{position:absolute;border:4px solid #956030;background:#dfad6b;box-shadow:inset 0 8px #efc789,4px 4px #17233c22;box-sizing:border-box}
.pa-effect-box:after{content:"";position:absolute;left:45%;top:0;width:10%;height:100%;background:#f5d6a4}
.pa-effect-paw{position:absolute;width:24px;height:22px;color:inherit;background:currentColor;border-radius:45% 45% 50% 50%;box-shadow:-10px -15px 0 -4px currentColor,0 -20px 0 -4px currentColor,11px -15px 0 -4px currentColor}
.pa-effect-star{position:absolute;color:#ffe39b;font:22px/1 system-ui,sans-serif;text-shadow:2px 2px #453660}
`;

  function mount(root) {
    destroy();
    root = root || global.document;
    if (!root?.querySelector) return;
    global.PixelCharacter?.apply(root);
    const doc = root.ownerDocument || root;
    const win = doc.defaultView || global;
    const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let disposed = false, effect = null;
    const node = (tag, className, text) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const generated = element => {
      element.setAttribute('data-generated', 'pixel-actions');
      return element;
    };
    const style = generated(node('style'));
    style.textContent = STYLE;
    (doc.head || doc.documentElement).append(style);

    // もう一度押されたら、前の演出を片づけて最初から動かします。
    function clearEffect() {
      if (!effect) return;
      effect.timers.forEach(id => win.clearTimeout(id));
      effect.animations.forEach(animation => {
        animation.onfinish = null;
        animation.cancel();
      });
      effect.layer.remove();
      effect = null;
    }

    function trigger(skill) {
      const catalog = global.PixelSkillCatalog;
      const signature = catalog?.skills && Object.hasOwn(catalog.skills, skill) ? catalog.skills[skill] : null;
      if (disposed || (!signature && !Object.hasOwn(SKILL_NAMES, skill))) return false;
      const button = root.querySelector('button[data-skill="' + skill + '"]');
      const img = root.querySelector('img.character, .character img');
      if (!button || button.disabled || button.closest('[data-generated]') || !img) return false;
      const characterId = img.getAttribute('data-character') || (img.getAttribute('src') || '').match(/assets\/(mint|ember|cloud|nova|aqua)\.svg/)?.[1];
      if (signature && characterId && !catalog.allowed(characterId, skill)) return false;
      clearEffect();
      let rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      if (rect.top < 70 || rect.bottom > win.innerHeight - 25 || rect.right < 0 || rect.left > win.innerWidth) {
        try { img.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' }); }
        catch (_) { img.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' }); }
        rect = img.getBoundingClientRect();
      }
      const layer = generated(node('div', 'pa-effect-layer'));
      layer.setAttribute('aria-hidden', 'true');
      doc.body.append(layer);
      const active = effect = { layer, timers: new Set(), animations: new Set() };
      const later = (fn, delay) => {
        const id = win.setTimeout(() => {
          active.timers.delete(id);
          if (!disposed && effect === active) fn();
        }, delay);
        active.timers.add(id);
      };
      const animate = (element, frames, duration, easing = 'linear') => {
        if (typeof element.animate !== 'function') return;
        const animation = element.animate(frames, { duration, easing });
        active.animations.add(animation);
        animation.onfinish = () => {
          active.animations.delete(animation);
          animation.cancel();
        };
      };
      later(clearEffect, signature && !signature.legacy ? 2400 : skill === 'glide' ? 1900 : 1250);
      const label = node('span', 'pa-effect-label', signature?.name || SKILL_NAMES[skill]);
      label.style.left = Math.max(70, Math.min(win.innerWidth - 70, rect.left + rect.width / 2)) + 'px';
      label.style.top = Math.max(8, rect.top - (media?.matches ? 20 : 55)) + 'px';
      layer.append(label);

      // 動きを減らす設定では、移動の代わりに名前と短い点滅で知らせます。
      if (media?.matches) {
        animate(img, [{ opacity: 1 }, { opacity: .6 }, { opacity: 1 }], 220);
        return true;
      }
      animate(label, [
        { opacity: 0, translate: '0 5px' }, { opacity: 1, translate: '0 0', offset: .15 },
        { opacity: 1, offset: .8 }, { opacity: 0, translate: '0 -6px' }
      ], 1150);
      const appearance = win.getComputedStyle?.(img) || {};
      const base = appearance.transform && appearance.transform !== 'none' ? appearance.transform : '';
      const move = (x, y, sx = 1, sy = 1) => `translate(${x}px, ${y}px) ${base} scale(${sx}, ${sy})`;
      const burst = (x, y, color) => {
        for (let i = 0; i < 9; i++) {
          const pixel = node('i', 'pa-effect-pixel'), angle = i / 9 * Math.PI * 2;
          pixel.style.cssText = `left:${x}px;top:${y}px;background:${color};`;
          layer.append(pixel);
          animate(pixel, [
            { opacity: .95, transform: 'translate(0,0) scale(1)' },
            { opacity: 0, transform: `translate(${Math.cos(angle) * 55}px,${Math.sin(angle) * 34 - 13}px) scale(.3)` }
          ], 450);
          later(() => pixel.remove(), 450);
        }
      };
      const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;

      // 固有技は、キャラの移動と小さな図形を組み合わせて作ります。
      const pose = (x = 0, y = 0, sx = 1, sy = 1, turn = 0, opacity = 1) => ({
        transform: move(x, y, sx, sy) + ` rotate(${turn}deg)`, opacity
      });
      const motion = (frames, duration = 1200, easing = 'ease-in-out') => animate(img, frames, duration, easing);
      const glyph = (mark, x, y, dx, dy, color, duration = 850, size = 26) => {
        const part = node('span', 'pa-effect-glyph', mark);
        part.style.cssText = `left:${x}px;top:${y}px;color:${color};font-size:${size}px;`;
        layer.append(part);
        animate(part, [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' },
          { opacity: 1, offset: .18 },
          { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.1)` }
        ], duration, 'ease-out');
        return part;
      };
      const hoop = (x, y, width, height, color, duration = 850, from = .3, to = 1.6) => {
        const part = node('i', 'pa-effect-hoop');
        part.style.cssText = `left:${x - width / 2}px;top:${y - height / 2}px;width:${width}px;height:${height}px;border-color:${color};`;
        layer.append(part);
        animate(part, [
          { opacity: 0, transform: `scale(${from})` },
          { opacity: .9, offset: .18 },
          { opacity: 0, transform: `scale(${to})` }
        ], duration, 'ease-out');
        return part;
      };
      const streak = (x, y, width, height, color, dx, dy, duration = 650, angle = 0) => {
        const part = node('i', 'pa-effect-streak');
        part.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${color};`;
        layer.append(part);
        animate(part, [
          { opacity: 0, transform: `rotate(${angle}deg) scaleX(.2)` },
          { opacity: 1, offset: .2 },
          { opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(${angle}deg) scaleX(1)` }
        ], duration, 'ease-out');
        return part;
      };
      const shower = (x, y, color, count = 9, radius = 65, mark = '✦') => {
        for (let i = 0; i < count; i++) {
          const angle = i / count * Math.PI * 2;
          glyph(mark, x, y, Math.cos(angle) * radius, Math.sin(angle) * radius * .65, color, 800, 13 + i % 3 * 4);
        }
      };
      const ghost = (x, y, dx, dy, duration = 650) => {
        const part = node('img', 'pa-effect-ghost');
        part.alt = '';
        part.src = img.currentSrc || img.src;
        part.style.cssText = `left:${x}px;top:${y}px;width:${rect.width}px;height:${rect.height}px;`;
        part.style.filter = appearance.filter || 'none';
        const face = /^matrix(?:3d)?\(\s*-/.test(base) || /scaleX\(\s*-1\s*\)/.test(base) ? 'scaleX(-1)' : '';
        animate(part, [{ opacity: .35, transform: face || 'none' }, { opacity: 0, transform: `translate(${dx}px,${dy}px) ${face}` }], duration);
        layer.append(part);
        return part;
      };
      const footY = rect.bottom - 5;
      const leftRoom = Math.min(65, Math.max(12, rect.left - 12));
      const rightRoom = Math.min(65, Math.max(12, win.innerWidth - rect.right - 12));
      const jumpRoom = Math.min(85, Math.max(28, rect.top - 38));
      const color = signature?.color || '#8ae5c4', accent = signature?.accent || '#fff0a5';

      if (signature && !Object.hasOwn(SKILL_NAMES, skill)) {
        // ミント：音符、音の輪、ステップ。
        if (skill === 'mint-beat') {
          motion([pose(), pose(0, 7, 1.12, .88), pose(0, -24), pose(), pose(0, -35, .97, 1.03), pose()], 1250);
          [0, 420, 800].forEach((delay, i) => later(() => {
            hoop(centerX, footY, rect.width + 25, 22, color, 600);
            glyph(i % 2 ? '♫' : '♪', centerX + (i % 2 ? 35 : -35), centerY, i % 2 ? 15 : -15, -65, accent, 800);
          }, delay));
        } else if (skill === 'mint-wave') {
          motion([pose(), pose(-7, 1, .97, 1.04, -8), pose(12, -7, 1.04, .96, 10), pose()], 1000);
          [0, 180, 360].forEach(delay => later(() => hoop(centerX + 15, centerY, 65, 90, color, 900, .1, 2), delay));
          later(() => glyph('♫', centerX + 22, centerY, 65, -20, accent), 200);
        } else if (skill === 'mint-dash') {
          motion([pose(), pose(-12, 3, .9, 1.05), pose(rightRoom, 0, 1.15, .9), pose(rightRoom, 0), pose()], 1100);
          [0, 1, 2].forEach(i => later(() => {
            ghost(rect.left + rightRoom * i / 3, rect.top, -12, 0);
            glyph('♪', centerX + rightRoom * i / 3, footY, -35, -25, color, 650, 22);
          }, 160 + i * 90));
        } else if (skill === 'mint-guard') {
          motion([pose(), pose(0, -5, 1.04, 1.04), pose()], 1200);
          const shield = hoop(centerX, centerY, rect.width + 22, rect.height + 22, color, 1450, .6, 1.1);
          shield.style.borderRadius = '25%';
          shield.style.background = color + '25';
          for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            glyph('♪', centerX + Math.cos(angle) * 65, centerY + Math.sin(angle) * 55, Math.cos(angle) * 12, Math.sin(angle) * 12, accent, 1300, 24);
          }
        } else if (skill === 'mint-moonwalk') {
          motion([pose(), pose(-leftRoom * .3, -3, 1, 1, -5), pose(-leftRoom * .55, 0, 1, .96, 4), pose(-leftRoom, -3, 1, 1, -5), pose(-leftRoom, 0), pose()], 1700, 'linear');
          [0, 1, 2, 3].forEach(i => later(() => streak(centerX - leftRoom * i / 4, footY, 15, 4, color, 12, 0, 600), i * 230));
          glyph('♪', centerX, centerY - 30, 25, -15, accent, 1600);
        } else if (skill === 'mint-dance') {
          motion([pose(), pose(-16, -7, 1, 1, -14), pose(16, -7, 1, 1, 14), pose(-16, -7, 1, 1, -14), pose(16, -7, 1, 1, 14), pose(0, -30, .95, 1.05), pose()], 1700);
          [0, 1, 2, 3].forEach(i => later(() => glyph(i % 2 ? '♫' : '♪', centerX + (i % 2 ? 45 : -45), centerY, i % 2 ? 20 : -20, -50, i % 2 ? color : accent, 750), i * 280));
        // エンバー：炎の尾、花火、回転キック。
        } else if (skill === 'ember-dash') {
          motion([pose(), pose(-8, 4, .92, 1.03), pose(rightRoom, -8, 1.2, .88), pose(rightRoom, 0), pose()], 1050, 'ease-out');
          [0, 1, 2, 3].forEach(i => later(() => {
            streak(centerX - 45 + rightRoom * i / 4, centerY + (i % 2 ? 14 : -4), 42, 9, i % 2 ? color : accent, -25, 0, 500);
            glyph('▲', centerX + rightRoom * i / 4, footY - 10, -20, -22, accent, 550, 18);
          }, 120 + i * 95));
        } else if (skill === 'ember-fireworks') {
          motion([pose(), pose(0, 7, 1.12, .88), pose(0, -15, .95, 1.06), pose()], 1400);
          streak(centerX, centerY, 5, 28, accent, 0, -jumpRoom, 520);
          [0, 1, 2].forEach(i => later(() => shower(centerX + (i - 1) * 35, rect.top - 10 - i % 2 * 25, i % 2 ? accent : color, 10, 45 + i * 7, '✦'), 300 + i * 220));
        } else if (skill === 'ember-jump') {
          motion([pose(), pose(0, 10, 1.16, .84), pose(0, -jumpRoom, .92, 1.08), pose(0, -jumpRoom * .7), pose(0, 4, 1.12, .9), pose()], 1300);
          [0, 160, 320].forEach(delay => later(() => {
            hoop(centerX, footY, rect.width + 20, 24, color, 650);
            shower(centerX, footY, accent, 7, 40, '▲');
          }, delay));
        } else if (skill === 'ember-ring') {
          motion([pose(), pose(0, -8, 1.04, 1.02), pose()], 1450);
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2;
            later(() => glyph('▲', centerX + Math.cos(a) * 60, centerY + Math.sin(a) * 55, Math.cos(a) * 20, -18, i % 2 ? color : accent, 850, 24), i * 65);
          }
          hoop(centerX, centerY, rect.width + 30, rect.height + 30, color, 1550, .8, 1.2);
        } else if (skill === 'ember-spin') {
          motion([pose(), pose(0, -16, 1, 1, -25), pose(0, -25, 1, 1, 160), pose(0, -16, 1, 1, 340), pose(0, 0, 1, 1, 360)], 1300);
          [0, 1, 2, 3, 4].forEach(i => later(() => {
            const a = i / 5 * Math.PI * 2;
            streak(centerX + Math.cos(a) * 42, centerY + Math.sin(a) * 38, 32, 7, i % 2 ? accent : color, Math.cos(a) * 20, Math.sin(a) * 20, 550, i * 72);
          }, i * 160));
        } else if (skill === 'ember-kick') {
          motion([pose(), pose(-14, 7, .95, .95, -15), pose(rightRoom * .7, -28, 1.12, .9, 35), pose(rightRoom * .7, -20, 1.05, .95, 30), pose()], 1150);
          later(() => {
            const x = Math.min(win.innerWidth - 25, centerX + rightRoom + 32);
            shower(x, centerY, accent, 8, 38, '✦');
            streak(x - 30, centerY, 45, 8, color, 25, -5, 550, -20);
          }, 360);
        // クラウド：足あと、段ボール、ねこパンチ。
        } else if (skill === 'cloud-hop') {
          motion([pose(), pose(-leftRoom * .5, -25, .95, 1.05, -8), pose(-leftRoom * .5, 3, 1.1, .9), pose(rightRoom * .5, -38, .95, 1.05, 8), pose(rightRoom * .5, 3, 1.1, .9), pose()], 1500);
          [0, 1, 2].forEach(i => later(() => glyph('· ·', centerX + (i - 1) * 25, footY, 0, 5, color, 800, 30), i * 430));
        } else if (skill === 'cloud-paw') {
          motion([pose(), pose(-10, 3, 1, .95, -9), pose(22, -7, 1.1, .95, 12), pose(), pose(20, -5, 1.1, .95, 12), pose()], 1250);
          [220, 700].forEach(delay => later(() => {
            const paw = node('i', 'pa-effect-paw');
            paw.style.cssText = `left:${centerX + 32}px;top:${centerY - 8}px;color:${color};`;
            layer.append(paw);
            animate(paw, [{ opacity: 0, transform: 'scale(.3) rotate(-20deg)' }, { opacity: 1, transform: 'scale(1.3) rotate(10deg)', offset: .35 }, { opacity: 0, transform: 'translate(25px,-8px) scale(.8)' }], 500);
          }, delay));
        } else if (skill === 'cloud-box') {
          const box = node('i', 'pa-effect-box');
          box.style.cssText = `left:${centerX - rect.width * .46}px;top:${rect.bottom - rect.height * .4}px;width:${rect.width * .92}px;height:${rect.height * .45}px;`;
          layer.append(box);
          animate(box, [{ opacity: 0, transform: 'scaleY(.1)' }, { opacity: 1, transform: 'scaleY(1)', offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0, transform: 'scaleY(.8)' }], 1800);
          motion([pose(), pose(0, -20), pose(0, 17, .78, .55, 0, .15), pose(0, 17, .78, .55, 0, .15), pose(0, -25, .95, 1.05), pose()], 1800);
          later(() => glyph('?', centerX + 32, rect.top + 10, 0, -15, color, 600, 27), 650);
        } else if (skill === 'cloud-scan') {
          motion([pose(), pose(-7, -3, 1, 1, -9), pose(7, -3, 1, 1, 9), pose()], 1500);
          const scan = streak(rect.left - 20, rect.top - 8, rect.width + 40, 5, color, 0, rect.height + 20, 1350);
          scan.style.boxShadow = '0 0 12px ' + color;
          [0, 1, 2, 3].forEach(i => {
            const x = i % 2 ? rect.right + 8 : rect.left - 16;
            const y = i < 2 ? rect.top : rect.bottom - 10;
            glyph('+', x, y, 0, 0, accent, 1500, 24);
          });
        } else if (skill === 'cloud-spin') {
          motion([pose(), pose(0, -8, 1, 1, -30), pose(-10, -12, 1, 1, -160), pose(10, -12, 1, 1, -290), pose(0, 0, 1, 1, -360)], 1450);
          [0, 1, 2, 3].forEach(i => later(() => {
            hoop(centerX, centerY + 20, rect.width + 35, 30, i % 2 ? color : accent, 600, .6, 1.2);
            glyph('✦', centerX + (i % 2 ? 48 : -48), centerY, 0, -20, color, 650, 18);
          }, i * 220));
        } else if (skill === 'cloud-nap') {
          motion([pose(), pose(0, 10, 1.15, .7, -8), pose(0, 8, 1.1, .74, -8), pose(0, 10, 1.15, .7, -8), pose(), pose(0, -8), pose()], 1900);
          [0, 1, 2].forEach(i => later(() => glyph('z', centerX + 25 + i * 8, rect.top + 25, 12, -35 - i * 8, color, 850, 17 + i * 5), 250 + i * 320));
        // ノヴァ：ロケット、流星、星の軌道。
        } else if (skill === 'nova-rocket') {
          motion([pose(), pose(-3, 4), pose(3, 4), pose(0, -jumpRoom, .9, 1.12), pose(0, -jumpRoom * .8), pose()], 1550);
          [0, 1, 2, 3].forEach(i => later(() => {
            streak(centerX - 9 + i % 2 * 12, footY - i * 16, 7, 28, i % 2 ? color : accent, 0, 45, 600);
            shower(centerX, footY, accent, 5, 28, '·');
          }, 240 + i * 110));
        } else if (skill === 'nova-meteor') {
          motion([pose(), pose(-8, 0, 1, 1, -6), pose(0, -12, .96, 1.04), pose()], 1300);
          [0, 1, 2].forEach(i => later(() => {
            const x = centerX - 50 + i * 35;
            streak(x - 35, rect.top - 25, 38, 4, accent, 65, 70, 750, 45);
            glyph('★', x, rect.top - 8, 65, 70, i % 2 ? color : accent, 800, 22);
          }, i * 230));
        } else if (skill === 'nova-orbit') {
          motion([pose(), pose(0, -18), pose(0, -22), pose()], 1800);
          hoop(centerX, centerY, rect.width + 60, 50, color, 1750, .85, 1.05);
          for (let i = 0; i < 3; i++) {
            const star = node('span', 'pa-effect-glyph', '★');
            star.style.cssText = `left:${centerX}px;top:${centerY}px;color:${i % 2 ? color : accent};font-size:21px;`;
            layer.append(star);
            const frames = Array.from({ length: 13 }, (_, j) => {
              const a = j / 12 * Math.PI * 2 + i * Math.PI * 2 / 3;
              return { transform: `translate(${Math.cos(a) * (rect.width / 2 + 30)}px,${Math.sin(a) * 27}px) scale(${.8 + (Math.sin(a) + 1) * .2})`, opacity: j === 12 ? 0 : 1 };
            });
            animate(star, frames, 1700);
          }
        } else if (skill === 'nova-gather') {
          motion([pose(), pose(0, -8, .95, 1.05), pose(0, -3, 1.12, 1.12), pose()], 1450);
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 90, y = Math.sin(a) * 70;
            glyph('★', centerX + x, centerY + y, -x, -y, i % 2 ? color : accent, 1100, 18);
          }
          later(() => hoop(centerX, centerY, 60, 60, accent, 700), 900);
        } else if (skill === 'nova-beam') {
          motion([pose(), pose(-12, 2, .93, 1.06), pose(8, -3, 1.12, .95), pose()], 1350);
          const end = Math.min(140, Math.max(40, win.innerWidth - rect.right - 14));
          hoop(rect.right - 15, centerY, 32, 38, color, 700, 1.4, .4);
          later(() => {
            streak(rect.right - 10, centerY - 7, end, 14, color, 10, 0, 750);
            streak(rect.right - 10, centerY - 2, end, 4, accent, 10, 0, 800);
            glyph('✦', rect.right + end - 15, centerY, 0, 0, accent, 750, 33);
          }, 380);
        } else if (skill === 'nova-flash') {
          motion([pose(), pose(0, 0, .3, 1.15, 0, 0), pose(rightRoom, -12, .3, 1.15, 0, 0), pose(rightRoom, -12), pose(rightRoom, -12, .3, 1.15, 0, 0), pose(), pose()], 1500);
          [0, 1, 2].forEach(i => later(() => {
            const x = centerX + (i === 1 ? rightRoom : 0);
            shower(x, centerY + (i === 1 ? -12 : 0), accent, 7, 43, '✦');
            hoop(x, centerY, 45, rect.height + 12, color, 450);
          }, 120 + i * 500));
        // アクア：泡、水面、しずく。
        } else if (skill === 'aqua-bubble') {
          motion([pose(), pose(0, -18, .98, 1.02), pose(7, -27), pose()], 1650);
          for (let i = 0; i < 6; i++) later(() => {
            const bubble = hoop(centerX - 45 + i * 18, footY - i % 2 * 18, 16 + i % 3 * 7, 16 + i % 3 * 7, i % 2 ? color : accent, 1100, .4, 1.3);
            animate(bubble, [{ translate: '0 0' }, { translate: `${i % 2 ? 12 : -12}px -85px` }], 1100, 'ease-out');
          }, i * 110);
        } else if (skill === 'aqua-wave') {
          motion([pose(), pose(-leftRoom * .4, -8, 1, 1, -8), pose(rightRoom * .6, -27, 1, 1, 12), pose(rightRoom * .2, -8, 1, 1, -5), pose()], 1500);
          [0, 1, 2, 3].forEach(i => later(() => {
            const wave = hoop(centerX - 35 + i * 24, footY - 5, 65, 35, i % 2 ? color : accent, 1000, .7, 1.5);
            wave.style.borderBottomColor = 'transparent';
            wave.style.borderLeftColor = 'transparent';
            animate(wave, [{ translate: '-15px 0' }, { translate: '35px -10px' }], 1000);
          }, i * 170));
        } else if (skill === 'aqua-ripple') {
          motion([pose(), pose(0, 7, 1.12, .88), pose(0, -8), pose()], 1050);
          [0, 220, 440, 660].forEach(delay => later(() => hoop(centerX, footY, rect.width + 30, 32, color, 1050, .1, 1.9), delay));
        } else if (skill === 'aqua-jet') {
          motion([pose(), pose(-8, 4, .95, 1.05), pose(rightRoom, -12, 1.2, .88), pose(rightRoom, -8), pose()], 1200);
          [0, 1, 2, 3].forEach(i => later(() => {
            streak(rect.left - 12 + rightRoom * i / 4, centerY + (i % 2 ? 8 : -8), 35, 5, i % 2 ? color : accent, -45, i % 2 ? 12 : -12, 700);
            glyph('●', rect.left + rightRoom * i / 4, centerY, -55, 15, color, 700, 10);
          }, 140 + i * 100));
        } else if (skill === 'aqua-dive') {
          motion([pose(), pose(0, -25, .95, 1.05), pose(0, 20, .85, .35, 15, .1), pose(0, 20, .85, .35, 15, .1), pose(0, -35, .9, 1.1), pose()], 1700);
          [300, 1150].forEach(delay => later(() => {
            hoop(centerX, footY, rect.width + 25, 30, color, 850, .5, 1.8);
            shower(centerX, footY, accent, 9, 55, '●');
          }, delay));
        } else if (skill === 'aqua-rain') {
          motion([pose(), pose(-5, -8, 1, 1, -5), pose(5, -8, 1, 1, 5), pose()], 1700);
          for (let i = 0; i < 15; i++) later(() => {
            const x = rect.left - 20 + (i * 29 % (rect.width + 40));
            streak(x, rect.top - 20, 4, 14, i % 2 ? color : accent, -10, rect.height + 25, 650, 12);
            later(() => hoop(x - 10, footY, 16, 7, color, 350, .4, 1.5), 500);
          }, i * 70);
        } else {
          clearEffect();
          return false;
        }
        return true;
      }

      // 二段ジャンプ：一度跳び、空中でもう一度跳びます。
      if (skill === 'jump') {
        animate(img, [
          { transform: move(0, 0), offset: 0 }, { transform: move(0, 9, 1.12, .88), offset: .09 },
          { transform: move(0, -42, .94, 1.05), offset: .25 }, { transform: move(0, -35), offset: .35 },
          { transform: move(0, -80, .94, 1.05), offset: .5 }, { transform: move(0, -83), offset: .58 },
          { transform: move(0, 6, 1.12, .88), offset: .88 }, { transform: move(0, 0), offset: 1 }
        ], 970);
        later(() => burst(centerX, rect.bottom - 12, '#c1f6a3'), 90);
        later(() => burst(centerX, rect.bottom - 48, '#ffe596'), 350);
        later(() => burst(centerX, rect.bottom - 8, '#c1f6a3'), 850);
      } else if (skill === 'dash') {
        // ダッシュ：素早く横に動き、残像を残します。
        const distance = Math.min(86, Math.max(25, (win.innerWidth - rect.right) * .65));
        animate(img, [
          { transform: move(0, 0), offset: 0 }, { transform: move(-12, 3, .91, 1.04), offset: .13 },
          { transform: move(distance, 0, 1.15, .92), offset: .32 }, { transform: move(distance, 0), offset: .55 },
          { transform: move(0, 0), offset: 1 }
        ], 900, 'ease-out');
        [0, 1, 2].forEach(n => later(() => {
          const ghost = node('img', 'pa-effect-ghost');
          ghost.alt = '';
          ghost.src = img.currentSrc || img.src;
          ghost.style.cssText = `left:${rect.left + distance * n / 3}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
          ghost.style.filter = appearance.filter || 'none';
          if (/^matrix(?:3d)?\(\s*-/.test(base) || /scaleX\(\s*-1\s*\)/.test(base)) ghost.style.transform = 'scaleX(-1)';
          layer.append(ghost);
          animate(ghost, [{ opacity: .3 }, { opacity: 0 }], 480);
          later(() => ghost.remove(), 480);
        }, 120 + n * 45));
        later(() => burst(centerX, rect.bottom - 10, '#c3acff'), 140);
      } else if (skill === 'highjump') {
        // ハイジャンプ：ためを作って高く跳びます。
        const height = Math.min(125, Math.max(50, rect.top - 8));
        animate(img, [
          { transform: move(0, 0) }, { transform: move(0, 8, 1.12, .88), offset: .12 },
          { transform: move(0, -height, .92, 1.08), offset: .48 },
          { transform: move(0, -height * .68), offset: .65 }, { transform: move(0, 0) }
        ], 1100, 'ease-out');
        burst(centerX, rect.bottom - 8, '#ffe39b');
      } else if (skill === 'glide') {
        // ふわり：浮き上がって、ゆっくり戻ります。
        animate(img, [
          { transform: move(0, 0) }, { transform: move(0, -38, 1.03, 1), offset: .22 },
          { transform: move(8, -45), offset: .5 }, { transform: move(-6, -28), offset: .78 },
          { transform: move(0, 0) }
        ], 1750, 'ease-in-out');
        burst(centerX, rect.bottom, '#b4efff');
      } else if (skill === 'magnet') {
        // 星よせ：まわりの星がキャラに集まります。
        for (let i = 0; i < 6; i++) {
          const star = node('span', 'pa-effect-star', '★'), angle = i * Math.PI / 3;
          star.style.left = centerX + 'px';
          star.style.top = centerY + 'px';
          layer.append(star);
          animate(star, [
            { transform: `translate(${Math.cos(angle) * 110}px,${Math.sin(angle) * 80}px)`, opacity: 1 },
            { transform: 'translate(0,0) scale(.3)', opacity: 0 }
          ], 950, 'ease-in');
        }
      } else if (skill === 'shield') {
        // シールド：キャラのまわりに光る壁を作ります。
        const ring = node('div', 'pa-effect-ring');
        ring.style.cssText = `left:${rect.left - 8}px;top:${rect.top - 8}px;width:${rect.width + 16}px;height:${rect.height + 16}px;`;
        layer.append(ring);
        animate(ring, [
          { opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.03)', offset: .18 },
          { opacity: 1, transform: 'scale(1)', offset: .78 }, { opacity: 0, transform: 'scale(1.1)' }
        ], 1050);
        burst(centerX, centerY, '#a2e5ff');
      }
      return true;
    }

    // HTMLの data-skill の値を読み、その特技を動かします。
    function onClick(event) {
      const button = event.target.closest?.('button[data-skill]');
      if (!button || button.disabled || button.closest('[data-generated]') || event.defaultPrevented) return;
      event.preventDefault();
      trigger(button.getAttribute('data-skill'));
    }
    root.addEventListener('click', onClick);
    current = {
      trigger,
      refreshAppearance() { global.PixelCharacter?.apply(root); },
      destroy() {
        disposed = true;
        clearEffect();
        root.removeEventListener('click', onClick);
        style.remove();
      }
    };
    return current;
  }

  function destroy() {
    current?.destroy();
    current = null;
  }
  global.PixelActions = {
    mount, destroy,
    trigger: skill => current ? current.trigger(skill) : false,
    refreshAppearance: () => current?.refreshAppearance()
  };
})(typeof window !== 'undefined' ? window : globalThis);
