(function(root){
'use strict';

const catalog=root.PixelSkillCatalog||(typeof module!=='undefined'&&module.exports?require('./skill-catalog.js'):null);
if(!catalog)throw new Error('特技のデータを読み込めませんでした。ページを開き直してください。');
const SKILLS=catalog.skills;
const skillAllowed=(character,skill)=>catalog.allowed(character,skill);

const INITIAL_HTML=`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ミントのプロフィール</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="page">
    <div class="card">
      <div class="character-area">
        <img class="character" data-character="mint" src="assets/mint.svg" alt="ヘッドホンをつけたミント色のキャラクター">
      </div>
      <div class="profile">
        <p class="category">のんびり冒険家</p>
        <h1>ミント</h1>
        <p class="bio">音楽と夜の散歩が好き。音に合わせてステップを踏む。</p>
        <div class="profile-links">
          <a class="profile-link" href="about.html">もっと見る →</a>
          <a class="skills-link" href="#skills">特技へ ↓</a>
        </div>
      </div>
    </div>

    <section id="skills" class="skills-section">
      <h2>特技</h2>
      <ul class="skills">
        <li><button type="button" data-skill="mint-beat">ビート ♪</button></li>
        <li><button type="button" data-skill="mint-wave">音のウェーブ ◎</button></li>
        <li><button type="button" data-skill="mint-dash">リズムダッシュ →</button></li>
      </ul>
    </section>
  </main>
  <!-- 動きは教材側のJavaScriptで用意しています -->
  <script src="character-actions.js"></script>
</body>
</html>`;
const ABOUT_HTML=`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ミントの好きなもの</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="page about-page">
    <header class="page-header">
      <a class="back-link" href="index.html">← プロフィールへ</a>
    </header>
    <div class="card about-card">
      <div class="character-area">
        <img class="character" data-character="mint" src="assets/mint.svg" alt="ヘッドホンをつけたミント色のキャラクター">
      </div>
      <div class="profile">
        <p class="category">のんびり冒険家</p>
        <h1 class="about-heading">ミントの好きなもの</h1>
        <p class="about-intro">お気に入りの曲を聴きながら、まだ歩いたことのない道を探しています。</p>
        <ul class="favorites">
          <li>音楽を聴くこと</li>
          <li>夜の散歩</li>
          <li>知らない道を歩くこと</li>
        </ul>
      </div>
    </div>
  </main>
</body>
</html>`;
const INTERACTION_CSS=`
/* リンクと特技のボタン */
.profile-links { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin-top: 10px; }
.skills-link { color: inherit; font-size: 16px; text-underline-offset: 3px; }
.skills li:has(button) { padding: 0; }
.skills button {
  display: block;
  width: 100%;
  min-height: 42px;
  padding: 8px;
  color: inherit;
  background: transparent;
  border: 0;
  font: inherit;
  font-weight: bold;
  white-space: normal;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.skills button:hover { background: #d7ecff; }
.skills button:active { transform: translateY(2px); }
a:focus-visible, button:focus-visible { outline: 3px solid #1760bb; outline-offset: 3px; }
.back-link { color: inherit; font-size: 16px; text-underline-offset: 4px; }

/* リンク先のページ */
.about-page .page-header { margin-bottom: 12px; }
.about-heading { margin: 6px 0 10px; font-size: 28px; letter-spacing: 0; }
.about-intro { margin: 0; font-size: 16px; line-height: 1.6; }
.favorites { margin: 14px 0 0; padding-left: 22px; font-size: 16px; }
.favorites li { margin-top: 6px; }
`;
const BASE_CSS=`/* ページ全体 */
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #18364b;
  background: #edf6fc;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
}
.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 12px;
}

/* キャラの紹介カード */
.card {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  gap: 16px;
  padding: 14px;
  background: #ffffff;
  border: 2px solid #18364b;
  box-shadow: 7px 7px 0 #bdd5e7;
}
.character-area {
  display: grid;
  place-items: center;
  min-width: 0;
  padding: 8px 0;
  background-image: linear-gradient(#7ca4c628 1px, transparent 1px), linear-gradient(90deg, #7ca4c628 1px, transparent 1px);
  background-size: 18px 18px;
}

/* キャラの見た目。数字を変えてみよう */
.character {
  width: 220px;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
  filter: hue-rotate(0deg);
  transform: scaleX(1);
}
.character-area .character { max-width: min(100%, 45vh); }
.profile { min-width: 0; }
.category { margin: 0; font-size: 16px; }
h1 {
  margin: 4px 0 8px;
  font-size: 36px;
  line-height: 1.2;
  letter-spacing: 0;
}
.bio { margin: 0; font-size: 16px; line-height: 1.6; }
.profile-link {
  display: inline-block;
  padding: 8px 12px;
  color: #18364b;
  background: #cde8ff;
  border: 1px solid #18364b;
  text-decoration: none;
  font-size: 16px;
  font-weight: bold;
}

/* 特技のリスト */
.skills-section { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
h2 { flex-shrink: 0; margin: 0; font-size: 20px; }
.skills {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.skills li {
  padding: 8px;
  background: #ffffff;
  border: 1px solid #819eb5;
  font-size: 16px;
}

/* 小さい画面でも文字は小さくしない */
@media (max-width: 420px) {
  .page { padding: 8px; }
  .card { gap: 10px; padding: 10px; }
  h1 { font-size: 30px; }
  .profile-links { gap: 6px; }
  .profile-link { padding: 7px 8px; }
  .skills-section { display: block; }
  h2 { margin-bottom: 6px; }
  .skills { gap: 5px; }
  .skills button { padding: 8px 3px; }
}
`;
const COMMON_CSS=BASE_CSS+INTERACTION_CSS;
const THEMES={field:{name:'図鑑',extra:''},neon:{name:'ネオン',extra:`
/* ネオンのテーマ */
body { color: #eff1ff; background: #17152c; }
.page-header { color: #b9a5ff; }
.card { background: #24213b; border-color: #9780f5; box-shadow: 7px 7px 0 #6953e8; }
.character-area { order: 2; background-color: #1d2036; background-image: linear-gradient(#997bff20 1px, transparent 1px), linear-gradient(90deg, #997bff20 1px, transparent 1px); }
.profile { order: 1; }
.badge { color: #1a1630; background: #d2bbff; }
h1 { color: #d8f888; }
.category { color: #b9a5ff; }
.profile-link { color: #1d2332; background: #d8f888; border-color: #d8f888; }
.skills li { background: #24213b; border-color: #8471c1; }
.skills button:hover { background: #41365f; color: #ffffff; }
`},poster:{name:'ポスター',extra:`
/* ポスターのテーマ */
body { color: #262327; background: #f0b39e; }
.page { padding: 14px; }
.card { position: relative; background: #fff4ce; border-color: #262327; box-shadow: 9px 9px 0 #262327; }
.character-area { background-color: #ff895d; background-image: none; transform: rotate(-4deg); border: 2px solid #262327; }
.badge { color: #fff4ce; background: #262327; }
h1 { font-size: 38px; letter-spacing: -1px; }
.category { font-weight: bold; }
.profile-link { color: #fff4ce; background: #262327; border-color: #262327; }
.skills li { background: #fff4ce; border: 2px solid #262327; box-shadow: 3px 3px 0 #262327; }
`}};
const CHARACTERS={
 mint:{name:'ミント',alt:'ヘッドホンをつけたミント色のキャラクター',category:'のんびり冒険家',bio:'音楽と夜の散歩が好き。音に合わせてステップを踏む。',skills:catalog.characters.mint,legacySkills:catalog.legacy.mint,about:"お気に入りの曲を聴きながら、まだ歩いたことのない道を探しています。",favorites:["音楽を聴くこと", "夜の散歩", "知らない道を歩くこと"]},
 ember:{name:'ヒバナ',alt:'紫のマントをつけた炎のキャラクター',category:'小さな火の使い手',bio:'じっとしているのが苦手。火花を散らして走り出す。',skills:catalog.characters.ember,legacySkills:catalog.legacy.ember,about:"外で遊ぶことが大好き。花火を見ると、つい一緒に跳ねたくなります。",favorites:["鬼ごっこ", "花火", "思いきり走ること"]},
 cloud:{name:'シロ',alt:'四角い耳としっぽの白い猫型ロボット',category:'気まぐれな猫ロボ',bio:'気になるものは何でも調べる。箱の中で休むのが好き。',skills:catalog.characters.cloud,legacySkills:catalog.legacy.cloud,about:"新しい道具を見つけると、まず近くで観察します。休むときは箱の中。",favorites:["日なた", "新しい道具", "箱の中で休むこと"]},
 nova:{name:'ノヴァ',alt:'星のアンテナがついた黄色いロボット',category:'星を探すロボット',bio:'夜空を見上げるのが好き。小さな星を集めている。',skills:catalog.characters.nova,legacySkills:catalog.legacy.nova,about:"星座を見つけるのが得意。空がよく見える場所を探しています。",favorites:["星座", "高い場所", "きらきらしたもの"]},
 aqua:{name:'アクア',alt:'青いひれと白いおなかを持つ水のキャラクター',category:'水辺の探検家',bio:'知らない景色を探している。泡や波を作るのが得意。',skills:catalog.characters.aqua,legacySkills:catalog.legacy.aqua,about:"水辺に着くと、魚や虫を探します。次に見たいのは、まだ知らない景色。",favorites:["水遊び", "水辺の生き物", "まだ知らない景色"]}
};
const TOURS=[
{tag:'h1',title:'ページの主な見出し',description:'ここではキャラクターの名前に使っています。タグの間の文字を変えると名前が変わります。',note:'文字の大きさや色はCSSで指定できます。',selector:'h1',needle:'<h1>ミント</h1>',code:'<h1>ミント</h1>',button:'名前を変える',demo:s=>{s.html=s.html.replace('<h1>ミント</h1>','<h1>ソラ</h1>');},after:'<h1>ソラ</h1>'},
{tag:'p',title:'文章の段落',description:'文章のひとまとまりを表します。段落を分けたいときはpを分けます。',note:'途中で折り返していても同じpの中なら1つの段落です。',selector:'.bio',needle:'<p class="bio">',code:'<p>文章のひとまとまり</p>',button:'段落を分ける',demo:s=>{s.html=s.html.replace('<p class="bio">音楽と夜の散歩が好き。音に合わせてステップを踏む。</p>','<p class="bio">音楽と夜の散歩が好き。</p>\n        <p class="bio">音に合わせてステップを踏む。</p>');},after:'<p>音楽と夜の散歩が好き。</p>\n<p>音に合わせてステップを踏む。</p>'},
{tag:'img',title:'画像を入れる',description:'srcで画像の場所を指定します。別のファイルに変えると画像も変わります。',note:'altは画像の代わりになる説明です。imgに終了タグはありません。',selector:'.character',needle:'<img class="character"',code:'src="assets/mint.svg"',button:'画像を変える',demo:s=>{s.html=s.html.replace('assets/mint.svg','assets/ember.svg').replace(CHARACTERS.mint.alt,CHARACTERS.ember.alt);},after:'src="assets/ember.svg"'},
{tag:'a',title:'別のページへのリンク',description:'hrefで移動先を指定します。このリンクを押すと、好きなものを紹介するページに移ります。',note:'about.htmlは別のHTMLファイルです。#skillsなら同じページの特技へ移動します。',selector:'.profile-link',needle:'<a class="profile-link"',code:'<a href="about.html">もっと見る →</a>',button:'リンクを試す',demo:s=>{s.activePage='about.html';},after:'移動先：about.html',afterSelector:'.about-heading'},
{tag:'ul / li',title:'箇条書きのリスト',description:'ulでリスト全体を囲みます。liが1つ分の項目です。',note:'項目の印や並べ方はCSSで変えられます。',selector:'.skills',needle:'<ul class="skills">',code:'<ul>\n  <li>ビート</li>\n</ul>',button:'特技を増やす',demo:s=>{s.html=s.html.replace('      </ul>','        <li>星を見つける</li>\n      </ul>');},after:'<li>星を見つける</li>'},
{tag:'div',title:'いくつかの要素をまとめる',description:'ここでは名前や画像を1枚のカードにまとめています。枠の範囲を見てみよう。',note:'色をつけているのはCSSです。divだけで色や枠がつくわけではありません。',selector:'.card',needle:'<div class="card">',code:'.card { background: #ffffff; }',button:'カードの色を変える',demo:s=>{s.css+='\n/* カード全体の色を変える */\n.card { background: #ffe2a8; }\n';},after:'.card { background: #ffe2a8; }',cssNeedle:'.card { background: #ffe2a8; }'},
{tag:'class / CSS',title:'どの部分を変えるか指定する',description:'.characterはclass="character"の要素を選びます。widthは幅を指定します。',note:'classは要素につける名前です。CSSでは先頭に.をつけて選びます。',selector:'.character',needle:'class="character"',code:'.character { width: 220px; }',button:'画像を小さくする',demo:s=>{s.css=s.css.replace('width: 220px','width: 120px');},after:'.character { width: 120px; }',cssNeedle:'.character {'}
];
function themeCSS(key){return COMMON_CSS+THEMES[key].extra;}
function initial(id='mint',selectedSkills){
 const key=Object.hasOwn(CHARACTERS,id)?id:'mint',character=CHARACTERS[key],mint=CHARACTERS.mint;
 const chosen=Array.isArray(selectedSkills)?[...new Set(selectedSkills)]:[];
 const skills=chosen.length>=1&&chosen.length<=3&&chosen.every(skill=>typeof skill==='string'&&skillAllowed(key,skill))?chosen:character.skills.slice(0,3);
 const adapt=source=>source.replaceAll('assets/mint.svg','assets/'+key+'.svg').replaceAll('data-character="mint"','data-character="'+key+'"').replaceAll(mint.alt,character.alt).replaceAll(mint.category,character.category).replaceAll(mint.bio,character.bio).replaceAll(mint.name,character.name);
 const items=skills.map(skill=>'        <li><button type="button" data-skill="'+skill+'">'+SKILLS[skill].name+' '+SKILLS[skill].mark+'</button></li>').join('\n');
 const html=adapt(INITIAL_HTML).replace(/(<ul class="skills">)\n[\s\S]*?(\n      <\/ul>)/,(_,open,close)=>open+'\n'+items+close);
 const aboutHtml=adapt(ABOUT_HTML).replace(mint.about,character.about).replace(/(<ul class="favorites">)\n[\s\S]*?(\n        <\/ul>)/,(_,open,close)=>open+'\n'+character.favorites.map(item=>'          <li>'+item+'</li>').join('\n')+close);
 return{version:3,edition:'student',html,aboutHtml,css:themeCSS('field'),theme:'field',cssEnabled:true,reflection:'',assets:[],activePage:'index.html'};
}
function clone(s){return{...s,assets:(s.assets||[]).map(a=>({...a}))};}
function pageSource(s,page=s.activePage){return page==='about.html'?s.aboutHtml:s.html;}
function setPageSource(s,source,page=s.activePage){if(page==='about.html')s.aboutHtml=source;else s.html=source;return s;}
function normalize(s){
 const fail=()=>{throw new Error('この教材で保存した編集データを選んでください。');};
 if(!s||s.version!==3||s.edition!=='student'||typeof s.html!=='string'||typeof s.css!=='string'||s.html.length>150000||s.css.length>100000||typeof s.reflection!=='string'||s.reflection.length>1500||!Object.hasOwn(THEMES,s.theme))fail();
 if(typeof s.aboutHtml!=='string'||s.aboutHtml.length>150000||!['index.html','about.html'].includes(s.activePage)||!Array.isArray(s.assets)||s.assets.length>8)fail();
 const paths=new Set(),ids=new Set();let total=0;
 const assets=s.assets.map(a=>{
  if(!a||typeof a.id!=='string'||!(/^[A-Za-z0-9_-]{1,80}$/).test(a.id)||ids.has(a.id)||typeof a.path!=='string'||!(/^uploads\/[A-Za-z0-9_-]+\.(webp|png|jpg|jpeg)$/).test(a.path)||paths.has(a.path)||typeof a.name!=='string'||a.name.length>160||typeof a.alt!=='string'||a.alt.length>300||typeof a.dataURL!=='string'||a.dataURL.length>700000||!(/^data:image\/(png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(a.dataURL)||a.dataURL.endsWith(',')||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>8192||a.height>8192)fail();
  total+=a.dataURL.length;if(total>2000000)fail();paths.add(a.path);ids.add(a.id);
  return{id:a.id,path:a.path,name:a.name,alt:a.alt,dataURL:a.dataURL,width:a.width,height:a.height};
 });
 return{version:3,edition:'student',html:s.html,aboutHtml:s.aboutHtml,css:s.css,theme:s.theme,cssEnabled:s.cssEnabled!==false,reflection:s.reflection,assets,activePage:s.activePage};
}
function tourState(index,demo=false){const s=initial();if(demo)TOURS[index].demo(s);return s;}
function embedAssets(html,art,assets=[]){
 const map=new Map(Object.entries(art||{}).map(([key,value])=>['assets/'+key+'.svg',value]));
 for(const a of assets)map.set(a.path,a.dataURL);
 // Only replace complete paths, including quoted HTML attributes and CSS url().
 return html.replace(/(?<=["'\s(=])(?:assets\/(?:mint|ember|cloud|nova|aqua)\.svg|uploads\/[A-Za-z0-9_-]+\.(?:webp|png|jpg|jpeg))(?=["'\s)>]|$)/g,path=>map.get(path)||path);
}
function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function highlight(source,kind){
 if(root.PixelSyntax)return root.PixelSyntax.highlight(source,kind);
 const re=kind==='html'?/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>/g:/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[\da-fA-F]{3,8}\b|\b[\d.]+(?:px|rem|em|%|deg|s)?\b|[\w-]+(?=\s*:)/g;
 let out='',end=0;for(const m of source.matchAll(re)){out+=escapeHTML(source.slice(end,m.index));const token=m[0];let type=kind==='html'?(token.startsWith('<!--')?'comment':'tag'):(token.startsWith('/*')?'comment':/^['"]/.test(token)?'string':/^[#\d]/.test(token)?'number':'prop');out+='<span class="tok-'+type+'">'+escapeHTML(token)+'</span>';end=m.index+token.length;}return out+escapeHTML(source.slice(end))+'\n';
}
function cssWarning(text){let clean=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');let b=0;for(const x of clean){if(x==='{')b++;if(x==='}')b--;}return b?'CSSの { と } の数が合っていません。途中まで表示されることがあります。':'';}
function sourceRange(html,info){
 if(!info||typeof info.tag!=='string')return null;
 // Keep character offsets while ignoring tags written inside comments or raw text.
 const masked=html.replace(/<!--[\s\S]*?-->/g,m=>' '.repeat(m.length)).replace(/(<(script|style|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,(m,open,tag,content,close)=>open+' '.repeat(content.length)+close);
 const tags=[...masked.matchAll(/<([a-z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)];
 const matches=tags.filter(m=>m[1].toLowerCase()===info.tag.toLowerCase());
 let best=Number.isInteger(info.ordinal)&&info.ordinal>=0?matches[info.ordinal]:null;
 if(!best)best=matches.find(m=>info.id&&new RegExp('\\bid=["\']'+info.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\']').test(m[0]));
 if(!best&&info.className){const c=info.className.split(/\s+/).filter(x=>!x.startsWith('__'));const sameClass=matches.filter(m=>{const a=m[0].match(/\bclass=["']([^"']*)["']/);return a&&c.some(x=>a[1].split(/\s+/).includes(x));});best=sameClass.find(m=>info.text&&html.slice(m.index+m[0].length,m.index+m[0].length+100).trimStart().startsWith(info.text.slice(0,40)))||sameClass[0];}
 if(!best&&info.text)best=matches.find(m=>html.slice(m.index+m[0].length,m.index+m[0].length+100).trimStart().startsWith(info.text.slice(0,40)));
 best=best||matches[0];return best?{start:best.index,end:best.index+best[0].length}:null;
}
const api={INITIAL_HTML,ABOUT_HTML,COMMON_CSS,INTERACTION_CSS,THEMES,CHARACTERS,SKILLS,skillAllowed,TOURS,themeCSS,initial,clone,normalize,pageSource,setPageSource,tourState,embedAssets,escapeHTML,highlight,cssWarning,sourceRange};root.PixelCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
