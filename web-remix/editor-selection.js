/* Extend a text selection past the editor edges without moving the whole page. */
(function () {
 'use strict';
 const kinds=['html','css','js','challenge-html','challenge-css'];
 const fontProperties=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontKerning','fontVariantLigatures','fontFeatureSettings','fontVariationSettings','letterSpacing','wordSpacing','textIndent','textTransform','textRendering','tabSize','direction','lineHeight'];
 const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
 const listeners=[],lineCache=new WeakMap();
 let initialized=false,composing=false,drag=null,frame=0,mirror=null,textNode=null,range=null,measuredText=null,measuredFont='',boundaries=[];
 const number=value=>parseFloat(value)||0;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));};
 function cancel(){
  if(frame)window.cancelAnimationFrame(frame);frame=0;
  const previous=drag;drag=null;
  if(previous?.captured){try{previous.editor.releasePointerCapture(previous.pointerId);}catch(_){}}
 }
 function usable(editor){
  if(!editor?.isConnected||document.hidden||editor.disabled||editor.closest('[hidden],[inert],[aria-hidden="true"],dialog:not([open])'))return false;
  const modal=[...document.querySelectorAll('dialog[open]')].at(-1);
  if(modal&&editor.closest('dialog[open]')!==modal)return false;
  const style=window.getComputedStyle?.(editor);
  return !!style&&style.display!=='none'&&style.visibility!=='hidden'&&editor.clientWidth>0&&editor.clientHeight>0;
 }
 function geometry(editor){
  const style=window.getComputedStyle(editor),box=editor.getBoundingClientRect();
  const left=box.left+(editor.clientLeft||number(style.borderLeftWidth)),top=box.top+(editor.clientTop||number(style.borderTopWidth));
  return {style,left,top,right:left+editor.clientWidth,bottom:top+editor.clientHeight,lineHeight:number(style.lineHeight)||number(style.fontSize)*1.5};
 }
 function lines(editor){
  let entry=lineCache.get(editor);if(entry?.source===editor.value)return entry;
  const rows=editor.value.split('\n'),starts=[];let offset=0;
  for(const row of rows){starts.push(offset);offset+=row.length+1;}
  entry={source:editor.value,rows,starts};lineCache.set(editor,entry);return entry;
 }
 function prepare(text,style){
  if(!mirror){
   mirror=document.createElement('div');mirror.className='editor-selection-measure';mirror.setAttribute('aria-hidden','true');
   Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',width:'max-content',height:'auto',margin:'0',padding:'0',border:'0',whiteSpace:'pre',overflowWrap:'normal',wordBreak:'normal',visibility:'hidden',pointerEvents:'none',contain:'layout style paint'});
   textNode=document.createTextNode('');mirror.appendChild(textNode);document.body.appendChild(mirror);range=document.createRange();
  }
  const font=fontProperties.map(key=>style[key]||'').join('|');
  if(font!==measuredFont){for(const key of fontProperties)mirror.style[key]=style[key]||'';measuredFont=font;}
  if(text!==measuredText){
   textNode.data=text;measuredText=text;boundaries=[0];
   if(segmenter){for(const part of segmenter.segment(text))boundaries.push(part.index+part.segment.length);}
   else{let offset=0;for(const point of text){offset+=point.length;boundaries.push(offset);}}
  }
 }
 function widthTo(index,origin){if(!index)return 0;range.setStart(textNode,0);range.setEnd(textNode,index);return range.getBoundingClientRect().right-origin;}
 /* Unlike a token hit test, a caret may sit on a blank line or after its last character. */
 function caretIndex(editor,x,y){
  if(!usable(editor)||!Number.isFinite(x)||!Number.isFinite(y)||typeof document.createRange!=='function')return null;
  const g=geometry(editor),source=lines(editor),contentTop=g.top+number(g.style.paddingTop)-editor.scrollTop;
  const row=clamp(Math.floor((y-contentTop)/g.lineHeight),0,source.rows.length-1),text=source.rows[row];
  if(!text.length)return source.starts[row];
  prepare(text,g.style);
  const local=x-(g.left+number(g.style.paddingLeft)-editor.scrollLeft),origin=mirror.getBoundingClientRect().left;
  if(local<=0)return source.starts[row];
  if(local>=widthTo(text.length,origin))return source.starts[row]+text.length;
  let low=0,high=boundaries.length-1;
  while(low<high){const middle=(low+high)>>1;if(widthTo(boundaries[middle],origin)<local)low=middle+1;else high=middle;}
  const before=boundaries[Math.max(0,low-1)],after=boundaries[low],midpoint=(widthTo(before,origin)+widthTo(after,origin))/2;
  return source.starts[row]+(local<midpoint?before:after);
 }
 function velocity(position,start,end){
  const band=Math.min(30,(end-start)/4),maximum=12;
  if(position<start+band)return -maximum*clamp((start+band-position)/band,0,1);
  if(position>end-band)return maximum*clamp((position-end+band)/band,0,1);
  return 0;
 }
 function schedule(){if(drag&&!frame)frame=window.requestAnimationFrame(tick);}
 function tick(time){
  frame=0;const current=drag;
  if(!current)return;
  if(!current.moved){
   // The compatibility mousedown event has also run by the next animation frame.
   // Reading earlier in a microtask can still see the caret from a previous click.
   if(current.editor.selectionStart===current.editor.selectionEnd&&Number.isInteger(current.editor.selectionStart))current.anchor=current.editor.selectionStart;
   return;
  }
  const editor=current.editor;
  if(composing||!usable(editor)||editor.value!==current.source){cancel();return;}
  const g=geometry(editor),scale=current.time?clamp((time-current.time)/16.667,0.5,2):1;current.time=time;
  const vx=velocity(current.x,g.left,g.right),vy=velocity(current.y,g.top,g.bottom);
  if(vx||vy){
   current.controlled=true;
   if(!current.captured&&editor.setPointerCapture){try{editor.setPointerCapture(current.pointerId);current.captured=true;}catch(_){}}
  }
  if(!current.controlled&&!current.scrolled)return;
  const oldTop=editor.scrollTop,oldLeft=editor.scrollLeft;
  const top=clamp(oldTop+vy*scale,0,Math.max(0,editor.scrollHeight-editor.clientHeight));
  const left=clamp(oldLeft+vx*scale,0,Math.max(0,editor.scrollWidth-editor.clientWidth));
  editor.scrollTop=top;editor.scrollLeft=left;
  const index=caretIndex(editor,clamp(current.x,g.left,g.right-1),clamp(current.y,g.top,g.bottom-1));
  if(index!==null){
   const start=Math.min(current.anchor,index),end=Math.max(current.anchor,index),direction=index<current.anchor?'backward':'forward';
   if(editor.selectionStart!==start||editor.selectionEnd!==end||editor.selectionDirection!==direction)editor.setSelectionRange(start,end,direction);
   // Safari may reveal the caret after setSelectionRange. Keep the deliberate edge scroll.
   editor.scrollTop=top;editor.scrollLeft=left;
  }
  current.scrolled=false;
  if(oldTop!==editor.scrollTop||oldLeft!==editor.scrollLeft){
   current.syncing=true;editor.dispatchEvent(new window.Event('scroll'));current.syncing=false;
  }
  if(drag===current&&(vx||vy))schedule();
 }
 function init(){
  if(initialized)return;initialized=true;
  for(const kind of kinds){
   const editor=document.getElementById(kind+'-editor');if(!editor)continue;
   listen(editor,'pointerdown',event=>{
    cancel();
    if(event.defaultPrevented||composing||event.isComposing||event.button!==0||event.isPrimary===false||event.pointerType==='touch'||event.shiftKey||event.metaKey||event.ctrlKey||event.altKey||event.detail>1||!usable(editor))return;
    const g=geometry(editor);
    // A scrollbar drag must remain a scrollbar drag.
    if(event.clientX<g.left||event.clientX>=g.right||event.clientY<g.top||event.clientY>=g.bottom)return;
    const anchor=caretIndex(editor,event.clientX,event.clientY);if(anchor===null)return;
    const current={editor,source:editor.value,pointerId:event.pointerId,anchor,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,controlled:false,scrolled:false,syncing:false,time:0};drag=current;
    // Retain the geometric anchor if a drag begins before the next frame.
    schedule();
   });
   listen(editor,'scroll',()=>{if(drag?.editor===editor&&drag.moved&&!drag.syncing){drag.scrolled=true;schedule();}});
   listen(editor,'input',()=>{lineCache.delete(editor);if(drag?.editor===editor)cancel();});
   listen(editor,'dragstart',cancel);
   listen(editor,'lostpointercapture',()=>{if(drag?.editor===editor)cancel();});
   listen(editor,'compositionstart',()=>{composing=true;cancel();});
   listen(editor,'compositionend',()=>{composing=false;});
  }
  listen(document,'pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointerId)return;
   if(!(event.buttons&1)){cancel();return;}
   if(event.shiftKey||event.metaKey||event.ctrlKey||event.altKey){cancel();return;}
   drag.x=event.clientX;drag.y=event.clientY;
   if(!drag.moved&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<4)return;
   drag.moved=true;window.PixelCodeHelp?.hide();schedule();
  });
  listen(document,'pointerup',event=>{if(drag&&event.pointerId===drag.pointerId)cancel();});
  listen(document,'pointercancel',cancel);
  listen(document,'keydown',event=>{if(event.key==='Escape'||event.key==='Meta'||event.key==='Control'||event.key==='Alt'||event.key==='Shift')cancel();});
  listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen(window,'blur',()=>{composing=false;cancel();});listen(window,'resize',cancel);
 }
 function destroy(){cancel();for(const remove of listeners.splice(0))remove();mirror?.remove();mirror=textNode=range=null;measuredText=null;measuredFont='';boundaries=[];initialized=false;composing=false;}
 window.PixelEditorSelection={init,cancel,destroy,caretIndex};
})();
