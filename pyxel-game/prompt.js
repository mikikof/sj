/* ブラウザ（file:// を含む）と Node で同じ頼む文を作る。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PyxelPrompt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMMON_RULES = `Pyxel（Python のレトロゲームエンジン）で、ブラウザの Pyxel Code Maker で動く 2D ゲームを作ってください。

【返し方】
main.py の全文を、1 つの Python のコードブロックで返してください。途中を「…」や「省略」で抜かないでください。コードのあとに遊び方を 3 行以内で書いてください。

【動かすための約束】
・作るコードのファイルは main.py 1 つにしてください。import は pyxel・random・math だけにしてください。ファイルの読み書き・input()・time.sleep は使わないでください。下で指定する絵とフォントの読み込みだけは使えます。
・pyxel.init(幅, 高さ, title="ゲーム名", fps=30) で始め、幅と高さはそれぞれ 256 以下にしてください。
・ゲームを進める update と、画面を描く draw に分け、pyxel.run(update, draw) で動かしてください。
・操作は矢印キーと Z（決定・ジャンプ・弾・わざなど）にし、ゲームに合う使い方を決めてください。もう一度遊ぶキーは Enter にしてください。
・古い書き方の init(caption=)、pyxel.MOUSE_LEFT_BUTTON、btnp(…, period=)、GAMEPAD_1_A、tilemap(0).get は使わないでください。画像を扱うときは pyxel.images[0] を使ってください。
・コメントは短い日本語で書き、コード全体は 300 行くらいまでにしてください。当たり判定は四角どうしにし、もの（相手・アイテム・弾）は同時に合計 30 個までにしてください。
・背景を色 1（紺）一色にしないでください。紺はキャラの輪郭の色なので、形が背景に溶けてしまいます。

【A. 土台（どのゲームにも入れる）】
・勝ちと負けをはっきり決め、1 回のミスですぐ終わりにしないでください。体力・残り時間・点が減るなど、ゲームに合う形にしてください。時間とともに難しくしてください。
・効果音を 2 つ以上、pyxel.sounds[番号].set(…) で作り、pyxel.play で鳴らしてください。点が入ったときとミスしたときに、目で分かる反応を出してください。
・効果音は、その出来事が起きた 1 回だけ鳴らしてください。当たっている間や押している間に毎回鳴らさないでください。BGM や、くり返し鳴る音は入れないでください。M キーで音を消せるようにしてください。
・タイトル → 遊ぶ → 終わり（点とハイスコア）→ もう一度、の流れで、1 回 1〜3 分にしてください。負けたら早く終わって構いません。ハイスコアはゲームを閉じるまで残し、ファイルには保存しないでください。
【B. このゲームの芯（いちばん大事）】
・生徒が欄に書いた中身から、このゲームにしかないルールを 1 つ決めて遊びの真ん中に置いてください。欄が少ないときや空のときは考えて補ってください。「落ちてくるものを取る・よける・撃つ」だけで終わらせず、ほかのゲームの作りをそのまま使い回さないでください。
・コードの先頭に「# このゲームの芯: …」というコメントを 1 行入れてください。「…」には決めたルールを書いてください。
・芯の例：色を合わせる／近くをかすめると点（危ないほど得）／弾や燃料に限りがある／時間で崩れる足場／すべる・はねる（重さや勢い）／ためて放つ／決まった順番で取る／相手の動きの決まりを読む／途中でルールが入れ替わる（昼と夜など）。この中から選ばなくても構いません。
【C. 味付け（1〜2 つだけ）】
・芯に合うものを次から 1〜2 つだけ選んでください。全部は入れないでください。コンボ／Z の「わざ」（待ち時間あり）／パワーアップ／最後に強い相手／段（LEVEL）の切り替え。
【D. 返す前に確かめる】
・A を満たすか、B の芯が遊びの真ん中にあるか、C は 1〜2 つだけか確かめてください。コードのあとに「このゲームの芯」と「入れた味付け」を合わせて 3 行以内で書いてください。遊び方の 3 行とは別にしてください。`;

  const CHARACTER_RULES = `【自分のキャラを使います】
・Code Maker には、キャラのページで作った ZIP を先に読み込みます。ZIP に my_resource.pyxres と umplus_j10r.bdf が入っています。
・主人公の絵は my_resource.pyxres の画像 0 の 1 段目にあります。16×16 が 4 コマで、x=0 が立ち、16 が歩き、32 がジャンプ、48 がわざです。どのコマも y=0 です。
・読み込みは次の形をこのまま入れてください。画面の大きさと題名は変えられます。
pyxel.init(192, 144, title="ゲーム名", fps=30)
pyxel.load("my_resource.pyxres")
try:
    FONT = pyxel.Font("umplus_j10r.bdf")
except Exception:
    FONT = None   # 字のファイルが無い＝キャラの ZIP を開かずに貼った
・FONT が None のときは、update の最初で return してゲームを進めないでください。draw では画面を消し、英語で Open your character ZIP first (Load > File) とだけ出して return してください。この読み込みと表示は必ず入れてください。クラスでは FONT を self.FONT にして構いません。
・主人公は pyxel.blt(x, y, 0, コマ * 16, 0, 16, 16, 0) で描いてください。コマは 0〜3 の番号です。最後の 0 は色 0 を透明にする指定です。左向きにするときは幅の 16 を -16 にしてください。
・動くと歩きのコマ（x=16）、跳ぶ間はジャンプのコマ（x=32）、わざを入れたときはわざの間にわざのコマ（x=48）を使ってください。
・画像 0 の 1 段目（y=0〜15）は書き換えないでください。ほかの絵は図形で描くか、画像 0 の 2 段目（y=16）より下に置いてください。
・FONT が None でなければ、日本語の文字を pyxel.text(x, y, 文字, 色, FONT) で描いてください。`;

  const SHAPES_RULES = `【自分のキャラは使いません】
・絵は pyxel.rect・pyxel.circ・pyxel.tri などの図形で描いてください。絵やフォントのファイルは読み込まないでください。
・画面の文字は英語にしてください。日本語はフォントがないと何も出ません。`;

  const FIELD_LABELS = Object.freeze({
    hero: '主人公（見た目・動かし方）',
    objects: '相手やもの（何が・どこから・どう動く・いくつ）',
    rules: 'ルール（当たると何が起きる・点の増え方）',
    ending: '終わり（勝ち・負けの条件）',
    difficulty: '難しさ（時間とともに何がどう変わる）',
    extra: 'ほかに頼みたいこと'
  });
  const PRESETS = Object.freeze({
    catch: {
      hero: '画面の下で、左右の矢印キーで動きます。\nいま取れる色を、主人公の近くにも出してください。',
      objects: '色の違うものが上から落ちてきます。\n同じ色を探して取り、違う色はよけます。',
      rules: 'いまの色と同じ色のものだけが得点です。違う色を取るとミスで 8 点減ります。\n取れる色はときどき変わり、変わる前に次の色を知らせます。',
      ending: '90 秒で 240 点以上なら勝ち、足りなければ負けです。\n終わりに点とハイスコアを出します。',
      difficulty: '時間とともに落ちる速さを上げます。\n色が変わるまでの間も短くします。',
      extra: '味付けはコンボだけ。正しい色を続けて取ると点が増えます。\n違う色を取るとコンボが切れます。'
    },
    dodge: {
      hero: '矢印キーで上下左右に動きます。\nZ は短いすり抜けダッシュで、使ったあとは少し待ちます。',
      objects: '岩が上から流れてきます。\n当たらないように、岩のすぐ横をねらって通ります。',
      rules: '相手の近くをかすめると点が入り、ぎりぎりほど高い点です。\nじっとしていると点が減ります。当たるとシールドが 1 減ります。',
      ending: 'シールドは 4。90 秒で 800 点以上なら勝ちです。\nシールドが 0 になるか、時間切れで点が足りなければ負けです。',
      difficulty: '時間とともに岩の速さを上げます。\n岩が出る間も短くします。',
      extra: '味付けは Z のわざだけ。使えるまでの待ち時間を見せます。\nすり抜けている間は、かすめても点が入りません。'
    },
    shoot: {
      hero: '左右の矢印キーで動き、Z を離すと弾を撃ちます。\nZ を長く押すと、ためて強い弾を撃てます。',
      objects: '相手が上から来ます。弾は 5 発までです。\n撃った弾が画面の外へ出ると戻り、また撃てます。',
      rules: '相手を倒すと得点です。撃ちすぎると撃てない時間ができます。\nためた弾は強く、かたい相手も倒せます。相手を通すと基地の耐久が減ります。',
      ending: '基地の耐久は 6。90 秒で 320 点以上なら勝ちです。\n耐久が 0 になるか、時間切れで点が足りなければ負けです。',
      difficulty: '時間とともに段（LEVEL）が切り替わります。\n後の段ほど相手が速くなり、かたい相手が増えます。',
      extra: '味付けは段（LEVEL）の切り替えだけです。\n残りの弾の数と、ため具合が分かる表示を付けます。'
    },
    jump: {
      hero: '左右の矢印キーで動き、Z でジャンプします。\n上の足場へ飛び移って登ります。',
      objects: '上へ上へ足場が続きます。\n乗った足場は 1 秒で崩れるので、次へ移ります。',
      rules: '高く行くほど点が増えます。同じ高さでは点は増えません。\n落ちても救助が残っていれば足場に戻れます。',
      ending: '120 秒で高さ 1200 以上なら勝ちです。救助は 3 回使えます。\n救助がなくなって落ちるか、時間切れで高さが足りなければ負けです。',
      difficulty: '時間とともに足場の幅を狭くします。\n足場の横のずれも大きくします。',
      extra: '味付けはパワーアップだけ。ときどきバネ足場が出て、高く跳べます。\n崩れるまでの残り時間が分かるように足場の見た目を変えます。'
    },
    free: {hero: '', objects: '', rules: '', ending: '', difficulty: '', extra: ''}
  });

  function useCharacter(options) {
    return typeof options === 'boolean' ? options : !options || options.useCharacter !== false;
  }
  function fixedRules(options) {
    return COMMON_RULES + '\n\n' + (useCharacter(options) ? CHARACTER_RULES : SHAPES_RULES);
  }
  function buildPrompt(fields = {}, options = {}) {
    const sections = Object.entries(FIELD_LABELS)
      .filter(([key]) => typeof fields[key] === 'string' && fields[key].trim())
      .map(([key, label]) => `【${label}】\n${fields[key]}`);
    return fixedRules(options) + (sections.length ? '\n\n【作りたいゲーム】\n' + sections.join('\n\n') : '');
  }
  function buildErrorPrompt(error, options = {}) {
    return `同じ会話で作ったゲームに、下のエラーが出ました。原因を短く説明し、直してください。\n\n${fixedRules(options)}\n\n【エラーの最後の数行】\n${error}\n\nmain.py の全文を返してください。`;
  }
  function buildFeaturePrompt(feature, options = {}) {
    return `同じ会話で作ったゲームに、下の変更を 1 つだけ加えてください。それ以外の動きは保ってください。\n\n${fixedRules(options)}\n\n【1 つだけ足したいこと】\n${feature}\n\nmain.py の全文を返してください。`;
  }
  return Object.freeze({COMMON_RULES, CHARACTER_RULES, SHAPES_RULES, FIELD_LABELS, PRESETS,
    fixedRules, buildPrompt, buildErrorPrompt, buildFeaturePrompt});
});
