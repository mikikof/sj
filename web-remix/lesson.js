/* The classroom scenes change the view, never the student's work. */
(function(){
'use strict';
const $=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)];
const scenes={
 touch:{view:'page',prompt:'',note:''},
 words:{view:'html',prompt:'文字を書き換えて右の画面を見る',note:'ボタンを押すと書き換える文字を選びます。入力するまで作品は変わりません。',action:'name',second:'bio'},
 look:{view:'css',prompt:'数字を書き換えて見た目を比べる',note:'ボタンを押すと書き換える数字を選びます。入力するまで作品は変わりません。',action:'color',second:'size',third:'flip'},
 media:{view:'html',prompt:'画像やリンクのしくみを見る',note:'画像はsrc、リンク先はhrefに書かれています。',action:'image',second:'link'},
 create:{view:'both',prompt:'作ったページを動かして確かめる',note:'前の場面にも戻れます。編集中の内容はそのまま残ります。',action:'test',second:'save'}
};
const trials={
 inspect:{title:'ページの中身を見る',example:'画面とHTMLを見比べる',cta:'HTMLを開く'},
 name:{title:'名前を書き換える',example:'好きな名前に',cta:'HTMLの場所へ'},
 bio:{title:'紹介文を書き換える',example:'自分のことをひと言',cta:'HTMLの場所へ'},
 color:{title:'色合いを変える',example:'例 0 → 180',cta:'CSSの場所へ'},
 size:{title:'大きさを変える',example:'例 220 → 120',cta:'CSSの場所へ'},
 flip:{title:'向きを変える',example:'例 1 → −1',cta:'CSSの場所へ'},
 image:{title:'画像を入れ替える',example:'自分の画像を使う',cta:'画像を選ぶ'},
 link:{title:'リンクの行き先を見る',example:'hrefのファイル名を確認',cta:'HTMLの場所へ'},
 test:{title:'特技を試す',example:'ボタンを押すとキャラが動く',cta:'プロフィールで試す'},
 save:{title:'作品を保存する',example:'作ったページを残す',cta:'保存方法を選ぶ'}
};
const sceneExtras={
 touch:[['skillButton','特技ボタンのコードへ'],['motion','動きのコードへ']],
 words:[['category','肩書きのコードへ'],['skillHeading','特技の見出しへ']],
 look:[['background','背景色のコードへ'],['cardShadow','カードの影のコードへ']],
 media:[['imageAlt','画像の説明へ'],['skillsLink','特技へのリンク先へ']],
 create:[['columns','横の並び方のコードへ'],['buttonColor','ボタンの色のコードへ']]
};
let hooks=null,current='touch',view='page',lastCodeView='both';
function setView(next,{remember=!document.body.classList.contains('touring')}={}){
 if(!['page','html','css','js','both'].includes(next))return;
 view=next;if(remember&&next!=='page')lastCodeView=next;
 document.body.dataset.codeView=view;
 document.querySelector('.editors')?.classList.remove('max-html','max-css');
 all('button[data-code-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.codeView===view)));
 all('[data-maximize]').forEach(el=>{const single=view===el.dataset.maximize;el.textContent=single?'↙':'⤢';el.setAttribute('aria-label',single?'HTMLとCSSの両方を表示':(el.dataset.maximize==='html'?'HTML':'CSS')+'を広く表示');});
 hooks?.onViewChange?.(view);
}
function toggleCode(){hooks.expandPreview(false);setView(view==='page'?lastCodeView:'page');}
function reveal(kind){if(view!==kind&&!(view==='both'&&kind!=='js'))setView(kind);}
function choose(scene){
 if(!Object.hasOwn(scenes,scene))return;
 hooks.leaveTour();current=scene;const s=scenes[scene];
 document.body.dataset.lessonScene=scene;
 $('lesson-current').hidden=scene==='touch';
 all('[data-scene]').forEach(el=>{
  const selected=el.dataset.scene===scene;el.setAttribute('aria-pressed',String(selected));
  if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
 });
 $('lesson-prompt').textContent=s.prompt;$('lesson-note').textContent=s.note;
 card('lesson-primary',s.action);card('lesson-secondary',s.second);card('lesson-extra',s.third);
 updateExtras();
 setView(s.view);
}
function card(id,name){
 const button=$(id),trial=trials[name];button.hidden=!trial;button.replaceChildren();
 if(!trial){button.removeAttribute('aria-label');delete button.dataset.trial;return;}
 button.dataset.trial=name;
 button.setAttribute('aria-label',`${trial.title}。${trial.example}。${trial.cta}`);
 for(const [className,text]of [['lesson-trial-title',trial.title],['lesson-trial-example',trial.example],['lesson-trial-cta',trial.cta+' →']]){
  const line=document.createElement('span');line.className=className;line.textContent=text;button.append(line);
 }
}
function initGuide(){
 const panel=$('lesson-panel');if(!panel)return;
 panel.setAttribute('aria-label','試してみよう');
 const row=panel.querySelector('.lesson-current');row.id='lesson-current';row.setAttribute('role','group');row.setAttribute('aria-labelledby','lesson-heading');
 row.setAttribute('aria-describedby','lesson-prompt');
 const heading=document.createElement('h2');heading.id='lesson-heading';heading.className='lesson-heading';heading.textContent='試してみよう';
 panel.querySelector('.lesson-copy').prepend(heading);
 $('lesson-note').hidden=true;
 for(const id of ['lesson-primary','lesson-secondary','lesson-extra']){$(id).className='lesson-trial';$(id).type='button';}
 const buttons=all('button[data-scene]');
 buttons.forEach((button,index)=>{
  button.type='button';button.setAttribute('aria-controls','lesson-current');
  const number=button.querySelector('.scene-number'),label=document.createElement('span');label.className='scene-label';
  label.textContent=button.textContent.replace(/^\s*\d+\s*/,'').trim();
  button.replaceChildren();if(number)button.append(number);button.append(label);
  button.addEventListener('keydown',event=>{
   let next=index;
   if(event.key==='ArrowRight')next=(index+1)%buttons.length;
   else if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=buttons.length-1;
   else return;
   event.preventDefault();buttons[next].focus({preventScroll:true});choose(buttons[next].dataset.scene);
  });
 });
}
// Locate the current source, including edits to attribute order, spacing and themes.
function attributes(tag,offset){
 const items=new Map(),name=tag.match(/^<[\w-]+/);if(!name)return items;
 const start=name[0].length,body=tag.slice(start,-1);
 const re=/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
 for(const m of body.matchAll(re)){
  const value=m[2]??m[3]??m[4];if(value===undefined){items.set(m[1].toLowerCase(),{value:''});continue;}
  const equal=m[0].indexOf('='),after=m[0].slice(equal+1),space=after.match(/^\s*/)[0].length;
  const quoted=after[space]==='"'||after[space]==="'",at=offset+start+m.index+equal+1+space+(quoted?1:0);
  items.set(m[1].toLowerCase(),{value,start:at,end:at+value.length});
 }
 return items;
}
function opening(source,tag,predicate=()=>true,from=0,to=source.length){
 const masked=source.replace(/<!--[\s\S]*?-->/g,m=>' '.repeat(m.length)).replace(/(<(script|style|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,(m,a,b,text,z)=>a+' '.repeat(text.length)+z);
 for(const m of masked.matchAll(/<([a-z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){
  if(m.index<from||m.index>=to||m[1].toLowerCase()!==tag)continue;
  const attrs=attributes(source.slice(m.index,m.index+m[0].length),m.index);
  if(predicate(attrs))return {start:m.index,end:m.index+m[0].length,attrs};
 }
 return null;
}
function hasClass(name){return attrs=>(attrs.get('class')?.value||'').split(/\s+/).includes(name);}
function textAfter(source,tag){
 if(!tag)return null;const text=source.slice(tag.end).match(/^(\s*)([^<]*?\S)(\s*)(?=<)/);
 return text?{start:tag.end+text[1].length,end:tag.end+text[1].length+text[2].length}:null;
}
function cssValue(source,selector,property){
 // Only unconditional rules are used here. Narrow-screen @media rules must not
 // take the learner to a value that is inactive in the current desktop layout.
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,m=>' '.repeat(m.length));
 let depth=0,quote='',escape=false,ruleStart=0,bodyStart=0,matched=false,result=null;
 for(let i=0;i<clean.length;i++){
  const ch=clean[i];if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
  if(ch==='"'||ch==="'"){quote=ch;continue;}
  if(ch==='{'){
   if(depth===0){matched=clean.slice(ruleStart,i).trim().split(',').some(s=>s.trim()===selector);bodyStart=i+1;}depth++;
  }else if(ch==='}'){
   depth=Math.max(0,depth-1);if(depth===0){
    if(matched){
     const body=clean.slice(bodyStart,i),safe=property.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
     const re=new RegExp('((?:^|;)\\s*'+safe+'\\s*:\\s*)([^;]*?)(?=;|$)','g');
     for(const m of body.matchAll(re)){const value=m[2].trimEnd();if(value){const start=bodyStart+m.index+m[1].length;result={start,end:start+value.length};}}
    }
    ruleStart=i+1;matched=false;
   }
  }else if(ch===';'&&depth===0)ruleStart=i+1;
 }
 return result;
}
function extraAction(name){
 hooks.leaveTour();let kind='html',range=null;
 if(['background','cardShadow','columns','buttonColor'].includes(name)){
  kind='css';const targets={background:['body','background'],cardShadow:['.card','box-shadow'],columns:['.card','grid-template-columns'],buttonColor:['.profile-link','background']};
  range=cssValue(hooks.getCSS(),...targets[name]);
 }else if(name==='motion'){
  kind='js';const source=$('js-editor')?.value||window.PIXEL_ACTION_LOGIC_SOURCE||window.PIXEL_ACTION_SOURCE||'',m=source.match(/\bfunction\s+trigger\s*\([^)]*\)\s*\{/);
  if(m)range={start:m.index,end:m.index+m[0].length};
 }else{
  hooks.navigate('index.html');const source=hooks.getSource();
  if(name==='skillButton')range=opening(source,'button',attrs=>attrs.has('data-skill'));
  if(name==='category')range=textAfter(source,opening(source,'p',hasClass('category')));
  if(name==='skillHeading'){
   const section=opening(source,'section',attrs=>attrs.get('id')?.value==='skills');
   if(section){const end=source.indexOf('</section',section.end);range=textAfter(source,opening(source,'h2',()=>true,section.end,end<0?source.length:end));}
  }
  if(name==='imageAlt')range=opening(source,'img',hasClass('character'))?.attrs.get('alt');
  if(name==='skillsLink')range=opening(source,'a',hasClass('skills-link'))?.attrs.get('href');
 }
 setView(kind);
 if(!range||!Number.isInteger(range.start)||!hooks.selectCode(kind,range,true))hooks.notify('この部分のコードが見つかりません。書き換えた内容を確認してください。');
 else hooks.showArrival(kind);
}
function updateExtras(){
 const menu=$('lesson-more');if(!menu)return;menu.open=false;
 const list=$('lesson-more-actions');list.replaceChildren();
 for(const [name,label] of sceneExtras[current]){
  const button=document.createElement('button');button.type='button';button.dataset.lessonExtra=name;button.textContent=label;
  button.addEventListener('click',()=>{menu.open=false;extraAction(name);});list.append(button);
 }
}
function initExtras(){
 const host=document.querySelector('.lesson-shortcuts');if(!host)return;
 const menu=document.createElement('details');menu.id='lesson-more';menu.className='lesson-more';
 const summary=document.createElement('summary');summary.textContent='ほかも試す';
 const list=document.createElement('div');list.id='lesson-more-actions';list.className='lesson-more-actions';
 menu.append(summary,list);host.append(menu);
 document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();menu.open=false;summary.focus({preventScroll:true});}});
}
function action(name){
 if(name==='inspect'){hooks.leaveTour();hooks.expandPreview(false);setView('html');return;}
 if(name==='image'){hooks.leaveTour();hooks.openDialog('assets-dialog');return;}
 if(name==='save'){hooks.openDialog('export-dialog');return;}
 if(name==='test'){hooks.leaveTour();hooks.navigate('index.html');setView('page');hooks.testSkill?.();return;}
 const targets={name:['html','<h1','index.html'],bio:['html','<p class="bio"','index.html'],color:['css','hue-rotate('],size:['css','.character {'],flip:['css','scaleX('],link:['html','<a class="profile-link"','index.html']};
 const target=targets[name];if(!target)return;
 const [kind,needle,page]=target;hooks.leaveTour();if(page)hooks.navigate(page);setView(kind);
 let targetNeedle=needle;
 if(name==='name'||name==='bio'){
  const source=hooks.getSource();
  const re=name==='name'?/(<h1\b[^>]*>)([^<]+)(<\/h1\s*>)/i:/(<p\b[^>]*class=["'][^"']*\bbio\b[^"']*["'][^>]*>)([^<]+)(<\/p\s*>)/i;
  const match=source.match(re);if(match)targetNeedle={start:match.index+match[1].length,end:match.index+match[1].length+match[2].length};
 }
 if(['color','size','flip'].includes(name)){
  const css=hooks.getCSS(),block=css.match(/\.character\s*\{[^}]*\}/);
  const patterns={color:/hue-rotate\(\s*(-?\d+(?:\.\d+)?)deg/,size:/\bwidth:\s*(\d+(?:\.\d+)?)px/,flip:/scaleX\(\s*(-?\d+(?:\.\d+)?)/};
  const match=block?.[0].match(patterns[name]);
  if(match){const start=block.index+match.index+match[0].lastIndexOf(match[1]);targetNeedle={start,end:start+match[1].length};}
 }
 if(!hooks.selectCode(kind,targetNeedle,true))hooks.notify('書き換えたコードに合わせて場所を探してください。');else hooks.showArrival(kind);
}
function init(options){
 hooks=options;
 initGuide();
 initExtras();
 all('[data-scene]').forEach(el=>el.addEventListener('click',()=>choose(el.dataset.scene)));
 all('button[data-code-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.codeView)));
 $('lesson-primary').addEventListener('click',()=>action(scenes[current].action));
 $('lesson-secondary').addEventListener('click',()=>action(scenes[current].second));
 $('lesson-extra').addEventListener('click',()=>action(scenes[current].third));
 choose('touch');
}
window.PixelLesson={init,setView,toggleCode,reveal,choose,getView:()=>view,getScene:()=>current};
})();
