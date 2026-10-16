(function(){
'use strict';
const C=window.PixelCore;
const STYLE_LINK=/^\.?\/?style\.css(?:[?#].*)?$/;
function cleanDocument(source,cssEnabled=true){
 const doc=new DOMParser().parseFromString(source,'text/html');let removed=0;const actionsEnabled=[...doc.querySelectorAll('script[src]')].some(el=>/^\.?\/?character-actions\.js$/.test(el.getAttribute('src')||''));
 for(const el of doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],animate,set,animateMotion,animateTransform,foreignObject')){if(!(el.tagName==='SCRIPT'&&/^\.?\/?character-actions\.js$/.test(el.getAttribute('src')||'')))removed++;el.remove();}
 for(const el of doc.querySelectorAll('*'))for(const a of [...el.attributes]){if(/^on/i.test(a.name)||['srcdoc','srcset','nonce','autofocus'].includes(a.name)||((['href','src','action','formaction','xlink:href'].includes(a.name))&&/^(javascript|vbscript):/i.test(a.value.replace(/[\u0000-\u0020\u007f]/g,'')))||(!cssEnabled&&a.name==='style')){el.removeAttribute(a.name);removed++;}}
 return{doc,removed,actionsEnabled,linked:[...doc.querySelectorAll('link[rel~="stylesheet"]')].some(el=>STYLE_LINK.test(el.getAttribute('href')||''))};
}
function stylesInOrder(doc,css){return [...doc.querySelectorAll('style,link[rel~="stylesheet"]')].map(el=>el.tagName==='STYLE'?el.textContent:STYLE_LINK.test(el.getAttribute('href')||'')?css:'').join('\n');}
function renderData(s,page=s.activePage){
 const {doc,removed,linked,actionsEnabled}=cleanDocument(C.pageSource(s,page),s.cssEnabled),authoredCSS=s.cssEnabled?C.embedAssets(stylesInOrder(doc,s.css),window.PIXEL_ART,s.assets):'',fontCSS=s.cssEnabled?(window.PixelFontLibrary?.cssFor(authoredCSS,doc)||''):'',css=fontCSS+(fontCSS?'\n':'')+authoredCSS;
 for(const el of doc.querySelectorAll('style,link'))el.remove();
 const warnings=[];
 if(!linked)warnings.push('style.cssを読み込むlinkタグがありません。CSS欄の内容は表示に使われません。');
 if(removed&&s.cssEnabled)warnings.push('追加した実行用コードは表示していません。');
 const warning=C.cssWarning(s.css);if(warning)warnings.push(warning);
 const info=page==='index.html'?window.PixelSkills?.inspect(s):null;
 const skillLibrary=info?.ok?{characterId:info.characterId,characterName:info.character.name,ids:[...info.ids],skills:info.character.skills.map(id=>({id,name:C.SKILLS[id].name,description:C.SKILLS[id].description,mark:C.SKILLS[id].mark||'✦'}))}:null;
 return{skillLibrary,body:C.embedAssets(doc.body.innerHTML,window.PIXEL_ART,s.assets),css,attrs:[...doc.body.attributes].map(a=>[a.name,a.value]),htmlAttrs:[...doc.documentElement.attributes].map(a=>[a.name,a.value]),title:doc.title,page,actionsEnabled,warnings};
}
// The same links and character actions work in the preview and saved pages.
function runner(options){
 const embedded=!!options.embedded;let current=options.page||'index.html',body=null,css=null,meta=null,sourceInfo=new WeakMap(),hovered=null,touring=false,actionsEnabled=null,locating=false,skillDrag=null,skipSkillClick=false,skillLibrary=null,skillPending=null;
 const tell=d=>{if(embedded)parent.postMessage(d,'*');};
 function sourceElement(el){if(el?.closest?.('[data-pixel-inspector]'))return null;while(el&&el!==document.body){if(sourceInfo.has(el))return el;el=el.parentElement;}return null;}
 function overlay(){let el=document.getElementById('__pixel-hover');if(!el){el=document.createElement('div');el.id='__pixel-hover';el.setAttribute('data-pixel-inspector','');el.setAttribute('aria-hidden','true');el.style.cssText='position:fixed;pointer-events:none;box-sizing:border-box;border:2px dotted #155ea8;box-shadow:0 0 0 1px #fff;z-index:2147483646;display:none;border-radius:3px;';document.body.append(el);}return el;}
 function tooltip(){let el=document.getElementById('__pixel-hover-tip');if(!el){el=document.createElement('div');el.id='__pixel-hover-tip';el.setAttribute('data-pixel-inspector','');el.setAttribute('aria-hidden','true');el.style.cssText='position:fixed;pointer-events:none;box-sizing:border-box;max-width:calc(100vw - 16px);padding:8px 12px;border:1px solid #a9c9ea;border-radius:7px;background:#123b61;color:#fff;box-shadow:0 3px 10px #123b6130;font:600 16px/1.5 system-ui,sans-serif;letter-spacing:normal;text-align:left;white-space:pre-line;overflow-wrap:anywhere;z-index:2147483647;display:none;';document.body.append(el);}return el;}
 function clearHover(){hovered=null;locating=false;drawHover();}
 function drawHover(){
  if(!embedded)return;const box=overlay(),tip=tooltip();
  if(!hovered||!hovered.isConnected||touring){box.style.display='none';tip.style.display='none';return;}
  const r=hovered.getBoundingClientRect(),vw=window.innerWidth||document.documentElement.clientWidth||640,vh=window.innerHeight||document.documentElement.clientHeight||480;
  if(r.top+r.height<=0||r.left+r.width<=0||r.top>=vh||r.left>=vw){box.style.display='none';tip.style.display='none';return;}
  Object.assign(box.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  const tag=sourceInfo.get(hovered)?.tag||'要素';
  const platform=window.navigator?.userAgentData?.platform||window.navigator?.platform||'';
  const shortcut=/Win|Linux|CrOS/i.test(platform)?'Ctrl＋クリックでコードへ':'⌘ Command＋クリックでコードへ';
  const skillHint=hovered.matches?.('[data-pixel-skill-draggable]')?'\nドラッグで特技の順番を変える':'';
  const characterHint=hovered.matches?.('img.character')?'\n'+(/Win|Linux|CrOS/i.test(platform)?'Alt':'⌥ Option')+'＋クリックでキャラを変える':'';
  tip.textContent='<'+tag+'>\n'+(locating?'HTMLを開きます':shortcut+characterHint+skillHint);
  tip.style.display='block';tip.style.left='8px';tip.style.top='8px';
  const size=tip.getBoundingClientRect(),left=Math.max(8,Math.min(r.left,vw-size.width-8)),above=r.top-size.height-8;
  const top=Math.max(8,Math.min(above>=8?above:r.top+r.height+8,vh-size.height-8));
  tip.style.left=left+'px';tip.style.top=top+'px';
 }
 function mark(selector,scroll){document.querySelectorAll('.__pixel-selected').forEach(el=>el.classList.remove('__pixel-selected'));if(!selector)return;let nodes=[];try{nodes=[...document.querySelectorAll(selector)];}catch(e){}nodes.forEach(el=>el.classList.add('__pixel-selected'));if(scroll&&nodes[0])nodes[0].scrollIntoView({block:'nearest'});}
 function skillButtons(){
  if(!embedded||touring||current!=='index.html')return [];
  const lists=[...document.querySelectorAll('ul.skills')];if(lists.length!==1)return [];
  const buttons=[...lists[0].querySelectorAll('button[data-skill]')];
  return buttons.length>=1&&buttons.length<=3&&new Set(buttons.map(el=>el.getAttribute('data-skill'))).size===buttons.length?buttons:[];
 }
 function skillPool(){return skillLibrary?.skills||[];}
 function setSkillPending(id){
  skillPending=skillPool().some(skill=>skill.id===id)?id:null;
  const skill=skillPool().find(item=>item.id===skillPending),help=document.getElementById('__pixel-skill-help'),cancel=document.getElementById('__pixel-skill-cancel');
  if(help)help.textContent=skill?'「'+skill.name+'」を入れる場所を上から選ぶ':'技を選んで、入れ替える場所を押す';
  if(cancel)cancel.hidden=!skillPending;
  document.querySelectorAll('[data-pixel-skill-pick]').forEach(el=>el.setAttribute('aria-pressed',String(el.getAttribute('data-pixel-skill-pick')===skillPending)));
  skillButtons().forEach(el=>el.toggleAttribute('data-pixel-skill-pending',!!skillPending));
 }
 function prepareSkills(){
  if(!embedded)return;
  document.querySelectorAll('[data-pixel-skill-draggable]').forEach(el=>{el.removeAttribute('data-pixel-skill-draggable');el.removeAttribute('data-pixel-skill-index');el.removeAttribute('data-pixel-skill-pending');el.removeAttribute('draggable');});
  const buttons=skillButtons();
  buttons.forEach((el,index)=>{el.setAttribute('draggable','true');el.setAttribute('data-pixel-skill-draggable','');el.setAttribute('data-pixel-skill-index',index);});
  let library=document.getElementById('__pixel-skill-library');
  const ids=buttons.map(el=>el.getAttribute('data-skill'));
  if(!buttons.length||!skillLibrary||skillPool().length!==6||ids.join(' ')!==skillLibrary.ids.join(' ')){
   library?.remove();skillPending=null;return;
  }
  const signature=JSON.stringify(skillLibrary);
  if(!library||library.getAttribute('data-library-signature')!==signature){
   library?.remove();library=document.createElement('section');library.id='__pixel-skill-library';library.setAttribute('data-pixel-inspector','');library.setAttribute('aria-label',skillLibrary.characterName+'の固有技');library.setAttribute('data-library-signature',signature);
   const header=document.createElement('div');header.className='__pixel-skill-heading';
   const title=document.createElement('h3');title.textContent=skillLibrary.characterName+'の固有技';header.append(title);
   const caption=document.createElement('span');caption.textContent='6つから選ぶ';header.append(caption);library.append(header);
   const pool=document.createElement('div');pool.className='__pixel-skill-pool';pool.setAttribute('role','group');pool.setAttribute('aria-label','入れ替える技を選ぶ');
   for(const skill of skillPool()){
    const button=document.createElement('button');button.type='button';button.setAttribute('data-pixel-skill-pick',skill.id);button.setAttribute('draggable','true');button.setAttribute('aria-pressed','false');button.setAttribute('title',skill.description);button.setAttribute('data-equipped',String(ids.includes(skill.id)));button.setAttribute('aria-label',skill.name+(ids.includes(skill.id)?'、使用中':'、入れ替える'));
    const icon=document.createElement('span');icon.className='__pixel-skill-mark';icon.textContent=skill.mark;icon.setAttribute('aria-hidden','true');button.append(icon);
    const label=document.createElement('span');label.className='__pixel-skill-name';label.textContent=skill.name;button.append(label);
    const status=document.createElement('span');status.className='__pixel-skill-used';status.textContent=ids.includes(skill.id)?'使用中':'入れ替える';button.append(status);pool.append(button);
   }
   library.append(pool);
   const footer=document.createElement('div');footer.className='__pixel-skill-footer';const help=document.createElement('p');help.id='__pixel-skill-help';help.setAttribute('role','status');help.setAttribute('aria-live','polite');footer.append(help);
   const cancel=document.createElement('button');cancel.id='__pixel-skill-cancel';cancel.type='button';cancel.textContent='やめる';cancel.hidden=true;footer.append(cancel);library.append(footer);
   const list=buttons[0].closest('ul.skills'),anchor=list.closest('section')||list;anchor.parentElement.insertBefore(library,anchor.nextSibling);
  }
  setSkillPending(skillPending);
 }
 function clearSkillDrag(){skillDrag=null;document.querySelectorAll('[data-pixel-skill-drop]').forEach(el=>el.removeAttribute('data-pixel-skill-drop'));}
 function render(d){
  const changed=body!==d.body||current!==d.page||actionsEnabled!==d.actionsEnabled;
  if(changed){skipSkillClick=false;skillPending=null;window.PixelActions?.destroy();document.body.innerHTML=d.body;body=d.body;hovered=null;sourceInfo=new WeakMap();const counts={};for(const el of document.body.querySelectorAll('*')){const tag=el.tagName.toLowerCase(),ordinal=counts[tag]||0;counts[tag]=ordinal+1;sourceInfo.set(el,{tag,id:el.id,className:typeof el.className==='string'?el.className:'',text:el.textContent.trim().slice(0,60),ordinal});}}
  if(css!==d.css){document.getElementById('__pixel-style').textContent=d.css;css=d.css;}
  const next=JSON.stringify([d.attrs,d.htmlAttrs]);if(meta!==next||changed){for(const a of [...document.body.attributes])document.body.removeAttribute(a.name);for(const [k,v]of d.attrs)document.body.setAttribute(k,v);for(const a of [...document.documentElement.attributes])document.documentElement.removeAttribute(a.name);for(const [k,v]of d.htmlAttrs)document.documentElement.setAttribute(k,v);meta=next;}
  document.title=d.title||'MY CHARACTER';current=d.page;touring=!!d.touring;actionsEnabled=d.actionsEnabled;skillLibrary=embedded&&!touring?d.skillLibrary:null;if(touring){hovered=null;locating=false;}
  window.PixelCharacter?.apply(document);
  if(changed){scrollTo(0,0);if(actionsEnabled!==false)window.PixelActions?.mount(document);}
  else window.PixelActions?.refreshAppearance?.();
  prepareSkills();clearSkillDrag();mark(d.selector,d.scroll);drawHover();
 }
 function notice(text){let el=document.getElementById('__pixel-notice');if(!el){el=document.createElement('div');el.id='__pixel-notice';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:18px;left:16px;right:16px;padding:12px 16px;background:#1b2540;color:white;font:14px/1.6 sans-serif;z-index:2147483647;border-radius:8px;';document.body.append(el);}el.textContent=text;setTimeout(()=>el.remove(),4500);}
 function route(href){
  href=href.replace(/^\.\//,'');
  if(href.startsWith('#')){let target;try{target=document.getElementById(decodeURIComponent(href.slice(1)));}catch(e){}if(target)target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});else notice('リンク先のidが見つかりません。hrefとidを見比べてみよう。');return;}
  const parts=href.replace(/^\.\//,'').split('#'),page=parts[0].split('?')[0];
  if(!['index.html','about.html'].includes(page)){notice('この教材のページ名は index.html と about.html です。');return;}
  if(embedded){tell({type:'pixel-navigate',page,hash:parts[1]||''});return;}
  if(options.codepen&&current==='index.html'){const original=document.getElementById('pixel-user-page');if(original)options.pages['index.html'].body=original.innerHTML;}
  if(!options.codepen)history.pushState({pixelPage:page},'', '#/'+page+(parts[1]?'#'+parts[1]:''));
  show(page,parts[1]);
 }
 function show(page,hash){const d=options.pages[page];if(!d)return;render({...d,page});if(hash){try{document.getElementById(decodeURIComponent(hash))?.scrollIntoView();}catch(e){}}}
 // Only an explicit modifier-click selects source. Ordinary movement never changes it.
 document.addEventListener('pointermove',e=>{if(!embedded||touring)return;hovered=sourceElement(e.target);locating=false;drawHover();});
 document.addEventListener('pointerleave',clearHover);
 document.addEventListener('pointerout',e=>{if(!e.relatedTarget)clearHover();});
 addEventListener('blur',clearHover);
 document.addEventListener('pointerdown',e=>{if(embedded&&!touring&&sourceElement(e.target)&&(e.metaKey||e.ctrlKey||(e.altKey&&e.target.closest?.('img.character'))))e.stopImmediatePropagation();},true);
 addEventListener('scroll',drawHover,{passive:true,capture:true});addEventListener('resize',drawHover,{passive:true});
 document.addEventListener('click',e=>{
  if(!(e.target instanceof Element))return;const el=sourceElement(e.target),link=e.target.closest('a');
  if(embedded&&el&&!touring&&(e.metaKey||e.ctrlKey)){hovered=el;locating=true;drawHover();tell({type:'pixel-locate',...sourceInfo.get(el)});e.preventDefault();e.stopImmediatePropagation();return;}
  if(embedded&&el&&!touring&&e.altKey&&el.matches('img.character')){tell({type:'pixel-character',...sourceInfo.get(el),character:window.PixelCharacter?.infer(el)||null});e.preventDefault();e.stopImmediatePropagation();return;}
  if(embedded&&!touring){
   const pick=e.target.closest('[data-pixel-skill-pick]'),cancel=e.target.closest('#__pixel-skill-cancel'),slot=e.target.closest('[data-pixel-skill-draggable]');
   if(pick){e.preventDefault();e.stopImmediatePropagation();if(e.metaKey||e.ctrlKey||e.altKey||skipSkillClick){skipSkillClick=false;return;}setSkillPending(skillPending===pick.getAttribute('data-pixel-skill-pick')?null:pick.getAttribute('data-pixel-skill-pick'));clearHover();return;}
   if(cancel){e.preventDefault();e.stopImmediatePropagation();setSkillPending(null);return;}
   if(skipSkillClick&&slot){skipSkillClick=false;e.preventDefault();e.stopImmediatePropagation();return;}
   if(skillPending&&slot){e.preventDefault();e.stopImmediatePropagation();const index=skillButtons().indexOf(slot),id=skillPending;if(index>=0){setSkillPending(null);clearHover();tell({type:'pixel-skill-place',id,index});}return;}
  }
  if(!link)return;const href=(link.getAttribute('href')||'').trim();
  if(/^(?:https?:)?\/\//i.test(href)){if(href.startsWith('//'))link.setAttribute('href','https:'+href);link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');return;}
  e.preventDefault();route(href);
 },true);
 if(embedded){
  document.addEventListener('dragstart',e=>{
   const pool=e.target.closest?.('[data-pixel-skill-pick]'),button=e.target.closest?.('[data-pixel-skill-draggable]'),buttons=skillButtons();
   if(!buttons.length||(!pool&&(!button||!buttons.includes(button))))return;
   if(e.metaKey||e.ctrlKey||e.altKey){e.preventDefault();return;}
   const id=pool?pool.getAttribute('data-pixel-skill-pick'):button.getAttribute('data-skill');
   if(pool&&!skillPool().some(skill=>skill.id===id)){e.preventDefault();return;}
   skillDrag={id,ids:buttons.map(el=>el.getAttribute('data-skill')),origin:pool?'pool':'slot',characterId:skillLibrary?.characterId};
   skipSkillClick=true;setSkillPending(null);clearHover();e.dataTransfer?.setData('text/plain',id);if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
  });
  document.addEventListener('dragover',e=>{
   const target=e.target.closest?.('[data-pixel-skill-draggable]');if(!skillDrag||!target||!skillButtons().includes(target))return;
   e.preventDefault();document.querySelectorAll('[data-pixel-skill-drop]').forEach(el=>el.removeAttribute('data-pixel-skill-drop'));target.setAttribute('data-pixel-skill-drop','');if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  });
  document.addEventListener('drop',e=>{
   const target=e.target.closest?.('[data-pixel-skill-draggable]'),drag=skillDrag;if(!drag||!target)return;e.preventDefault();e.stopPropagation();
   const buttons=skillButtons(),ids=buttons.map(el=>el.getAttribute('data-skill')),index=buttons.indexOf(target),from=ids.indexOf(drag.id);
   clearSkillDrag();setTimeout(()=>{skipSkillClick=false;},0);if(index<0||ids.join(' ')!==drag.ids.join(' ')||drag.characterId!==skillLibrary?.characterId)return;
   if(drag.origin==='pool'){tell({type:'pixel-skill-place',id:drag.id,index});return;}
   if(from<0||index===from)return;ids.splice(from,1);ids.splice(index,0,drag.id);tell({type:'pixel-skill-reorder',ids});
  });
  document.addEventListener('dragend',()=>{clearSkillDrag();setTimeout(()=>{skipSkillClick=false;},0);});
 }
 document.addEventListener('keydown',e=>{
  if(embedded&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();tell({type:'pixel-history',redo:e.key.toLowerCase()==='y'||e.shiftKey});}
  if(embedded&&e.key==='Escape'){if(skillPending||skillDrag){e.preventDefault();e.stopImmediatePropagation();setSkillPending(null);clearSkillDrag();skipSkillClick=false;}else tell({type:'pixel-escape'});}
 });
 document.addEventListener('submit',e=>e.preventDefault());
 if(embedded){addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='pixel-render')render(e.data);if(e.data?.type==='pixel-test-skill'&&!touring&&current==='index.html'&&actionsEnabled!==false){const button=skillButtons()[0];if(button)window.PixelActions?.trigger(button.getAttribute('data-skill'));else notice('特技ボタンを置くと、キャラを動かせます。');}if(e.data?.type==='pixel-scroll'){try{document.getElementById(decodeURIComponent(e.data.hash))?.scrollIntoView();}catch(e){}}});tell({type:'pixel-ready'});}
 else {if(options.codepen){const wrapper=document.getElementById('pixel-user-page');if(wrapper)options.pages['index.html'].body=wrapper.innerHTML;const style=document.createElement('style');style.id='__pixel-style';document.head.append(style);}
 const fromHash=location.hash.slice(2).split('#'),page=!options.codepen&&options.pages[fromHash[0]]?fromHash[0]:current;show(page,fromHash[1]);if(!options.codepen)addEventListener('popstate',()=>{const p=location.hash.slice(2).split('#');show(options.pages[p[0]]?p[0]:'index.html',p[1]);});}
}
function json(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function script(source,nonce=''){return '<script'+(nonce?' nonce="'+nonce+'"':'')+'>'+source.replace(/<\/script/gi,'<\\/script')+'<\/script>';}
function runtime(options){return(window.PIXEL_ACTION_SOURCE||'')+'\n;('+runner.toString()+')('+json(options)+');';}
function shell(){const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; script-src \'nonce-'+nonce+'\'; font-src data:"><style id="__pixel-style"></style><style>.__pixel-selected{outline:3px solid #2563a8!important;outline-offset:4px!important}[data-pixel-skill-draggable]{cursor:grab!important}[data-pixel-skill-drop]{outline:3px solid #2465bf!important;outline-offset:3px!important;background:#cfe7ff!important}[data-pixel-skill-pending]{outline:2px dashed #2465bf!important;outline-offset:3px!important;cursor:pointer!important}#__pixel-skill-library{box-sizing:border-box;display:block;margin:10px 0 0;padding:7px 10px;background:#edf6ff;color:#18364b;border:1px solid #a2bed8;border-radius:8px;font:16px/1.35 system-ui,sans-serif;letter-spacing:normal;text-align:left}#__pixel-skill-library *{box-sizing:border-box}#__pixel-skill-library .__pixel-skill-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px}#__pixel-skill-library h3{margin:0;font:700 17px/1.2 system-ui,sans-serif;color:#18364b}#__pixel-skill-library .__pixel-skill-heading>span{font-size:14px;color:#315574;white-space:nowrap}#__pixel-skill-library .__pixel-skill-pool{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}#__pixel-skill-library button{font:inherit;color:#18364b;letter-spacing:normal;text-transform:none;cursor:pointer;box-shadow:none}#__pixel-skill-library [data-pixel-skill-pick]{display:grid;grid-template-columns:22px minmax(0,1fr);grid-template-rows:auto auto;align-content:center;column-gap:5px;row-gap:0;min-width:0;min-height:42px;padding:3px 7px;background:#fff;border:1px solid #8dacc8;border-radius:5px;text-align:left;cursor:grab}#__pixel-skill-library [data-pixel-skill-pick]:active{cursor:grabbing}#__pixel-skill-library .__pixel-skill-mark{grid-row:1/3;grid-column:1;align-self:center;font-size:20px;font-weight:700;color:#2565a8}#__pixel-skill-library .__pixel-skill-name{grid-row:1;grid-column:2;font-size:16px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}#__pixel-skill-library .__pixel-skill-used{grid-row:2;grid-column:2;align-self:center;font-size:13px;line-height:1.1;color:#49657b}#__pixel-skill-library [data-equipped=true]{border-color:#5c93bd;background:#dceeff}#__pixel-skill-library [data-equipped=true] .__pixel-skill-used{color:#174d77;font-weight:700}#__pixel-skill-library [data-pixel-skill-pick]:hover{border-color:#2465bf;background:#e4f1ff}#__pixel-skill-library [data-pixel-skill-pick][aria-pressed=true]{outline:3px solid #2465bf;outline-offset:0;background:#cce5ff}#__pixel-skill-library button:focus-visible{outline:3px solid #2465bf;outline-offset:2px}#__pixel-skill-library .__pixel-skill-footer{display:flex;align-items:center;gap:8px;min-height:21px;margin-top:4px}#__pixel-skill-help{flex:1;margin:0;font:16px/1.4 system-ui,sans-serif;color:#244762}#__pixel-skill-cancel{flex-shrink:0;padding:3px 8px;background:#fff;border:1px solid #8dacc8;border-radius:4px;font-size:14px!important}#__pixel-skill-library [hidden]{display:none!important}@media(max-width:480px){#__pixel-skill-library .__pixel-skill-pool{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:360px){#__pixel-skill-library{padding:9px}#__pixel-skill-library .__pixel-skill-pool{grid-template-columns:repeat(2,minmax(0,1fr))}#__pixel-skill-library .__pixel-skill-heading>span{font-size:13px}}</style></head><body></body>'+script(runtime({embedded:true}),nonce)+'</html>';}
function pages(s){return Object.fromEntries(['index.html','about.html'].map(page=>[page,renderData({...s,cssEnabled:true},page)]));}
function fullExport(s){return '<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MY CHARACTER</title><style id="__pixel-style"></style></head><body></body>'+script(runtime({pages:pages(s),page:'index.html'}))+'</html>';}
function codepenData(s){const p=pages(s);for(const page of Object.keys(p)){const {doc}=cleanDocument(C.pageSource(s,page),true),css=C.embedAssets([...doc.querySelectorAll('style')].map(el=>el.textContent).join('\n'),window.PIXEL_ART,s.assets),fontCSS=window.PixelFontLibrary?.cssFor(css,doc)||'';p[page].css=fontCSS+(fontCSS?'\n':'')+css;}const css=C.embedAssets(s.css,window.PIXEL_ART,s.assets),fontCSS=window.PixelFontLibrary?.cssFor(css)||'';return{title:'キャラの紹介ページ',html:'<div id="pixel-user-page">'+p['index.html'].body+'</div>',css:fontCSS+(fontCSS?'\n':'')+css,js:runtime({pages:p,page:'index.html',codepen:true}),head:'<meta name="viewport" content="width=device-width,initial-scale=1">',editors:'110',layout:'left'};}
window.PixelPreview={cleanDocument,stylesInOrder,renderData,shell,fullExport,codepenData,runner};
})();
