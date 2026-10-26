/* 外部ライブラリを使わず、ブラウザと Node で同じ点検を行います。 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PyxelChecker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // stop_patterns.json の個別実行で ModuleNotFoundError を確認したものだけです。
  const MISSING_MODULES = new Set(['pygame', 'arcade', 'ursina', 'panda3d', 'pymunk']);
  const ALLOWED_MODULES = new Set(['pyxel', 'random', 'math']);
  const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

  function extractCode(answer) {
    const text = String(answer == null ? '' : answer).replace(/^\uFEFF/, '');
    const lines = text.match(/[^\n]*(?:\n|$)/g) || [];
    const blocks = [];
    let opened = null;
    let offset = 0;
    for (const line of lines) {
      const mark = line.match(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)\r?\n?$/);
      if (mark) {
        if (!opened) {
          opened = { fence: mark[1], language: mark[2].trim().toLowerCase(), start: offset + line.length };
        } else if (mark[1][0] === opened.fence[0] && mark[1].length >= opened.fence.length && !mark[2].trim()) {
          blocks.push({ language: opened.language, code: text.slice(opened.start, offset) });
          opened = null;
        }
      }
      offset += line.length;
    }
    if (!blocks.length) return { code: text, notes: [] };
    const python = blocks.filter(block => /^(?:python|py|python3)$/.test(block.language));
    const plain = blocks.filter(block => !block.language);
    const choices = python.length ? python : plain.length ? plain : blocks;
    const chosen = choices.find(block => /\bimport\s+pyxel\b|\bfrom\s+pyxel\s+import\b/.test(block.code)) || choices[0];
    const notes = ['コードの外にある説明と、コードブロックの印を取り除きました。'];
    if (blocks.length > 1) notes.push('複数のコードブロックがあります。Python のゲームらしいブロックを 1 つだけ取り出しました。main.py の全文が 1 つにまとまっているか確認してください。');
    if (opened) notes.push('閉じていないコードブロックもあります。取り出したコードが全文か確認してください。');
    return { code: chosen.code, notes };
  }

  // コメントと文字列を空白に置き換え、元の位置と改行を保ちます。
  // Python 全体の構文解析ではありません。f 文字列の式や実行経路は評価しません。
  function scan(source) {
    const out = source.split('');
    const strings = [];
    function blank(start, end) {
      for (let i = start; i < end; i++) if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
    }
    for (let i = 0; i < source.length;) {
      if (source[i] === '#') {
        const end = source.indexOf('\n', i);
        blank(i, end < 0 ? source.length : end);
        i = end < 0 ? source.length : end;
      } else if (source[i] === '"' || source[i] === "'") {
        const start = i;
        const quote = source[i];
        const triple = source.slice(i, i + 3) === quote.repeat(3);
        const width = triple ? 3 : 1;
        i += width;
        const contentStart = i;
        let contentEnd = i;
        while (i < source.length) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source.slice(i, i + width) === quote.repeat(width)) {
            contentEnd = i; i += width; break;
          }
          i++;
          contentEnd = i;
        }
        strings.push({ start, end: Math.min(i, source.length), value: source.slice(contentStart, contentEnd) });
        blank(start, Math.min(i, source.length));
      } else i++;
    }
    return { mask: out.join(''), strings };
  }

  function calls(source, mask, pattern) {
    const found = [];
    const re = new RegExp(pattern, 'g');
    let match;
    while ((match = re.exec(mask))) {
      const open = re.lastIndex - 1;
      const stack = ['('];
      const args = [];
      let begin = open + 1;
      let end = -1;
      for (let i = begin; i < mask.length; i++) {
        const c = mask[i];
        if ('([{'.includes(c)) stack.push(c);
        else if (')]}'.includes(c)) {
          stack.pop();
          if (!stack.length) { end = i; args.push({ start: begin, end: i, raw: source.slice(begin, i).trim(), mask: mask.slice(begin, i).trim() }); break; }
        } else if (c === ',' && stack.length === 1) {
          args.push({ start: begin, end: i, raw: source.slice(begin, i).trim(), mask: mask.slice(begin, i).trim() });
          begin = i + 1;
        }
      }
      if (end >= 0) found.push({ start: match.index, end: end + 1, args: args.filter(arg => arg.raw), match });
    }
    return found;
  }

  function escapeRE(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function number(arg) {
    return arg && /^[+-]?\d+(?:\.\d+)?$/.test(arg.raw) ? Number(arg.raw) : null;
  }

  function checkCode(input, options) {
    const code = String(input == null ? '' : input);
    const useCharacter = !options || options.useCharacter !== false;
    const stops = [];
    const warnings = [];
    const notices = [];
    if (!code.trim()) return { stops, warnings, notices };
    const { mask, strings } = scan(code);
    const seen = new Set();
    function add(kind, id, message, offset) {
      // 構文エラーは関数の中でも発生します。実行時のエラーは、実行される
      // 経路や except による処理を決められない所なら「注意」にとどめます。
      if (kind === 'stop' && !['code-fence', 'fullwidth-space'].includes(id) && typeof offset === 'number') {
        const start = mask.lastIndexOf('\n', offset - 1) + 1;
        const next = mask.indexOf('\n', offset);
        const lineCode = mask.slice(start, next < 0 ? mask.length : next);
        if (/^[ \t]+\S/.test(lineCode) || /\b(?:if|elif|else|while|for|try|except|finally|def|class|with|lambda|and|or)\b/.test(lineCode) || /^\s*\)\s*:/.test(lineCode)) {
          kind = 'warning';
          message += ' 条件や関数、例外の処理があるため、実際に止まるかはこの点検では確かめられません。';
        }
      }
      const line = typeof offset === 'number' ? code.slice(0, offset).split('\n').length : undefined;
      const key = kind + ':' + id + ':' + (line || '');
      if (seen.has(key)) return;
      seen.add(key);
      const item = { id, message };
      if (line) item.line = line;
      (kind === 'stop' ? stops : kind === 'notice' ? notices : warnings).push(item);
    }
    function matching(re, kind, id, message) {
      let match;
      while ((match = re.exec(mask))) add(kind, id, message, match.index);
    }
    matching(/```/g, 'stop', 'code-fence', 'コードブロックの印（```）がコードの中に残っています。印を消して、Python の部分だけを貼ってください。');
    matching(/\u3000/g, 'stop', 'fullwidth-space', 'コードの中に全角の空白があります。半角の空白に直してください。');

    const imports = [];
    const aliases = new Set(['pyxel']);
    const importedCalls = Object.fromEntries(['init', 'btnp', 'load', 'Font', 'text', 'cls', 'run'].map(name => [name, new Set()]));
    // import a, b と from a import b。括弧や行末の \\ による改行にも対応します。
    const importRE = /\b(?:from[ \t]+([.\w]+)[ \t]+import\b|import\b)([^;\n]*(?:\\\r?\n[^;\n]*)?)/g;
    let imported;
    while ((imported = importRE.exec(mask))) {
      if (imported[1]) {
        imports.push({ name: imported[1].split('.')[0], at: imported.index });
        if (imported[1] === 'pyxel') {
          for (const part of imported[2].replace(/[()]/g, '').split(',')) {
            const named = part.trim().match(/^(init|btnp|load|Font|text|cls|run)(?:\s+as\s+([A-Za-z_]\w*))?$/);
            if (named) importedCalls[named[1]].add(named[2] || named[1]);
          }
          for (const [oldName, id] of [['MOUSE_LEFT_BUTTON', 'old-mouse'], ['GAMEPAD_1_A', 'old-gamepad']]) {
            if (new RegExp('\\b' + oldName + '\\b').test(imported[2])) add('stop', id, oldName + ' は古い名前です。今の Pyxel の名前で書き直してもらってください。', imported.index);
          }
        }
      } else {
        for (const part of imported[2].replace(/\\\r?\n/g, ' ').split(',')) {
          const name = part.trim().match(/^([A-Za-z_]\w*)(?:\.\w+)*(?:\s+as\s+(\w+))?/);
          if (!name) continue;
          imports.push({ name: name[1], at: imported.index });
          if (name[1] === 'pyxel' && name[2]) aliases.add(name[2]);
        }
      }
    }
    for (const item of imports) {
      if (ALLOWED_MODULES.has(item.name)) continue;
      const confirmedMissing = MISSING_MODULES.has(item.name);
      add(confirmedMissing ? 'stop' : 'warning', 'unsupported-import', confirmedMissing
        ? item.name + ' の読み込みは、確認に使った Pyxel 環境でエラーになります。pyxel・random・math だけで書き直してもらってください。'
        : item.name + ' を読み込んでいます。動く場合もありますが、このページで決めた約束は pyxel・random・math だけです。Code Maker で使えるか確認が必要です。', item.at);
    }

    const moduleName = '(?:' + Array.from(aliases, escapeRE).join('|') + ')';
    const dotted = '\\b' + moduleName + '\\s*\\.\\s*';
    function apiCalls(name) {
      const found = calls(code, mask, dotted + name + '\\s*\\(');
      for (const alias of importedCalls[name] || []) {
        found.push(...calls(code, mask, '\\b' + escapeRE(alias) + '\\s*\\(')
          .filter(call => !mask.slice(0, call.start).trimEnd().endsWith('.')));
      }
      return found;
    }
    matching(new RegExp(dotted + 'MOUSE_LEFT_BUTTON\\b', 'g'), 'stop', 'old-mouse', 'MOUSE_LEFT_BUTTON は古い名前です。MOUSE_BUTTON_LEFT を使います。');
    matching(new RegExp(dotted + 'GAMEPAD_1_A\\b', 'g'), 'stop', 'old-gamepad', 'GAMEPAD_1_A は古い名前です。このゲームでは矢印キーと Z を使います。');
    for (const call of apiCalls('init')) {
      if (call.args.some(arg => /^caption\s*=/.test(arg.mask))) add('stop', 'old-caption', 'init の caption= は古い書き方です。title= に直してください。', call.start);
    }
    for (const call of apiCalls('btnp')) {
      if (call.args.some(arg => /^period\s*=/.test(arg.mask))) add('stop', 'old-period', 'btnp の period= は使えません。repeat= に直してもらってください。', call.start);
    }
    for (const call of calls(code, mask, dotted + 'tilemap\\s*\\(')) {
      if (/^\s*\.\s*get\b/.test(mask.slice(call.end))) add('stop', 'old-tilemap-get', 'tilemap(0).get は古い書き方です。必要なら tilemaps[0].pget を使います。', call.start);
    }

    const assignedStrings = new Map();
    const assignedRE = /\b((?:self\s*\.\s*)?[A-Za-z_]\w*)[ \t]*=(?!=)/g;
    let assigned;
    while ((assigned = assignedRE.exec(mask))) {
      const end = mask.indexOf('\n', assignedRE.lastIndex);
      const values = strings.filter(s => s.start >= assignedRE.lastIndex && s.start < (end < 0 ? code.length : end));
      if (values.length) assignedStrings.set(assigned[1].replace(/\s/g, ''), values.map(s => s.value));
    }
    function stringValues(arg) {
      if (!arg) return [];
      const values = strings.filter(s => s.start >= arg.start && s.end <= arg.end).map(s => s.value);
      for (const [name, assignedValues] of assignedStrings) {
        if (new RegExp('\\b' + escapeRE(name) + '\\b').test(arg.mask.replace(/\s*\.\s*/g, '.'))) values.push(...assignedValues);
      }
      return values.map(value => value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
    }

    const loads = apiCalls('load');
    const fonts = apiCalls('Font').filter(call => stringValues(call.args[0]).includes('umplus_j10r.bdf'));
    if (fonts.length || loads.some(call => stringValues(call.args[0]).includes('my_resource.pyxres'))) {
      add('notice', 'character-zip-first', 'キャラの ZIP を開いてから貼るコードです。先に Code Maker の Load → File でキャラの ZIP を開いてください。');
    }

    // 固定の読み込みと update/draw 冒頭の分岐を、インデントと実際の呼び出しで探します。
    // Python の実行はしません。別関数に任せる形など、確認できない形は「注意」です。
    function hasFontGuard() {
      const rows = [];
      let offset = 0;
      for (const text of mask.split('\n')) {
        const leading = text.match(/^[ \t]*/)[0];
        rows.push({ text: text.trim(), start: offset, indent: leading.replace(/\t/g, '        ').length,
          codeStart: offset + leading.length, end: offset + text.length });
        offset += text.length + 1;
      }
      const rowAt = at => rows.findIndex(row => at >= row.start && at <= row.end);
      const textCalls = apiCalls('text');
      const clearCalls = apiCalls('cls');
      const runs = apiCalls('run');
      const statementEnds = new Map();
      const continuationRows = new Set();
      for (const call of [...fonts, ...textCalls, ...clearCalls, ...runs, ...loads]) {
        const start = rowAt(call.start);
        const end = rowAt(call.end - 1);
        statementEnds.set(start, Math.max(statementEnds.get(start) || start, end));
        for (let i = start + 1; i <= end; i++) continuationRows.add(i);
      }
      function suiteEnd(index) {
        let end = index + 1;
        while (end < rows.length && (!rows[end].text || continuationRows.has(end) || rows[end].indent > rows[index].indent)) end++;
        return end;
      }
      function statements(index) {
        const result = [];
        const end = suiteEnd(index);
        for (let i = index + 1; i < end; i++) if (rows[i].text) {
          result.push(i);
          if (rows[i].text.endsWith(':')) i = suiteEnd(i) - 1;
          else if (statementEnds.has(i)) i = statementEnds.get(i);
        }
        return result;
      }
      function classAt(index) {
        let found = -1;
        for (let i = 0; i < index; i++) if (/^class\s+/.test(rows[i].text) && suiteEnd(i) > index) found = i;
        return found;
      }
      function wholeCall(index, collection) {
        return collection.find(call => call.start === rows[index].codeStart && !mask.slice(call.end, rows[rowAt(call.end - 1)].end).trim());
      }
      function callbackGuard(callback, drawing, name, run) {
        if (!callback || !/^(?:self\s*\.\s*)?[A-Za-z_]\w*$/.test(callback.mask)) return false;
        const callbackName = callback.mask.replace(/\s/g, '').split('.').at(-1);
        const owner = callback.mask.includes('.') ? classAt(rowAt(run.start)) : -1;
        const candidates = rows.map((row, index) => ({row, index})).filter(({row, index}) =>
          new RegExp('^def\\s+' + escapeRE(callbackName) + '\\s*\\(').test(row.text) && classAt(index) === owner);
        if (candidates.length !== 1) return false;
        const body = statements(candidates[0].index);
        const guard = body.find(index => !/^(?:global|nonlocal)\s/.test(rows[index].text) && !(drawing && wholeCall(index, clearCalls)));
        if (guard === undefined) return false;
        const condition = rows[guard].text.replace(/\s/g, '');
        if (![ 'if' + name + 'isNone:', 'ifNoneis' + name + ':' ].includes(condition)) return false;
        const branch = statements(guard);
        if (!branch.length || rows[branch.at(-1)].text !== 'return') return false;
        if (!drawing) return branch.length === 1;
        let messages = 0;
        for (const index of branch.slice(0, -1)) {
          if (wholeCall(index, clearCalls)) continue;
          const call = wholeCall(index, textCalls);
          if (!call) return false;
          const textArg = call.args.find(arg => /^(?:s|text)\s*=/.test(arg.mask)) || call.args[2];
          const positional = call.args.filter(arg => !/^\w+\s*=/.test(arg.mask));
          const font = call.args.find(arg => /^font\s*=/.test(arg.mask)) || positional[4];
          if (font && !/^(?:font\s*=\s*)?None$/.test(font.mask)) return false;
          if (!stringValues(textArg).includes('Open your character ZIP first (Load > File)')) return false;
          messages++;
        }
        return messages === 1;
      }
      return fonts.length > 0 && fonts.every(font => {
        const index = rowAt(font.start);
        const assignment = mask.slice(rows[index].codeStart, font.start).match(/^((?:self\s*\.\s*)?[A-Za-z_]\w*)\s*=\s*$/);
        if (!assignment) return false;
        const name = assignment[1].replace(/\s/g, '');
        const tryIndex = rows.findIndex((row, i) => row.text === 'try:' && i < index && suiteEnd(i) > index && statements(i).includes(index));
        if (tryIndex < 0) return false;
        const exceptIndex = suiteEnd(tryIndex);
        if (!rows[exceptIndex] || rows[exceptIndex].indent !== rows[tryIndex].indent ||
          !/^except\s+Exception(?:\s+as\s+[A-Za-z_]\w*)?\s*:$/.test(rows[exceptIndex].text)) return false;
        const fallback = statements(exceptIndex);
        if (fallback.length !== 1 || rows[fallback[0]].text.replace(/\s/g, '') !== name + '=None') return false;
        return runs.length > 0 && runs.every(run => callbackGuard(run.args[0], false, name, run) && callbackGuard(run.args[1], true, name, run));
      });
    }

    if (useCharacter) {
      if (!loads.some(call => stringValues(call.args[0]).includes('my_resource.pyxres'))) {
        add('warning', 'missing-resource', 'my_resource.pyxres を読み込む行が見つかりません。pyxel.init のすぐあとに pyxel.load("my_resource.pyxres") が必要です。');
      }
      if (!hasFontGuard()) {
        add('warning', 'missing-font-guard', '字のファイルがないときの案内を確認できません。02 の決まりの文どおりに try / except Exception で FONT を読み込み、FONT が None ならゲームを進めず、英語の案内だけを出してください。');
      }

      const imageExpression = dotted + '(?:images\\s*\\[\\s*0\\s*\\]|image\\s*\\(\\s*0\\s*\\))';
      const imageAliases = [];
      const imageAliasRE = new RegExp('\\b((?:self\\s*\\.\\s*)?[A-Za-z_]\\w*)\\s*=\\s*' + imageExpression, 'g');
      let imageAlias;
      while ((imageAlias = imageAliasRE.exec(mask))) imageAliases.push(escapeRE(imageAlias[1]).replace(/\\ /g, '\\s*'));
      const imageRef = '(?:' + imageExpression + (imageAliases.length ? '|\\b(?:' + imageAliases.join('|') + ')' : '') + ')';
      const methods = calls(code, mask, imageRef + '\\s*\\.\\s*(set|pset|rectb?|circb?|trib?|line|fill|cls|blt|bltm|load)\\s*\\(');
      for (const call of methods) {
        const method = call.match[1];
        const y = number(call.args[1]);
        let overlaps = true;
        if (['set', 'pset', 'load'].includes(method)) overlaps = y === null || (y >= 0 && y < 16) || (method !== 'pset' && y < 0);
        if (['rect', 'rectb', 'blt', 'bltm'].includes(method)) {
          const height = number(call.args[method.startsWith('blt') ? 6 : 3]);
          overlaps = y === null || height === null ? y === null || y < 16 : Math.min(y, y + height) < 16 && Math.max(y, y + height) > 0;
        }
        if (['circ', 'circb'].includes(method)) {
          const radius = number(call.args[2]);
          overlaps = y === null || radius === null || (y - radius < 16 && y + radius >= 0);
        }
        if (['line', 'tri', 'trib'].includes(method)) {
          const ys = (method === 'line' ? [1, 3] : [1, 3, 5]).map(i => number(call.args[i]));
          overlaps = ys.some(n => n === null) || (Math.min(...ys) < 16 && Math.max(...ys) >= 0);
        }
        if (overlaps) add('warning', 'character-overwrite', '画像 0 の 1 段目を書き換える可能性があります。自分のキャラが消えないよう、ほかの絵は y=16 より下か画面の図形で描いてください。', call.start);
      }
      matching(new RegExp(dotted + 'images\\s*\\[\\s*0\\s*\\]\\s*=(?!=)', 'g'), 'warning', 'character-overwrite', '画像 0 を入れ替える行があります。自分のキャラの 4 コマを残しているか確認してください。');
    }

    for (const call of calls(code, mask, dotted + 'text\\s*\\(')) {
      const textArg = call.args.find(arg => /^(?:s|text)\s*=/.test(arg.mask)) || call.args[2];
      const positional = call.args.filter(arg => !/^\w+\s*=/.test(arg.mask));
      const font = call.args.find(arg => /^font\s*=/.test(arg.mask)) || positional[4];
      const hasFont = font && !/^(?:font\s*=\s*)?None$/.test(font.mask);
      if (!hasFont && stringValues(textArg).some(value => JAPANESE.test(value))) {
        add('warning', 'missing-font', '日本語を pyxel.text に渡していますが、フォントが見つかりません。02 の決まりの文にある読み込みを使い、pyxel.text の最後に FONT を渡してください。', call.start);
      }
    }
    const omitted = code.search(/…|省略/);
    const ellipsis = mask.search(/\.\.\./);
    if (omitted >= 0 || ellipsis >= 0) add('warning', 'omitted-code', '「…」「省略」または「...」があります。途中を抜いた印か確認し、Gemini には main.py の全文を返してもらってください。', omitted >= 0 ? omitted : ellipsis);
    return { stops, warnings, notices };
  }

  function inspect(answer, options) {
    const extracted = extractCode(answer);
    const checked = checkCode(extracted.code, options);
    if (extracted.notes.some(note => note.startsWith('複数'))) checked.warnings.unshift({ id: 'multiple-code-blocks', message: '複数のコードブロックのうち、1 つだけを取り出しました。main.py の全文を 1 つのコードブロックで返してもらってください。' });
    if (extracted.notes.some(note => note.startsWith('閉じて'))) checked.warnings.unshift({ id: 'incomplete-code-block', message: '閉じていないコードブロックもあります。コードが全文か確認してください。' });
    return { ...extracted, ...checked };
  }

  return Object.freeze({ extractCode, checkCode, inspect });
});
