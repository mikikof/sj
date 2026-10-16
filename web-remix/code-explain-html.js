/* HTMLの上で⌘を押したときの説明。編集途中のコードも文字位置を保って読みます。 */
(function (root) {
'use strict';
const api = root.PixelCodeExplain = root.PixelCodeExplain || {};
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const TAGS = {
 html:['HTML全体を囲むタグです。langで文章の言語を伝えます。','中にはページの設定を置くheadと内容を置くbodyを書きます。'],
 head:['ページの設定を書く場所です。ふつうは画面の本文には表示されません。','ここでタイトルや読み込むCSSを指定します。本文はbodyに書きます。'],
 body:['画面に表示する内容を囲みます。','中の見出し・文章・画像を変えるとページの内容が変わります。'],
 title:['ページのタイトルです。通常はブラウザのタブなどに使われます。','中の文字を変えても本文の見出しは変わりません。この教材の外側のタブ名も変わりません。'],
 meta:['文字コードなどの設定を伝えるタグです。終了タグはありません。','charsetやname、contentの組み合わせで設定の種類が変わります。'],
 link:['CSSなどの別ファイルをこのページに結びつけます。本文のリンクとは別のタグです。','この教材ではhrefをstyle.cssにするとCSS欄の内容が使われます。'],
 style:['中にCSSを書くタグです。','中のCSSを変えると見た目が変わります。この教材ではCSS欄でも編集できます。'],
 script:['JavaScriptを読み込んだり書いたりするタグです。','この教材ではcharacter-actions.jsが特技の動きをつけます。自由に追加したJavaScriptはプレビューでは実行されません。'],
 main:['そのページの主な内容をまとめます。','囲む範囲を変えると主な内容の範囲が変わります。色や配置はCSSで決まります。'],
 header:['ページやまとまりの導入部分です。見出しなどを置きます。','中の見出しやリンクを変えられます。上に固定されるという意味ではありません。'],
 footer:['ページやまとまりの末尾に置く情報です。','著者名や補足などを入れられます。画面の下に固定するには別にCSSが必要です。'],
 nav:['ページ内や別ページへの主なリンクをまとめます。','中にaタグを増やすと移動先を増やせます。'],
 section:['見出しをつけられる内容のまとまりです。ここでは特技のまとまりにも使っています。','中の見出しや項目を変えられます。枠や色が自動でつくわけではありません。'],
 article:['記事など単独でも意味が通じる内容のまとまりです。','中の内容を入れ替えると記事が変わります。見た目はCSSで指定します。'],
 aside:['本文に関連する補足情報をまとめます。','内容の役割を示すタグです。横に並べるにはCSSで指定します。'],
 div:['要素をまとめる箱です。div自体に特別な意味や色はありません。','classをつけてCSSで指定すると箱全体の配置・色・枠を変えられます。'],
 span:['文章の一部分などを囲むタグです。','囲んだ部分だけにclassやstyleをつけて見た目を変えられます。'],
 p:['文章のひとまとまりを表す段落です。','中の文字を変えると文章が変わります。段落を分けるならpをもう1つ作ります。'],
 h1:['ページの主な見出しです。ここではキャラの名前にも使っています。','中の文字を変えると見出しが変わります。文字の大きさはCSSで決まります。'],
 h2:['h1の下の段階にあたる見出しです。','中の文字を変えると小見出しが変わります。h3にすると見出しの段階も変わります。'],
 h3:['h2の下の段階にあたる見出しです。','中の文字を変えると見出しが変わります。見た目の大きさとは別に段階を表します。'],
 h4:['h3の下の段階にあたる見出しです。','中の文字や見出しの段階を変えられます。大きさはCSSでも指定できます。'],
 h5:['h4の下の段階にあたる見出しです。','中の文字や見出しの段階を変えられます。大きさはCSSでも指定できます。'],
 h6:['h5の下の段階にあたる見出しです。','中の文字や見出しの段階を変えられます。大きさはCSSでも指定できます。'],
 img:['画像を入れるタグです。srcが画像の場所、altが画像の代わりになる説明です。終了タグはありません。','srcを別の画像にすると絵が変わります。大きさや色合いはCSSでも変えられます。'],
 a:['リンクを作るタグです。hrefで移動先を指定します。','中の文字はリンクの表示、hrefは移動先を変えます。'],
 ul:['順番をつけないリスト全体を囲みます。1つ分の項目はliです。','liを増やすと項目が増えます。横並びや印の有無はCSSで変えられます。'],
 ol:['順番のあるリスト全体を囲みます。1つ分の項目はliです。','liを増やすと番号つきの項目が増えます。番号の見た目はCSSでも変えられます。'],
 li:['リストの1つ分の項目です。ulやolの中に書きます。','liを増やすと項目が増えます。文字を特技名にするだけでは新しい動きは増えません。'],
 button:['押して操作するボタンです。','中の文字で表示名を変えます。この教材ではdata-skillで用意された特技を指定します。'],
 br:['文章の途中で改行します。終了タグはありません。','入れた位置で次の行に移ります。段落を分ける場合はpを使います。'],
 hr:['話題の区切りを表します。終了タグはありません。','多くのブラウザでは線になります。線の見た目はCSSで変えられます。'],
 strong:['内容が重要だと示します。','囲んだ内容の重要性を伝えます。通常は太字ですがCSSで見た目を変えられます。'],
 em:['文章の中で強調する部分です。','囲んだ言葉を強調します。見た目だけを変えたいときはCSSでも指定できます。'],
 b:['注意を引きたい文字を表します。通常は太字になります。','囲む範囲を変えると目立つ部分が変わります。重要性を示すstrongとは役割が違います。'],
 i:['声や雰囲気が異なる語句などを表します。通常は斜体になります。','囲む範囲を変えるとその部分の役割が変わります。見た目はCSSでも指定できます。'],
 small:['補足や細かな注記を表します。','通常は文字が小さくなります。読みやすい大きさはCSSで指定できます。'],
 mark:['注目してほしい部分を示します。','囲む部分を変えると目印をつける場所が変わります。色はCSSで変えられます。'],
 code:['プログラムなどのコードを表します。','中の文字はコードとして表示されます。書いただけで実行されるわけではありません。'],
 pre:['空白や改行を保った文章を表示します。','空白や改行を増やすと表示にも反映されます。'],
 blockquote:['ほかの文章から引用したまとまりです。','中の文字を変えると引用文が変わります。余白などはCSSで指定できます。'],
 figure:['画像や図とその説明をまとめます。','中の画像や説明を入れ替えられます。'],
 figcaption:['figureの中の画像や図につける説明です。','中の文字を変えると画面に出る説明が変わります。imgのaltとは別です。'],
 details:['開いたり閉じたりできるまとまりです。','open属性をつけると最初から開きます。見出しはsummaryで指定します。'],
 summary:['detailsを開閉するための見出しです。','中の文字を変えると押す場所の表示が変わります。'],
 input:['文字入力や選択などの部品です。typeで種類を変えます。終了タグはありません。','type="text"なら文字入力、type="checkbox"ならチェック欄になります。'],
 textarea:['複数行の文字を入力できる欄です。','タグの間の文字が最初の内容になります。rowsやCSSで大きさを変えられます。'],
 label:['入力欄につける説明です。forで入力欄のidと結びつけられます。','forと入力欄のidをそろえると説明を押して入力欄を選べます。'],
 select:['選択肢から選ぶ入力欄です。','中のoptionを増やすと選択肢が増えます。'],
 option:['selectなどの中の1つ分の選択肢です。','中の文字で表示名を、valueで扱う値を変えます。'],
 form:['入力して送る内容をまとめます。','通常はactionに送信先を指定します。この教材のプレビューでは外部への送信は使えません。'],
 table:['表全体を囲みます。','trで行、thやtdで1つ分のマスを作れます。'],
 tr:['表の1行を表します。','trを増やすと行が増えます。中のthやtdがその行のマスになります。'],
 th:['表の見出しのマスです。','中の文字を変えると表の見出しが変わります。'],
 td:['表のデータのマスです。','中の文字や画像を変えるとそのマスの内容が変わります。'],
 thead:['表の見出しの行をまとめます。','中のtrを変えると見出し部分が変わります。'],
 tbody:['表の本文の行をまとめます。','中のtrを増やすと本文の行が増えます。'],
 caption:['表につける題名です。','中の文字を変えると表の題名が変わります。'],
 canvas:['JavaScriptで絵を描くための領域です。','widthやheightは描画領域の大きさです。タグだけでは絵は描かれません。'],
 video:['動画を表示する部品です。','通常はsrcで動画、controlsで再生ボタンの表示を指定します。このプレビューでは動画の読み込みに制限があります。'],
 audio:['音声を再生する部品です。','通常はsrcで音声、controlsで再生ボタンを指定します。このプレビューでは音声の読み込みに制限があります。'],
 iframe:['別のページを枠の中に埋め込むタグです。','通常はsrcでページを選びます。この教材のプレビューでは取り除かれます。'],
 svg:['点や線の情報で絵を描くSVGの領域です。','中の図形や色を変えると絵が変わります。'],
 path:['SVGの線や形を表します。dに形の情報を書きます。','dで形、fillで塗り色、strokeで線の色を変えられます。'],
 rect:['SVGの四角形です。','xとyで位置、widthとheightで大きさ、fillで色を変えられます。'],
 circle:['SVGの円です。','cxとcyで中心、rで半径、fillで色を変えられます。'],
 g:['SVGの図形をまとめるグループです。','fillやtransformをつけると中の図形をまとめて変更できます。'],
 template:['あとでJavaScriptなどから使うHTMLのひな形です。','中を書き換えてもそのまま画面には表示されません。使う処理が別に必要です。']
};
const ATTRS = {
 class:['CSSやJavaScriptから選ぶためにつける名前です。複数なら空白で区切ります。','名前を変えると元の名前を使うCSSや動きが合わなくなることがあります。CSSの .名前 と見比べてみよう。'],
 id:['そのページの中で要素を区別する名前です。同じidは重ねずに使います。','名前を変えたらhref="#名前"やCSSの #名前 も合わせます。'],
 alt:['画像の代わりになる説明です。画像を見られないときや読み上げで使われます。','画像の内容に合う説明にします。画像そのものやポインターを置いたときの吹き出しは変わりません。'],
 title:['要素につける補足情報です。ブラウザによってはポインターを置くと表示されます。','補足の文を変えられます。本文やimgのaltの代わりにはなりません。'],
 style:['この要素に直接書くCSSです。','中のプロパティや値を変えるとこの要素の見た目が変わります。'],
 lang:['文章の言語を伝えます。jaは日本語、enは英語です。','読み上げなどに影響します。文章を自動で翻訳する機能ではありません。'],
 charset:['文字の読み取り方を指定します。utf-8は日本語など多くの文字を扱えます。','適切でない文字コードにすると文字化けの原因になります。通常はutf-8のままで使います。'],
 href:['リンクや読み込むファイルの行き先です。','aでは移動先、linkでは読み込むファイルが変わります。'],
 src:['画像やスクリプトなどのファイルの場所です。','別のファイルの場所に変えると読み込む内容が変わります。存在しない場所は読み込めません。'],
 rel:['リンク先のファイルやページとの関係を表します。','linkのstylesheetはCSSを読み込む指定です。aでは関係や開き方の補助に使います。'],
 target:['リンク先をどこで開くかの指定です。','通常は_blankで別のタブに開きます。この教材では外部のWebリンクは別のタブに開きます。'],
 type:['部品やデータの種類です。同じtypeでもタグによって意味が変わります。','buttonでは通常のボタンか送信ボタンか、inputでは入力欄の種類などが変わります。'],
 hidden:['この要素を通常の表示から隠します。値を省略して使える属性です。','hiddenを外すと表示対象になります。hidden="false"と書いても隠す指定は残ります。'],
 disabled:['ボタンや入力欄を操作できない状態にします。','外すと再び操作できるようになります。disabled="false"でも無効の指定は残ります。'],
 readonly:['入力欄の内容を読み取り専用にします。','外すと入力できるようになります。readonly="false"でも読み取り専用の指定は残ります。'],
 checked:['チェック欄などが最初から選ばれていることを示します。','外すと最初の選択状態が変わります。checked="false"でも指定は残ります。'],
 selected:['optionが最初に選ばれていることを示します。','別のoptionにつけると最初の選択肢が変わります。selected="false"でも指定は残ります。'],
 open:['detailsやdialogを開いた状態にします。','detailsでは外すと最初は閉じます。open="false"でも開く指定は残ります。'],
 placeholder:['入力欄が空のときに出る短いヒントです。','例などの表示が変わります。実際に入力された値や入力欄の説明ラベルとは別です。'],
 value:['入力部品などで扱う値です。','inputでは最初の内容、optionでは選んだときの値などが変わります。'],
 for:['labelがどの入力欄の説明かを指定します。','入力欄のidと同じ名前にすると結びつきます。'],
 width:['画像や描画領域などの幅を指定します。','数を大きくすると幅が広がります。CSSの幅指定が優先される場合もあります。'],
 height:['画像や描画領域などの高さを指定します。','数を大きくすると高さが増えます。CSSの高さ指定が優先される場合もあります。'],
 rows:['textareaに表示する行数の目安です。','数を増やすと入力欄が高くなります。入力できる総行数の制限ではありません。'],
 cols:['textareaの横幅を文字数で指定する目安です。','数を増やすと入力欄が広がります。CSSでも幅を指定できます。'],
 name:['入力部品やmetaの設定につける名前です。','formでは送るデータの名前、metaでは設定の種類が変わります。'],
 content:['metaで指定する設定の中身です。','何を設定するかは同じタグのnameなどと組み合わせて決まります。'],
 tabindex:['キーボードで要素を選ぶ順番に関わる指定です。','0は通常の順で選べる指定、-1はTabでの移動先から外す指定です。'],
 role:['その要素の役割を読み上げなどの支援機能に伝えます。','役割の伝え方が変わります。roleだけでは見た目やボタンの動きはつきません。'],
 'aria-label':['要素の名前を読み上げなどの支援機能に伝えます。','伝える名前が変わります。ふつうの画面に出る文字は変わりません。'],
 'aria-hidden':['読み上げなどの支援機能から隠すかを指定します。','trueは支援機能から隠す指定です。これだけでは画面から消えません。'],
 'aria-pressed':['ボタンが押された状態かを支援機能に伝えます。','trueやfalseで伝える状態が変わります。状態に合う見た目や動きは別に用意します。'],
 'aria-expanded':['開閉する部分が開いているかを支援機能に伝えます。','trueやfalseで伝える状態が変わります。これだけでは開閉しません。'],
 'aria-labelledby':['名前の説明に使う別の要素をidで指定します。','idの行き先を変えると名前として読まれる内容が変わります。'],
 loading:['画像などを読み込むタイミングの指定です。','lazyにすると表示が近づくまで読み込みを待つことがあります。'],
 download:['リンク先をダウンロードするための指定です。','通常は値に保存名を書けます。実際の動作はリンク先やブラウザによって異なります。'],
 fill:['SVGの図形の塗り色です。','色の名前やカラーコードを変えると図形の中の色が変わります。noneは塗らない指定です。'],
 stroke:['SVGの図形の線の色です。','色を変えると輪郭の色が変わります。線の太さはstroke-widthです。'],
 'stroke-width':['SVGの線の太さです。','数を大きくすると線が太くなります。'],
 viewbox:['SVGで使う座標の範囲です。位置2つと幅・高さの4つの数を書きます。','範囲を変えると絵の見える部分や拡大のされ方が変わります。'],
 d:['SVGのpathに描く線や形の命令です。','座標や命令を変えると形が変わります。色はfillやstrokeで指定します。']
};
const PARTS = {
 'data-head':{name:'頭のパーツ',values:{default:'元の頭',cap:'キャップ',crown:'王冠',antenna:'アンテナ'}},
 'data-hands':{name:'手のパーツ',values:{default:'元の手',gloves:'グローブ',robot:'ロボットの手',wings:'羽'}},
 'data-feet':{name:'足のパーツ',values:{default:'元の足',boots:'ブーツ',wheels:'車輪',spring:'ばね'}},
 'data-gear':{name:'装備',values:{none:'装備なし',sword:'剣',shield:'盾',pack:'リュック'}}
};
const SKILLS={jump:'二段ジャンプ',dash:'ダッシュ',shield:'シールド',highjump:'ハイジャンプ',glide:'ふわり',magnet:'星よせ'};
const CHARACTERS={mint:'ミント',ember:'ヒバナ',cloud:'シロ',nova:'ノヴァ',aqua:'アクア'};
const CLASSES={page:'ページ全体の内容',card:'紹介カード', 'character-area':'キャラの画像を置く場所',character:'キャラの画像',profile:'紹介文のまとまり',category:'キャラの肩書き',bio:'紹介文','profile-links':'プロフィール内のリンクのまとまり','profile-link':'「もっと見る」のページへのリンク','skills-link':'特技の場所へのリンク','skills-section':'特技の見出しとリスト',skills:'特技のリスト','about-page':'「もっと見る」のページ','page-header':'ページ上部のまとまり','back-link':'プロフィールに戻るリンク','about-heading':'「もっと見る」のページの見出し','about-intro':'好きなものを紹介する文章','about-card':'「もっと見る」のページの紹介カード','about-note':'このページの補足文',favorites:'好きなもののリスト',badge:'小さなラベル','character-label':'画像につけるラベル','page-footer':'ページ末尾の情報'};
for(const map of [TAGS,ATTRS,PARTS,SKILLS,CHARACTERS,CLASSES,...Object.values(PARTS).map(part=>part.values)])Object.setPrototypeOf(map,null);
const cache = new Map();
function short(value, max=42) { const chars=Array.from(String(value));return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join(''); }
function pair(meaning,change,example) { return {meaning,change,...(example?{example}:{})}; }
function record(token,label,kind,body) { return {start:token.start,end:token.end,label:short(label),kind,...body}; }
function tokenize(source) {
 const tokens=[],stack=[];let i=0;
 const push=(start,end,type,extra={})=>{if(end>start)tokens.push({start,end,type,...extra});};
 const chunk=(start,end,type,extra={})=>{let pos=start;const re=/&(?:#[xX][\da-fA-F]+|#\d+|[A-Za-z][\w]+);/g,part=source.slice(start,end);let m;
  while((m=re.exec(part))){const at=start+m.index;if(at>pos)push(pos,at,type,extra);push(at,at+m[0].length,'entity',{...extra,entity:m[0]});pos=at+m[0].length;}push(pos,end,type,extra);
 };
 while(i<source.length){
  const parent=stack[stack.length-1];
  if(parent&&RAW.has(parent.tag)){
   const re=new RegExp('</'+parent.tag+'(?=[\\s/>])','ig');re.lastIndex=i;const close=re.exec(source),end=close?close.index:source.length;
   if(end>i){if(parent.tag==='script'||parent.tag==='style')push(i,end,'embedded',{tag:parent.tag,attrs:parent.attrs});else chunk(i,end,'text',{tag:parent.tag,attrs:parent.attrs});i=end;continue;}
  }
  if(source.startsWith('<!--',i)){const close=source.indexOf('-->',i+4),end=close<0?source.length:close+3;push(i,end,'comment',{complete:close>=0});i=end;continue;}
  if(/^<!doctype\b/i.test(source.slice(i,i+11))){let end=i+2,quote='';for(;end<source.length;end++){const c=source[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>'){end++;break;}}push(i,end,'doctype');i=end;continue;}
  const match=/^<(\/?)\s*([A-Za-z][\w:-]*)/.exec(source.slice(i));
  if(match){
   const begin=i,closing=!!match[1],tag=match[2].toLowerCase(),nameStart=i+match[0].lastIndexOf(match[2]);
   const ctx={tag,closing,attrs:Object.create(null)};
   push(begin,begin+1,'punct',{...ctx,symbol:'<'});
   if(closing)push(begin+1,begin+2,'punct',{...ctx,symbol:'/'});
   push(nameStart,nameStart+match[2].length,'tag',ctx);i+=match[0].length;
   let complete=false,selfClosing=false;
   while(i<source.length){
    if(/\s/.test(source[i])){i++;continue;}
    if(source[i]==='>'){push(i,i+1,'punct',{...ctx,symbol:'>'});i++;complete=true;break;}
    if(source[i]==='/'&&source[i+1]==='>'){push(i,i+1,'punct',{...ctx,symbol:'/',selfClosing:true});push(i+1,i+2,'punct',{...ctx,symbol:'>'});i+=2;selfClosing=true;complete=true;break;}
    if(source[i]==='<')break;
    const attrMatch=/^[^\s"'<>/=]+/.exec(source.slice(i));
    if(!attrMatch){push(i,i+1,'unknown',ctx);i++;continue;}
    const attr=attrMatch[0].toLowerCase(),attrStart=i,attrContext={...ctx,attr};i+=attrMatch[0].length;
    push(attrStart,i,'attribute',attrContext);ctx.attrs[attr]='';
    while(/\s/.test(source[i]||'')&&i<source.length)i++;
    if(source[i]!=='=')continue;
    push(i,i+1,'punct',{...attrContext,symbol:'='});i++;
    while(/\s/.test(source[i]||'')&&i<source.length)i++;
    const quote=source[i]==='"'||source[i]==="'"?source[i]:'';
    if(quote){push(i,i+1,'punct',{...attrContext,symbol:quote});i++;}
    const valueStart=i;
    if(quote){while(i<source.length&&source[i]!==quote)i++;}
    else{while(i<source.length&&!/[\s>]/.test(source[i]))i++;}
    const value=source.slice(valueStart,i);ctx.attrs[attr]=value;
    const valueContext={...attrContext,value,valueStart,valueEnd:i};
    if(attr==='class'||attr==='data-skills'||attr==='rel'){
     const words=/\S+/g;let word;while((word=words.exec(value)))push(valueStart+word.index,valueStart+word.index+word[0].length,'value',{...valueContext,word:word[0]});
    }else if(attr==='style')push(valueStart,i,'inline-css',valueContext);
    else if(/^on/.test(attr))push(valueStart,i,'inline-js',valueContext);
    else chunk(valueStart,i,'value',valueContext);
    if(quote&&source[i]===quote){push(i,i+1,'punct',{...attrContext,symbol:quote});i++;}
   }
   if(closing){let k=stack.length-1;while(k>=0&&stack[k].tag!==tag)k--;if(k>=0)stack.length=k;}
   else if(complete&&!VOID.has(tag)&&!(selfClosing&&(tag==='svg'||stack.some(item=>item.tag==='svg'))))stack.push(ctx);
   continue;
  }
  if(source[i]==='<'){push(i,i+1,'unknown',{tag:parent?.tag});i++;continue;}
  const next=source.indexOf('<',i),end=next<0?source.length:next;
  chunk(i,end,'text',{tag:parent?.tag,attrs:parent?.attrs});i=end;
 }
 tokens.sort((a,b)=>a.start-b.start);return tokens;
}
function lex(source) {if(cache.has(source))return cache.get(source);const result=tokenize(source);cache.set(source,result);if(cache.size>4)cache.delete(cache.keys().next().value);return result;}
function attrBody(t){
 const a=t.attr,v=t.attrs[a]||'',tag=t.tag;
 if(a==='href'&&tag==='a')return pair('リンクを押したときの移動先です。','about.htmlなら「もっと見る」のページ、#skillsなら同じページのid="skills"へ移動します。');
 if(a==='href'&&tag==='link')return pair('読み込むファイルの場所です。','この教材ではstyle.cssがCSS欄と結びついています。別の名前にするとCSS欄の見た目が反映されなくなります。');
 if(a==='src'&&tag==='img')return pair('表示する画像の場所です。','アップロードした画像のパスや別の用意された画像に変えると表示する絵が変わります。');
 if(a==='src'&&tag==='script')return pair('読み込むJavaScriptファイルの場所です。','この教材ではcharacter-actions.jsが特技の動きをつけます。別の名前にするとその動きが使えなくなります。');
 if(a==='name'&&tag==='meta')return pair('metaで指定する設定の種類です。','viewportは画面の表示領域の設定です。具体的な値はcontentに書きます。');
 if(a==='content'&&tag==='meta'&&t.attrs.name?.toLowerCase()==='viewport')return pair('ページを表示する幅や最初の拡大率の設定です。','width=device-widthは端末の幅、initial-scale=1は最初の倍率を1倍にします。本文の文字サイズはCSSで変えます。');
 if(a==='type'&&tag==='button')return pair('ボタンの役割です。buttonは通常の操作用ボタンです。','submitはフォーム送信、resetはフォームの入力を戻す役割です。特技の種類はdata-skillで指定します。');
 if(PARTS[a]){const p=PARTS[a];return pair('この教材のJavaScriptが読む'+p.name+'の設定です。HTMLに元からある機能ではありません。','class="character"のimgで使います。用意された5体の画像なら値に合わせてパーツが変わります。',Object.keys(p.values).join(' / '));}
 if(a==='data-skill')return pair('この教材のJavaScriptにボタンの特技を伝えます。','mint-beatなど、用意された特技の識別名を使います。表示名はタグの間の文字で変えます。');
 if(a==='data-character')return pair('この教材で、どのキャラを選んだかを記録する名前です。','この値だけを変えても画像は変わりません。元の絵はimgのsrcで指定します。');
 if(/^data-/.test(a))return pair('制作者が自由につけられるデータ用の属性です。JavaScriptなどから読み取れます。','値を変えて何が起きるかは読み取る処理によります。この名前だけでは動きは決まりません。');
 if(/^on/.test(a))return pair('クリックなどの出来事で実行するJavaScriptを書く属性です。','この教材のプレビューでは取り除かれるため、書き換えても動作には反映されません。');
 if(ATTRS[a])return pair(...ATTRS[a]);
 if(/^aria-/.test(a))return pair('読み上げなどの支援機能へ情報を伝える属性です。','名前ごとに決まった値の書き方があります。これだけで画面の見た目や動きが変わるとは限りません。');
 if(['x','y','cx','cy','r','rx','ry'].includes(a)&&['rect','circle','ellipse','text','svg'].includes(tag))return pair('SVGの位置や大きさを表す数値です。','x・yやcx・cyは位置、rは半径、rx・ryは横・縦方向の半径などを変えます。');
 return pair('このタグにつけられた属性名です。この説明機能では固有の役割を確認できません。','対応するHTMLの属性やJavaScriptがなければ、書き換えても見た目や動きは変わらないことがあります。');
}
function valueBody(t){
 const a=t.attr,v=t.word??t.value??'',whole=t.value||'',tag=t.tag;
 if(a==='class'){
  const known=CLASSES[v],name=short(v,30);
  return pair('この要素につけたclass名です。CSSでは .'+name+' で選びます。'+(known?'教材では'+known+'につけています。':''),v==='character'?'この名前を外すとキャラ用のCSSやパーツ編集の対象から外れます。別の名前を足すなら空白で区切ります。':'名前を変えると .'+name+' のCSSが当たらなくなります。ほかのclass名を足すなら空白で区切ります。');
 }
 if(a==='id')return pair('この要素のidは「'+short(v,24)+'」です。href="#'+short(v,24)+'"やCSSの #'+short(v,24)+' から指定できます。','idを変えると元の名前のリンクやCSSが合わなくなります。同じページでidを重ねないようにします。');
 if(a==='href'){
  if(tag==='link')return attrBody(t);
  if(/^#/.test(v))return pair('同じページのid="'+short(v.slice(1),28)+'"を探して移動するリンクです。','移動したい場所のidと#の後ろの名前をそろえます。該当するidがないと移動できません。');
  const page=v.replace(/^\.\//,'').split(/[?#]/)[0];
  if(page==='about.html')return pair('「もっと見る」のページを開くリンク先です。','index.htmlにするとプロフィールへ、#skillsにすると今のページの特技の場所へ移動します。');
  if(page==='index.html')return pair('キャラのプロフィールを開くリンク先です。','about.htmlにすると「もっと見る」のページへ移動します。リンクに見える文字は別に変更できます。');
  if(/^(https?:)?\/\//i.test(v))return pair('WebサイトのURLです。この教材では外部サイトを別のタブに開きます。','別のURLに変えると開くサイトが変わります。リンクの表示名はタグの間の文字で変えます。');
  return pair('リンクの移動先として書かれた場所です。','この教材で用意されたページはindex.htmlとabout.htmlです。別のファイル名を書くだけでは新しいページは作られません。');
 }
 if(a==='src'&&tag==='img'){
  const name=/assets\/(mint|ember|cloud|nova|aqua)\.svg(?:[?#].*)?$/.exec(v);
  if(name)return pair('assetsフォルダにある'+CHARACTERS[name[1]]+'の画像です。svgは点や線で絵を表す画像形式です。','別の用意されたキャラのファイル名にすると画像が変わります。パーツの変更はdata-headなどでも指定できます。','assets/nova.svg');
  if(/^uploads\//.test(v))return pair('この教材にアップロードした画像の場所です。','別のアップロード画像のパスにすると画像が変わります。この画像には5体のキャラ用のパーツ編集は使えません。');
  if(/^data:image\//i.test(v))return pair('画像データを文字列にして直接埋め込んでいます。ファイル名ではありません。','画像を差し替えるときはアップロード機能で新しい画像のパスを使えます。途中だけを変えると画像が読めなくなることがあります。');
  return attrBody(t);
 }
 if(a==='alt')return pair('画像の代わりに伝える説明文です。読み上げなどで使われます。','絵に合う説明に書き換えます。ここを変えても絵は変わりません。ポインターを置いたときの吹き出しを指定するものでもありません。');
 if(a==='src'&&tag==='script')return attrBody(t);
 if(a==='rel'&&tag==='link'&&v==='stylesheet')return pair('このlinkはCSSを読み込むという指定です。','この指定を外すとCSS欄とページのつながりがなくなります。');
 if(a==='lang')return pair(v==='ja'?'jaは日本語を表す言語コードです。':v==='en'?'enは英語を表す言語コードです。':'文章の言語を表すコードです。','文章の言語に合わせます。変えても文章が自動で翻訳されるわけではありません。');
 if(a==='charset')return pair(v.toLowerCase()==='utf-8'?'utf-8は日本語や記号などを読み取るための文字コードです。':'「'+short(v,24)+'」という文字コードを指定しています。文書の実際の文字コードに合わせる必要があります。','このページはUTF-8で扱っています。通常はutf-8を指定します。');
 if(a==='type'&&tag==='button'&&v==='button')return pair('フォームを送信しない通常のボタンという指定です。','特技を変えるにはdata-skillを書き換えます。ここに特技の識別名を書いても動きの指定にはなりません。');
 if(a==='data-skill'){
  const skill=root.PixelSkillCatalog?.skills[v]?.name||SKILLS[v];
  if(skill)return pair(v+'は「'+skill+'」を呼び出す名前です。教材のJavaScriptが読み取ります。','別の用意された特技名にするとボタンの動きが変わります。ボタンの文字も別に合わせるとわかりやすくなります。');
  return pair('特技を指定するために書かれた値です。この名前の特技は教材に用意されていません。','画像の下の候補から選ぶと、この値も変わります。新しい名前を書くだけでは新しい動きは増えません。');
 }
 if(a==='data-character')return pair((CHARACTERS[v]?v+'は「'+CHARACTERS[v]+'」の識別名です。':'キャラの識別名として書かれた値です。')+'画像を入れ替えた後も、選んだキャラと使える特技を記録するために使います。','この値だけではキャラの画像は切り替わりません。画像の場所はsrcに書きます。');
 if(PARTS[a]){const p=PARTS[a],name=p.values[v];return pair(name?p.name+'に「'+name+'」を使う指定です。教材のJavaScriptが絵を描き直します。':p.name+'の指定です。この値は用意された選択肢に含まれていません。','使える値は'+Object.keys(p.values).join('・')+'です。用意された5体のキャラに反映されます。');}
 if(['hidden','disabled','readonly','checked','selected','open'].includes(a))return attrBody(t);
 if(a==='name'&&tag==='meta'&&v==='viewport')return pair('画面にどう収めるかを設定するmetaです。','具体的な幅や倍率はcontentに書きます。文字の内容や色は変わりません。');
 if(a==='content')return attrBody(t);
 if(a==='width'||a==='height')return pair(a==='width'?'幅を表す値です。HTMLの画像の幅は単位をつけずに数で書きます。':'高さを表す値です。HTMLの画像の高さは単位をつけずに数で書きます。','数を大きくすると大きさが増えます。ただしCSS側の指定で表示サイズが決まる場合もあります。');
 const body=attrBody(t);return pair('「'+short(whole,30)+'」は'+short(a,30)+'に設定する値です。 '+body.meaning,body.change);
}
function delegate(t,source,index){
 const css=t.type==='inline-css'||t.tag==='style',provider=css?api.css:api.js;
 const raw=source.slice(t.start,t.end),prefix=css&&t.type==='inline-css'?'.inline { ':'',suffix=prefix?' }':'';
 if(typeof provider==='function'){
  try{const result=provider(prefix+raw+suffix,index-t.start+prefix.length);if(result){const start=Math.max(t.start,t.start+result.start-prefix.length),end=Math.min(t.end,t.start+result.end-prefix.length);if(start<=index&&end>index)return {...result,start,end,change:!css?'この教材ではHTML内に書いたJavaScriptは実行されません。'+(result.change||''):result.change};}}catch(_){/* The rest of the HTML remains explainable while code is incomplete. */}
 }
 return record(t,css?'HTML内のCSS':'HTML内のJavaScript',css?'CSS':'JavaScript',css?pair('この部分は見た目を指定するCSSです。','プロパティと値を変えると指定した部分の見た目が変わります。'):pair('HTMLの中に書かれたJavaScriptです。','この教材ではHTML内に追加したJavaScriptは実行されません。動きのコードはJavaScriptのタブで見られます。'));
}
function explain(t,source,index){
 if(t.type==='embedded'&&t.tag==='script'&&t.attrs.type&&!/^(?:module|(?:text|application)\/(?:java|ecma)script)(?:\s*;|$)/i.test(t.attrs.type.trim()))return record(t,'script内のデータ','埋め込みデータ',pair('このscriptにはtype="'+short(t.attrs.type,28)+'"が指定されています。通常のJavaScriptとは別の種類のデータです。','対応する処理が読み取って使う内容です。この教材のプレビューではこのscriptは取り除かれます。'));
 if(t.type==='inline-css'||t.type==='inline-js'||t.type==='embedded')return delegate(t,source,index);
 if(t.type==='tag'){
  const body=TAGS[t.tag];
  if(t.closing)return record(t,'</'+t.tag+'>','終了タグ',pair(short(t.tag,30)+'で囲む範囲はここまでです。/が終了タグの目印です。','開始タグと名前をそろえます。閉じる位置を変えるとその要素に含まれる内容が変わります。'));
  return record(t,'<'+t.tag+'>','HTMLタグ',body?pair(...body):pair('「'+short(t.tag,30)+'」というタグ名です。この説明機能では固有の役割を確認できません。','独自のタグは対応するCSSやJavaScriptで役割が決まることがあります。名前を変えたら終了タグもそろえます。'));
 }
 if(t.type==='attribute')return record(t,t.attr,'HTMLの属性',attrBody(t));
 if(t.type==='value')return record(t,t.word??t.value??source.slice(t.start,t.end),t.attr==='class'?'class名':t.attr==='id'?'id名':'属性の値',valueBody(t));
 if(t.type==='comment')return record(t,'<!-- コメント -->','コメント',pair('制作者向けのメモです。コメントの内容はページには表示されません。',t.complete?'中の文章を変えてもページの表示は変わりません。<!-- と --> がコメントの範囲です。':'まだ --> がありません。コメントを閉じるまで後ろの内容も表示されないことがあります。'));
 if(t.type==='doctype')return record(t,'<!doctype html>','HTMLの宣言',pair('この文書を現在のHTMLのルールで表示するための宣言です。','ふつうは最初の行にこのまま置きます。消すとブラウザの表示のルールが変わることがあります。'));
 if(t.type==='entity'){
  const known={'&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':'改行されにくい空白','&copy;':'©','&hearts;':'♥'};let decoded=known[t.entity];
  if(!decoded&&/^&#/.test(t.entity)){const number=/^&#x/i.test(t.entity)?parseInt(t.entity.slice(3,-1),16):parseInt(t.entity.slice(2,-1),10);if(number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff))decoded=String.fromCodePoint(number);}
  return record(t,t.entity,'文字参照',pair(decoded?'「'+decoded+'」をHTMLの文字として書く表し方です。':'記号などをHTMLの文字として書く表し方です。正しい名前なら対応する文字になります。','たとえば &lt; は < の表示に使います。タグとして解釈させずに記号を文章に入れられます。'));
 }
 if(t.type==='punct'){
  if(t.symbol==='=')return record(t,'=','属性の区切り',pair('左の属性名と右の値を結びつけます。','たとえばsrc="画像の場所"という形で書きます。値を変えるとその属性の設定が変わります。'));
  if(t.symbol==='"'||t.symbol==="'")return record(t,t.symbol,'値を囲む引用符',pair('属性の値がどこからどこまでかを示します。空白を含む値もひとまとまりになります。','同じ種類の引用符で両側を囲みます。片方を消すと後ろのコードまで値に含まれることがあります。'));
  if(t.symbol==='/')return record(t,'/','タグの記号',t.selfClosing?pair('タグの末尾にある/です。HTMLのimgやbrにはもともと終了タグがありません。','通常のHTMLではdivなどを /> だけで閉じることはできません。必要な終了タグを書きます。'):pair('終了タグであることを示す/です。','たとえば </p> は段落の終わりです。開始タグにはこの/をつけません。'));
  return record(t,t.symbol,'タグの記号',pair(t.symbol==='<'?'タグの始まりを示します。この後ろにタグ名を書きます。':'タグの指定がここで終わることを示します。','<p>文章</p> のように使います。記号を消すとタグとして読み取れなくなることがあります。'));
 }
 if(t.type==='text'){
  if(t.tag==='title')return record(t,short(source.slice(t.start,t.end).trim()),'ページのタイトル',pair('titleタグの中の文字です。通常はブラウザのタブなどの名前に使われます。','本文の見出しは変わりません。この教材を囲む外側のブラウザのタブ名も変わりません。'));
  if(t.tag==='textarea')return record(t,short(source.slice(t.start,t.end).trim()),'入力欄の最初の内容',pair('textareaに最初から入る文字です。','書き換えると入力欄の最初の内容が変わります。ここに書いたタグの形もふつうは文字として扱われます。'));
  const isButton=t.tag==='button',isLink=t.tag==='a',isName=t.tag==='h1';
  return record(t,short(source.slice(t.start,t.end).trim()),isButton?'ボタンに表示する文字':isLink?'リンクに表示する文字':isName?'見出しに表示する文字':'表示する文字',pair(isButton?'ボタンの上に表示する文字です。':isLink?'リンクとして画面に表示する文字です。':isName?'h1の見出しとして表示する文字です。':'タグの間にある文章や記号です。画面に表示する内容を書きます。',isButton?'文字を変えるとボタンの表示名が変わります。特技の動きはdata-skillで指定します。':isLink?'表示名を変えても移動先は変わりません。移動先はhrefで指定します。':'この文字を書き換えると表示する内容が変わります。色や大きさはCSSで指定します。'));
 }
 return record(t,source.slice(t.start,t.end),'編集中のHTML',pair('HTMLの一部分です。今の書き方だけでは役割を確定できません。','タグは <名前>、属性は 名前="値" の形になっているか前後を見てみよう。'));
}
api.html=function(source,index){
 source=String(source??'');if(!Number.isInteger(index)||index<0||index>=source.length||/\s/.test(source[index]))return null;
 const tokens=lex(source);let lo=0,hi=tokens.length-1;
 while(lo<=hi){const mid=(lo+hi)>>1,t=tokens[mid];if(index<t.start)hi=mid-1;else if(index>=t.end)lo=mid+1;else return explain(t,source,index);}
 return record({start:index,end:index+1},source[index],'編集中のHTML',pair('HTMLの一部分です。前後の書き方で役割が決まります。','近くのタグや属性を確認すると使い方がわかります。'));
};
})(typeof window!=='undefined'?window:globalThis);
