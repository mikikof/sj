/* 特技の入れ替えと並び替えを HTML に反映する。 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const allowed=(character,id)=>root.PixelCore.skillAllowed(character,id);
const mark=id=>root.PixelCore.SKILLS[id]?.mark||'✦';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let hooks,panel,selected=null,dragged=null,previousFocus=null;
const voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
function scan(source){
 const nodes=[],stack=[],re=/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi;let m;
 while((m=re.exec(source))){
  const raw=m[0];if(/^<!/.test(raw))continue;
  const match=raw.match(/^<(\/)?([\w:-]+)/),tag=match[2].toLowerCase();
  if(match[1]){if(stack.at(-1)?.tag!==tag)return null;const node=stack.pop();node.closeStart=m.index;node.end=re.lastIndex;continue;}
  const node={tag,start:m.index,openEnd:re.lastIndex,end:re.lastIndex,raw,parent:stack.at(-1)||null,children:[],attrs:[]};
  const attrs=/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;let a;
  while((a=attrs.exec(raw))){const value=a[2]??a[3]??a[4]??'',name=a[1].toLowerCase();node.attrs.push({name,value,start:m.index+a.index+a[0].search(/\S/),end:m.index+a.index+a[0].length});}
  node.parent?.children.push(node);nodes.push(node);
  if(!voids.has(tag)&&!/\/\s*>$/.test(raw)){
   if(['script','style','textarea','title'].includes(tag)){const ending=new RegExp('</'+tag+'\\s*>','gi');ending.lastIndex=re.lastIndex;const close=ending.exec(source);if(!close)return null;node.closeStart=close.index;node.end=ending.lastIndex;re.lastIndex=ending.lastIndex;}
   else stack.push(node);
  }
 }
 return stack.length?null:nodes;
}
const attr=(node,name)=>node?.attrs.find(a=>a.name===name);
const classes=node=>(attr(node,'class')?.value||'').split(/\s+/);
function inspect(state){
 const source=state?.html||'',nodes=scan(source);
 const fail=message=>({ok:false,message});
 if(!nodes)return fail('HTMLのタグが閉じていない場所があります。先にコードを確認してください。');
 const lists=nodes.filter(n=>n.tag==='ul'&&classes(n).includes('skills'));
 if(lists.length!==1)return fail('特技のリストが見つかりません。ul の class="skills" を確認してください。');
 const list=lists[0],image=nodes.find(n=>n.tag==='img'&&classes(n).includes('character'));
 if(!image)return fail('キャラの画像が見つかりません。img の class="character" を確認してください。');
 if(image.attrs.filter(a=>a.name==='data-character').length>1)return fail('キャラの data-character が二重に指定されています。');
 const declared=attr(image,'data-character')?.value,fromPath=attr(image,'src')?.value.match(/(?:^|\/)assets\/([a-z]+)\.svg(?:[?#]|$)/)?.[1];
 const characterId=declared||fromPath,characters=root.PixelCore?.CHARACTERS||{},character=Object.hasOwn(characters,characterId)?characters[characterId]:null;
 if(!character)return fail('キャラの data-character に、元のキャラの名前を指定してください。');
 const items=list.children;if(items.length<1||items.length>3||items.some(n=>n.tag!=='li'||!Number.isInteger(n.closeStart)))return fail('特技のリストは li を1〜3個にしてください。');
 const clear=s=>s.replace(/<!--[\s\S]*?-->/g,'').trim();
 let last=list.openEnd;const gaps=[],entries=[];
 for(const item of items){
  const gap=source.slice(last,item.start);if(clear(gap))return fail('ul の中に、li 以外の文字があります。');gaps.push(gap);last=item.end;
  const buttons=nodes.filter(n=>n.tag==='button'&&n.start>item.start&&n.end<item.end&&attr(n,'data-skill'));
  if(buttons.length!==1||buttons[0].attrs.filter(a=>a.name==='data-skill').length!==1)return fail('それぞれの li に、data-skill を指定したボタンを1個置いてください。');
  const id=attr(buttons[0],'data-skill').value;if(!allowed(characterId,id))return fail('このキャラが使えない特技が含まれています。data-skill を確認してください。');
  entries.push({id,start:item.start,end:item.end,raw:source.slice(item.start,item.end)});
 }
 const tail=source.slice(last,list.closeStart);if(clear(tail))return fail('ul の中に、li 以外の文字があります。');
 const ids=entries.map(e=>e.id);if(new Set(ids).size!==ids.length)return fail('同じ特技が2個あります。data-skill を確認してください。');
 return{ok:true,source,list,character,characterId,ids,entries,gaps,tail};
}
function build(state,ids){
 const info=inspect(state);if(!info.ok)return info;
 if(!Array.isArray(ids)||ids.length<1||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!allowed(info.characterId,id)))return{ok:false,message:'特技は、このキャラが使えるものを1〜3個選んでください。'};
 if(ids.join(' ')===info.ids.join(' '))return{ok:true,changed:false,info};
 const raws=new Map(info.entries.map(item=>[item.id,item.raw]));
 const line=info.gaps.find(g=>/\n[ \t]*$/.test(g)),indent=line?.match(/\n([ \t]*)$/)?.[1]||'        ';
 const chunks=ids.map((id,index)=>(info.gaps[index]??'\n'+indent)+(raws.get(id)||'<li><button type="button" data-skill="'+id+'">'+esc(root.PixelCore.SKILLS[id].name)+' '+mark(id)+'</button></li>'));
 // Keep any comments between removed slots instead of silently deleting them.
 const remaining=info.gaps.slice(ids.length).join('');
 const body=chunks.join('')+remaining+info.tail;
 const html=info.source.slice(0,info.list.openEnd)+body+info.source.slice(info.list.closeStart);
 return{ok:true,changed:true,html,range:{start:info.list.openEnd,end:info.list.openEnd+body.length},ids:[...ids]};
}
function apply(ids){
 if(!hooks)return false;
 const next=build(hooks.getState(),ids);if(!next.ok){hooks.notify?.(next.message);refresh();return false;}if(!next.changed)return false;
 hooks.leaveTour?.();hooks.commit(state=>{state.html=next.html;});
 hooks.navigate?.('index.html');hooks.selectCode?.('html',next.range,true);hooks.showArrival?.('html');
 selected=null;refresh();if(panel&&!panel.hidden)$('skill-editor-status').textContent='特技のHTMLが変わりました。ページのボタンで試せます。';
 hooks.notify?.('特技のHTMLが変わりました');return true;
}
function put(id,index){
 if(!hooks||typeof id!=='string'||!Number.isInteger(index))return false;
 const info=inspect(hooks.getState());if(!info.ok)return false;const ids=[...info.ids],from=ids.indexOf(id);
 if(!allowed(info.characterId,id)||index<0||index>2)return false;
 if(from>=0){if(index>=ids.length)index=ids.length-1;if(from===index)return false;ids.splice(from,1);ids.splice(index,0,id);}
 else if(index<ids.length)ids[index]=id;else if(ids.length<3)ids.push(id);else return false;
 return apply(ids);
}
function clearDrag(){dragged=null;panel?.querySelectorAll('.skill-drop-target').forEach(el=>el.classList.remove('skill-drop-target'));}
function refresh(){
 if(!panel||panel.hidden)return;const info=inspect(hooks.getState());
 $('skill-editor-error').hidden=info.ok;$('skill-editor-work').hidden=!info.ok;
 if(!info.ok){$('skill-editor-error').textContent=info.message;return;}
 $('skill-editor-character').textContent=info.character.name+'の特技';
 if(selected&&!allowed(info.characterId,selected))selected=null;
 $('skill-editor-slots').innerHTML=[0,1,2].map(index=>{const id=info.ids[index],skill=root.PixelCore.SKILLS[id];return '<div class="skill-slot" data-skill-slot="'+index+'"><span class="skill-slot-number">'+(index+1)+'</span><button type="button" class="skill-slot-main" data-skill-place="'+index+'"'+(id?' draggable="true" data-skill-drag="'+id+'"':'')+' aria-label="'+(selected?esc(root.PixelCore.SKILLS[selected].name)+'を'+(index+1)+'番に置く':(index+1)+'番 '+(skill?esc(skill.name):'空いている場所'))+'"><strong>'+(skill?esc(skill.name):'ここに入れる')+'</strong><small>'+(selected?'選んだ特技をここに置く':skill?esc(skill.description):'3つまで使えます')+'</small></button>'+(id?'<div class="skill-order-buttons"><button type="button" data-skill-move="'+index+':-1" aria-label="'+esc(skill.name)+'を前へ"'+(index===0?' disabled':'')+'>←</button><button type="button" data-skill-move="'+index+':1" aria-label="'+esc(skill.name)+'を後ろへ"'+(index===info.ids.length-1?' disabled':'')+'>→</button><button type="button" data-skill-remove="'+index+'" aria-label="'+esc(skill.name)+'を外す"'+(info.ids.length===1?' disabled':'')+'>外す</button></div>':'')+'</div>';}).join('');
 $('skill-editor-pool').innerHTML=info.character.skills.map(id=>'<button type="button" draggable="true" data-skill-pick="'+id+'" data-skill-drag="'+id+'" aria-pressed="'+(selected===id)+'"><span class="skill-pool-mark">'+mark(id)+'</span><strong>'+esc(root.PixelCore.SKILLS[id].name)+'</strong><small>'+(info.ids.includes(id)?'使用中':esc(root.PixelCore.SKILLS[id].description))+'</small></button>').join('');
 $('skill-editor-instruction').textContent=selected?'上の1〜3番から置く場所を選んでください。':'特技を上の枠へドラッグ。クリックしてから置く場所を選んでも入れ替えられます。';
}
function open(){if(!panel||!hooks)return;hooks.leaveTour?.();previousFocus=document.activeElement;selected=null;panel.hidden=false;document.body.classList.add('skill-editor-open');refresh();$('skill-editor-close').focus({preventScroll:true});}
function close(){if(!panel||panel.hidden)return;panel.hidden=true;selected=null;clearDrag();document.body.classList.remove('skill-editor-open');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
function init(options){
 hooks=options;if(panel)return;const area=document.querySelector('.preview-area');if(!area)return;
 panel=document.createElement('aside');panel.id='skill-editor';panel.className='skill-editor';panel.hidden=true;panel.setAttribute('aria-label','特技を入れ替える');
 panel.innerHTML='<header class="skill-editor-heading"><h2 id="skill-editor-character">特技を入れ替える</h2><button type="button" id="skill-editor-close">ページへ戻る ×</button></header><p id="skill-editor-error" role="status" hidden></p><div id="skill-editor-work"><p id="skill-editor-instruction"></p><div id="skill-editor-slots" class="skill-editor-slots" role="group" aria-label="使用する特技の順番"></div><h3>使える特技</h3><div id="skill-editor-pool" class="skill-editor-pool" role="group" aria-label="使える特技"></div></div><p id="skill-editor-status" class="skill-editor-status" role="status" aria-live="polite">ページに並ぶ順番です。ボタンを押すと特技が動きます。</p>';
 area.append(panel);$('skill-editor-close').addEventListener('click',close);
 panel.addEventListener('click',event=>{
  const button=event.target.closest?.('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-skill-pick')){selected=selected===button.dataset.skillPick?null:button.dataset.skillPick;refresh();panel.querySelector('[data-skill-pick="'+button.dataset.skillPick+'"]').focus({preventScroll:true});}
  if(button.hasAttribute('data-skill-place')){const index=Number(button.dataset.skillPlace);if(selected)put(selected,index);else{const info=inspect(hooks.getState());selected=info.ok?info.ids[index]:null;refresh();panel.querySelector('[data-skill-place="'+index+'"]').focus({preventScroll:true});}}
  if(button.hasAttribute('data-skill-move')){const [index,delta]=button.dataset.skillMove.split(':').map(Number),info=inspect(hooks.getState());if(info.ok&&put(info.ids[index],index+delta))panel.querySelector('[data-skill-place="'+(index+delta)+'"]').focus({preventScroll:true});}
  if(button.hasAttribute('data-skill-remove')){const info=inspect(hooks.getState());if(info.ok&&info.ids.length>1)apply(info.ids.filter((_,i)=>i!==Number(button.dataset.skillRemove)));}
 });
 panel.addEventListener('dragstart',event=>{const el=event.target.closest?.('[data-skill-drag]');if(!el)return;dragged=el.dataset.skillDrag;selected=null;event.dataTransfer?.setData('text/plain',dragged);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
 panel.addEventListener('dragover',event=>{const slot=event.target.closest?.('[data-skill-slot]');if(!dragged||!slot)return;event.preventDefault();panel.querySelectorAll('.skill-drop-target').forEach(el=>el.classList.remove('skill-drop-target'));slot.classList.add('skill-drop-target');if(event.dataTransfer)event.dataTransfer.dropEffect='move';});
 panel.addEventListener('drop',event=>{const slot=event.target.closest?.('[data-skill-slot]'),id=dragged;if(!slot||!id)return;event.preventDefault();clearDrag();put(id,Number(slot.dataset.skillSlot));});
 panel.addEventListener('dragend',clearDrag);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close();}});
}
root.PixelSkills={init,open,close,refresh,reorder:apply,put,inspect,build};
})(typeof window!=='undefined'?window:globalThis);
