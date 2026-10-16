/* Hold Command over the source to read it. The editor's selection is never used. */
(function () {
 'use strict';
 const kinds=['html','css','js'];
 const copiedStyles=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontKerning','fontVariantLigatures','fontFeatureSettings','fontVariationSettings','letterSpacing','wordSpacing','textIndent','textTransform','textRendering','tabSize','direction'];
 const cache=new WeakMap();
 const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
 let initialized=false,held=false,dismissed=false,composing=false,pointer=null,frame=0,observer=null;
 let mirror,mirrorText,measureRange,tooltip,mark,label,kindText,meaning,change,example,activeEditor=null;
 let measuredLine='',measuredFont='',boundaries=[];
 const listeners=[];
 const platform=window.navigator?.userAgentData?.platform||window.navigator?.platform||'';
 const mac=!platform||/Mac|iPhone|iPad|iPod/i.test(platform);
 const number=value=>parseFloat(value)||0;
 const modifier=event=>mac?!!event.metaKey:!!event.ctrlKey;
 const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));};
 const create=(tag,className,parent)=>{const node=document.createElement(tag);if(className)node.className=className;if(parent)parent.appendChild(node);return node;};
 function ensureMirror(){
  if(mirror)return;
  mirror=create('div','code-help-measure',document.body);
  mirror.setAttribute('aria-hidden','true');
  Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',width:'max-content',height:'auto',margin:'0',padding:'0',border:'0',whiteSpace:'pre',overflowWrap:'normal',wordBreak:'normal',visibility:'hidden',pointerEvents:'none',contain:'layout style paint'});
  mirrorText=document.createTextNode('');mirror.appendChild(mirrorText);
  measureRange=document.createRange();
 }
 function sourceLines(editor){
  const source=editor.value;let entry=cache.get(editor);
  if(entry?.source===source)return entry;
  const lines=source.split('\n'),starts=[];let offset=0;
  for(const line of lines){starts.push(offset);offset+=line.length+1;}
  entry={source,lines,starts};cache.set(editor,entry);return entry;
 }
 function prepareLine(line,style){
  ensureMirror();
  const font=copiedStyles.map(name=>style[name]||'').join('|')+'|'+style.lineHeight;
  if(font!==measuredFont){for(const name of copiedStyles)mirror.style[name]=style[name]||'';mirror.style.lineHeight=style.lineHeight;measuredFont=font;}
  if(line!==measuredLine||!boundaries.length){
   mirrorText.data=line;measuredLine=line;boundaries=[0];
   if(segmenter){for(const part of segmenter.segment(line))boundaries.push(part.index+part.segment.length);}
   else{let offset=0;for(const point of line){offset+=point.length;boundaries.push(offset);}}
  }
 }
 function rangeRect(start,end){
  measureRange.setStart(mirrorText,start);measureRange.setEnd(mirrorText,end);
  return measureRange.getBoundingClientRect();
 }
 function visible(editor){
  if(!editor?.isConnected||document.hidden||editor.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
  const style=window.getComputedStyle(editor);
  if(style.display==='none'||style.visibility==='hidden')return false;
  const rect=editor.getBoundingClientRect();
  return rect.width>0&&rect.height>0&&editor.clientWidth>0&&editor.clientHeight>0;
 }
 /* Range uses the browser's real glyph positions: Japanese, tabs and emoji are not columns. */
 function hitTest(editor,x,y){
  if(!editor||!Number.isFinite(x)||!Number.isFinite(y)||!visible(editor))return null;
  const style=window.getComputedStyle(editor),rect=editor.getBoundingClientRect();
  const left=rect.left+(editor.clientLeft||number(style.borderLeftWidth));
  const top=rect.top+(editor.clientTop||number(style.borderTopWidth));
  const clip={left,top,right:left+editor.clientWidth,bottom:top+editor.clientHeight};
  if(x<left||x>=clip.right||y<top||y>=clip.bottom)return null;
  const lineHeight=number(style.lineHeight)||number(style.fontSize)*1.5;
  const source=sourceLines(editor),contentLeft=left+number(style.paddingLeft)-editor.scrollLeft;
  const contentTop=top+number(style.paddingTop)-editor.scrollTop;
  const row=Math.floor((y-contentTop)/lineHeight),line=source.lines[row];
  if(row<0||line===undefined||!line.length)return null;
  prepareLine(line,style);
  const origin=mirror.getBoundingClientRect().left,localX=x-contentLeft;
  const full=rangeRect(0,line.length);
  if(localX<0||localX>=full.right-origin)return null;
  let lo=1,hi=boundaries.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(rangeRect(0,boundaries[mid]).right-origin<=localX)lo=mid+1;else hi=mid;}
  const start=boundaries[lo-1],end=boundaries[lo],glyph=rangeRect(start,end);
  if(localX<glyph.left-origin||localX>=glyph.right-origin||/^\s+$/u.test(line.slice(start,end)))return null;
  return {index:source.starts[row]+start,end:source.starts[row]+end,row,lineStart:source.starts[row],lineEnd:source.starts[row]+line.length,line,source:source.source,clip,contentLeft,lineTop:contentTop+row*lineHeight,lineHeight,origin};
 }
 function ensureOverlay(){
  if(tooltip)return;
  mark=create('div','code-help-token',document.body);mark.hidden=true;mark.setAttribute('aria-hidden','true');
  tooltip=create('aside','code-help-tooltip',document.body);tooltip.id='code-help-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');
  const heading=create('div','code-help-heading',tooltip);
  kindText=create('span','code-help-kind',heading);label=create('code','code-help-label',heading);
  const list=create('dl','code-help-description',tooltip);
  create('dt','',list).textContent='意味';meaning=create('dd','',list);
  create('dt','',list).textContent='変えると';change=create('dd','',list);
  example=create('p','code-help-example',tooltip);example.hidden=true;
  create('p','code-help-release',tooltip).textContent=(mac?'⌘':'Ctrl')+'を離すと閉じます';
 }
 function removeDescription(editor){
  if(!editor)return;
  const ids=(editor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='code-help-tooltip');
  if(ids.length)editor.setAttribute('aria-describedby',ids.join(' '));else editor.removeAttribute('aria-describedby');
 }
 function hide(){
  if(frame){window.cancelAnimationFrame(frame);frame=0;}
  if(tooltip)tooltip.hidden=true;if(mark)mark.hidden=true;
  removeDescription(activeEditor);activeEditor=null;
 }
 function draw(hit,info){
  ensureOverlay();
  const editor=pointer.editor;
  if(activeEditor!==editor){removeDescription(activeEditor);const ids=(editor.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!ids.includes(tooltip.id))ids.push(tooltip.id);editor.setAttribute('aria-describedby',ids.join(' '));activeEditor=editor;}
  const fullTitle=String(info.label||hit.source.slice(info.start,info.end));
  const title=fullTitle.length>100?fullTitle.slice(0,99)+'…':fullTitle;
  kindText.textContent=String(info.kind||pointer.kind.toUpperCase());label.textContent=title;
  meaning.textContent=String(info.meaning||'');change.textContent=String(info.change||'');
  example.textContent=info.example?String(info.example):'';example.hidden=!info.example;
  const start=Math.max(hit.lineStart,info.start)-hit.lineStart,end=Math.min(hit.lineEnd,info.end)-hit.lineStart;
  const rect=start<end?rangeRect(start,end):null;
  if(rect){
   const left=Math.max(hit.clip.left,hit.contentLeft+rect.left-hit.origin),right=Math.min(hit.clip.right,hit.contentLeft+rect.right-hit.origin);
   const top=Math.max(hit.clip.top,hit.lineTop+2),bottom=Math.min(hit.clip.bottom,hit.lineTop+hit.lineHeight-2);
   mark.hidden=right<=left||bottom<=top;Object.assign(mark.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
  }else mark.hidden=true;
  tooltip.hidden=false;
  const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight,gap=12;
  tooltip.style.maxWidth=Math.max(160,Math.min(400,viewportWidth-gap*2))+'px';
  tooltip.style.maxHeight=Math.max(120,viewportHeight-gap*2)+'px';
  // Measure after filling the content; the popup lives outside the clipped editor.
  const box=tooltip.getBoundingClientRect();
  let x=pointer.x+20,y=pointer.y+24;
  if(x+box.width>viewportWidth-gap)x=pointer.x-box.width-20;
  if(y+box.height>viewportHeight-gap)y=pointer.y-box.height-18;
  x=Math.max(gap,Math.min(x,viewportWidth-box.width-gap));
  y=Math.max(gap,Math.min(y,viewportHeight-box.height-gap));
  tooltip.style.left=x+'px';tooltip.style.top=y+'px';
 }
 function refresh(){
  frame=0;
  if(!held||dismissed||composing||!pointer||!visible(pointer.editor)||document.querySelector('dialog[open]')){hide();return;}
  const hit=hitTest(pointer.editor,pointer.x,pointer.y);
  if(!hit){hide();return;}
  const provider=window.PixelCodeExplain?.[pointer.kind];
  if(typeof provider!=='function'){hide();return;}
  let info;try{info=provider(hit.source,hit.index);}catch(_){hide();return;}
  if(!info||!Number.isInteger(info.start)||!Number.isInteger(info.end)||info.start<0||info.end>hit.source.length||info.start>hit.index||info.end<=hit.index||!info.meaning||!info.change){hide();return;}
  draw(hit,info);
 }
 function schedule(){if(pointer&&held&&!dismissed&&!frame)frame=window.requestAnimationFrame(refresh);}
 function init(){
  if(initialized)return;initialized=true;ensureOverlay();
  document.querySelectorAll('[data-code-help-hint]').forEach(node=>{node.textContent='重ねて'+(mac?'⌘':'Ctrl')+'で説明';node.title='コードの上にポインターを置いて'+(mac?'⌘（Command）':'Ctrl')+'を押すと説明が出ます';});
  for(const kind of kinds){
   const editor=document.getElementById(kind+'-editor');if(!editor)continue;
   const move=event=>{
    if(event.pointerType==='touch')return;
    pointer={editor,kind,x:event.clientX,y:event.clientY};
    if(typeof event.metaKey==='boolean'||typeof event.ctrlKey==='boolean')held=modifier(event);
    if(!held){dismissed=false;hide();return;}if(event.buttons){hide();return;}schedule();
   };
   listen(editor,'pointermove',move);listen(editor,'pointerenter',move);
   listen(editor,'pointerleave',()=>{if(pointer?.editor===editor){pointer=null;hide();}});
   listen(editor,'scroll',()=>{if(pointer?.editor===editor&&held)schedule();});
   listen(editor,'input',()=>{cache.delete(editor);hide();});
   listen(editor,'compositionstart',()=>{composing=true;hide();});
   listen(editor,'compositionend',()=>{composing=false;});
  }
  listen(document,'keydown',event=>{
   if(event.key==='Escape'){dismissed=true;hide();return;}
   held=modifier(event);if(!held){hide();return;}if(!event.isComposing)schedule();
  });
  listen(document,'keyup',event=>{
   held=modifier(event)&&event.key!==(mac?'Meta':'Control');
   if(!held){dismissed=false;hide();}
  });
  listen(window,'blur',()=>{held=false;dismissed=false;pointer=null;hide();});
  listen(window,'resize',()=>{hide();});
  listen(document,'visibilitychange',()=>{if(document.hidden){held=false;pointer=null;hide();}});
  if(window.MutationObserver){
   observer=new window.MutationObserver(()=>hide());
   observer.observe(document.body,{attributes:true,attributeFilter:['class','data-code-view','data-lesson-scene']});
   for(const kind of kinds){const node=document.getElementById(kind+'-section');if(node)observer.observe(node,{attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden']});}
  }
 }
 function destroy(){hide();for(const remove of listeners.splice(0))remove();observer?.disconnect();observer=null;mirror?.remove();tooltip?.remove();mark?.remove();mirror=mirrorText=measureRange=tooltip=mark=label=kindText=meaning=change=example=null;measuredLine=measuredFont='';boundaries=[];initialized=false;held=false;pointer=null;}
 window.PixelCodeHelp={init,hide,refresh,destroy,hitTest};
})();
