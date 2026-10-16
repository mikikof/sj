/* コードを実行せず、JavaScript の語と前後の書き方から説明を選ぶ。 */
(function (global) {
  'use strict';
  const api = global.PixelCodeExplain = global.PixelCodeExplain || {};
  const cache = new Map();
  const words = /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/uy;
  const numbers = /(?:0[xX][\da-fA-F](?:[\da-fA-F_]*[\da-fA-F])?|0[bB][01][01_]*|0[oO][0-7][0-7_]*|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/y;
  const operators = ['>>>=','===','!==','>>>','**=','&&=','||=','??=','<<=','>>=','=>','==','!=','<=','>=','++','--','+=','-=','*=','/=','%=','&&','||','??','?.','**','<<','>>','&=','|=','^=','...'];
  function tokenize(source) {
    const tokens = []; let cursor = 0;
    function add(start, end, type) { tokens.push({ start, end, type, value: source.slice(start, end) }); }
    function last() { for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].type !== 'comment') return tokens[i]; return null; }
    function regexAllowed() {
      const prev = last();
      if (!prev) return true;
      if (prev.value === ')') {
        let depth = 1;
        for (let i = tokens.length - 2; i >= 0; i--) {
          if (tokens[i].value === ')') depth++;
          if (tokens[i].value === '(' && --depth === 0) return /^(if|while|for|with|switch|catch)$/.test((tokens[i - 1] || {}).value || '');
        }
      }
      return /^(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|new)$/.test(prev.value) || /^(?:[=(:,;!~?\[{]|=>|&&|\|\||\?\?|\$\{|[+*%&|^<>-]=?)$/.test(prev.value);
    }
    function template() {
      let chunk = cursor++;
      while (cursor < source.length) {
        if (source[cursor] === '\\') { cursor = Math.min(source.length, cursor + 2); continue; }
        if (source[cursor] === '`') { cursor++; add(chunk, cursor, 'template'); return; }
        if (source[cursor] === '$' && source[cursor + 1] === '{') {
          if (cursor > chunk) add(chunk, cursor, 'template');
          add(cursor, cursor + 2, 'interpolation'); cursor += 2; scan(true); chunk = cursor; continue;
        }
        cursor++;
      }
      if (cursor > chunk) add(chunk, cursor, 'template');
    }
    function scan(interpolation) {
      let braces = 0;
      while (cursor < source.length) {
        const start = cursor, c = source[cursor], next = source[cursor + 1];
        if (/\s/u.test(c)) { cursor++; continue; }
        if (c === '/' && next === '/') { cursor += 2; while (cursor < source.length && !/[\r\n]/.test(source[cursor])) cursor++; add(start, cursor, 'comment'); continue; }
        if (c === '/' && next === '*') { const end = source.indexOf('*/', cursor + 2); cursor = end < 0 ? source.length : end + 2; add(start, cursor, 'comment'); continue; }
        if (c === '"' || c === "'") {
          cursor++;
          while (cursor < source.length) {
            if (source[cursor] === '\\') { cursor = Math.min(source.length, cursor + 2); continue; }
            if (source[cursor] === c) { cursor++; break; }
            if (/[\r\n]/.test(source[cursor])) break;
            cursor++;
          }
          add(start, cursor, 'string'); continue;
        }
        if (c === '`') { template(); continue; }
        if (c === '/' && regexAllowed()) {
          let end = cursor + 1, group = false, closed = false;
          while (end < source.length && !/[\r\n]/.test(source[end])) {
            if (source[end] === '\\') { end += 2; continue; }
            if (source[end] === '[') group = true;
            if (source[end] === ']') group = false;
            if (source[end] === '/' && !group) { end++; closed = true; break; }
            end++;
          }
          if (closed) { while (/[a-z]/i.test(source[end] || '') && end < source.length) end++; cursor = end; add(start, cursor, 'regex'); continue; }
        }
        words.lastIndex = cursor; const word = words.exec(source);
        if (word) { cursor = words.lastIndex; add(start, cursor, 'word'); continue; }
        numbers.lastIndex = cursor; const number = numbers.exec(source);
        if (number) { cursor = numbers.lastIndex; add(start, cursor, 'number'); continue; }
        if (c === '}' && interpolation && braces === 0) { cursor++; add(start, cursor, 'interpolation-end'); return; }
        if (c === '{') braces++;
        if (c === '}') braces--;
        const operator = operators.find(value => source.startsWith(value, cursor));
        cursor += operator ? operator.length : (source.codePointAt(cursor) > 0xffff ? 2 : 1);
        add(start, cursor, 'symbol');
      }
    }
    scan(false);
    const significant = tokens.filter(t => t.type !== 'comment');
    const stack = [];
    significant.forEach((token, index) => {
      token.before = significant[index - 1]; token.after = significant[index + 1];
      token.parent = stack[stack.length - 1];
      if (/^(?:\(|\[|\{|\$\{)$/.test(token.value)) stack.push(token);
      else if (/^[)\]}]$/.test(token.value)) {
        const expected = { ')': '(', ']': '[', '}': '{' }[token.value];
        const open = stack[stack.length - 1];
        if (open && (open.value === expected || (expected === '{' && open.value === '${'))) { stack.pop(); token.open = open; open.close = token; }
      }
    });
    significant.forEach(token => {
      if (token.value !== '(' || !token.close) return;
      const prev = token.before, next = token.close.after;
      const fn = prev && (prev.value === 'function' || (prev.before && prev.before.value === 'function'));
      if (fn || (next && next.value === '=>')) {
        let t = token.after; const parameters = new Set();
        while (t && t !== token.close) { if (t.type === 'word' && t.parent === token && (!t.after || t.after.value !== ':') && (!t.before || /^(\(|,|\.\.\.)$/.test(t.before.value))) { t.parameter = true; parameters.add(t.value); } t = t.after; }
        const body = next && next.value === '=>' ? next.after : next;
        if (body && body.value === '{') body.parameters = parameters;
      }
    });
    significant.forEach(token => {
      if (token.type === 'word' && token.after && token.after.value === '=>' && token.after.after && token.after.after.value === '{') token.after.after.parameters = new Set([token.value]);
    });
    significant.forEach(token => {
      if (token.type !== 'word') return;
      let scope = token.parent;
      while (scope) { if (scope.parameters && scope.parameters.has(token.value)) { token.parameterReference = true; break; } scope = scope.parent; }
    });
    return tokens;
  }
  function dictionary(rows) { const out = Object.create(null); for (const row of rows) { const [keys, meaning, change] = row; for (const key of keys.split('|')) out[key] = { meaning, change }; } return out; }
  const keywords = dictionary([
    ['const','名前を付けて値を保存します。同じ名前に別の値を代入し直すことはできません。','配列やオブジェクトの中身は変更できます。値を代入し直すなら let を使います。'],
    ['let','あとで値を入れ直せる変数を作ります。','最初の値を変えると、その変数を使う処理の出発点が変わります。'],
    ['var','変数を作る以前からある書き方です。let と変数が使える範囲が違います。','let への置き換えでは、同じ変数を使う範囲も確かめます。'],
    ['function','ひとまとまりの処理を関数にします。呼び出すと中の処理が動きます。','中の処理を変えると、この関数を呼ぶ場面の動きが変わります。'],
    ['return','関数の処理をここで終えます。後ろに値があれば呼び出し元に返します。','返す値や位置を変えると、結果や実行される処理が変わります。'],
    ['if','括弧の条件が成り立つときだけ、次の処理を行います。','条件を変えると、処理が動く場面が変わります。'],
    ['else','直前の if の条件が成り立たなかったときの処理です。','ここを変えると、条件に当てはまらないときの動きが変わります。'],
    ['for','決めた条件やデータに沿って処理を繰り返します。','条件や回すデータを変えると、回数や対象が変わります。'],
    ['while','条件が成り立つ間、同じ処理を繰り返します。','条件がいつまでも成り立つと、繰り返しが終わらなくなります。'],
    ['do','まず処理を1回実行し、後ろの while の条件で繰り返すか決めます。','最初の1回は条件にかかわらず実行されます。'],
    ['break','いまの繰り返しや switch を抜けます。','削除すると、その先の繰り返しや分岐も進むことがあります。'],
    ['continue','今回の繰り返しの残りを飛ばして、次の回へ進みます。','移動すると、各回で実行される処理が変わります。'],
    ['true|false','条件や状態を表す値です。true は「はい」、false は「いいえ」に当たります。','反対の値にすると、この値を調べる条件分岐も変わります。'],
    ['null','値がないことを明示する値です。','要素などの値を入れると、「まだない」としていた処理が変わります。'],
    ['undefined','値がまだ設定されていないときなどに使われる値です。','値があるかを調べる条件で使います。文字列の "undefined" とは別物です。'],
    ['typeof','値の種類を文字列で調べます。例：関数なら "function"。','比較する種類を変えると、その後の処理を行う条件が変わります。'],
    ['new','関数やクラスを使って新しいオブジェクトを作ります。','作る種類や渡す値を変えると、できるオブジェクトが変わります。'],
    ['try','エラーが起きる可能性のある処理を囲みます。','エラーが起きると catch に移ります。通常は中の処理を進めます。'],
    ['catch','try の中でエラーが起きたときの処理です。','ここを変えると、エラーが起きたときの対応が変わります。'],
    ['finally','try や catch の後で行う処理です。','片付けなどの処理を変えます。return がある場合の結果にも注意が必要です。'],
    ['throw','エラーなどの値を投げて通常の処理を中断します。','投げる値を変えると、受け取る catch の内容も変わります。'],
    ['of','for…of で、配列などから値を1つずつ取り出します。','対象の配列を変えると、処理する値が変わります。'],
    ['in','オブジェクトにその名前の項目があるかを調べます。for…in では項目名を順に取り出します。','調べる名前や対象を変えると、判定や取り出す項目が変わります。'],
    ['this','関数の呼び出し方などに応じた対象を指します。','対象は周囲の書き方で変わります。いつも同じ要素を指すわけではありません。'],
    ['switch|case|default','値に合わせて実行する処理を分ける書き方です。','値や分岐を変えると、どの処理が選ばれるかが変わります。'],
    ['class|extends|super','オブジェクトの作り方や、引き継ぐ処理を定義する書き方です。','定義を変えると、そのクラスから作るオブジェクトの動きが変わります。'],
    ['async|await','時間がかかる処理の完了を扱う書き方です。await は結果を待ってから続きを進めます。','待つ処理を変えると、続きを実行するタイミングが変わります。'],
    ['import|export|from|as','別のファイルと値や関数を受け渡す書き方で使います。','名前や読み込み先を変えると、使うコードが変わります。'],
    ['delete','オブジェクトから指定した項目を取り除きます。','項目を消すと、あとからその項目を読む処理にも影響します。'],
    ['void','式を実行したあと、結果を undefined にします。','計算結果を使わない場面の書き方です。'],
    ['instanceof','値が指定した種類のオブジェクトとして作られたかを調べます。','調べる種類を変えると、判定が変わります。'],
    ['yield','ジェネレーター関数をいったん止めて値を渡します。','渡す値や位置を変えると、順に取り出せる結果が変わります。'],
    ['debugger','開発者ツールがあるとき、ここで処理を一時停止して調べられます。','通常の画面に文章を表示する命令ではありません。']
  ]);
  const symbols = dictionary([
    ['=','右側の値を左側の変数や項目に入れます。等しいかを調べる記号ではありません。','右側を変えると、保存される値が変わります。'],
    ['===|!==','値の種類も含めて比較します。=== は一致、!== は不一致を調べます。','例えば 1 と "1" は別物として扱います。条件を変えると分岐が変わります。'],
    ['==|!=','必要に応じて値の種類を変換して比較します。== は一致、!= は不一致を調べます。','例えば 1 と "1" が同じと判定される場合があります。=== とは結果が異なることがあります。'],
    ['<|>|<=|>=','左右の値の大小を比べます。= が付くと同じ値も含みます。','境目の値や記号を変えると、条件に当てはまる範囲が変わります。'],
    ['&&','左が条件を満たすと右を調べます。「両方とも」の条件によく使います。','左が false などなら右は実行しません。|| にすると条件のつなぎ方が変わります。'],
    ['||','左が false・0・空文字などなら右の値を使います。条件では「どちらか」に使います。','左が条件を満たせば右は実行しません。0 も予備の値に置き換わります。'],
    ['??','左が null または undefined のときだけ、右の値を使います。','0 や空文字はそのまま使います。|| と判定する範囲が違います。'],
    ['!','条件としての意味を反転します。','「当てはまる」を「当てはまらない」に変えられます。'],
    ['+','数値なら足し算、文字列を含む場合は文字の連結に使います。','値の種類によって結果が変わります。1 + 2 は 3、"1" + 2 は "12" です。'],
    ['-','引き算、または数値の符号を反転する記号です。','位置や速度の前にあると、動く向きが変わることがあります。'],
    ['*|/|%|**','順に掛け算・割り算・余り・累乗を表します。','値や記号を変えると、計算結果が変わります。% は繰り返す模様にも使えます。'],
    ['+=|-=|*=|/=|%=|**=','いまの値で計算して、結果を同じ変数や項目に入れ直します。','例えば x += 2 は x = x + 2 と同じ意味です。'],
    ['++|--','値を1増やす、または1減らす記号です。','繰り返しの回数や進む順番に使います。前後どちらに置くかでも式の値が違います。'],
    ['=>','矢印の左で値を受け取り、右で処理する関数を作ります。','右が式だけならその結果を返します。{ } で囲む場合は必要に応じて return を書きます。'],
    ['?','条件 ? A : B の形で、条件に応じて使う値を選びます。','条件が成り立つと A、そうでなければ B になります。'],
    ['?.','左側が null や undefined なら、その先の参照や呼び出しを行いません。','対象がないときのエラーを避ける書き方です。値があるときは通常どおり進みます。'],
    ['.','左のオブジェクトが持つ項目や関数を、右の名前で指定します。','右の名前を変えると、読む値や呼び出す処理が変わります。'],
    ['...','配列やオブジェクトの中身を広げます。引数では残りの値をまとめる書き方にもなります。','置く場所によってコピー・展開・残りの受け取りのどれかになります。'],
    [';','処理の区切りを示します。for の括弧内では開始・条件・更新を区切ります。','区切る場所を変えると、コードの解釈が変わることがあります。'],
    [',','値・引数・項目などを区切ります。','追加や削除で、渡す値の数や並びが変わります。'],
    [':','オブジェクトの項目名と値を区切ります。条件 ? A : B でも使います。','前後の組み合わせを変えると、保存する項目や選ばれる値が変わります。'],
    ['{|}','処理やオブジェクトの範囲を囲む波括弧です。','対応する括弧を消すと範囲が崩れ、コードが動かなくなることがあります。'],
    ['(|)','関数に渡す値・条件・計算のまとまりなどを囲む括弧です。','中の値や括る範囲を変えると、渡す内容や計算の順番が変わります。'],
    ['[|]','配列を作るか、番号や名前を指定して中身を読む角括弧です。','配列の番号は 0 から始まります。番号を変えると取り出す値が変わります。'],
    ['&|^|~|<<|>>|>>>|&=|^=|<<=|>>=|>>>=','数値を2進数の各けたとして扱う演算です。','&& や || の条件のつなぎ方とは別です。けたごとの計算結果が変わります。'],
    ['&&=|??=','条件が合うときだけ右の値を代入する記号です。','&&= は左が条件を満たすとき、??= は null か undefined のときに代入します。']
  ]);
  // The dictionary separator is |, so register operators containing it directly.
  symbols['||'] = { meaning:'左が false・0・空文字などなら右の値を使います。条件では「どちらか」に使います。', change:'左が条件を満たせば右は実行しません。0 も予備の値に置き換わります。' };
  ['|','|='].forEach(key => { symbols[key] = { meaning:'数値を2進数の各けたとして扱う演算です。', change:'条件をつなぐ || とは別です。けたごとの計算結果が変わります。' }; });
  symbols['||='] = { meaning:'左が false・0・空文字などのときだけ、右の値を代入します。', change:'0 をそのまま残したい場合などは、??= との違いを確かめます。' };
  const methods = dictionary([
    ['querySelector','CSS のセレクタで、条件に合う最初の HTML 要素を探します。','セレクタを変えると、操作する要素が変わります。なければ null になります。'],
    ['querySelectorAll','CSS のセレクタに合う HTML 要素をすべて探します。','セレクタを変えると、まとめて操作する要素が変わります。'],
    ['createElement','指定したタグの HTML 要素を作ります。','"button" ならボタンになります。作っただけでは画面に出ず、追加も必要です。'],
    ['append|appendChild|prepend','要素や文字を HTML の中に追加します。prepend は先頭に追加します。','追加する内容や順番を変えると、画面の構成が変わります。'],
    ['replaceChildren','要素の中身を、渡した要素や文字に入れ替えます。','入れ替える内容を変えると、その領域の表示が変わります。'],
    ['remove','この要素を HTML から取り除きます。','削除する対象を変えると、画面から消える部分が変わります。'],
    ['getAttribute|setAttribute|removeAttribute','HTML の属性を読み取る・設定する・取り除く関数です。','属性名や値を変えると、画像・状態・読み上げ用の説明などが変わります。'],
    ['addEventListener|removeEventListener','クリックなどを受け取る処理を登録・解除します。','イベント名や関数を変えると、反応する操作や動きが変わります。'],
    ['preventDefault','ブラウザが通常行う動作を、このイベントでは止めます。','例えばリンクの移動やキーによるスクロールを止めます。イベントの伝わり方は止めません。'],
    ['stopPropagation','イベントが親の要素などへ伝わるのを止めます。','ブラウザ本来の動作を止める preventDefault とは別です。'],
    ['closest','自分自身から親へたどり、セレクタに合う最初の要素を探します。','セレクタを変えると、どのボタンやまとまりを探すかが変わります。'],
    ['contains','ある要素が、この要素の中にあるかを調べます。','比較する要素を変えると、内側・外側の判定が変わります。'],
    ['getBoundingClientRect','要素の画面内の位置と大きさを調べます。','この結果を使ってエフェクトなどを置く位置を決めています。'],
    ['getComputedStyle','CSS を反映したあとの見た目の値を読みます。','CSS 側の色合い・幅などを変えると、ここで読み取る値も変わります。'],
    ['focus|blur','キーボード操作の対象にする、または対象から外す関数です。','対象を変えると、キー入力を受け取る場所が変わります。'],
    ['scrollIntoView','この要素が見える位置まで画面をスクロールします。','block などの設定で、画面のどの位置に合わせるかが変わります。'],
    ['setPointerCapture','押したポインターの動きを、指定の要素が引き続き受け取ります。','ボタンから指が外れたときなどの操作の受け取り方が変わります。'],
    ['animate','要素の見た目を、指定した途中の状態に沿って動かします。','transform や duration を変えると、動く位置や速さが変わります。'],
    ['cancel','アニメーションなどの実行を取り消します。','呼ぶタイミングを変えると、動きが終わるタイミングも変わります。'],
    ['requestAnimationFrame','次の画面描画に合わせて関数を呼ぶよう予約します。','毎回もう一度予約すると動きが続きます。渡す関数で描画内容が変わります。'],
    ['now','performance.now は、基準時点からの経過時間をミリ秒で読み取ります。','前回の値との差を求めると、画面更新の間に何秒進んだか分かります。'],
    ['cancelAnimationFrame','予約した画面描画の呼び出しを取り消します。','予約した処理を止めるタイミングが変わります。'],
    ['setTimeout|clearTimeout','一定時間後の処理を予約する、または予約を取り消す関数です。','setTimeout の待ち時間はミリ秒です。1000 ならおよそ1秒後になります。'],
    ['matchMedia','画面の条件や利用者の設定に当てはまるかを調べます。','このページでは、動きを減らす設定が有効か調べています。'],
    ['observe|disconnect','ResizeObserver などで、変化を見張る対象を指定・解除します。','対象を変えると、どの要素の変化で処理が動くかが変わります。'],
    ['getContext','canvas に描くための機能を取り出します。"2d" は平面の描画です。','ここで得た ctx を使って背景やキャラを描きます。'],
    ['fillRect','canvas に塗りつぶした四角形を描きます。引数は x・y・幅・高さです。','位置と大きさを変えると、描く四角形が変わります。'],
    ['clearRect','canvas の四角い範囲を透明に消します。','指定した位置と大きさの範囲が消えます。'],
    ['drawImage','canvas に画像を描きます。','画像・位置・大きさを変えると、画面に描くキャラなどが変わります。'],
    ['save|restore','canvas の色や座標変換などの設定を保存・復元します。','絵そのものを保存する命令ではありません。後の描画に設定を残すかが変わります。'],
    ['translate','canvas の描画の基準位置をずらします。','値を変えると、その後に描く図形の位置が変わります。'],
    ['scale','canvas の描画倍率を変えます。負の値なら向きも反転します。','横倍率を -1 にすると、その後の描画が左右反転します。'],
    ['setTransform','canvas の拡大・回転・移動などの変換をまとめて設定します。','値を変えると、その後の絵の大きさや位置が変わります。'],
    ['beginPath|closePath','線で図形を描く経路を作り始める、または始点へ閉じる命令です。','これだけでは線を表示しません。stroke や fill と合わせて使います。'],
    ['moveTo|lineTo','線の始点へ移動する、または次の点まで線の経路を作ります。','座標を変えると、線や多角形の形が変わります。'],
    ['arc','円や円弧の経路を作ります。','中心・半径・角度を変えると、輪の位置や大きさが変わります。'],
    ['stroke|fill','作った経路を、線として描く・内側を塗る命令です。','strokeStyle や fillStyle を変えると色が変わります。'],
    ['getImageData|putImageData','canvas の画素の色を読み取る・書き戻す関数です。','色の値を変えて書き戻すと、画像の色を変えられます。'],
    ['map','配列の各値から別の値を作り、新しい配列にします。','渡す関数を変えると、作られる配列の中身が変わります。'],
    ['filter','条件に合う値だけを集め、新しい配列にします。','条件を変えると、残る値が変わります。元の配列を直接削る処理ではありません。'],
    ['forEach','配列などの各値について処理を1回ずつ行います。','中の処理を変えると、各項目に行うことが変わります。'],
    ['includes|has','指定した値が含まれるかを true / false で調べます。','探す値を変えると、判定が変わります。'],
    ['push','配列の末尾に値を追加します。','追加する値や数を変えると、配列の中身や増え方も変わります。'],
    ['slice','指定範囲の値を切り出した、新しい配列や文字列を作ります。','終わりの番号は含みません。slice(0, 3) は先頭から3つです。'],
    ['splice','配列の指定した位置で、値を削除・追加します。','元の配列そのものが変わります。slice とは違います。'],
    ['concat','配列などをつないだ、新しい値を作ります。','つなぐ内容や順番を変えると結果が変わります。'],
    ['reverse','配列の並び順を逆にします。','元の配列の順番も変わります。'],
    ['split','区切りを指定して文字列を分け、配列にします。','空白やカンマなど、区切りを変えると分かれ方が変わります。'],
    ['join','配列の値を文字列につなぎます。','渡す区切り文字を変えると、表示する文章のつなぎ方が変わります。'],
    ['test|exec','正規表現で文字を調べます。test は一致するか、exec は一致した内容を返します。','パターンを変えると、見つかる文字が変わります。'],
    ['add|delete|clear','Set などの集合に値を加える・削除する・すべて取り除く関数です。','タイマーやアニメーションなど、覚えておく対象が変わります。'],
    ['hasOwn','オブジェクト自身に指定の項目があるか調べます。','名前を変えると、存在するか調べる項目が変わります。'],
    ['entries|values','オブジェクトの「名前と値の組」、または「値だけ」を配列で取り出します。','対象を変えると、繰り返しで扱う項目が変わります。'],
    ['from','Array.from は、順に取り出せるデータなどを配列にします。','渡す対象を変えると、新しい配列の中身が変わります。'],
    ['assign','右側のオブジェクトの項目を、左側のオブジェクトへコピーします。','同じ名前の項目は上書きされます。コピー先も変わります。'],
    ['min|max','渡した数のうち、最小値・最大値を返します。','上限や下限を決めるときに使います。比べる数で範囲が変わります。'],
    ['round|floor|ceil','順に四捨五入・小さい側の整数・大きい側の整数にそろえます。','小数の扱いが変わります。floor(-1.2) は -2 です。'],
    ['abs','数の符号を除いた大きさを返します。','負の数も正の大きさになります。距離などの計算に使います。'],
    ['sin|cos','角度に応じて -1 から 1 の間で変わる値を返します。角度の単位はラジアンです。','角度の変わる速さや掛ける数で、往復する動きの速さ・幅が変わります。'],
    ['hypot','直角方向の長さから、斜めの距離を求めます。','横と縦の距離を渡すと、2点の間の距離を計算できます。'],
    ['isFinite','値が通常の有限な数値かを調べます。','Number.isFinite は文字列を数に変換せずに調べます。'],
    ['toFixed','小数点以下のけた数を決めた文字列を作ります。','toFixed(1) なら小数第1位までになります。元の数は変わりません。'],
    ['toggle','classList.toggle は CSS の class を付け外しします。','class 名や条件を変えると、当てはまる CSS や見た目が変わります。']
  ]);
  const actions = dictionary([
    ['mount','このページで特技を使えるように、クリックの処理などを準備します。','対象のページや準備する内容を変えると、特技を使える場所が変わります。'],
    ['destroy','特技の動きとクリックの登録を終了する関数です。','ページを作り直すときに、前のページの動きが残らないようにします。'],
    ['trigger','このページのキャラに、指定した特技の動きを出す関数です。','mint-beatやcloud-pawなど、HTMLのdata-skillと対応する名前で動きを選びます。'],
    ['clearEffect','表示中の演出を消し、予約していた動きも止める関数です。','呼ぶタイミングを変えると、特技の演出が消えるタイミングが変わります。'],
    ['onClick','押された特技ボタンのdata-skillを読み取り、その動きを呼び出します。','読み取る属性や呼び出す関数を変えると、クリックへの反応が変わります。'],
    ['refreshAppearance','HTMLのパーツ指定とCSSの色から、キャラの画像を作り直します。','HTMLやCSSで指定したキャラの見た目を反映します。'],
    ['animate','要素・途中の状態・時間・速度の変わり方を受け取り、動きをつける関数です。','渡す位置や時間によって、特技の動きや速さが変わります。'],
    ['move','移動する距離と大きさの倍率から、CSSのtransformに渡す文字列を作ります。','横・縦の距離や倍率を変えると、キャラが動く位置や伸び縮みが変わります。'],
    ['burst','指定した場所に小さな光の粒を散らす関数です。','位置や色を変えると、特技のエフェクトが変わります。'],
    ['node','タグ・class・文字を指定してHTML要素を作る、この教材の関数です。','渡す値で、演出に使う要素や文字が変わります。'],
    ['generated','JavaScriptで作った要素にdata-generatedという目印をつけます。','この目印で、自分が編集したHTMLと演出のために追加した要素を見分けます。'],
    ['later','指定したミリ秒後に処理を動かす予約を、この教材で管理する関数です。','時間や処理を変えると、光の粒などを出す・消すタイミングが変わります。'],
    ['SKILL_NAMES','前に保存したページで使っていた6つの特技名の表です。','新しい固有技はPixelSkillCatalogの表から読み込みます。'],
    ['PixelSkillCatalog|catalog','キャラごとの6つの固有技と、その名前や色をまとめた表です。','HTMLのdata-skillに書かれた名前から、対応する特技を探します。'],
    ['signature','いま押した特技の名前・色・キャラなどを取り出したデータです。','ボタンのdata-skillが変わると、ここで読み取る特技も変わります。'],
    ['allowed','そのキャラが使える特技かを調べる、この教材の関数です。','キャラと特技の名前を渡すと、使える場合にtrueを返します。'],
    ['pose','移動・大きさ・回転・透明度から、動きの途中の姿勢を作ります。','数値を変えると、跳ぶ高さや傾く角度などが変わります。'],
    ['motion','キャラ画像に一連の動きをつける、この教材の関数です。','姿勢の並びと時間を変えると、キャラの動き方が変わります。'],
    ['glyph','音符や星などの文字を、動くエフェクトとして出します。','文字・位置・色・移動距離を変えると、演出が変わります。'],
    ['hoop','キャラのまわりや足元に、広がる輪を作ります。','幅と高さで形を、色と時間で輪の見え方を変えられます。'],
    ['streak','光や水の流れなどに使う、細長い図形を作ります。','長さ・太さ・移動先を変えると、ビームや雨の見え方が変わります。'],
    ['shower','星や火花などを、指定した場所からまわりへ散らします。','個数・色・広がる距離を変えると、粒の演出が変わります。'],
    ['ghost','いまのキャラと同じ画像で、薄い残像を作ります。','移動先や時間を変えると、ダッシュの残像が変わります。'],
    ['characterId','HTMLのdata-characterなどから読み取ったキャラの名前です。','この名前を使って、そのキャラに合う特技かを確かめます。'],
    ['footY|centerX|centerY','キャラの足元や中心の画面内の位置です。','ここを基準に、輪や音符などをキャラの近くへ置きます。'],
    ['leftRoom|rightRoom|jumpRoom','キャラが画面から大きくはみ出さないように決めた移動距離です。','画面内の余白を使って、横移動やジャンプの幅を調整します。'],
    ['STYLE','特技の演出に使うCSSを文字列として保存しています。','文字列の中のCSSを変えると、光の粒や特技名の見た目が変わります。'],
    ['current','いまのページに登録している特技の機能です。','ページを作り直したときに、前の登録を終了して新しい登録に入れ替えます。'],
    ['effect|active','いま表示している演出の要素・タイマー・アニメーションをまとめています。','まとめて記録しておくと、次の特技を押したときに前の演出を片づけられます。'],
    ['disposed','このページの特技の処理を終了したかを記録する値です。','trueのときは、前のページで予約した動きを進めません。'],
    ['doc|document','HTMLページ全体を表すオブジェクトです。','要素を探す・作る・追加するなどの操作に使います。'],
    ['win|window|global|globalThis','ブラウザの画面や、JavaScriptが動く環境の機能を使うための対象です。','幅・タイマーなどの機能を、後ろの名前で指定します。'],
    ['Math','数の計算に使う関数や定数をまとめた、JavaScriptの標準機能です。','Math.minやMath.sinなど、後ろの名前で計算方法を選びます。'],
    ['Array|Object|Set','配列・項目のまとまり・重複のない集合を扱う標準機能です。','種類によって、データの持ち方や使える関数が違います。'],
    ['Number|String|parseFloat','値を数値や文字列へ変換する標準機能です。parseFloatは先頭の小数を読み取ります。','数として計算するか、文字としてつなぐかが変わります。'],
    ['Image','画像を読み込むためのオブジェクトを作ります。','srcを変えると、読み込む画像が変わります。'],
    ['ResizeObserver','要素のサイズが変わったときに処理するための機能です。','監視する要素や関数で、サイズ変更時の処理が変わります。'],
    ['PixelActions|PixelCharacter','この教材が用意した、特技の動きやキャラ表示の機能です。JavaScriptの標準命令ではありません。','後ろに指定した関数を呼び、キャラの表示や動きを更新します。']
  ]);
  const properties = dictionary([
    ['x|left|right','横方向の座標や位置です。canvas の x は右へ行くほど大きくなります。','値を変えると、キャラ・図形・要素などの横位置が変わります。'],
    ['y|top|bottom','縦方向の座標や位置です。canvas の y は下へ行くほど大きくなります。','値を変えると、キャラ・図形・要素などの縦位置が変わります。'],
    ['w|width|h|height','横幅や高さを表す項目です。','値を変えると、表示する要素やエフェクトの大きさが変わります。'],
    ['face|flip','左右の向きです。1と-1などの値で表します。','符号を反対にすると、向きや左右反転が変わります。'],
    ['length','配列の要素数や、文字列の長さなどを表します。','配列の中身や文字を増減すると値が変わります。文字列では絵文字などが2以上になることもあります。'],
    ['textContent','HTML 要素の中の文字を読み書きします。','文章を入れ替えると表示が変わります。<h1> のような文字もタグとしては実行しません。'],
    ['className|classList','HTML 要素の class を文字列、または一覧として扱います。','class を変えると、その class に対応する CSS が当たるかも変わります。'],
    ['style|cssText','要素に直接指定する CSS を扱います。cssText は CSS をまとめた文字列です。','値を変えると、その要素の位置や色などが変わります。'],
    ['fillStyle|strokeStyle','canvas の塗りつぶし色・線の色を設定します。','このあと描く図形の色が変わります。すでに描いた部分は描き直すまで変わりません。'],
    ['globalAlpha|opacity','透け具合を指定する値です。0 は透明、1 は不透明です。','小さくすると薄く、大きくすると濃く表示されます。'],
    ['lineWidth','canvas で線を描くときの太さです。','数を大きくすると、そのあと描く線が太くなります。'],
    ['imageSmoothingEnabled','canvas で画像を拡大するとき、なめらかにするかを指定します。','false にするとドットの角が残り、true にすると境界がなめらかになります。'],
    ['duration','アニメーションの設定では、動きを終えるまでのミリ秒数です。','animate の duration を大きくすると、同じ動きに長い時間がかかります。'],
    ['offset','アニメーション全体のどの時点かを、0 から 1 で指定します。','0.5 なら半分の時点です。数を変えると途中の動きのタイミングが変わります。'],
    ['easing','アニメーションの速度の変わり方を指定します。','linear は一定、ease-out は終わりに向かってゆっくりになります。'],
    ['transform|translate','移動・拡大・回転など、表示上の変形を指定します。','座標や倍率を変えると、特技の動きやキャラの見た目が変わります。'],
    ['filter','画像などに掛かる色合い・ぼかし等の効果です。','hue-rotate の角度などを変えると、キャラ全体の色合いが変わります。'],
    ['src|currentSrc','画像などの読み込み先です。currentSrc は実際に使っている画像の URL です。','src の読み込み先を変えると、表示する画像が変わります。'],
    ['scale','表示する大きさの倍率です。','1は基準の大きさ、2は2倍です。'],
    ['color','このデータを使って描く粒や図形の色です。','カラーコードなどの値を変えると、描かれる色が変わります。'],
    ['size','ここでは光の粒を描く四角形の大きさです。','数を大きくすると粒が大きく、小さくすると細かくなります。'],
    ['alt','画像の内容を伝える代わりの文章です。','画像が見えない場合や読み上げで伝える内容が変わります。'],
    ['hidden|disabled','要素を非表示にするか、操作を無効にするかの状態です。','true / false を切り替えると、表示やボタンを押せるかが変わります。'],
    ['target|relatedTarget','操作が起きた要素や、フォーカスの移動先などの関連する要素です。','この要素を調べ、どこで操作したかに合わせて処理を分けます。'],
    ['code|key','押したキーの情報です。code は物理的な位置、key は入力される文字やキーの意味を表します。','比べる文字列を変えると、反応するキーが変わります。'],
    ['repeat|defaultPrevented','キーの押しっぱなしによる繰り返しか、通常の動作がすでに止められたかを表す状態です。','条件で調べることで、同じ操作の重複などを避けています。'],
    ['matches','matchMedia などが調べた条件に、いま当てはまるかを表します。','この結果に応じて、動きを減らす設定などを反映します。'],
    ['PI','円周率です。JavaScript では角度の計算などに使います。','Math.PI * 2 は1周分の角度（ラジアン）です。'],
    ['naturalWidth|naturalHeight','画像ファイルの本来の幅・高さです。','CSS で指定した表示サイズとは別です。縦横比の計算に使います。'],
    ['innerWidth|innerHeight|devicePixelRatio','表示領域の幅・高さや、画面の画素の細かさを表します。','画面に合わせた配置や、canvas の鮮明さを調整するために使います。'],
    ['document|ownerDocument','その画面や要素が属する HTML ページ全体です。','別の要素やページを対象にすると、要素を作る・探す範囲が変わります。'],
    ['defaultView','この HTML ページに対応する window を取り出します。','この画面の幅やタイマーなど、ページと同じ環境の機能を使います。'],
    ['head|body|documentElement','HTML の head・body・最上位の html 要素を指します。','追加先を変えると、CSS や表示する要素を置く場所が変わります。'],
    ['childNodes','要素の直下にある子の一覧です。文字やコメントも含みます。','この一覧を使って、子の要素や文字を順に調べられます。'],
    ['type','HTML のボタンや入力欄などの種類を指定する属性です。','button の type を "button" にすると、フォーム送信とは別の通常ボタンになります。'],
    ['tabIndex','キーボードの Tab で選べるかや、その順序を指定します。','0 なら通常の順序で選べます。-1 は Tab の順序から外します。'],
    ['activeElement','いまキーボード操作の対象になっている要素です。','この要素を調べると、どこへキー入力が届くかが分かります。'],
    ['tagName','HTML 要素のタグ名を読み取ります。通常の HTML では大文字になります。','タグ名によって、画像・ボタンなどの種類を見分けられます。'],
    ['isContentEditable','文字を直接編集できる要素かを調べる値です。','trueの場合に別の操作を止めるなど、入力を邪魔しない処理に使えます。'],
    ['pointerId','マウスや指など、操作しているポインターを見分ける番号です。','同じポインターの動きを追い続けるために使います。'],
    ['detail','イベントの追加情報です。click ではクリック回数などが入ります。','この値を調べ、クリックの種類に応じて処理を分けられます。'],
    ['performance','処理の経過時間などを詳しく調べる、ブラウザの機能です。','performance.now()で時間を読み取り、処理にかかった時間などを計算できます。'],
    ['onload|onerror|onfinish','読み込み完了・読み込み失敗・アニメーション終了のときに呼ぶ処理です。','入れる関数を変えると、その出来事の後に行う処理が変わります。']
  ]);
  function result(token, kind, detail, label) { return { start: token.start, end: token.end, label: label || token.value, kind, meaning: detail.meaning, change: detail.change }; }
  function chain(token) { const parts = [token.value]; let t = token; for (let i = 0; i < 5 && t.before && /^(\.|\?\.)$/.test(t.before.value); i++) { t = t.before.before; if (!t) break; parts.unshift(t.value); } return parts.join('.'); }
  function enclosingCall(token) { let p = token.parent; while (p) { if (p.value === '(' && p.before && p.before.type === 'word') return p.before.value; p = p.parent; } return ''; }
  function stringExplanation(token, source) {
    const raw = token.value, value = raw.replace(/^["'`]|["'`]$/g, '');
    const prev = token.before, call = enclosingCall(token);
    const assignment = prev && prev.value === '=' && prev.before && prev.before.value;
    if (assignment === 'STYLE' || (token.type === 'template' && /(?:^|\n)\.[\w-]+\s*\{/.test(value))) return result(token, 'CSS を入れた文字列', { meaning:'このJavaScriptはCSSを文字列として保存し、ページに追加しています。中身はCSSの書き方です。', change:'セレクタや色・余白を変えると、特技のエフェクトや表示名の見た目が変わります。' }, '特技の演出のCSS');
    if (value === 'use strict') return result(token, '実行の設定', { meaning:'間違いやすい一部の書き方を、エラーとして扱う設定です。', change:'画面に表示する文章ではありません。削ると、誤りを見つける条件が変わります。' });
    if (/^(querySelector|querySelectorAll|closest|q)$/.test(call)) return result(token, '要素を探す文字列', { meaning:'CSS のセレクタで、操作したい HTML 要素を指定しています。', change:'例えば .character を変えると、探す class が変わります。見つからない場合もあります。' });
    if (/^(?:getAttribute|setAttribute|removeAttribute)$/.test(call) && token.parent && token.parent.after === token) return result(token, 'HTML の属性名', { meaning:'HTML 要素から読み書きする属性の名前です。data- で始まる名前は、この教材の JavaScript が読む情報です。', change:'名前を変えると、読み書きする情報が変わります。HTML 側の属性名とも対応させます。' });
    if (/^(?:click|keydown|keyup|pointerdown|pointerup|pointercancel|lostpointercapture|focusout|blur|resize|visibilitychange)$/.test(value) && /^(on|addEventListener|removeEventListener)$/.test(call)) return result(token, 'イベント名', { meaning:'いつ処理を動かすかを指定します。' + (value === 'click' ? 'click はクリックしたときです。' : value === 'keydown' ? 'keydown はキーを押したときです。' : value === 'keyup' ? 'keyup はキーを離したときです。' : 'この名前の操作や変化を受け取ります。'), change:'イベント名を変えると、反応する操作やタイミングが変わります。' });
    if (/^#[\da-f]{3,8}$/i.test(value)) return result(token, '色を表す文字列', { meaning:'16進数のカラーコードです。JavaScript の文字列として色を渡しています。', change:'カラーコードを変えると、この値を使って描く図形や文字の色が変わります。' });
    if (/^(jump|dash|shield|highjump|glide|magnet)$/.test(value) || (global.PixelSkillCatalog?.skills && Object.hasOwn(global.PixelSkillCatalog.skills, value))) return result(token, '特技の名前', { meaning:'特技の動きを見分ける名前です。画面に出す日本語名とは別です。', change:'用意された名前へ変えると、選ぶ特技や判定が変わります。HTML の data-skill などとも対応しています。' });
    if (call === 'node' || call === 'createElement') {
      if (token.parent && token.parent.after === token) return result(token, '作るタグの名前', { meaning:'JavaScript で作る HTML 要素のタグ名です。', change:'button ならボタン、p なら段落など、要素の種類が変わります。' });
      if (/^pa-[\w-]+$/.test(value)) return result(token, '付ける class の名前', { meaning:'新しく作る HTML 要素の class 名です。', change:'名前を変えると、対応する CSS や JavaScript から見つけられるかが変わります。' });
    }
    if (token.type === 'template') return result(token, 'テンプレート文字列', { meaning:'バッククォートで囲む文字列です。${ … } では計算した値を文章に埋め込めます。', change:'文字を変えると表示や CSS の指定が変わります。${ … } の中は JavaScript として計算します。' }, raw.length > 90 ? 'テンプレート文字列' : raw);
    return result(token, '文字列', { meaning:'引用符で囲んだ文字です。表示する文章・名前・設定などとして使います。', change:'変更した文字が、そのまま値になります。CSS の名前や読み込み先などは、使う側との対応も必要です。' }, raw.length > 90 ? '文字列' : raw);
  }
  function numberExplanation(token, source) {
    const before = source.slice(Math.max(0, token.start - 100), token.start);
    let meaning = '計算・位置・時間・条件などに使う数値です。', change = '値を変えると、この数を使う計算や判定の結果が変わります。';
    if (/\bduration\s*:\s*$/.test(before)) { meaning = 'アニメーションにかけるミリ秒数です。1000 なら1秒です。'; change = '大きくすると、同じ動きに長い時間がかかります。'; }
    else if (/\b(?:x|y|w|h|width|height)\s*:\s*-?\s*$/.test(before)) { const key = before.match(/(x|y|w|h|width|height)\s*:\s*-?\s*$/)[1]; meaning = key === 'x' ? '横位置の座標です。右へ行くほど大きくなります。' : key === 'y' ? '縦位置の座標です。下へ行くほど大きくなります。' : '幅または高さを決める数値です。'; change = '値を変えると、キャラやエフェクトの位置や大きさが変わります。'; }
    else if (/\b(?:opacity|globalAlpha|offset)\s*[:=]\s*$/.test(before)) { meaning = /offset\s*:\s*$/.test(before) ? 'アニメーションのどの時点かを表す、0〜1 の値です。' : '透け具合を表す値です。0 は透明、1 は不透明です。'; change = /offset\s*:\s*$/.test(before) ? '数を変えると、この状態になるタイミングが変わります。' : '小さくすると薄く、大きくすると濃く表示されます。'; }
    return result(token, '数値', { meaning, change });
  }
  function describe(token, source) {
    if (token.type === 'comment') return result(token, 'コメント', { meaning:'人が読むためのメモです。この部分は JavaScript の処理として実行されません。', change:'文章だけを変えても動きは変わりません。/* */ や // の範囲を変えると、実行する部分も変わります。' }, token.value.startsWith('//') ? '// コメント' : '/* コメント */');
    if (token.type === 'string' || token.type === 'template') return stringExplanation(token, source);
    if (token.type === 'regex') return result(token, '正規表現', { meaning:'文字の並び方を指定するパターンです。/ … / の中では、\u005c\u005cs などにも特別な意味があります。', change:'パターンを変えると、見つける文字や分割する場所が変わります。末尾の g・i などは探し方の設定です。' });
    if (token.type === 'number') return numberExplanation(token, source);
    if (token.type === 'interpolation' || token.type === 'interpolation-end') return result(token, '文字列に値を入れる部分', { meaning:'${ … } の中を JavaScript として計算し、結果を文字列へ埋め込みます。', change:'中の変数や式を変えると、文字列に入る値が変わります。' });
    const name = token.value, shortName = name.length > 36 ? name.slice(0, 35) + '…' : name, prev = token.before, next = token.after;
    if (token.type === 'word') {
      const property = prev && /^(\.|\?\.)$/.test(prev.value), key = next && next.value === ':';
      if (!property && !key && keywords[name]) return result(token, /^(true|false|null|undefined)$/.test(name) ? '値' : 'JavaScript の構文', keywords[name]);
      const calling = next && (next.value === '(' || (next.value === '?.' && next.after && next.after.value === '('));
      const objectName = token.parent && token.parent.value === '{' && token.parent.before && token.parent.before.value === '=' && token.parent.before.before && token.parent.before.before.value;
      if (key && objectName === 'SKILL_NAMES') return result(token, '項目の名前', { meaning:'特技の内部名です。右側に、画面へ出す日本語名を対応させています。', change:'名前を変えるなら HTML の data-skill や、その特技を処理するコードの名前も合わせます。' });
      if (property && name === 'apply' && /(?:^|\.)PixelCharacter\.apply$/.test(chain(token))) return result(token, 'キャラの表示を更新', { meaning:'HTML のパーツ指定と CSS の色を読み、キャラの画像を作り直す、この教材の関数です。', change:'HTML の data-head などや CSS の --body-color を変えると、作るキャラの見た目が変わります。' }, chain(token) + '(…)');
      if (property && calling && methods[name]) return result(token, '関数の呼び出し', methods[name], chain(token) + '(…)');
      if ((property || key) && properties[name]) return result(token, 'オブジェクトの項目', properties[name], property ? chain(token) : name);
      if (!property && !key && (token.parameter || token.parameterReference || (next && next.value === '=>'))) return result(token, '受け取る値の名前', { meaning:'関数を呼び出した側から渡された値を、この名前で受け取って使います。', change:'名前を変えるなら、関数の中で同じ値を使っている箇所も合わせて変えます。' });
      if (!key && actions[name] && (!property || /^(PixelActions|PixelCharacter|mount|destroy|trigger|refreshAppearance|PI|Image|ResizeObserver)$/.test(name))) return result(token, calling ? 'このコードの関数' : 'このコードで使う名前', actions[name], calling ? name + '(…)' : name);
      if (property && !calling && methods[name] && !properties[name]) return result(token, '関数を表す項目', { meaning:methods[name].meaning, change:'この位置では関数そのものを参照しています。実行する場合は後ろに ( … ) を付けます。' }, chain(token));
      if (property && properties[name]) return result(token, 'オブジェクトの項目', properties[name], chain(token));
      if (property) return result(token, calling ? 'オブジェクトの関数' : 'オブジェクトの項目', { meaning:'左側の対象にある「' + shortName + '」という' + (calling ? '関数を呼び出しています。' : '項目を読んだり、値を入れたりしています。'), change:'名前を変えると別の項目を指します。存在しない名前では値が得られず、呼び出せないこともあります。' }, chain(token) + (calling ? '(…)' : ''));
      if (key) return result(token, '項目の名前', { meaning:'オブジェクトの中で、右側の値に「' + shortName + '」という名前を付けています。', change:'名前を変えると、あとでこの値を読むコードの名前も合わせる必要があります。' });
      if (prev && prev.value === 'function') return result(token, '関数の名前', { meaning:'ひとまとまりの処理に付けた名前です。この名前で呼び出せます。', change:'名前を変えるなら、この関数を呼んでいる箇所も同じ名前にします。' });
      if (calling) return result(token, '関数の呼び出し', { meaning:'「' + shortName + '」という名前の処理を、括弧の中の値を渡して呼び出します。', change:'詳しい動きは、この関数の定義で決まります。渡す値を変えると結果が変わることがあります。' }, name + '(…)');
      return result(token, '変数などの名前', { meaning:'「' + shortName + '」という名前で値を扱っています。何が入るかは、この名前を定義・代入している箇所で決まります。', change:'名前だけを変えると、ほかの箇所と対応しなくなります。値を変えたいときは代入している箇所を見ます。' });
    }
    if (symbols[name]) return result(token, 'JavaScript の記号', symbols[name]);
    return result(token, 'コードの記号', { meaning:'前後の書き方と合わせて解釈する記号です。この記号だけでは役割を特定できません。', change:'対応する括弧や前後の式を確認します。途中の入力では、まだ有効なコードになっていないこともあります。' });
  }
  api.js = function explainJavaScript(source, index) {
    if (typeof source !== 'string' || !Number.isInteger(index) || index < 0 || index >= source.length || /\s/u.test(source[index])) return null;
    let tokens = cache.get(source);
    if (!tokens) { tokens = tokenize(source); cache.set(source, tokens); if (cache.size > 4) cache.delete(cache.keys().next().value); }
    let left = 0, right = tokens.length - 1;
    while (left <= right) {
      const middle = (left + right) >> 1, token = tokens[middle];
      if (index < token.start) right = middle - 1;
      else if (index >= token.end) left = middle + 1;
      else {
        if (token.type === 'template' && token.value.startsWith('`') && token.value.endsWith('`') && token.before && token.before.value === '=' && token.before.before && token.before.before.value === 'STYLE' && typeof api.css === 'function' && index > token.start && index < token.end - 1) {
          const offset = token.start + 1, css = api.css(token.value.slice(1, -1), index - offset);
          if (css) return { ...css, start: css.start + offset, end: css.end + offset, kind: 'CSS（文字列の中）', meaning: '特技の演出に使うCSSを文字列として保存しています。' + css.meaning };
        }
        return describe(token, source);
      }
    }
    return null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
