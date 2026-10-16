(function (root) {
'use strict';

const target = Object.freeze({
  name: 'ソラ',
  description: '好きなことはゲームと音楽。',
  background: '#dbeafe',
  heading: '#1d4ed8',
  imageWidth: '64px',
  border: '12px outset #334155'
});
const questions = [
  {
    id: 'heading', prompt: '名前を見出しとして書くパーツは？', answer: 'h1',
    explanation: 'h1 はページの主な見出し。名前が入りました。',
    options: [
      {id: 'h1', label: 'HTML の h1', kind: 'html', code: '<h1>ミント</h1>'},
      {id: 'heading-color', label: 'CSS の color', kind: 'css', code: 'h1 { color: #334155; }'},
      {id: 'link', label: 'HTML の a', kind: 'html', code: '<a href="about.html">もっと見る</a>'}
    ]
  },
  {
    id: 'paragraph', prompt: '説明文を書くパーツは？', answer: 'p',
    explanation: 'p は文章のまとまり。名前の下に説明が入りました。',
    options: [
      {id: 'image', label: 'HTML の img', kind: 'html', code: '<img src="assets/mint.svg" alt="ミント">'},
      {id: 'p', label: 'HTML の p', kind: 'html', code: '<p>ここに説明が入ります。</p>'},
      {id: 'paragraph-size', label: 'CSS の font-size', kind: 'css', code: 'p { font-size: 18px; }'}
    ]
  },
  {
    id: 'style', prompt: 'カードに背景色と枠をつけるのは？', answer: 'card-style',
    explanation: 'CSS で見た目が変わりました。次は文字や色、大きさを自分で変えます。',
    options: [
      {id: 'card-html', label: 'HTML の div', kind: 'html', code: '<div class="card"></div>'},
      {id: 'message', label: 'JavaScript の alert', kind: 'js', code: 'alert("こんにちは");'},
      {id: 'card-style', label: 'CSS の background-color と border', kind: 'css', code: '.card { background-color: #ffffff; border: 2px solid #334155; }'}
    ]
  }
];
for (const question of questions) {
  question.options.forEach(Object.freeze);
  Object.freeze(question.options);
  Object.freeze(question);
}
Object.freeze(questions);

function source(name, description, count) {
  return '<!doctype html>\n<html lang="ja">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>キャラの紹介カード</title>\n</head>\n<body>\n  <main class="card">\n    <img src="assets/mint.svg" width="64" height="64" alt="ミント色のキャラクター">\n' +
    (count >= 1 ? '    <h1>' + name + '</h1>\n' : '') +
    (count >= 2 ? '    <p>' + description + '</p>\n' : '') +
    '  </main>\n</body>\n</html>';
}
function sheet(background, heading, imageWidth, border) {
  return 'body {\n  background-color: ' + background + ';\n  color: #334155;\n  font-family: sans-serif;\n  margin: 0;\n  padding: 12px;\n}\nh1 {\n  color: ' + heading + ';\n  font-size: 24px;\n  margin: 0;\n}\n.card {\n  display: grid;\n  grid-template-columns: 64px 1fr;\n  column-gap: 14px;\n  max-width: 420px;\n  margin: 0 auto;\n  padding: 14px;\n  background-color: #ffffff;\n  border: ' + border + ';\n}\nimg { width: ' + imageWidth + '; height: auto; grid-row: 1 / 3; align-self: center; image-rendering: pixelated; }\np { font-size: 16px; line-height: 1.5; margin: 4px 0 0; }\n';
}
function initial() {
  return {html: source('ミント', 'ここに説明が入ります。', 3), css: sheet('#f1f5f9', '#334155', '16px', '2px solid #334155')};
}
function reference() {
  return {html: source(target.name, target.description, 3), css: sheet(target.background, target.heading, target.imageWidth, target.border)};
}
function assembly(count) {
  const n = Math.min(3, Math.max(0, Number(count) || 0));
  return {html: source('ミント', 'ここに説明が入ります。', n), css: n >= 3 ? initial().css : ''};
}

// Locate authored tags without treating comments, attributes or script text as tags.
// DOMParser decides the meaning; these ranges only point the learner to their source.
function htmlRanges(html) {
  const nodes = [], stack = [];
  const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf('<', index);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }
    let end = start + 1, quote = '';
    for (; end < html.length; end++) {
      const c = html[end];
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    if (end === html.length) break;
    const raw = html.slice(start, end + 1);
    index = end + 1;
    const match = /^<\s*(\/?)\s*([a-z][\w:-]*)\b/i.exec(raw);
    if (!match) continue;
    const name = match[2].toLowerCase();
    if (match[1]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name !== name) continue;
        stack[i].contentEnd = start;
        stack[i].end = end + 1;
        stack.length = i;
        break;
      }
      continue;
    }
    const node = {name, start, end: end + 1, contentStart: end + 1, contentEnd: end + 1, raw, parent: stack[stack.length - 1] || null};
    nodes.push(node);
    if (/^(?:script|style|textarea|title|template)$/i.test(name)) {
      const close = new RegExp('</\\s*' + name + '\\s*>', 'ig');
      close.lastIndex = index;
      const found = close.exec(html);
      node.contentEnd = found ? found.index : html.length;
      node.end = found ? close.lastIndex : html.length;
      index = node.end;
      continue;
    }
    if (!voidTags.test(name) && !/\/\s*>$/.test(raw)) stack.push(node);
  }
  return nodes;
}
function hasCardClass(node) {
  const match = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(node.raw);
  return !!match && (match[1] || match[2] || match[3] || '').split(/\s+/).includes('card');
}
function contentRange(nodes, name) {
  const node = nodes.find(n => n.name === name && n.parent && hasCardClass(n.parent));
  return node ? {start: node.contentStart, end: Math.max(node.contentStart, node.contentEnd)} : undefined;
}
function hiddenReason(element, parsed) {
  if (element.hasAttribute('hidden')) return {kind: 'html'};
  for (const property of ['display', 'visibility', 'opacity', 'content-visibility']) {
    const result = effective(parsed, element, [property]);
    if (result.uncertain) return {kind: 'css'};
    const declaration = result.winner;
    if (!declaration || declaration.property === 'all') continue;
    const value = declaration.value.toLowerCase();
    if (property === 'display' && value === 'none' ||
        property === 'visibility' && /^(?:hidden|collapse)$/.test(value) ||
        property === 'content-visibility' && value === 'hidden' ||
        property === 'opacity' && /^(?:0+(?:\.0*)?|\.0+)(?:%)?$/.test(value)) {
      return {kind: declaration.inline ? 'html' : 'css', range: declaration.inline ? undefined : declaration.range};
    }
  }
  return null;
}
function hiddenByStyle(element, parsed) { return !!hiddenReason(element, parsed); }

function visibleText(element, parsed) {
  if (!element) return null;
  for (let parent = element; parent && parent.nodeType === 1; parent = parent.parentElement) {
    if (hiddenByStyle(parent, parsed)) return null;
  }
  function read(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 || /^(?:script|style|template)$/.test(node.localName) || hiddenByStyle(node, parsed)) return '';
    return Array.from(node.childNodes).map(read).join('');
  }
  return Array.from(element.childNodes).map(read).join('').trim().replace(/\s+/g, ' ');
}

// A small CSS reader for this short exercise. Offsets are kept in the original
// UTF-16 source, including Japanese comments, so jump-to-code stays exact.
function maskComments(text) {
  let result = '', quote = '', malformed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      result += c;
      if (c === '\\' && i + 1 < text.length) result += text[++i];
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") { quote = c; result += c; }
    else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const next = end < 0 ? text.length : end + 2;
      result += text.slice(i, next).replace(/[^\n\r]/g, ' ');
      if (end < 0) malformed = true;
      i = next - 1;
    } else result += c;
  }
  return {text: result, malformed: malformed || !!quote};
}
function splitOutside(text, separator) {
  const parts = [];
  let start = 0, quote = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === separator && depth === 0) { parts.push({text: text.slice(start, i), start}); start = i + 1; }
  }
  parts.push({text: text.slice(start), start});
  return parts;
}
function declarations(text, offset) {
  const result = [];
  for (const part of splitOutside(text, ';')) {
    const match = /^\s*([-\w]+)\s*:\s*([\s\S]*?)\s*$/.exec(part.text);
    if (!match) { if (part.text.trim()) result.push({invalid: true}); continue; }
    const raw = match[2], important = /!\s*important\s*$/i.test(raw);
    const value = raw.replace(/!\s*important\s*$/i, '').trim();
    const relative = part.text.indexOf(':') + 1;
    const leading = /^\s*/.exec(part.text.slice(relative))[0].length;
    result.push({property: match[1].toLowerCase(), value, important,
      range: {start: offset + part.start + relative + leading, end: offset + part.start + relative + leading + value.length}});
  }
  return result;
}
function parseCSS(css) {
  const masked = maskComments(css), text = masked.text, rules = [];
  let cursor = 0, unsupported = masked.malformed;
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || '') && cursor < text.length) cursor++;
    if (cursor >= text.length) break;
    const open = text.indexOf('{', cursor);
    if (open < 0) { if (text.slice(cursor).trim()) unsupported = true; break; }
    const selector = text.slice(cursor, open).trim();
    let quote = '', depth = 1, close = open + 1, nested = false;
    for (; close < text.length; close++) {
      const c = text[close];
      if (quote) { if (c === '\\') close++; else if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '{') { depth++; nested = true; }
      else if (c === '}' && --depth === 0) break;
    }
    if (close >= text.length) { unsupported = true; break; }
    if (selector.startsWith('@') || nested) unsupported = true;
    else {
      const list = splitOutside(selector, ',').map(p => p.text.trim());
      const decls = declarations(text.slice(open + 1, close), open + 1);
      rules.push({selectors: list, declarations: decls, start: cursor, end: close + 1});
    }
    cursor = close + 1;
  }
  return {rules, unsupported};
}
function specificity(selector) {
  // Conditional and advanced selectors deliberately do not guess a visual result.
  if (!/^[\w\s.#*>+~-]+$/.test(selector)) return null;
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+/g) || []).length;
  const rest = selector.replace(/[.#][\w-]+/g, '');
  const tags = (rest.match(/[a-zA-Z][\w-]*/g) || []).length;
  return [0, ids, classes, tags];
}
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function effective(parsed, element, properties) {
  let winner = null, uncertain = parsed.unsupported;
  if (!element) return {winner, uncertain: true};
  for (const rule of parsed.rules) {
    const relevant = rule.declarations.filter(d => properties.includes(d.property) || d.property === 'all');
    if (!relevant.length) continue;
    let best = null;
    for (const selector of rule.selectors) {
      const score = specificity(selector);
      if (!score) { uncertain = true; continue; }
      let matched = false;
      try { matched = element.matches(selector); } catch (_) { uncertain = true; }
      if (matched && (!best || compare(score, best) > 0)) best = score;
    }
    if (!best) continue;
    for (const declaration of relevant) {
      const priority = [declaration.important ? 1 : 0].concat(best);
      if (!winner || compare(priority, winner.priority) >= 0) winner = Object.assign({priority}, declaration);
    }
  }
  for (const declaration of declarations(maskComments(element.getAttribute('style') || '').text, 0)) {
    if (!properties.includes(declaration.property) && declaration.property !== 'all') continue;
    const priority = [declaration.important ? 1 : 0, 1, 0, 0, 0];
    if (!winner || compare(priority, winner.priority) >= 0) winner = Object.assign({priority, inline: true}, declaration);
  }
  return {winner, uncertain};
}
function directDeclaration(parsed, selector, property) {
  let found;
  for (const rule of parsed.rules) {
    if (!rule.selectors.some(s => s.toLowerCase() === selector)) continue;
    for (const declaration of rule.declarations) {
      if (declaration.property === property && (!found || !found.important || declaration.important)) found = declaration;
    }
  }
  return found;
}
function documentFor(html) {
  const Parser = root.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
  if (!Parser) return null;
  try { return new Parser().parseFromString(html, 'text/html'); } catch (_) { return null; }
}
function comparableValue(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/')
    .replace(/\b0(?:px|em|rem)\b/g, '0').replace(/#[0-9a-f]{3}\b/g, hex => '#' + hex.slice(1).split('').map(c => c + c).join(''));
}
function structuralIntegrity(doc, nodes, parsed, html, css) {
  const cards = doc ? doc.querySelectorAll('.card') : [];
  const card = cards.length === 1 ? cards[0] : null;
  const cardSource = nodes.find(hasCardClass);
  const htmlRange = node => node ? {start: node.start, end: node.contentStart} : {start: 0, end: 0};
  function problem(message, kind, range) { return {ok: false, message, kind, range}; }
  if (!card) return problem('カードの <main class="card"> を確認してください。カードは1つです。', 'html', htmlRange(cardSource));
  for (const name of ['img', 'h1', 'p']) {
    const elements = Array.from(card.children).filter(child => child.localName === name);
    const node = nodes.find(n => n.name === name && n.parent && hasCardClass(n.parent));
    if (elements.length !== 1) return problem('カードの中の <' + name + '> の行を確認してください。必要なパーツが消えたり重なったりしています。', 'html', htmlRange(node || cardSource));
    if (name === 'img') {
      const src = (elements[0].getAttribute('src') || '').replace(/^\.\//, '');
      if (src !== 'assets/mint.svg') return problem('画像のファイル名が変わっています。最初の画像を使います。', 'html', htmlRange(node));
    }
    for (let parent = elements[0]; parent && parent.nodeType === 1; parent = parent.parentElement) {
      const hidden = hiddenReason(parent, parsed);
      if (hidden) return problem('カードや画像が隠れています。非表示にしたコードを「戻す」で確認してください。', hidden.kind, hidden.range || (hidden.kind === 'html' ? htmlRange(node) : {start: css.length, end: css.length}));
    }
  }
  // These are the supplied card parts, not additional learner tasks. Keep the
  // starter layout intact while the six requested values are edited. This is
  // intentionally bounded to the short exercise stylesheet, not a pixel judge.
  const baseline = parseCSS(initial().css);
  for (const rule of baseline.rules) {
    const selector = rule.selectors[0];
    let element;
    try { element = selector === '.card' ? card : /^(?:h1|p|img)$/.test(selector) ? Array.from(card.children).find(child => child.localName === selector) : doc.querySelector(selector); } catch (_) {}
    for (const expected of rule.declarations) {
      if (selector === 'body' && expected.property === 'background-color' || selector === 'h1' && expected.property === 'color' ||
          selector === 'img' && expected.property === 'width' || selector === '.card' && expected.property === 'border') continue;
      const properties = expected.property === 'background-color' ? ['background-color', 'background'] : [expected.property];
      const actual = effective(parsed, element, properties);
      if (!actual.uncertain && actual.winner && actual.winner.property !== 'all' &&
          (comparableValue(actual.winner.value) === comparableValue(expected.value) ||
           selector === 'img' && expected.property === 'height' && comparableValue(actual.winner.value) === '64px')) continue;
      const ownRule = parsed.rules.find(r => r.selectors.includes(selector));
      const range = actual.winner && !actual.winner.inline ? actual.winner.range : ownRule ? {start: ownRule.start, end: ownRule.end} : {start: css.length, end: css.length};
      return problem('カードの配置や形も見本と比べてみましょう。変更を戻して確認できます。', 'css', range);
    }
  }
  return {ok: true, message: '', kind: null, range: undefined};
}

function validate(input) {
  const html = String(input && input.html || ''), css = String(input && input.css || '');
  const doc = documentFor(html), nodes = htmlRanges(html), parsed = parseCSS(css);
  const card = doc && doc.querySelectorAll('.card').length === 1 ? doc.querySelector('.card') : null;
  const headings = card ? Array.from(card.children).filter(n => n.localName === 'h1') : [];
  const paragraphs = card ? Array.from(card.children).filter(n => n.localName === 'p') : [];
  const h1 = headings.length === 1 ? headings[0] : null;
  const p = paragraphs.length === 1 ? paragraphs[0] : null;
  const images = card ? Array.from(card.children).filter(n => n.localName === 'img') : [];
  const img = images.length === 1 ? images[0] : null;
  const body = doc && doc.querySelector('body');
  const externalStyle = !!(doc && doc.querySelector('style, link[rel="stylesheet"]'));
  const checks = [
    {id: 'name', label: 'h1 の名前を「' + target.name + '」にする', kind: 'html', range: contentRange(nodes, 'h1'),
      ok: visibleText(h1, parsed) === target.name, message: '名前は見出しです。見出しのタグにはさまれた文章を探してみましょう。'},
    {id: 'description', label: 'p の説明を「' + target.description + '」にする', kind: 'html', range: contentRange(nodes, 'p'),
      ok: visibleText(p, parsed) === target.description, message: '説明文は文章のまとまりです。そのタグにはさまれた文章を探してみましょう。'}
  ];
  function checkColor(id, label, selector, property, element, expected, properties) {
    const direct = directDeclaration(parsed, selector, property);
    const result = effective(parsed, element, properties);
    const actual = result.winner;
    const ok = !!direct && direct.value.toLowerCase() === expected && !result.uncertain && !externalStyle && !!actual &&
      actual.property !== 'all' && actual.value.toLowerCase() === expected;
    checks.push({id, label, kind: 'css', range: direct && direct.range, ok,
      message: result.uncertain || externalStyle ? 'このチャレンジでは ' + selector + ' の ' + property + ' で色を指定します。' :
        property === 'background-color' ? 'ページ全体の背景は body で指定します。文字の色と区別してみましょう。' : '見出しの文字の色を指定するプロパティを探してみましょう。'});
  }
  checkColor('background', 'body の background-color を ' + target.background + ' にする', 'body', 'background-color', body, target.background, ['background-color', 'background']);
  checkColor('heading', 'h1 の color を ' + target.heading + ' にする', 'h1', 'color', h1, target.heading, ['color']);
  const imageDirect = directDeclaration(parsed, 'img', 'width');
  const imageWidth = effective(parsed, img, ['width', 'inline-size']);
  const imageBoundsOk = ['min', 'max'].every(bound => {
    const result = effective(parsed, img, [bound + '-width', bound + '-inline-size']);
    if (result.uncertain) return false;
    if (!result.winner) return true;
    if (result.winner.property === 'all') return false;
    const value = comparableValue(result.winner.value);
    if (bound === 'max' && value === 'none' || bound === 'min' && /^(?:auto|0)$/.test(value)) return true;
    if (!/^\d+(?:\.\d+)?px$/.test(value)) return false;
    return bound === 'min' ? parseFloat(value) <= 64 : parseFloat(value) >= 64;
  });
  checks.push({id: 'imageSize', label: 'img の width を ' + target.imageWidth + ' にする', kind: 'css',
    range: imageDirect && imageDirect.range,
    ok: !!imageDirect && comparableValue(imageDirect.value) === target.imageWidth && !imageWidth.uncertain && !externalStyle &&
      !!imageWidth.winner && imageWidth.winner.property !== 'all' && comparableValue(imageWidth.winner.value) === target.imageWidth && imageBoundsOk,
    message: '画像の横幅は width で指定します。数字の後ろの px も必要です。'});
  const borderDirect = directDeclaration(parsed, '.card', 'border');
  const borderOk = !!borderDirect && comparableValue(borderDirect.value) === target.border && !externalStyle &&
    ['top', 'right', 'bottom', 'left'].every(side => ['width', 'style', 'color'].every(facet => {
      // Border shorthands reset all their components. Check each physical edge
      // so a later border-width, border-style or border-top cannot slip through.
      const result = effective(parsed, card, ['border', 'border-' + facet, 'border-' + side, 'border-' + side + '-' + facet,
        'border-block', 'border-inline', 'border-block-' + facet, 'border-inline-' + facet,
        'border-block-start', 'border-block-end', 'border-inline-start', 'border-inline-end',
        'border-block-start-' + facet, 'border-block-end-' + facet, 'border-inline-start-' + facet, 'border-inline-end-' + facet]);
      if (result.uncertain || !result.winner) return false;
      const actual = result.winner, value = comparableValue(actual.value);
      if (actual.property === 'border' || actual.property === 'border-' + side) return value === target.border;
      const expected = {width: '12px', style: 'outset', color: '#334155'}[facet];
      if (actual.property === 'border-' + side + '-' + facet) return value === expected;
      if (actual.property === 'border-' + facet) {
        const values = value.split(' ');
        if (values.length > 4) return false;
        const expanded = [values[0], values[1] || values[0], values[2] || values[0], values[3] || values[1] || values[0]];
        return expanded[['top', 'right', 'bottom', 'left'].indexOf(side)] === expected;
      }
      // Logical edges and resets are outside this first exercise. Do not certify
      // a layout that depends on an unexamined writing direction or reset.
      return false;
    }));
  checks.push({id: 'border', label: '.card の border を ' + target.border + ' にする', kind: 'css',
    range: borderDirect && borderDirect.range, ok: borderOk,
    message: '枠線は「太さ・種類・色」をまとめて指定できます。outset は浮き出た形の枠線です。'});
  for (const check of checks) if (check.ok) check.message = 'できました。';
  const structure = structuralIntegrity(doc, nodes, parsed, html, css);
  return {checks, structureOk: structure.ok, structureMessage: structure.message, structureKind: structure.kind, structureRange: structure.range,
    complete: structure.ok && checks.every(check => check.ok)};
}

root.PixelChallengeModel = Object.freeze({target, questions, initial, reference, assembly, validate});
})(typeof window !== 'undefined' ? window : globalThis);
