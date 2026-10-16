(function(root){
'use strict';
const API=root.PixelCodeExplain||(root.PixelCodeExplain={});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const properties={
  color:['文字の色','色を変えると文字の色が変わります。'],
  background:['背景をまとめて指定','色や画像を変えると背景が変わります。'],
  'background-color':['背景の色','色を変えると背景色が変わります。'],
  'background-image':['背景の画像やグラデーション','none にすると背景画像が消えます。'],
  'background-size':['背景画像1枚分の大きさ','この教材の格子では数字を大きくするとマスが広がります。'],
  'background-position':['背景画像の位置','位置を変えると画像の見える場所が変わります。'],
  'background-repeat':['背景画像の繰り返し方','no-repeat なら繰り返さず1枚だけ表示します。'],
  width:['横幅','数字を大きくすると広がります。max-width があるとその上限までです。'],
  height:['高さ','画像の縦横比を保つなら auto を使えます。'],
  'min-width':['横幅の下限','0 にすると内容の幅に縛られず小さくできる場合があります。'],
  'max-width':['横幅の上限','小さくすると広がれる幅が狭くなります。'],
  'min-height':['高さの下限','大きくすると少なくともその高さを確保します。'],
  'max-height':['高さの上限','小さくすると高さの上限が低くなります。'],
  margin:['枠の外側の余白','大きくすると周囲との間隔が広がります。'],
  padding:['枠の内側の余白','大きくすると内容と枠の間が広がります。'],
  display:['要素の並べ方','grid は格子状、flex は主に一列、none は非表示です。'],
  'grid-template-columns':['グリッドの列数と幅','1fr 1fr は同じ幅の2列、1fr は1列です。'],
  'grid-template-rows':['グリッドの行数と高さ','値の数や大きさで行の構成が変わります。'],
  'grid-column':['グリッドの列の位置','span 2 なら2列分の幅を使います。'],
  'grid-row':['グリッドの行の位置','span 2 なら2行分の高さを使います。'],
  'align-items':['子要素を交差方向にそろえる位置','横一列の flex では center で上下の中央にそろいます。'],
  'justify-content':['並ぶ方向の余白の配り方','横一列の flex では center で中央、space-between で両端に分かれます。'],
  'justify-items':['グリッドの各マス内の横方向の位置','center なら各マスの中央に寄ります。'],
  'place-items':['上下と左右のそろえ方','grid では center でマスの上下左右の中央に置きます。'],
  'align-self':['この要素だけの交差方向の位置','親の align-items とは別の位置にそろえられます。'],
  gap:['並べた要素どうしのすき間','大きくすると離れます。2つの値なら行・列の順です。'],
  'row-gap':['行のすき間','大きくすると行どうしが離れます。'],
  'column-gap':['列のすき間','大きくすると列どうしが離れます。'],
  flex:['flex の子要素が伸び縮みする割合など','1 は空いた場所を分け合って広がる指定です。'],
  'flex-grow':['空いた場所へ広がる割合','大きい要素ほど余った場所を多く受け取ります。'],
  'flex-shrink':['場所が足りないときに縮む割合','0 にすると縮まなくなります。'],
  'flex-basis':['伸び縮みする前の基準の大きさ','この値を基準に幅や高さを配分します。'],
  'flex-direction':['flex で並ぶ向き','row は横、column は縦に並びます。'],
  'flex-wrap':['flex の折り返し方','wrap は入りきらない要素を次の行へ移します。'],
  order:['flex や grid で見せる順番','小さい数字から先に並びます。HTMLの順番は変わりません。'],
  font:['文字の設定をまとめて指定','サイズや字体などをまとめて変えます。inherit は親と同じ設定です。'],
  'font-family':['文字の字体','左から使える字体を探します。名前で文字の形が変わります。'],
  'font-size':['文字の大きさ','数字を大きくすると文字が大きくなります。'],
  'font-weight':['文字の太さ','bold は太字です。数値は使える字体の範囲で大きいほど太くなります。'],
  'font-style':['斜体などの文字の形','italic は斜体、normal は通常の形です。'],
  'line-height':['1行分の高さ','単位なしの 1.5 は文字サイズの1.5倍です。大きくすると行の間が広がります。'],
  'letter-spacing':['文字どうしの間隔','正の値で広がり、負の値で詰まります。'],
  'text-align':['行の中の文字などの位置','center は中央、left は左、right は右にそろえます。'],
  'text-decoration':['下線などの文字の飾り','none は線なし、underline は下線です。'],
  'text-decoration-thickness':['下線などの太さ','大きくすると線が太くなります。'],
  'text-underline-offset':['下線と文字の距離','大きくすると下線が文字から離れます。'],
  'text-shadow':['文字の影','位置・ぼかし・色で影の見え方が変わります。'],
  'white-space':['空白と改行の扱い','nowrap は自動で折り返さず、normal は幅に合わせて折り返します。'],
  'overflow-wrap':['長い文字列の折り返し方','anywhere は長いURLなども途中で折り返せます。'],
  border:['枠線の太さ・種類・色','数字や色で枠線が変わります。0 は枠線なしです。'],
  'border-color':['枠線の色','色を変えると枠線の色が変わります。'],
  'border-width':['枠線の太さ','大きくすると枠線が太くなります。'],
  'border-style':['枠線の種類','solid は実線、dashed は破線、dotted は点線です。'],
  'border-radius':['角の丸み','大きくすると角が丸くなります。'],
  'box-sizing':['幅や高さの数え方','border-box は内側の余白と枠線を幅や高さに含めます。'],
  'box-shadow':['要素の枠の影','横のずれ・縦のずれ・ぼかし・色で影が変わります。'],
  outline:['枠の外側の線','選択した場所の目印にもなります。太さや色を変えられます。'],
  'outline-offset':['枠と outline の間隔','大きくすると線が外側へ離れます。'],
  'image-rendering':['画像を拡大したときの描き方','pixelated はドットの輪郭を残し、auto は通常の描き方です。'],
  'object-fit':['画像を枠に収める方法','contain は全体を収め、cover は枠を埋めてはみ出す部分を切ります。'],
  'object-position':['画像の枠内の位置','左右や上下に動かして見える部分を変えられます。'],
  filter:['色やぼかしの効果','hue-rotate は画像全体の色合いを回します。'],
  transform:['見た目の移動・回転・拡大縮小','位置や向きを変えます。通常は周りの要素の配置を押し広げません。'],
  'transform-origin':['回転や拡大の中心','left top は左上を中心に変形します。'],
  opacity:['要素全体の不透明さ','1 は不透明、0 は透明、0.5 は半透明です。'],
  position:['位置を決める方法','relative は元の場所、absolute は基準となる祖先から配置します。'],
  inset:['上下左右の位置','position に応じた基準からの距離を変えます。'],
  'z-index':['重なったときの前後関係','適用される要素では同じ重なりの範囲内で大きい値ほど手前になります。'],
  isolation:['重なり順を独立したまとまりにするか','isolate は内側の z-index の比較をそのまとまりの中に区切ります。'],
  'touch-action':['タッチ操作をブラウザーがどう扱うか','none は通常のスクロールや拡大操作を抑えます。ゲームの操作自体は追加しません。'],
  'backdrop-filter':['後ろにある内容のぼかしなどの効果','blur() なら透けて見える後ろの内容をぼかします。要素自身への filter とは異なります。'],
  overflow:['枠からはみ出した内容の扱い','hidden は隠し、auto は必要ならスクロールできます。'],
  'overflow-x':['横にはみ出した内容の扱い','hidden は隠し、auto は必要なら横スクロールできます。'],
  'overflow-y':['縦にはみ出した内容の扱い','hidden は隠し、auto は必要なら縦スクロールできます。'],
  visibility:['要素を見せるかどうか','hidden は場所を残したまま隠します。display: none とは異なります。'],
  cursor:['ポインターの形','pointer は指の形です。クリックの動作そのものは追加しません。'],
  'pointer-events':['ポインター操作の対象になるか','none はその要素をクリックの対象から外します。'],
  'list-style':['リストの印や番号','none は先頭の丸印などを消します。'],
  content:['::before や ::after に追加する内容','文字列を変えると追加される文字が変わります。'],
  transition:['値が変わるときのアニメーション','時間を長くすると対応する値がゆっくり変わります。'],
  'transition-duration':['変化にかける時間','長くするとゆっくり変わります。'],
  animation:['アニメーションをまとめて指定','@keyframes の名前や時間で動き方が変わります。'],
  'animation-name':['使う @keyframes の名前','同じ名前の動きを使います。一致しないと動きません。'],
  'animation-duration':['動き1回分の時間','長くすると1回の動きがゆっくりになります。'],
  'animation-iteration-count':['動きの繰り返し回数','infinite はずっと繰り返します。'],
  'animation-timing-function':['動く速さの変化','linear は一定、ease は速さが変化します。'],
  'user-select':['文字などを選択できるか','none では通常の文字選択ができません。']
};
for(const [dir,ja] of [['top','上'],['right','右'],['bottom','下'],['left','左']]){
  properties['margin-'+dir]=['枠の'+ja+'側の余白','数字を変えると'+ja+'側の空きが変わります。'];
  properties['padding-'+dir]=['枠の内側の'+ja+'の余白','大きくすると内容と'+ja+'の枠の間が広がります。'];
  properties[dir]=[ja+'端からの位置','position が static 以外のときなどに位置を動かします。'];
}
const functions={
  min:['小さい方の値を使う','括弧の値を変えると小さい方の値が採用されます。'],
  max:['大きい方の値を使う','片方が小さくても大きい方の値を保ちます。'],
  clamp:['値を一定の範囲に収める','最小値・目安・最大値の順に指定します。'],
  minmax:['グリッドの下限と上限','minmax(0, 1fr) は0まで縮められ、余った場所を分け合えます。'],
  repeat:['列や行の指定を繰り返す','repeat(3, 1fr) は同じ幅の3列です。最初の数で列数などが変わります。'],
  calc:['長さなどを計算する','calc(100% - 20px) は基準から20px引きます。+ と - の前後には空白が必要です。'],
  var:['名前をつけた値を使う','-- で始まる名前の値を読みます。元の値を変えると使う場所も変わります。'],
  'hue-rotate':['画像全体の色合いを回す','0deg は元の色、180deg で大きく変わります。体だけの色指定ではありません。'],
  scalex:['横方向の拡大縮小','1 は元の幅、2 は2倍、-1 は左右反転です。'],
  scaley:['縦方向の拡大縮小','1 は元の高さ、2 は2倍、-1 は上下反転です。'],
  scale:['拡大縮小','1 は元の大きさ、1.5 は1.5倍です。2つなら横・縦の順です。'],
  rotate:['要素の回転','正と負の角度で回る向きが変わります。'],
  translatex:['横方向への移動','正の値で右、負の値で左へ動きます。'],
  translatey:['縦方向への移動','正の値で下、負の値で上へ動きます。'],
  translate:['横・縦への移動','1つ目は横、2つ目は縦の移動量です。'],
  'linear-gradient':['直線方向に色が変わる背景','色・角度・色の切り替わる位置で背景の模様が変わります。'],
  'radial-gradient':['中心から外側へ色が変わる背景','色や中心の位置で円やだ円の模様が変わります。'],
  url:['画像やファイルの場所','場所を変えると読み込む画像などが変わります。'],
  rgb:['赤・緑・青の強さで色を指定','3つの値で色が変わります。/ の後は不透明さです。'],
  rgba:['赤・緑・青と不透明さで色を指定','最後の不透明さは0で透明、1で不透明です。'],
  hsl:['色相・鮮やかさ・明るさで色を指定','角度と2つの割合で色が変わります。'],
  hsla:['色相・鮮やかさ・明るさと不透明さ','最後の値で透け方が変わります。'],
  blur:['輪郭をぼかす','大きくするとぼかしが強くなります。'],
  brightness:['明るさを変える','100% が元の明るさ、200% は明るくなります。'],
  contrast:['明暗の差を変える','100% が元の差です。大きくすると差が強まります。'],
  grayscale:['白黒に近づける','0% は元の色、100% は白黒です。'],
  saturate:['鮮やかさを変える','100% は元の色、0% は白黒です。'],
  'drop-shadow':['画像の輪郭などに影をつける','横・縦のずれ、ぼかし、色で影が変わります。'],
  steps:['動きを段階に区切る','最初の数で段階の数が変わります。'],
  'cubic-bezier':['動く速さの変化を曲線で指定','4つの値で加速や減速の具合が変わります。']
};
const pseudos={
  hover:['ポインターが重なっている要素','重ねたときの見た目が変わります。'],
  active:['押している最中の要素','押している間の見た目が変わります。'],
  focus:['フォーカスがある要素','キーボード操作やクリックで選ばれたときの見た目が変わります。'],
  'focus-visible':['フォーカスの目印が必要な要素','主にキーボード操作で選んだ場所の目印を変えられます。'],
  'focus-within':['自分か子孫にフォーカスがある要素','中の入力欄などを選ぶときの見た目が変わります。'],
  has:['括弧の条件に合う要素を持つもの','li:has(button) は中に button がある li を選びます。'],
  not:['括弧の条件に合わないもの','条件で除外される要素が変わります。'],
  is:['括弧内のどれかに合うもの','カンマで候補を増やすと対象が増えます。'],
  where:['括弧内のどれかに合うもの','候補をまとめられます。:where 自体はCSSの優先度を上げません。'],
  root:['文書の一番外側の要素','HTMLでは html を選びます。共通の変数を置くこともあります。'],
  'first-child':['きょうだいの一番目','last-child なら最後の要素が対象です。'],
  'last-child':['きょうだいの最後','first-child なら一番目の要素が対象です。'],
  'nth-child':['きょうだいの何番目か','2 は2番目、odd は奇数番目、even は偶数番目です。'],
  'nth-of-type':['同じタグの中で何番目か','数字で対象の順番が変わります。'],
  checked:['チェック済みや選択済みの要素','選択されたときの見た目が変わります。'],
  disabled:['操作できない状態の要素','無効なボタンなどの見た目が変わります。'],
  empty:['文字や子要素がない要素','空の要素だけに見た目をつけられます。'],
  before:['要素の内容の前に作る部分','content で文字などを追加して見た目を変えられます。'],
  after:['要素の内容の後に作る部分','content で文字などを追加して見た目を変えられます。'],
  marker:['リスト先頭の丸印や番号','印の色などを変えられます。'],
  selection:['文字を選択している部分','選択中の文字色や背景色を変えられます。'],
  placeholder:['入力欄の入力例','入力前の文字の色などを変えられます。']
};
function identStart(c){return !!c&&(/[a-zA-Z_\-]/.test(c)||c.charCodeAt(0)>=128||c==='\\');}
function identChar(c){return !!c&&(/[a-zA-Z0-9_\-]/.test(c)||c.charCodeAt(0)>=128||c==='\\');}
function readIdent(s,i){while(i<s.length&&identChar(s[i])){if(s[i]==='\\'){i++;let n=0;while(i<s.length&&n<6&&/[\da-f]/i.test(s[i])){i++;n++;}if(n&&/\s/.test(s[i]||''))i++;else if(!n&&i<s.length)i++;}else i++;}return i;}
function lex(s){const a=[];let i=0;while(i<s.length){const start=i,c=s[i];let type='punct';if(/\s/.test(c)){type='space';while(i<s.length&&/\s/.test(s[i]))i++;}
else if(c==='/'&&s[i+1]==='*'){type='comment';const n=s.indexOf('*/',i+2);i=n<0?s.length:n+2;}
else if(c==='"'||c==="'"){type='string';const q=c;i++;while(i<s.length){if(s[i]==='\\'){i=Math.min(s.length,i+2);continue;}if(s[i]===q){i++;break;}if(s[i]==='\n'||s[i]==='\r')break;i++;}}
else if((c==='@'||c==='#')&&identChar(s[i+1])){type=c==='@'?'at':'hash';i=readIdent(s,i+1);}
else{const n=s.slice(i).match(/^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/);if(n){type='number';i+=n[0].length;if(s[i]==='%')i++;else if(identStart(s[i]))i=readIdent(s,i);}
else if(identStart(c)){type='ident';i=readIdent(s,i);}else i+=['~=','|=','^=','$=','*=','||'].includes(s.slice(i,i+2))?2:1;}
a.push({start,end:i,text:s.slice(start,i),type,role:'unknown'});}return a;}
function trim(a,l,h){while(l<h&&['space','comment'].includes(a[l].type))l++;while(h>l&&['space','comment'].includes(a[h-1].type))h--;return [l,h];}
function paint(a,l,h,info){for(let i=l;i<h;i++)Object.assign(a[i],info);}
function plain(a,l,h){return a.slice(l,h).filter(t=>t.type!=='comment').map(t=>t.text).join('').trim();}
function parse(source){const a=lex(source);
function header(l,h,role){paint(a,l,h,{role});if(role==='selector'){let attr=-1;for(let i=l;i<h;i++){if(a[i].text==='[')attr=i;if(attr>=0)a[i].attrStart=attr;if(a[i].text===']'&&attr>=0){for(let k=attr;k<=i;k++)a[k].attrEnd=i;attr=-1;}}}}
function declaration(lo,hi){const [l,h]=trim(a,lo,hi);if(l>=h)return;let colon=-1,depth=0;for(let i=l;i<h;i++){if(['(','['].includes(a[i].text))depth++;if([')',']'].includes(a[i].text))depth--;if(a[i].text===':'&&depth===0){colon=i;break;}}
if(colon<0){paint(a,l,h,{role:'property',property:plain(a,l,h)});return;}
const rawProperty=plain(a,l,colon),property=rawProperty.startsWith('--')?rawProperty:rawProperty.toLowerCase();paint(a,l,colon,{role:'property',property});Object.assign(a[colon],{role:'colon',property});paint(a,colon+1,h,{role:'value',property});const stack=[];
for(let i=colon+1;i<h;i++){const t=a[i];t.fn=stack.at(-1)?.name||'';t.arg=stack.at(-1)?.arg||0;let next=i+1;while(next<h&&['space','comment'].includes(a[next].type))next++;
if(t.type==='ident'&&a[next]?.text==='('){t.role='function';t.functionName=t.text.toLowerCase();}
if(t.text==='('){let prev=i-1;while(prev>colon&&['space','comment'].includes(a[prev].type))prev--;stack.push({name:a[prev]?.type==='ident'?a[prev].text.toLowerCase():'',arg:0});t.fn=stack.at(-1).name;t.arg=0;}
else if(t.text===')')stack.pop();else if(t.text===','&&stack.length)stack.at(-1).arg++;}
const top=a.slice(colon+1,h).filter(t=>!['space','comment','punct'].includes(t.type)&&!t.fn&&t.role!=='function');top.forEach((t,i)=>{t.valueCount=top.length;t.topPosition=i;});}
function block(lo,hi,mode,depth=0){if(depth>100)return;let begin=lo,paren=0,square=0;for(let i=lo;i<hi;i++){const t=a[i];if(['comment','string'].includes(t.type))continue;const x=t.text;if(x==='(')paren++;else if(x===')')paren=Math.max(0,paren-1);else if(x==='[')square++;else if(x===']')square=Math.max(0,square-1);if(paren||square)continue;
if(x==='{'){const [l]=trim(a,begin,i),first=a[l]?.text.toLowerCase()||'',at=first.startsWith('@'),key=/^@(?:-webkit-)?keyframes$/.test(first),declAt=/^@(font-face|page|property|counter-style)$/.test(first);header(begin,i,at?'at-rule':mode==='keyframes'?'keyframe':'selector');let level=1,j=i+1;
for(;j<hi;j++){if(['comment','string'].includes(a[j].type))continue;if(a[j].text==='{')level++;else if(a[j].text==='}'&&--level===0)break;}
a[i].role='open-block';if(j<hi)a[j].role='close-block';block(i+1,j,key?'keyframes':at&&!declAt?'rules':'declarations',depth+1);i=j;begin=j+1;}
else if(x===';'){const [l]=trim(a,begin,i);if(mode==='declarations'&&a[l]?.type!=='at')declaration(begin,i);else header(begin,i,a[l]?.type==='at'?'at-rule':'selector');t.role='semicolon';begin=i+1;}}
if(begin<hi){const [l]=trim(a,begin,hi);if(mode==='declarations'&&a[l]?.type!=='at')declaration(begin,hi);else header(begin,hi,a[l]?.type==='at'?'at-rule':mode==='keyframes'?'keyframe':'selector');}}
block(0,a.length,'rules');return a;}
const cache=new Map();
function tokens(s){if(cache.has(s)){const a=cache.get(s);cache.delete(s);cache.set(s,a);return a;}const a=parse(s);cache.set(s,a);if(cache.size>3)cache.delete(cache.keys().next().value);return a;}
function out(t,kind,meaning,change,range){return {start:range?.[0]??t.start,end:range?.[1]??t.end,label:range?.[2]??t.text,kind,meaning,change};}
function prev(a,i){while(--i>=0)if(!['space','comment'].includes(a[i].type))return i;return -1;}
function next(a,i){while(++i<a.length)if(!['space','comment'].includes(a[i].type))return i;return -1;}
const short=s=>s.length>36?s.slice(0,35)+'…':s;
function propertyInfo(t){const p=t.property||(t.text.startsWith('--')?t.text:t.text.toLowerCase());
if(p==='--body-color')return out(t,'キャラの色','体の色を保存するCSS変数です。教材のJavaScriptが読み取ります。','色コードで対応するキャラの体の色が変わります。画像の塗り替えは教材のJavaScriptが行います。');
if(p==='--accent-color')return out(t,'キャラの色','アクセント色を保存する独自の変数です。教材のJavaScriptが読み取って画像を描き直します。','色コードでキャラの一部の色が変わります。変わる部分はキャラや装備によって異なります。');
if(p.startsWith('--'))return out(t,'CSS変数','あとで var() から使えるように名前をつけた値です。','使われている場所があればまとめて変わります。名前だけでは見た目は変わりません。');
const v=own(properties,p)?properties[p]:null;
return v?out(t,'プロパティ',v[0]+'を指定します。',v[1]):out(t,'プロパティ','「'+short(p)+'」という設定名です。詳しい説明はまだありません。','対応するプロパティと有効な値なら反映されます。名前の書き間違いは反映されません。');}
// Explain the relationship on a visible token too: whitespace itself is hard to point at.
function relation(a,i){let p=prev(a,i);if(p<0||a[p].role!=='selector')return '';const op=a[p].text;let tail=p,word='';
if(['>','+','~'].includes(op)){tail=prev(a,p);word=op==='>'?'の直接の子である ':op==='+'?'の直後のきょうだいである ':'より後ろのきょうだいである ';}
else if(a.slice(p+1,i).some(t=>t.type==='space')&&!['(',')','[',']',':',',','.'].includes(op)){word='の中にある ';}
else return '';
if(tail<0)return '';let start=tail;while(start>0&&a[start-1].role==='selector'&&![',','('].includes(a[start-1].text))start--;const label=plain(a,start,tail+1);return label?'「'+short(label)+'」'+word:'';}
function selectorInfo(a,i){const t=a[i],p=a[prev(a,i)],n=a[next(a,i)];
if(t.attrStart!==undefined){const first=t.attrStart,last=t.attrEnd??i,content=a.slice(first+1,last).filter(x=>!['space','comment'].includes(x.type)),name=short(content[0]?.text||'属性');
if(t.type==='space')return null;
if(t.text==='['||t.text===']')return out(t,'属性セレクタ','HTMLの属性を条件に選ぶ括弧です。','[data-skill="jump"] なら data-skill が jump の要素を選びます。');
const ops={'=':'値が完全に同じ','~=':'空白区切りの値に含まれる','|=':'値が同じか、その値とハイフンで始まる','^=':'その値で始まる','$=':'その値で終わる','*=':'その値を含む'};
if(own(ops,t.text))return out(t,'属性の条件',ops[t.text]+'要素を選びます。','記号を変えると選ぶ範囲が変わります。');
if(content[0]===t)return out(t,'属性名で選ぶ','HTMLで「'+short(t.text)+'」という属性を持つ要素が対象です。','名前を変えると別の属性を持つ要素が対象になります。');
return out(t,'属性の値で選ぶ','HTMLの「'+name+'」の値と照らし合わせる条件です。','文字を変えると対象が変わります。HTMLの属性自体は書き換わりません。');}
if(t.text==='.'&&n?.type==='ident'||t.type==='ident'&&p?.text==='.'&&p.end===t.start){const dot=t.text==='.'?t:p,id=t.text==='.'?n:t,rel=relation(a,t.text==='.'?i:prev(a,i));return out(t,'クラスセレクタ',rel+'HTMLの class に「'+short(id.text)+'」を持つ要素を選びます。','名前を変えると対象が変わります。HTML側の class と一致させます。',[dot.start,id.end,'.'+id.text]);}
if(t.type==='hash')return out(t,'IDセレクタ',relation(a,i)+'HTMLで id="'+short(t.text.slice(1))+'" の要素を選びます。','名前で対象が変わります。リンクの飛び先を変える指定ではありません。');
let colon=-1,nameIndex=-1;if(t.text===':'){colon=i;let ni=next(a,i);if(a[ni]?.text===':')ni=next(a,ni);if(a[ni]?.type==='ident')nameIndex=ni;}
else if(t.type==='ident'&&p?.text===':'){colon=prev(a,i);nameIndex=i;}
if(colon>=0&&nameIndex>=0){if(a[prev(a,colon)]?.text===':')colon=prev(a,colon);const name=a[nameIndex].text.toLowerCase(),v=own(pseudos,name)?pseudos[name]:null,label=a.slice(colon,nameIndex+1).map(x=>x.text).join('');return out(t,label.startsWith('::')?'疑似要素':'状態や条件で選ぶ',v?v[0]+'を選びます。':'「'+short(label)+'」という条件で選びます。',v?v[1]:'条件で対象が変わります。使える名前か確認してください。',[a[colon].start,a[nameIndex].end,label]);}
if(t.type==='space'){if(!p||!n||p.role!=='selector'||n.role!=='selector'||/[\n\r]/.test(t.text)||['>','+','~',',','(','['].includes(p.text)||['>','+','~',',',')',']'].includes(n.text))return null;return out(t,'中にある要素を選ぶ','空白で区切ると左側の要素の中にある右側の要素を選びます。','間に別の要素があっても対象です。> なら直接の子だけになります。');}
const punctuation={
  '>':['直接の子を選ぶ','左側のすぐ内側にある子要素だけを選びます。','空白だけならさらに内側の子孫も対象です。'],
  '+':['直後のきょうだいを選ぶ','すぐ後にある同じ親の要素を選びます。','~ なら後ろに続くきょうだいも対象です。'],
  '~':['後ろのきょうだいを選ぶ','左側より後ろにある同じ親の要素を選びます。','+ ならすぐ後だけが対象です。'],
  ',':['条件の区切り','分けた条件のどれかに合う要素を選びます。','条件を増やすと同じ見た目を使う対象が増えます。'],
  '*':['すべての要素','ここに当てはまるすべての種類のタグを選びます。','h1 などに変えると対象のタグを絞れます。'],
  '&':['外側のセレクタ','入れ子のCSSで外側に書いた対象を表します。','&:hover は外側の対象にポインターが重なったときの指定です。'],
  '(':['条件の括弧','疑似クラスなどの条件をこの中に書きます。','条件で対象が変わります。左右の括弧を対応させます。'],
  ')':['条件の括弧','疑似クラスなどの条件を閉じます。','条件で対象が変わります。左右の括弧を対応させます。']
};
if(own(punctuation,t.text))return out(t,...punctuation[t.text]);
if(t.type==='ident'){// nth-child arguments are conditions, not tag names.
let k=i;while(k>=0&&a[k].role==='selector'&&!['{',','].includes(a[k].text)){if(a[k].text==='('&&['nth-child','nth-of-type'].includes(a[prev(a,k)]?.text))return out(t,'順番の条件','何番目を選ぶかを指定します。','odd は奇数番目、even は偶数番目、2n は偶数番目です。');k--;}
return out(t,'タグセレクタ',relation(a,i)+'HTMLの <'+short(t.text)+'> タグの要素を選びます。','h1 を p にすると段落が対象です。class を選ぶ場合は先頭に . が必要です。');}
if(t.type==='number')return out(t,'順番などの条件','要素の順番などを指定する数値です。','nth-child(2) は2番目、nth-child(2n) は偶数番目を選びます。');
return out(t,'セレクタの記号','見た目を変える対象を指定する部分です。','記号で対象が変わる場合があります。使える書き方か確認してください。');}
const mediaFeatures={
  'max-width':['幅が指定値以下のとき','大きくすると、より広い表示領域でも内側のCSSが働きます。'],
  'min-width':['幅が指定値以上のとき','大きくすると、より広い表示領域だけで内側のCSSが働きます。'],
  'max-height':['高さが指定値以下のとき','値を変えると切り替わる高さが変わります。'],
  'min-height':['高さが指定値以上のとき','値を変えると切り替わる高さが変わります。'],
  'prefers-reduced-motion':['動きを減らす設定かどうか','reduce は端末で動きを減らす設定が使われているときです。'],
  'prefers-color-scheme':['明るい表示・暗い表示の設定','dark は暗い表示、light は明るい表示に合わせます。'],
  orientation:['表示領域の縦長・横長','portrait は縦長、landscape は横長です。']
};
function atInfo(a,i){const t=a[i];let j=i;while(j>0&&a[j-1].role==='at-rule')j--;const at=a.slice(j,i+1).find(x=>x.type==='at')?.text.toLowerCase()||'';
const rules={
  '@media':['画面の条件でCSSを切り替える','括弧の条件に合うときだけ内側のCSSが働きます。'],
  '@supports':['機能に対応するときだけCSSを使う','括弧の指定にブラウザーが対応しているかで切り替えます。'],
  '@keyframes':['アニメーションの途中の姿を決める','animation で同じ名前を指定すると使えます。'],
  '@font-face':['読み込む字体を登録する','font-family の名前や src で使う字体が変わります。'],
  '@import':['別のCSSを読み込む','ファイルの場所で読み込むCSSが変わります。'],
  '@layer':['CSSの優先順のグループを作る','グループの順序で指定の優先順が変わります。'],
  '@container':['周りの要素の大きさなどで切り替える','条件に合うときだけ内側のCSSが働きます。'],
  '@property':['CSS変数の型や初期値を登録する','受け付ける値や未指定時の値を決められます。']
};
if(t.type==='at'){const v=own(rules,t.text.toLowerCase())?rules[t.text.toLowerCase()]:null;return out(t,'CSSの規則',v?v[0]+'書き方です。':'「'+short(t.text)+'」で始まるCSSの規則です。',v?v[1]:'規則ごとに働きが異なります。使える名前か確認してください。');}
if(at==='@media'||at==='@container'){
if(own(mediaFeatures,t.text))return out(t,'表示の条件',mediaFeatures[t.text][0]+'を条件にします。'+(at==='@media'?'この教材ではプレビューの表示領域が基準です。':''),mediaFeatures[t.text][1]);
if(t.type==='number'){let feature='';for(let k=i-1;k>=j;k--){if(own(mediaFeatures,a[k].text)){feature=a[k].text;break;}}return out(t,'切り替える境目',feature?'「'+feature+'」の条件に使う長さです。':'条件に使う長さや数値です。',feature?mediaFeatures[feature][1]:'値でCSSが働く条件が変わります。');}
if(['and','or','not','only'].includes(t.text))return out(t,'条件のつなぎ方',t.text==='and'?'両方の条件に合うときに使います。':t.text==='or'?'どれかの条件に合うときに使います。':t.text==='not'?'続く条件に合わないときに使います。':'対応したブラウザーにこの条件を適用する語です。','つなぎ方でCSSが働く場面が変わります。');
if(t.text===',')return out(t,'条件の区切り','どれかの条件に合えば内側のCSSを使います。','条件を増やすとCSSが働く場面を増やせます。');
return out(t,'表示の条件','画面などの条件を指定する部分です。','条件に合うときだけ内側のCSSが働きます。');}
if(/keyframes$/.test(at))return out(t,'動きの名前','このアニメーションにつける名前です。','使う側の animation-name などと名前を一致させます。');
return out(t,'規則の条件や値','「'+short(at)+'」の対象や条件を指定する部分です。','この規則の書き方に合わせると対象や条件が変わります。');}
function numeric(t){const p=t.property||'',x=t.text,m=x.match(/^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?)(.*)$/),unit=(m?.[2]||'').toLowerCase(),n=m?.[1]||x,fn=t.fn;let meaning='',change='数字で「'+short(p)+'」の値が変わります。';
if(['scalex','scaley','scale'].includes(fn))return out(t,'大きさの倍率',n+' 倍にする値です。',fn==='scalex'?'1 は元の幅、2 は2倍、-1 は左右反転です。':fn==='scaley'?'1 は元の高さ、2 は2倍、-1 は上下反転です。':'1 は元の大きさ、0.5 は半分、2 は2倍です。');
if(fn==='hue-rotate')return out(t,'色合いを回す角度','画像全体の色合いを '+short(x)+' 回します。','0deg は元の色、180deg で大きく変わります。体だけでなく画像全体にかかります。');
if(fn==='repeat'&&t.arg===0)return out(t,'繰り返す数','同じ列や行の指定を '+short(n)+' 回繰り返します。','repeat(3, 1fr) の3を2にすると同じ幅の2列になります。');
if(unit==='px'){meaning=short(x)+' はCSS上の長さです。px は「ピクセル」と読みます。';change='大きくすると長さが増えます。画面の倍率などにより実際の画素数とは異なります。';}
else if(unit==='vh'){meaning='表示領域の高さの '+short(n)+'% です。この教材ではプレビューの高さが基準です。';change='大きくすると高さを基準にした長さが増えます。横幅の指定にも使えます。';}
else if(unit==='vw'){meaning='表示領域の幅の '+short(n)+'% です。この教材ではプレビューの幅が基準です。';change='大きくすると幅を基準にした長さが増えます。';}
else if(unit==='vmin'||unit==='vmax'){meaning='表示領域の縦横の'+(unit==='vmin'?'小さい':'大きい')+'方の '+short(n)+'% です。';change='縦横比によって基準になる向きが変わります。';}
else if(unit==='rem'){meaning='html 要素の文字サイズの '+short(n)+' 倍です。';change='数字や基準の文字サイズで長さが変わります。';}
else if(unit==='em'){meaning=(p==='font-size'?'親の文字サイズ':'この要素の文字サイズ')+'の '+short(n)+' 倍です。';change='文字サイズを基準に大きさや余白を調整できます。';}
else if(unit==='fr'){meaning='グリッドで余った場所を分ける割合です。';change='1fr 1fr は同じ割合、1fr 2fr は後ろの列が2倍の割合で受け取ります。';}
else if(unit==='deg'){meaning=short(n)+' 度という角度です。';change='360deg で1周です。回転や色合い、グラデーションの向きが変わります。';}
else if(unit==='s'||unit==='ms'){meaning=short(n)+(unit==='s'?'秒':'ミリ秒')+'という時間です。';change='1000ms は1sです。動きの時間なら大きいほどゆっくりになります。';}
else if(unit==='%'){
if(/^translate/.test(fn)){meaning='変形する要素自身の'+(fn==='translatey'||fn==='translate'&&t.arg===1?'高さ':'幅')+'の '+short(n)+'% です。';change='自分の大きさを基準に移動します。';}
else if(fn==='linear-gradient'||fn==='radial-gradient'){meaning='グラデーションの範囲での位置などを表す割合です。';change='数字で色が切り替わる位置などが変わります。';}
else if(['rgb','rgba','hsl','hsla','brightness','contrast','grayscale','saturate','opacity'].includes(fn)){meaning='「'+fn+'」に渡す割合です。';change='色や効果の強さが変わります。意味は関数内の位置によって異なります。';}
else if(p==='font-size'){meaning='親の文字サイズの '+short(n)+'% です。';change='100% は親と同じ大きさ、150% は1.5倍です。';}
else if(p==='line-height'){meaning='この要素の文字サイズの '+short(n)+'% の行の高さです。';change='大きくすると行の高さが増えます。';}
else if(/^(width|min-width|max-width|margin(?:-.+)?|padding(?:-.+)?)$/.test(p)){meaning='基準となる親側の幅の '+short(n)+'% です。';change=/^(margin|padding)/.test(p)?'上下の余白でも基準は通常、親側の幅です。':'100% で親側の幅いっぱいです。余白や枠線の数え方にも影響されます。';}
else if(/^(height|min-height|max-height)$/.test(p)){meaning='基準となる親側の高さの '+short(n)+'% です。';change='親側の高さが未指定だと期待どおりにならない場合があります。';}
else if(p==='opacity'){meaning='要素全体の不透明さが '+short(n)+'% です。';change='0% は透明、100% は不透明です。';}
else{meaning='「'+short(p)+'」で使う割合 '+short(n)+'% です。';change='基準はプロパティや関数によって異なります。';}}
else if(unit){meaning='数値 '+short(n)+' と単位 '+short(unit)+' の組み合わせです。';change='対応する単位なら、その単位を基準に大きさなどが変わります。';}
else if(p==='line-height'){meaning='文字サイズの '+short(n)+' 倍を1行の高さにします。';change='1.2 から1.6へ増やすと行の間が広がります。';}
else if(p==='font-weight'){meaning='文字の太さを表す数値です。';change='使える字体の範囲で大きい数ほど太くなります。';}
else if(p==='opacity'){meaning='不透明さを表す数値です。';change='0 は透明、0.5 は半透明、1 は不透明です。';}
else if(p==='order'){meaning='見た目の並び順の数値です。';change='小さい数から先に並びます。HTMLの順番は変わりません。';}
else if(p==='flex-shrink'){meaning='場所が足りないときに縮む割合です。';change='0 は縮みません。値が大きいと元の大きさも考慮して多く縮む場合があります。';}
else if(p==='flex'||p==='flex-grow'){meaning='空いた場所を分け合う割合などの数値です。';change='1 なら同じ割合の要素どうしで空いた場所を分け合います。';}
else if(Number(n)===0){meaning='長さなどを0にします。0の長さは通常、単位を省略できます。';change='長さを0以外にするなら 8px など必要な単位をつけます。';}
else{meaning='「'+short(p)+'」に使う数値です。';change='長さなら単位が必要なことがあります。割合や回数などは単位なしで使います。';}
if(/^(margin|padding)$/.test(p)&&!fn&&t.valueCount){const side={1:['上下左右'],2:['上下','左右'],3:['上','左右','下'],4:['上','右','下','左']}[t.valueCount];if(side?.[t.topPosition])meaning+=' ここは'+side[t.topPosition]+'の余白です。';}
if(p==='box-shadow'&&!fn&&t.topPosition<4){const which=['横のずれ','縦のずれ','ぼかしの広さ','影の広がり'][t.topPosition];if(which)meaning+=' ここは'+which+'です。';}
return out(t,unit?'数値と単位':'数値',meaning,change);}
const values={
  display:{grid:['格子状に並べる','grid-template-columns で列数や幅を決めます。'],flex:['一つの方向に並べる','flex-direction で縦横、gap ですき間を変えます。'],block:['基本的に前後で改行する表示','inline なら行の中に流れます。'],'inline-block':['行の中に置ける箱','行の中に並びながら幅や高さを指定できます。'],inline:['行の中に流す表示','文字のように並びます。通常 width や height は効きません。'],none:['配置ごと非表示にする','占めていた場所もなくなります。HTMLは消えません。']},
  'image-rendering':{pixelated:['ドットの輪郭を残して拡大する','auto は通常の拡大表示です。']},
  'box-sizing':{'border-box':['幅と高さに内側の余白と枠線を含める','指定した幅の内側に padding と border が収まります。'],'content-box':['幅と高さを内容だけの大きさにする','padding と border の分だけ外側が大きくなります。']},
  'flex-wrap':{wrap:['入りきらない要素を折り返す','nowrap なら一列のままです。'],nowrap:['要素を折り返さない','wrap なら入りきらない要素は次の行に移ります。']},
  'flex-direction':{row:['横方向に並べる','column なら縦方向です。'],column:['縦方向に並べる','row なら横方向です。']},
  'font-weight':{bold:['太字にする','normal なら通常の太さです。'],normal:['通常の太さにする','bold なら太字です。']},
  position:{relative:['元の場所を基準に配置する','top や left で見た目をずらせます。元の場所は残ります。'],absolute:['基準となる祖先から配置する','通常の並びから外れ、top や left などで位置を決めます。'],fixed:['通常は表示領域を基準に固定する','スクロールしても同じ場所です。祖先の transform などで基準が変わる場合があります。'],sticky:['スクロールに応じて位置を保つ','top などで指定した位置にとどまります。'],static:['通常の流れで配置する','top や left による位置指定は効きません。']},
  cursor:{pointer:['ポインターを指の形にする','形だけが変わります。クリックの動作はHTMLやJavaScriptで用意します。']},
  'white-space':{nowrap:['自動で折り返さない','normal は幅に応じて折り返します。'],pre:['空白と改行をそのまま表示する','連続する空白や改行が見た目に残ります。']},
  'text-decoration':{none:['下線などをつけない','underline なら下線がつきます。'],underline:['下線をつける','none なら下線が消えます。']},
  'font-family':{'sans-serif':['ゴシック系の字体を使う','指定した字体が使えないときなどに、この種類から選びます。'],serif:['明朝系の字体を使う','文字の端に飾りがある字体を使います。'],monospace:['文字の幅がそろう字体を使う','コードなどで位置をそろえやすくなります。']}
};
function valueInfo(a,i){const t=a[i],p=t.property||'',x=t.text,lower=x.toLowerCase();
if(t.role==='function'){const f=own(functions,t.functionName)?functions[t.functionName]:null,change=t.functionName==='min'&&p==='max-width'?'min(100%, 45vh) なら親の幅と表示領域の高さの45%を比べて小さい方を使います。':f?.[1];return out(t,'CSSの関数',f?f[0]+'ための書き方です。':'「'+short(x)+'」という関数で値を指定します。',change||'括弧の値で結果が変わります。使える関数と書き方か確認してください。');}
if(t.type==='hash'&&/^#[\da-f]+$/i.test(x)){const valid=[4,5,7,9].includes(x.length);return out(t,'カラーコード',valid?'# の後の数字と a〜f で色を表します。'+([5,9].includes(x.length)?'最後の'+(x.length===5?'1桁':'2桁')+'は不透明さです。':''):'色の指定に似ていますが桁数が合っていません。','パレットの色コードに置き換えると「'+short(p)+'」の色が変わります。');}
if(x.startsWith('--'))return out(t,t.fn==='var'?'CSS変数を使う':'名前つきの値',t.fn==='var'?'「'+short(x)+'」に保存した値を読みます。':'-- で始まる名前です。CSS変数などで使います。',t.fn==='var'?'元の値や名前で使う値が変わります。未定義なら予備の値を使うか指定が無効になります。':'通常は var() で変数を読みます。このプロパティの書き方を確認してください。');
if(t.type==='number')return numeric(t);
if(t.type==='string')return out(t,p==='font-family'?'字体の名前':t.fn==='url'?'ファイルの場所':'文字列',p==='font-family'?'空白を含む字体名を引用符で囲んでいます。':t.fn==='url'?'画像などの場所を引用符で囲んでいます。':'文字を値として渡すために引用符で囲んでいます。',p==='font-family'?'別の字体名にすると使える場合は文字の形が変わります。':t.fn==='url'?'画像の場所を変えると読み込む画像が変わります。':'中の文字で使われる文字列が変わります。引用符を左右で対応させます。');
if(x==='!'||lower==='important'){const pi=prev(a,i),ni=next(a,i),start=x==='!'?t.start:a[pi]?.text==='!'?a[pi].start:t.start,end=x==='!'&&a[ni]?.text.toLowerCase()==='important'?a[ni].end:t.end;return out(t,'指定を優先する印','!important は通常の指定より優先させる印です。','指定どうしの関係が複雑になるので対象や順序を確認して使います。',[start,end,'!important']);}
const universal={inherit:['親と同じ値を使います。','親の同じプロパティを変えるとここにも伝わります。'],initial:['プロパティの初期値を使います。','ブラウザーが定めるそのプロパティの初期値に戻します。'],unset:['継承する性質なら親の値、それ以外は初期値です。','性質によって inherit または initial と同じ働きです。'],revert:['手前のスタイルの段階に戻します。','作者の指定を取り消したようにブラウザーなどの指定へ戻します。']};
if(own(universal,lower))return out(t,'値の指定',...universal[lower]);
if(own(values,p)&&own(values[p],lower)){const v=values[p][lower];return out(t,'値の指定',v[0]+'指定です。',v[1]);}
if(lower==='auto'){let meaning='ブラウザーが大きさや位置を計算します。',change='数値に変えると自動計算からその指定に変わります。';if(/^margin/.test(p)){meaning='この方向の余った余白を自動で受け取ります。';change='幅に余裕があるとき margin: 0 auto は左右に余白を分けて中央に置きます。';}else if(p==='height'){meaning='内容や画像の比率などから高さを決めます。';change='画像では width に合わせて元の縦横比を保った高さになります。';}return out(t,'自動で決める値',meaning,change);}
if(lower==='transparent')return out(t,'透明な色','完全に透明な色です。','色コードなら色がつきます。背景では後ろが見える状態から変わります。');
if(lower==='currentcolor')return out(t,'文字と同じ色','この要素の color と同じ色です。','color を変えると一緒に変わります。');
if(lower==='none')return out(t,'なしにする値','「'+short(p)+'」の効果などを使わない値です。','使える別の値なら効果や表示が有効になります。');
const lines={solid:'切れ目のない実線',dashed:'短い線が並ぶ破線',dotted:'点が並ぶ点線',double:'二重の線'};
if(own(lines,lower))return out(t,'線の種類',lines[lower]+'です。','太さや色を保ったまま線の種類を変えられます。');
if(lower==='center')return out(t,'中央にそろえる値','「'+short(p)+'」の対象の方向で中央にそろえます。',p==='place-items'?'grid ではマスの上下左右の中央です。':'プロパティや並ぶ方向によって上下・左右のどちらかが変わります。');
if(['space-between','space-around','space-evenly'].includes(lower))return out(t,'余白の配り方',lower==='space-between'?'両端に要素を置いて間に余白を均等に配ります。':lower==='space-around'?'各要素の両側に同じ余白を配ります。':'要素の間と両端に同じ余白を配ります。','値を切り替えると空いた場所の入り方が変わります。');
if(['hidden','visible','scroll'].includes(lower))return out(t,'表示の値',lower==='hidden'?'このプロパティの対象を隠す指定です。':lower==='visible'?'このプロパティの対象を見せる指定です。':'スクロールできるようにする指定です。','「'+short(p)+'」によって対象や場所を残すかどうかが異なります。');
const punctuation={
  ',':['値の区切り','関数の引数や複数の背景などを分けます。'],
  '(':['関数の括弧','関数に渡す値を中に書きます。閉じる括弧と対応させます。'],
  ')':['関数の括弧','関数に渡す値の終わりです。開く括弧と対応させます。'],
  '/':['値を分ける記号','rgb の不透明さや font の行の高さなどの区切りです。'],
  '+':['足し算の記号','calc の中で値を足します。前後に空白が必要です。'],
  '-':['引き算の記号','calc の中で値を引きます。前後に空白が必要です。'],
  '*':['掛け算の記号','calc の中で数を掛けます。有効な単位の組み合わせで使います。']
};
if(own(punctuation,x))return out(t,'値の記号',punctuation[x][0]+'です。',punctuation[x][1]);
if(/^(red|blue|green|white|black|yellow|orange|purple|pink|gray|grey|cyan|magenta|rebeccapurple)$/i.test(x))return out(t,'色の名前','「'+x+'」という名前で色を指定します。','別の色名や色コードで色が変わります。');
const v=own(properties,p)?properties[p]:null;return out(t,'プロパティの値','「'+short(p)+'」に渡す値です。'+(v?'ここでは'+v[0]+'を決めます。':''),v?v[1]:'使える値はプロパティごとに異なります。有効な書き方か確認してください。');}
API.css=function(source,index){if(typeof source!=='string'||!Number.isInteger(index)||index<0||index>=source.length)return null;const a=tokens(source);let l=0,h=a.length-1,i=-1;while(l<=h){const m=(l+h)>>1,t=a[m];if(index<t.start)h=m-1;else if(index>=t.end)l=m+1;else{i=m;break;}}if(i<0)return null;const t=a[i];
if(t.type==='comment')return out(t,'コメント','/* と */ の間は人が読むメモです。CSSの指定には使いません。','中の文章だけなら表示は変わりません。閉じる */ を消すと後ろもコメントになります。');
if(t.type==='space'&&t.role!=='selector')return null;
if(t.role==='selector')return selectorInfo(a,i);
if(t.role==='at-rule')return atInfo(a,i);
if(t.role==='property')return propertyInfo(t);
if(t.role==='value'||t.role==='function')return valueInfo(a,i);
if(t.role==='colon')return out(t,'名前と値の区切り','左にプロパティ名、右に値を書きます。','color: blue のように使います。: を消すと反映されません。');
if(t.role==='semicolon')return out(t,'設定の区切り','1つの設定の終わりを示す ; です。','次の設定の前に必要です。抜けると後ろの設定まで反映されないことがあります。');
if(t.role==='open-block'||t.role==='close-block')return out(t,'CSSのまとまり',t.role==='open-block'?'対象や条件に対応する設定がここから始まります。':'ここで設定のまとまりを閉じます。','{ と } を対応させます。位置で対象や条件が変わる場合があります。');
if(t.role==='keyframe')return out(t,'動きの途中の時点',t.text==='from'?'動きの最初（0%）の姿です。':t.text==='to'?'動きの最後（100%）の姿です。':'動き全体のどの時点かを指定します。','50% は途中の姿です。内側のCSSでその時点の位置や色を決めます。');
return t.type==='space'?null:out(t,'CSSのコード','この位置の詳しい説明はまだありません。','セレクタ { プロパティ: 値; } の形や括弧の対応を確認してください。');};
if(typeof module==='object'&&module.exports)module.exports=API.css;
})(typeof window!=='undefined'?window:globalThis);
