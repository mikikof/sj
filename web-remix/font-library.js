(function () {
'use strict';
// Font files stay in this library. The editable CSS contains ordinary font names.
const faces = new WeakMap();
const styleId = 'pixel-font-library';
const cssUnescape = text => String(text).replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n\f])/gi, (_, hex, char) => {
  if (!hex) return char;
  const n = parseInt(hex, 16);
  return n && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
});
const normalize = text => cssUnescape(text).replace(/\s+/g, ' ').trim().toLowerCase();
function withoutComments(text) {
  let result = '', quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      result += c;
      if (c === '\\' && i + 1 < text.length) result += text[++i];
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") { quote = c; result += c; }
    else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) break;
      result += ' '; i = end + 1;
    } else result += c;
  }
  return result;
}
function fonts() {
  return Array.isArray(window.PIXEL_FONT_DATA) ? window.PIXEL_FONT_DATA : [];
}
function face(font) {
  if (faces.has(font)) return faces.get(font);
  if (!font.family || !/^data:font\/woff2;base64,[a-z0-9+/=]+$/i.test(font.dataURL || '')) return '';
  const family = String(font.family).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, ' ');
  const license = [font.label || font.family, font.sourceURL || '', font.licenseText || ''].join('\n').replace(/\*\//g, '* /').replace(/<\//g, '< /');
  const result = '/*\n' + license + '\n*/\n@font-face {\n  font-family: "' + family + '";\n  src: url("' + font.dataURL + '") format("woff2");\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n}\n';
  faces.set(font, result);
  return result;
}
// Scan declaration boundaries without confusing comments, strings or functions
// with CSS. This also accepts a style attribute (no enclosing selector).
function declarations(source) {
  const text = String(source || ''), result = [];
  let start = 0, colon = -1, quote = '', comment = false, depth = 0;
  const emit = end => {
    if (colon < start) return;
    const rawProperty = withoutComments(text.slice(start, colon)).trim();
    const property = rawProperty.startsWith('--') ? rawProperty : rawProperty.toLowerCase();
    if (/^(?:font-family|font|--[\w-]+)$/.test(property)) result.push([property, withoutComments(text.slice(colon + 1, end))]);
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (comment) { if (c === '*' && next === '/') { comment = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '(' || c === '[') { depth++; continue; }
    if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); continue; }
    if (depth) continue;
    if (c === ':' && colon < start) colon = i;
    if (c === '{') { start = i + 1; colon = -1; }
    if (c === ';' || c === '}') { emit(i); start = i + 1; colon = -1; }
  }
  emit(text.length);
  return result;
}
function collect(css, html) {
  const entries = declarations(css);
  if (html) {
    let doc = html;
    if (typeof html === 'string') {
      if (typeof DOMParser === 'undefined') return entries;
      doc = new DOMParser().parseFromString(html, 'text/html');
    }
    if (doc?.querySelectorAll) {
      for (const el of doc.querySelectorAll('[style]')) entries.push(...declarations(el.getAttribute('style')));
      for (const el of doc.querySelectorAll('style')) entries.push(...declarations(el.textContent));
    }
  }
  return entries;
}
function familyNames(value) {
  const names = [];
  // Quoted names remain distinct, so a family name inside a longer quoted
  // string cannot accidentally load an unrelated font.
  const outside = value.replace(/(["'])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g, (_, quote, text) => { names.push(normalize(text)); return ','; });
  for (const part of outside.split(',')) {
    const text = normalize(part.replace(/!\s*important\s*$/i, ''));
    if (text) names.push(text);
  }
  return names;
}
function used(css, html = '') {
  const entries = collect(css, html), variables = new Map(), values = [];
  for (const [property, value] of entries) {
    if (property.startsWith('--')) {
      if (!variables.has(property)) variables.set(property, []);
      variables.get(property).push(value);
    } else values.push({property, value});
  }
  // Resolve referenced custom properties conservatively, including fallbacks.
  // Different selectors may define the same variable for different elements.
  const resolved = [], seen = new Set();
  function visit(property, value) {
    const key = property + ':' + value;
    if (seen.has(key)) return;
    seen.add(key); resolved.push({property, value});
    for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) for (const next of variables.get(match[1]) || []) visit(property, next);
    for (const match of value.matchAll(/var\(\s*--[\w-]+\s*,\s*([^)]*)\)/g)) visit(property, match[1]);
  }
  for (const item of values) visit(item.property, item.value);
  return fonts().filter(font => {
    const name = normalize(font.family);
    return name && resolved.some(({property, value}) => familyNames(value).some(part => part === name || (property === 'font' && part.endsWith(' ' + name))));
  });
}
function cssFor(css, html = '') { return used(css, html).map(face).filter(Boolean).join('\n'); }
function install() {
  if (typeof document === 'undefined' || !document.head) return false;
  if (document.getElementById(styleId)) return true;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = fonts().map(face).filter(Boolean).join('\n');
  document.head.append(style);
  return true;
}
window.PixelFontLibrary = { install, cssFor, used };
})();
