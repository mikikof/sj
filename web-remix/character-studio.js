/* キャラの編集と、変更したHTML・CSSへの案内。 */
(function (root) {
'use strict';
let hooks, panel, tab='color', previousFocus, lastChange=null, current=null, target=null, inertSnapshot=[];
const partNames={head:'頭',hands:'手',feet:'足',gear:'装備'};
const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maskComments=text=>text.replace(/\/\*[\s\S]*?\*\//g,m=>' '.repeat(m.length));
function imageTags(source) {
 const masked=source.replace(/<!--[\s\S]*?-->/g,m=>' '.repeat(m.length)).replace(/(<(script|style|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,(m,open,tag,text,close)=>open+' '.repeat(text.length)+close);
 return [...masked.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map((m,ordinal)=>{
  const text=source.slice(m.index,m.index+m[0].length),doc=new DOMParser().parseFromString(text,'text/html'),element=doc.querySelector('img');
  return {start:m.index,end:m.index+text.length,text,element,ordinal};
 }).filter(tag=>tag.element?.classList.contains('character'));
}
function cssRules(css) {
 const uncommented=maskComments(css),masked=uncommented.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,m=>' '.repeat(m.length));
 const found=[];let depth=0,boundary=0,open=-1,character=false;
 for(let i=0;i<masked.length;i++) {
  if(masked[i]==='{') {if(depth===0){character=masked.slice(boundary,i).trim()==='.character';open=i;}depth++;}
  else if(masked[i]==='}') {depth=Math.max(0,depth-1);if(depth===0){if(character)found.push({start:open+1,end:i,body:uncommented.slice(open+1,i)});boundary=i+1;character=false;}}
  else if(masked[i]===';'&&depth===0)boundary=i+1;
 }
 return found;
}
function propertyRange(css,key) {
 let result=null;
 for(const rule of cssRules(css)) {
  const re=new RegExp('(?:^|;)\\s*'+key+'\\s*:\\s*([^;}]+)','g');let match;
  while((match=re.exec(rule.body))) {
   const offset=match.index+match[0].lastIndexOf(match[1]),value=match[1].trim(),left=match[1].length-match[1].trimStart().length;
   result={start:rule.start+offset+left,end:rule.start+offset+left+value.length,value};
  }
 }
 return result;
}
function setProperty(css,key,value) {
 const range=propertyRange(css,key);if(range)return css.slice(0,range.start)+value+css.slice(range.end);
 const rule=cssRules(css).at(-1);
 if(rule) {
  const before=css.slice(0,rule.end),trimmed=before.trimEnd(),body=maskComments(css.slice(rule.start,rule.end)).trim();
  const separator=body&&!/[;}]$/.test(body)?';':'';
  return trimmed+separator+'\n  '+key+': '+value+';\n'+css.slice(rule.end);
 }
 return css.trimEnd()+'\n\n/* キャラの色 */\n.character {\n  '+key+': '+value+';\n}\n';
}
function attrRange(text,key) {
 // Attribute names are matched after whitespace, so data-head never matches a string inside another value.
 const attributes=/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;let match;
 while((match=attributes.exec(text)))if(match[1].toLowerCase()===key)return {start:match.index+match[0].search(/\S/),end:match.index+match[0].length};
 return null;
}
function setAttr(text,key,value) {
 const next=key+'="'+esc(value)+'"',range=attrRange(text,key);
 if(range)return text.slice(0,range.start)+next+text.slice(range.end);
 const end=text.search(/\/?\s*>$/);return end<0?text:text.slice(0,end).trimEnd()+' '+next+text.slice(end);
}
function patchImages(source,id,attributes,restore=false,ordinal=null) {
 let result=source;
 const tags=imageTags(source),chosen=ordinal===null?tags.find(tag=>root.PixelCharacter.infer(tag.element)===id):tags.find(tag=>tag.ordinal===ordinal);
 for(const tag of (chosen?[chosen]:[])) {
  const known=root.PixelCharacter.infer(tag.element);
  if(!restore&&known!==id)continue;
  let text=tag.text;
  if(restore)text=setAttr(text,'src','assets/'+id+'.svg');
  if(!Object.hasOwn(root.PixelCore?.CHARACTERS||{},tag.element.getAttribute('data-character')))text=setAttr(text,'data-character',id);
  for(const [key,value]of Object.entries(attributes))text=setAttr(text,key,value);
  result=result.slice(0,tag.start)+text+result.slice(tag.end);
 }
 return result;
}
function readState() {
 const state=hooks.getState(),page=state.activePage==='about.html'?'aboutHtml':'html';
 const candidates=imageTags(state[page]||'');
 const selected=target?.page===page?candidates.find(item=>item.ordinal===target.ordinal):candidates[0];
 if(!selected)return {state,page,missing:true};
 const id=root.PixelCharacter.infer(selected.element);
 const profile=imageTags(state.html||'')[0],about=imageTags(state.aboutHtml||'')[0];
 const declared=selected.element.getAttribute('data-character')||profile?.element.getAttribute('data-character')||about?.element.getAttribute('data-character');
 const original=Object.hasOwn(root.PixelCore?.CHARACTERS||{},declared)?declared:root.PixelCharacter.infer(profile?.element)||root.PixelCharacter.infer(about?.element)||'mint';
 if(!id)return {state,page,selected,custom:true,original};
 const config=root.PixelCharacter.defaults(id);
 for(const key of Object.keys(partNames))config[key]=selected.element.getAttribute('data-'+key)||config[key];
 for(const [key,property]of (state.cssEnabled===false?[]:[['bodyColor','--body-color'],['accentColor','--accent-color']])) {
  const value=propertyRange(state.css,property)?.value;
  if(value)config[key]=value;
 }
 return {state,page,selected,id,config:root.PixelCharacter.normalize(id,config)};
}
function colorContent() {
 const colors=[['body','からだ',current.config.bodyColor,'#61d9bc','#73b9ff','#eaa3e1','#f5b46d'],['accent','アクセント',current.config.accentColor,'#ff9b41','#ffe068','#9edbff','#f7faff']];
 return '<div class="studio-colors">'+colors.map(([key,label,value,...choices])=>'<div class="studio-color-row"><label for="studio-'+key+'-color">'+label+'</label><div class="studio-color-picker"><input id="studio-'+key+'-color" type="color" value="'+value+'" aria-label="'+label+'の色を変える"><code>'+value.toUpperCase()+'</code></div><div class="studio-swatches" role="group" aria-label="'+label+'の色の候補">'+choices.map(color=>'<button type="button" data-studio-color="'+key+'" data-studio-value="'+color+'" style="--studio-swatch:'+color+'" aria-label="'+label+'を'+color+'に変える" aria-pressed="'+(value.toLowerCase()===color.toLowerCase())+'"></button>').join('')+'</div></div>').join('')+'</div>';
}
function renderOptions() {
 const options=$('studio-options');
 if(current.missing||current.custom){options.innerHTML='';return;}
 if(tab==='color') {
  options.innerHTML=colorContent();
  for(const key of ['body','accent'])$('studio-'+key+'-color').addEventListener('change',e=>changeColor(key,e.target.value));
  options.querySelectorAll('[data-studio-color]').forEach(button=>button.addEventListener('click',()=>changeColor(button.dataset.studioColor,button.dataset.studioValue)));
 } else {
  options.innerHTML='<div class="studio-part-options">'+Object.entries(root.PixelCharacter.options[tab]).map(([value,label])=>{
   const config={...current.config,[tab]:value};
   return '<button type="button" data-studio-part="'+tab+'" data-studio-value="'+value+'" aria-pressed="'+(current.config[tab]===value)+'"><img src="'+esc(root.PixelCharacter.dataURL(current.id,config))+'" alt=""><span>'+label+'</span></button>';
  }).join('')+'</div>';
  options.querySelectorAll('[data-studio-part]').forEach(button=>button.addEventListener('click',()=>changePart(button.dataset.studioPart,button.dataset.studioValue)));
 }
}
function refresh() {
 if(!panel||panel.hidden)return;
 current=readState();
 $('studio-empty').hidden=!current.missing;$('studio-custom').hidden=!current.custom;
 $('studio-edit').hidden=Boolean(current.missing||current.custom);
 $('studio-code-jump').hidden=!lastChange;
 if(current.missing)return;
 if(current.custom) {
  $('studio-original-name').textContent=root.PixelCore?.CHARACTERS[current.original]?.name||'ミント';
  const src=current.selected.element.getAttribute('src')||'';
  $('studio-custom-image').src=current.state.assets?.find(asset=>asset.path===src)?.dataURL||src;
  return;
 }
 const filter=propertyRange(current.state.css,'filter')?.value||'none',transform=propertyRange(current.state.css,'transform')?.value||'none';
 panel.style.setProperty('--studio-filter',current.state.cssEnabled===false?'none':filter);
 panel.style.setProperty('--studio-transform',current.state.cssEnabled===false?'none':transform);
 $('studio-image').src=root.PixelCharacter.dataURL(current.id,current.config);
 $('studio-image').alt=(root.PixelCore?.CHARACTERS[current.id]?.name||'キャラ')+'の見た目';
 $('studio-character-name').textContent=root.PixelCore?.CHARACTERS[current.id]?.name||'キャラ';
 $('studio-tabs').querySelectorAll('[data-studio-tab]').forEach(button=>{
  const selected=button.dataset.studioTab===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
 });
 renderOptions();
}
function focusChanged() {
 if(!lastChange)return;
 const state=hooks.getState();let range=null;
 if(lastChange.kind==='css')range=propertyRange(state.css,lastChange.key);
 else {
  const source=state.activePage==='about.html'?state.aboutHtml:state.html;
  const page=state.activePage==='about.html'?'aboutHtml':'html',tags=imageTags(source);
  const tag=lastChange.page===page?tags.find(item=>item.ordinal===lastChange.ordinal):tags.find(item=>root.PixelCharacter.infer(item.element)===lastChange.id);
  if(tag){const attribute=attrRange(tag.text,lastChange.key);if(attribute)range={start:tag.start+attribute.start,end:tag.start+attribute.end};}
 }
 if(!range){hooks.notify?.('変更した場所が見つかりません。コードが書き換わっているか確認してください。');return;}
 hooks.selectCode(lastChange.kind,range,true);hooks.showArrival?.(lastChange.kind);
}
function record(change,message) {lastChange=change;refresh();$('studio-code-status').textContent=message;focusChanged();}
function patchPages(state,id,attributes,restore=false) {
 const originalSource=current.selected.element.getAttribute('src');
 for(const page of ['html','aboutHtml']) {
  let ordinal=current.page===page?current.selected.ordinal:null,restorePage=restore&&current.page===page;
  if(restore&&current.page!==page) {
   const counterpart=imageTags(state[page]).find(tag=>!root.PixelCharacter.infer(tag.element)&&tag.element.getAttribute('src')===originalSource);
   if(counterpart){ordinal=counterpart.ordinal;restorePage=true;}
  }
  state[page]=patchImages(state[page],id,attributes,restorePage,ordinal);
 }
}
function changePart(key,value) {
 current=readState();if(current.missing||current.custom||!Object.hasOwn(root.PixelCharacter.options[key]||{},value)||current.config[key]===value)return;
 const id=current.id;
 const page=current.page,ordinal=current.selected.ordinal;
 hooks.commit(state=>patchPages(state,id,{['data-'+key]:value}));
 record({kind:'html',key:'data-'+key,id,page,ordinal},'HTMLの data-'+key+' を変更しました');
}
function changeColor(key,value) {
 current=readState();if(current.missing||current.custom||!/^#[0-9a-f]{6}$/i.test(value))return;
 const property=key==='accent'?'--accent-color':'--body-color',configKey=key==='accent'?'accentColor':'bodyColor';
 if(current.config[configKey].toLowerCase()===value.toLowerCase())return;
 const id=current.id;
 hooks.commit(state=>{patchPages(state,id,{});state.css=setProperty(state.css,property,value.toLowerCase());state.cssEnabled=true;});
 record({kind:'css',key:property,id},'CSSの '+property+' を変更しました');
}
function restoreOriginal() {
 current=readState();if(!current.custom)return;const id=current.original;
 const page=current.page,ordinal=current.selected.ordinal;
 hooks.commit(state=>patchPages(state,id,{},true));
 record({kind:'html',key:'src',id,page,ordinal},'HTMLの src を元のキャラに戻しました');
}
function setTab(next,focus=false) {if(!['color',...Object.keys(partNames)].includes(next))return;tab=next;refresh();if(focus)$('studio-tabs').querySelector('[data-studio-tab="'+tab+'"]').focus({preventScroll:true});}
function open(info) {
 if(!hooks||!root.PixelCharacter)return;
 if(panel.hidden) {
  previousFocus=document.activeElement;
  inertSnapshot=[...panel.parentNode.children].filter(el=>el!==panel).map(el=>[el,el.inert]);
  for(const [el]of inertSnapshot)el.inert=true;
 }
 hooks.leaveTour?.();
 document.body.classList.remove('preview-expanded');hooks.setView?.('html');
 const page=hooks.getState().activePage==='about.html'?'aboutHtml':'html';
 target=Number.isInteger(info?.ordinal)?{page,ordinal:info.ordinal}:null;
 panel.hidden=false;document.body.classList.add('studio-open');lastChange=null;
 $('studio-code-status').textContent='選ぶとコードも変わります';refresh();
 if(info?.tab)setTab(info.tab);
 $('studio-close').focus({preventScroll:true});
}
function close() {
 if(!panel||panel.hidden)return;panel.hidden=true;document.body.classList.remove('studio-open');
 for(const [el,wasInert]of inertSnapshot)el.inert=wasInert;inertSnapshot=[];
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
}
function init(options) {
 hooks=options;if(panel)return;
 const area=document.querySelector('.preview-area');if(!area)return;
 panel=document.createElement('aside');panel.id='character-studio';panel.className='character-studio';panel.hidden=true;panel.setAttribute('aria-label','キャラの見た目を変える');
 panel.innerHTML='<header class="studio-heading"><h2>キャラの見た目</h2><button id="studio-close" type="button" class="text-button">ページへ戻る ×</button></header>'+
 '<div id="studio-edit" class="studio-edit"><div class="studio-preview"><img id="studio-image" alt=""><div><strong id="studio-character-name"></strong><p>パーツや色を選んでみよう</p><p class="studio-note">リンク先のキャラも変わります</p></div></div>'+
 '<div id="studio-tabs" class="studio-tabs" role="tablist" aria-label="変えるところ">'+[['color','色'],...Object.entries(partNames)].map(([key,label],i)=>'<button type="button" role="tab" data-studio-tab="'+key+'" aria-selected="'+(i===0)+'" aria-controls="studio-options" tabindex="'+(i===0?'0':'-1')+'">'+label+'</button>').join('')+'</div><div id="studio-options" class="studio-options" role="tabpanel" aria-label="パーツと色の選択"></div></div>'+
 '<div id="studio-custom" class="studio-custom" hidden><img id="studio-custom-image" alt="使用中の画像"><div><p>追加した画像を使っています。</p><p>パーツを選ぶには元のキャラに戻します。</p><button id="studio-restore-original" type="button" class="secondary-button"><span id="studio-original-name"></span>に戻して編集する</button></div></div>'+
 '<div id="studio-empty" class="studio-empty" hidden><p>編集できるキャラの画像が見つかりません。</p><p>HTMLの画像に <code>class="character"</code> があるか確認してください。</p></div>'+
 '<footer class="studio-footer"><p id="studio-code-status" role="status" aria-live="polite">選ぶとコードも変わります</p><button id="studio-code-jump" type="button" class="text-button" hidden>変更したコードへ ↗</button></footer>';
 area.append(panel);
 $('studio-close').addEventListener('click',close);$('studio-code-jump').addEventListener('click',focusChanged);$('studio-restore-original').addEventListener('click',restoreOriginal);
 $('studio-tabs').querySelectorAll('[data-studio-tab]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.studioTab)));
 $('studio-tabs').addEventListener('keydown',event=>{
  const keys=['color',...Object.keys(partNames)];let index=keys.indexOf(tab);
  if(event.key==='ArrowRight')index=(index+1)%keys.length;else if(event.key==='ArrowLeft')index=(index+keys.length-1)%keys.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=keys.length-1;else return;
  event.preventDefault();setTab(keys[index],true);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close();}});
}
root.PixelStudio={init,open,refresh,close};
})(typeof window!=='undefined'?window:globalThis);
