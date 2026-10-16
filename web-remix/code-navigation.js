/* Shift-click follows references between the two editable source files. */
(function () {
 'use strict';
 const kinds=['html','css'];
 let hooks={},initialized=false,composing=false,gesture=null,active=null,popup=null,list=null,title=null,observer=null;
 const listeners=[];
 const $=id=>document.getElementById(id);
 const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));};
 const create=(tag,className,parent)=>{const node=document.createElement(tag);if(className)node.className=className;if(parent)parent.appendChild(node);return node;};
 const tell=text=>{if(text&&typeof hooks.notify==='function')hooks.notify(text);};
 const other=kind=>kind==='html'?'css':'html';
 const plainShift=event=>event.shiftKey&&!event.metaKey&&!event.ctrlKey&&!event.altKey;
 const primary=event=>(event.button===undefined||event.button===0)&&event.isPrimary!==false&&event.pointerType!=='touch';
 function context(){
  try{const value=hooks.getContext?.();if(!value||typeof value.html!=='string'||typeof value.css!=='string')return null;return {html:value.html,css:value.css,page:String(value.page||'')};}catch(_){return null;}
 }
 function same(a,b){return !!a&&!!b&&a.html===b.html&&a.css===b.css&&a.page===b.page;}
 function current(snapshot){
  return same(snapshot,context())&&kinds.every(kind=>$(kind+'-editor')?.value===snapshot[kind]);
 }
 function usable(editor){return !!editor?.isConnected&&!editor.closest('[hidden],[inert],[aria-hidden="true"]')&&!document.querySelector('dialog[open]');}
 function resolve(kind,index,snapshot){
  if(!snapshot||!Number.isInteger(index)||index<0||index>=snapshot[kind].length)return {targets:[],message:'タグやセレクタにカーソルを置いてください。'};
  let result;
  try{result=window.PixelCodeReferences?.resolve({kind,index,...snapshot});}catch(_){result=null;}
  const seen=new Set();
  const targets=(Array.isArray(result?.targets)?result.targets:[]).filter(target=>{
   if(target.kind!==other(kind)||!Number.isInteger(target.start)||!Number.isInteger(target.end)||target.start<0||target.end<=target.start||target.end>snapshot[target.kind].length)return false;
   const key=target.kind+':'+target.start+':'+target.end;if(seen.has(key))return false;seen.add(key);return true;
  }).map(target=>({kind:target.kind,start:target.start,end:target.end,label:String(target.label||''),detail:String(target.detail||'')}));
  return {targets,message:String(result?.message||'対応する '+other(kind).toUpperCase()+' が見つかりませんでした。')};
 }
 function close(restoreFocus=false){
  const origin=active?.editor;gesture=null;active=null;
  if(popup)popup.hidden=true;
  for(const kind of kinds){const hint=$(kind+'-reference-hint');if(hint)hint.setAttribute('aria-expanded','false');}
  if(restoreFocus&&usable(origin))origin.focus({preventScroll:true});
 }
 function sourceInfo(source,index){
  const lineStart=source.lastIndexOf('\n',index-1)+1,next=source.indexOf('\n',index),lineEnd=next===-1?source.length:next;
  return {line:source.slice(0,index).split('\n').length,snippet:source.slice(lineStart,lineEnd).trim().slice(0,160)};
 }
 function go(target,snapshot){
  if(!current(snapshot)){close();tell('コードが変わりました。もう一度選んでください。');return;}
  close();
  let moved=false;try{moved=typeof hooks.jump==='function'&&hooks.jump({...target})!==false;}catch(_){moved=false;}
  if(!moved){tell('移動先を開けませんでした。もう一度選んでください。');return;}
  const info=sourceInfo(snapshot[target.kind],target.start);
  tell(target.kind.toUpperCase()+' '+info.line+'行目'+(target.label?'：'+target.label.slice(0,90):''));
 }
 function ensurePopup(){
  if(popup)return;
  popup=create('section','code-navigation-popup',document.body);popup.id='code-navigation-popup';popup.hidden=true;
  popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','code-navigation-title');
  const heading=create('div','code-navigation-heading',popup);
  title=create('h2','',heading);title.id='code-navigation-title';
  const dismiss=create('button','code-navigation-close',heading);dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','参照先を閉じる');
  listen(dismiss,'click',()=>close(true));
  list=create('div','code-navigation-list',popup);list.setAttribute('role','group');list.setAttribute('aria-label','参照先');
  listen(list,'click',event=>{
   const button=event.target.closest?.('[data-reference-index]');if(!button||!list.contains(button)||!active)return;
   const target=active.targets[Number(button.dataset.referenceIndex)];if(target)go(target,active.snapshot);
  });
  const hint=create('p','code-navigation-keys',popup);hint.textContent='↑ ↓ で選ぶ　Enter で移動　Esc で閉じる';
  listen(popup,'keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
   const buttons=[...list.querySelectorAll('button')],at=buttons.indexOf(document.activeElement);
   if(!buttons.length)return;
   let next;
   if(event.key==='ArrowDown')next=at<0?0:(at+1)%buttons.length;
   if(event.key==='ArrowUp')next=at<0?buttons.length-1:(at-1+buttons.length)%buttons.length;
   if(event.key==='Home')next=0;
   if(event.key==='End')next=buttons.length-1;
   if(next!==undefined){event.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView?.({block:'nearest'});}
  });
 }
 function position(x,y){
  const gap=10,width=Math.max(160,Math.min(420,window.innerWidth-gap*2)),height=Math.max(100,window.innerHeight-gap*2);
  popup.style.width=width+'px';popup.style.maxHeight=height+'px';
  const box=popup.getBoundingClientRect();
  let left=x+16,top=y+20;
  if(left+box.width>window.innerWidth-gap)left=x-box.width-16;
  if(top+box.height>window.innerHeight-gap)top=y-box.height-16;
  popup.style.left=Math.max(gap,Math.min(left,window.innerWidth-box.width-gap))+'px';
  popup.style.top=Math.max(gap,Math.min(top,window.innerHeight-box.height-gap))+'px';
 }
 function show(request){
  if(!current(request.snapshot)){close();tell('コードが変わりました。もう一度選んでください。');return;}
  if(!request.targets.length){tell(request.message);return;}
  window.PixelCodeHelp?.hide();
  if(request.targets.length===1){go(request.targets[0],request.snapshot);return;}
  ensurePopup();active=request;
  title.textContent='対応する '+other(request.kind).toUpperCase()+' を選ぶ';list.replaceChildren();
  request.targets.forEach((target,index)=>{
   const info=sourceInfo(request.snapshot[target.kind],target.start),button=create('button','code-navigation-target',list);button.type='button';button.dataset.referenceIndex=String(index);
   const heading=create('span','code-navigation-target-heading',button);
   const line=create('span','code-navigation-line',heading);line.textContent=target.kind.toUpperCase()+' '+info.line+'行目';
   const label=create('code','code-navigation-label',heading);label.textContent=target.label.slice(0,160)||info.snippet;
   if(info.snippet!==target.label){const snippet=create('code','code-navigation-snippet',button);snippet.textContent=info.snippet;}
   if(target.detail){const detail=create('span','code-navigation-detail',button);detail.textContent=target.detail.slice(0,240);}
  });
  popup.hidden=false;$(request.kind+'-reference-hint')?.setAttribute('aria-expanded','true');position(request.x,request.y);
  list.querySelector('button')?.focus({preventScroll:true});
 }
 function fromHint(kind,editor,hint){
  close();if(composing||!usable(editor))return;
  const snapshot=context();if(!snapshot||!current(snapshot))return;
  const index=Math.min(Math.max(0,Number.isInteger(editor.selectionStart)?editor.selectionStart:0),snapshot[kind].length-1);
  const result=resolve(kind,index,snapshot);if(!result.targets.length){tell(result.message);return;}
  const box=hint.getBoundingClientRect();
  show({kind,editor,snapshot,targets:result.targets,x:box.left,y:box.bottom});
 }
 function init(options){
  hooks=options||hooks;if(initialized)return;initialized=true;ensurePopup();
  for(const kind of kinds){
   const editor=$(kind+'-editor');if(!editor)continue;
   const foot=$(kind+'-section')?.querySelector('.editor-foot');
   if(foot){
    const hint=create('button','code-navigation-hint',foot);hint.type='button';hint.id=kind+'-reference-hint';hint.textContent='Shift＋クリック → '+other(kind).toUpperCase();
    hint.title='Shift＋クリックで対応する '+other(kind).toUpperCase()+' へ。カーソルを置いてこのボタンを押しても移動できます。';
    hint.setAttribute('aria-label','対応する '+other(kind).toUpperCase()+' を開く（Shift＋クリック）');hint.setAttribute('aria-haspopup','dialog');hint.setAttribute('aria-expanded','false');hint.setAttribute('aria-controls','code-navigation-popup');
    listen(hint,'click',()=>fromHint(kind,editor,hint));
   }
   listen(editor,'pointerdown',event=>{
    close();if(composing||event.isComposing||!plainShift(event)||!primary(event)||!usable(editor))return;
    const snapshot=context();if(!snapshot||!current(snapshot))return;
    const hit=window.PixelCodeHelp?.hitTest(editor,event.clientX,event.clientY);if(!hit||!Number.isInteger(hit.index))return;
    const result=resolve(kind,hit.index,snapshot);
    if(result.targets.length){event.preventDefault();window.PixelCodeHelp?.hide();}
    gesture={kind,editor,snapshot,targets:result.targets,message:result.message,x:event.clientX,y:event.clientY,pointerId:event.pointerId};
   });
   listen(editor,'pointermove',event=>{
    if(gesture?.editor===editor&&event.buttons&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7)gesture=null;
   });
   listen(editor,'pointercancel',()=>{gesture=null;});
   listen(editor,'click',event=>{
    const request=gesture;gesture=null;if(!request||request.editor!==editor||!plainShift(event)||event.button!==0||event.pointerType==='touch')return; /* click の isPrimary は Chrome で false になるので見ない（押し下げの時点で primary を確かめ済み。2026-10-16） */
    if(Math.hypot(event.clientX-request.x,event.clientY-request.y)>7)return;
    if(request.targets.length){event.preventDefault();event.stopPropagation();}show(request);
   });
   listen(editor,'input',()=>close());listen(editor,'scroll',()=>close());listen(editor,'compositionstart',()=>{composing=true;close();});listen(editor,'compositionend',()=>{composing=false;});
  }
  listen(document,'pointerdown',event=>{if(!popup?.contains(event.target)&&!kinds.some(kind=>event.target===$(kind+'-editor')))close();},true);
  listen(document,'keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();close(true);}else if(event.key==='Escape')gesture=null;});
  listen(document,'visibilitychange',()=>{if(document.hidden)close();});
  listen(window,'blur',()=>{composing=false;close();});listen(window,'resize',()=>close());
  if(window.MutationObserver){
   observer=new window.MutationObserver(records=>{
    const changed=records.some(record=>{
     if(record.attributeName==='class'&&record.target!==document.body)return false;
     return record.oldValue!==record.target.getAttribute(record.attributeName);
    });
    if(changed)close();
   });
   observer.observe(document.body,{attributes:true,attributeOldValue:true,attributeFilter:['class','data-code-view','data-lesson-scene']});
   // Arrival highlights also change section classes. Their animation must not close a chooser.
   for(const kind of kinds){const section=$(kind+'-section');if(section)observer.observe(section,{attributes:true,attributeOldValue:true,attributeFilter:['style','hidden','inert','aria-hidden']});}
  }
 }
 function destroy(){close();for(const remove of listeners.splice(0))remove();observer?.disconnect();observer=null;popup?.remove();popup=list=title=null;for(const kind of kinds)$(kind+'-reference-hint')?.remove();initialized=false;composing=false;hooks={};}
 window.PixelCodeNavigation={init,close,refresh:close,destroy};
})();
