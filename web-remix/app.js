(function(){
'use strict';
const C=window.PixelCore,P=window.PixelPreview,$=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)],STORAGE='pixel-page-student:v1';
let work=C.initial(),past=[],future=[],tour=-1,demo=false,tourPage=null,tourView='both',ready=false,renderTimer,historyTimer,historyOpen=false,toastTimer,split=44,escapeTab=false,hoverInfo=null,hoverRange=null,nav=[],navAt=0,hasSavedWork=false,sessionActive=false,starterId='mint',selectedCharacter='mint',selectedSkills=[],arrivalTimer;
try{const raw=localStorage.getItem(STORAGE);if(raw){const prior=JSON.parse(raw);work=C.normalize(prior);hasSavedWork=true;}}catch(e){}
nav=[work.activePage];starterId=profileCharacter(work.html);selectedCharacter=starterId;
function profileCharacter(html){
 const image=new DOMParser().parseFromString(html,'text/html').querySelector('img.character'),declared=image?.getAttribute('data-character'),src=image?.getAttribute('src')||'';
 return Object.hasOwn(C.CHARACTERS,declared)?declared:Object.keys(C.CHARACTERS).find(id=>src==='assets/'+id+'.svg')||starterId;
}
const active=()=>{if(tour<0)return work;const s=C.tourState(tour,demo);if(tourPage)s.activePage=tourPage;return s;};
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(work));$('save-status').textContent='このブラウザに保存済み';}catch(e){$('save-status').textContent='自動保存できません。編集データを保存してください';}}
function closeHistory(){clearTimeout(historyTimer);historyOpen=false;}
function checkpoint(){past.push(C.clone(work));if(past.length>40)past.shift();future=[];}
function edit(mutator){clearTimeout(renderTimer);closeHistory();const wasTour=tour>=0;tour=-1;demo=false;tourPage=null;if(wasTour)window.PixelLesson?.setView(tourView);checkpoint();mutator(work);hoverInfo=null;hoverRange=null;syncEditors();renderUI();sendPreview();save();window.PixelImages?.refresh();}
function beginTyping(){if(!historyOpen){checkpoint();historyOpen=true;}clearTimeout(historyTimer);historyTimer=setTimeout(closeHistory,900);}
function updateSyntax(kind){const input=$(kind+'-editor');$(kind+'-highlight').innerHTML=C.highlight(input.value,kind);$(kind+'-lines').textContent=Array.from({length:input.value.split('\n').length},(_,i)=>i+1).join('\n');syncScroll(kind);}
function syncScroll(kind){
 const input=$(kind+'-editor'),syntax=$(kind+'-highlight'),lines=$(kind+'-lines');
 // A single scroll surface avoids independently clamped scroll ranges in <pre> and <textarea>.
 syntax.scrollTop=0;syntax.scrollLeft=0;lines.scrollTop=0;
 syntax.style.transform='translate('+(-input.scrollLeft)+'px, '+(-input.scrollTop)+'px)';
 lines.style.transform='translateY('+(-input.scrollTop)+'px)';
 if(kind==='html')drawCodeGlow();
}
function drawCodeGlow(){
 const el=$('html-editor'),g=$('html-glow');g.hidden=!hoverRange;if(!hoverRange)return;
 const style=getComputedStyle(el),h=parseFloat(style.lineHeight)||30;
 const start=Math.max(0,Math.min(el.value.length,hoverRange.start));
 const end=Math.max(start,Math.min(el.value.length,hoverRange.end));
 const row=el.value.slice(0,start).split('\n').length-1;
 const lastRow=el.value.slice(0,Math.max(start,end-1)).split('\n').length-1;
 g.style.top=((el.offsetTop||0)+(el.clientTop||0)+(parseFloat(style.paddingTop)||0)+row*h-el.scrollTop)+'px';
 g.style.height=((lastRow-row+1)*h)+'px';
 const border=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
 g.style.right=Math.max(0,(el.offsetWidth||0)-(el.clientWidth||0)-border)+'px';
}
function syncEditors(){window.PixelEditorSelection?.cancel();window.PixelCodeNavigation?.close();window.PixelCodeHelp?.hide();const s=active();for(const k of ['html','css']){const el=$(k+'-editor');el.value=k==='html'?C.pageSource(s):s.css;el.readOnly=tour>=0;el.setAttribute('aria-readonly',String(tour>=0));updateSyntax(k);}}
function queueRender(){clearTimeout(renderTimer);$('live-status').textContent='入力中…';renderTimer=setTimeout(()=>{sendPreview();save();renderUI();},220);}
function onInput(kind,event){window.PixelCodeNavigation?.close();updateSyntax(kind);if(tour>=0||event?.isComposing)return;beginTyping();if(kind==='html')C.setPageSource(work,$('html-editor').value);else work.css=$('css-editor').value;hoverInfo=null;hoverRange=null;drawCodeGlow();queueRender();}
for(const k of ['html','css']){const el=$(k+'-editor');el.addEventListener('input',e=>onInput(k,e));el.addEventListener('compositionend',()=>onInput(k));el.addEventListener('scroll',()=>syncScroll(k));el.addEventListener('click',()=>position(k));el.addEventListener('keyup',()=>position(k));el.addEventListener('keydown',e=>{if(e.key==='Escape'){escapeTab=true;return;}if(e.key==='Tab'&&!el.readOnly&&!escapeTab){e.preventDefault();el.setRangeText('  ',el.selectionStart,el.selectionEnd,'end');onInput(k);}else escapeTab=false;if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();clearTimeout(renderTimer);sendPreview();save();}});}
function position(kind){const el=$(kind+'-editor'),before=el.value.slice(0,el.selectionStart),row=before.split('\n');$(kind+'-position').textContent=row.length+'行 / '+(row.at(-1).length+1)+'列';}
function selectCode(kind,needle,focus=true){
 window.PixelCodeNavigation?.close();
 const el=$(kind+'-editor'),rawStart=typeof needle==='object'?needle.start:el.value.indexOf(needle);
 if(!Number.isInteger(rawStart)||rawStart<0||rawStart>el.value.length)return false;
 const start=rawStart,rawEnd=typeof needle==='object'?needle.end:start+needle.length;
 const end=Math.max(start,Math.min(el.value.length,Number.isInteger(rawEnd)?rawEnd:start));
 if(focus){
  window.PixelLesson?.reveal(kind);expandPreview(false);
  document.querySelector('.editors').classList.remove('max-'+(kind==='html'?'css':'html'));
  el.focus({preventScroll:true});el.setSelectionRange(start,end);
 }
 const style=getComputedStyle(el),h=parseFloat(style.lineHeight)||30;
 if(focus||!['html-editor','css-editor','js-editor'].includes(document.activeElement?.id)){
  const before=el.value.slice(0,start),row=before.split('\n').length-1;
  const targetHeight=Math.min(3,el.value.slice(start,end).split('\n').length)*h;
  const context=Math.max(h,((el.clientHeight||h*5)-targetHeight)/2);
  el.scrollTop=Math.max(0,(parseFloat(style.paddingTop)||0)+row*h-context);
  el.scrollLeft=0;
  if(focus){
   // Measure the real prefix: Japanese glyphs and tabs are not a fixed fraction of font-size.
   const probe=document.createElement('span');
   probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;white-space:pre;width:max-content;padding:0;border:0;margin:0;';
   for(const property of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','fontKerning','fontFeatureSettings','fontVariantLigatures','tabSize'])if(style[property])probe.style[property]=style[property];
   probe.textContent=before.split('\n').at(-1);el.parentNode.appendChild(probe);
   const width=probe.getBoundingClientRect().width;probe.remove();
   el.scrollLeft=Math.max(0,width-Math.max(0,(el.clientWidth||0)*.2));
  }
 }
 syncScroll(kind);if(focus)position(kind);return true;
}
function sendPreview(scroll=false){if(!ready)return;const s=active(),data=P.renderData(s),item=C.TOURS[tour];let selector='';if(item)selector=demo&&item.afterSelector?item.afterSelector:item.selector;
 $('code-error').hidden=!data.warnings.length;$('code-error').textContent=data.warnings.join(' ');
 $('preview').contentWindow.postMessage({type:'pixel-render',...data,touring:tour>=0,selector,scroll},'*');$('live-status').textContent=tour>=0?'ツアーの見本':'反映済み';}
function navigate(page,hash='',fromHistory=false){if(!['index.html','about.html'].includes(page))return;clearTimeout(renderTimer);closeHistory();if(tour>=0){tourPage=page;}else{if(!fromHistory&&page!==work.activePage){nav=nav.slice(0,navAt+1);nav.push(page);navAt=nav.length-1;}work.activePage=page;save();}hoverInfo=null;hoverRange=null;syncEditors();renderUI();sendPreview();if(hash)setTimeout(()=>$('preview').contentWindow.postMessage({type:'pixel-scroll',hash},'*'),80);}
function historyMove(redo=false){const from=redo?future:past,to=redo?past:future;if(!from.length)return;clearTimeout(renderTimer);closeHistory();to.push(C.clone(work));work=from.pop();const wasTour=tour>=0;tour=-1;demo=false;tourPage=null;if(wasTour)window.PixelLesson?.setView(tourView);hoverInfo=null;hoverRange=null;nav=[work.activePage];navAt=0;syncEditors();renderUI();sendPreview();save();window.PixelImages?.refresh();}
function receiveInfo(d,focus){if(tour>=0)return;const range=C.sourceRange(C.pageSource(work),d);if(!range)return;hoverInfo=d;hoverRange=range;const row=$('html-editor').value.slice(0,range.start).split('\n').length;$('selected-tag').textContent='<'+d.tag+'>';$('html-match').textContent=row+'行目：<'+d.tag+'>';selectCode('html',range,focus);drawCodeGlow();renderUI();if(focus){showArrival('html');toast('<'+d.tag+'> → HTMLの'+row+'行目');}}
window.addEventListener('message',event=>{if(event.source!==$('preview').contentWindow)return;const d=event.data;if(d?.type==='pixel-ready'){ready=true;sendPreview();}else if(d?.type==='pixel-locate'&&typeof d.tag==='string'){receiveInfo(d,true);}else if(d?.type==='pixel-character'){expandPreview(false);window.PixelPalette?.close(false);window.PixelFonts?.close(false);window.PixelStudio?.open(d);}else if(d?.type==='pixel-skill-place'&&typeof d.id==='string'&&Number.isInteger(d.index)&&d.index>=0&&d.index<3&&tour<0&&work.activePage==='index.html'){window.PixelSkills?.put(d.id,d.index);}else if(d?.type==='pixel-skill-reorder'&&Array.isArray(d.ids)&&tour<0){window.PixelSkills?.reorder(d.ids);}else if(d?.type==='pixel-navigate'){navigate(d.page,d.hash);}else if(d?.type==='pixel-history'){historyMove(d.redo);}else if(d?.type==='pixel-escape'){expandPreview(false);}});
function renderUI(){window.PixelSkills?.refresh();window.PixelStudio?.refresh();const inTour=tour>=0,s=active();document.body.classList.toggle('touring',inTour);$('tour-panel').hidden=!inTour;$('edit-mode').setAttribute('aria-pressed',String(!inTour));$('tour-mode').setAttribute('aria-pressed',String(inTour));$('undo').disabled=!past.length;$('redo').disabled=!future.length;$('assets-open').disabled=inTour;$('character-open').disabled=inTour;$('skills-open').disabled=inTour;
 all('[data-theme]').forEach(el=>{el.disabled=inTour;el.setAttribute('aria-pressed',String(el.dataset.theme===s.theme));});$('css-toggle').disabled=inTour;$('css-toggle').setAttribute('aria-checked',String(s.cssEnabled));$('css-toggle').textContent=s.cssEnabled?'CSSあり':'CSSなし';
 all('[data-page]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.page===s.activePage)));$('html-filename').textContent=s.activePage;$('preview-address').textContent=s.activePage;$('preview-title').textContent=s.activePage==='about.html'?'もっと見る':'キャラ紹介';$('page-back').disabled=inTour||navAt===0;$('page-forward').disabled=inTour||navAt>=nav.length-1;const codeOpen=document.body.dataset.codeView!=='page';$('locate-code').disabled=inTour;$('locate-code').setAttribute('aria-expanded',String(codeOpen));$('locate-code').querySelector('span').textContent=codeOpen?'コードを隠す':'コードを見る';$('locate-code').title=inTour?'ツアーを閉じるとコードの表示を切り替えられます':codeOpen?'コードを隠してページだけ表示する':'前に見ていたコードを表示する';
 $('work-note').textContent=inTour?'説明用の見本です。作品は残っています。':'⌘Zで戻す / ⇧⌘Zで進む';
 if(inTour){const t=C.TOURS[tour];$('tour-counter').textContent=(tour+1)+' / '+C.TOURS.length;$('tour-title').textContent=t.title;$('tour-description').textContent=t.description;$('tour-note').textContent=t.note;$('tour-code').textContent=demo?t.after:t.code;$('tour-demo').textContent=demo?'元の表示':t.button;$('tour-prev').disabled=tour===0;$('tour-next').textContent=tour===C.TOURS.length-1?'作品に戻る →':'次へ →';$('selected-tag').textContent=t.tag+' の場所';$('preview-tip').textContent=tour===3&&s.activePage==='about.html'?'別のHTMLファイルに移動しました。リンク先の内容を見てみよう。':'青い枠が今説明している部分です。';all('[data-tour]').forEach(x=>x.setAttribute('aria-current',Number(x.dataset.tour)===tour?'step':'false'));}
 else{$('selected-tag').textContent=hoverInfo?'<'+hoverInfo.tag+'>':'';$('preview-tip').textContent='⌘＋クリックでコードへ（WindowsはCtrl）';if(!hoverInfo)$('html-match').textContent='';}
}
function tourHighlight(){const t=C.TOURS[tour];if(!t)return;if(tour===3&&active().activePage==='about.html'){selectCode('html','class="about-heading"',false);return;}selectCode('html',demo&&tour===0?'<h1>ソラ</h1>':t.needle,false);if(t.cssNeedle)selectCode('css',tour===5&&!demo?'.card {':t.cssNeedle,false);}
function startTour(n=0){window.PixelSkills?.close();window.PixelStudio?.close();window.PixelPalette?.close(false);window.PixelFonts?.close(false);if(tour<0)tourView=window.PixelLesson?.getView()||'both';window.PixelLesson?.setView('both',{remember:false});clearTimeout(renderTimer);closeHistory();tour=n;demo=false;tourPage=null;hoverInfo=null;hoverRange=null;syncEditors();renderUI();sendPreview(true);tourHighlight();}
function leaveTour(){if(tour<0)return;tour=-1;demo=false;tourPage=null;window.PixelLesson?.setView(tourView);syncEditors();renderUI();sendPreview();save();}
$('tour-steps').innerHTML=C.TOURS.map((x,i)=>'<button data-tour="'+i+'"><span>'+String(i+1).padStart(2,'0')+'</span> '+C.escapeHTML(x.tag)+'</button>').join('');
all('[data-tour]').forEach(x=>x.addEventListener('click',()=>startTour(Number(x.dataset.tour))));$('tour-mode').addEventListener('click',()=>startTour());$('edit-mode').addEventListener('click',leaveTour);$('tour-close').addEventListener('click',leaveTour);$('tour-prev').addEventListener('click',()=>startTour(Math.max(0,tour-1)));$('tour-next').addEventListener('click',()=>tour===C.TOURS.length-1?leaveTour():startTour(tour+1));$('tour-demo').addEventListener('click',()=>{demo=!demo;tourPage=null;syncEditors();renderUI();sendPreview(true);tourHighlight();});
all('[data-page]').forEach(el=>el.addEventListener('click',()=>{leaveTour();navigate(el.dataset.page);}));$('page-back').addEventListener('click',()=>{if(navAt>0)navigate(nav[--navAt],'',true);});$('page-forward').addEventListener('click',()=>{if(navAt<nav.length-1)navigate(nav[++navAt],'',true);});
function showArrival(kind){for(const k of ['html','css','js'])$(k+'-section').classList.remove('code-arrival');clearTimeout(arrivalTimer);const el=$(kind+'-section');void el.offsetWidth;el.classList.add('code-arrival');arrivalTimer=setTimeout(()=>el.classList.remove('code-arrival'),1400);}
all('[data-theme]').forEach(el=>el.addEventListener('click',()=>{
 edit(s=>{s.theme=el.dataset.theme;s.css=C.themeCSS(s.theme);s.cssEnabled=true;});
 const extra=C.THEMES[work.theme].extra,offset=extra?C.COMMON_CSS.length:0;
 const start=work.css.indexOf('body {',offset),end=work.css.indexOf('}',start)+1;
 selectCode('css',{start:Math.max(0,start),end:end>start?end:Math.max(0,start)+20},true);showArrival('css');
 document.querySelector('.tools-menu').open=false;
 toast('「'+C.THEMES[work.theme].name+'」のCSSに切り替えました。');
}));
$('css-toggle').addEventListener('click',()=>edit(s=>s.cssEnabled=!s.cssEnabled));$('locate-code').addEventListener('click',()=>{if(tour<0)window.PixelLesson?.toggleCode();});
$('undo').addEventListener('click',()=>historyMove());$('redo').addEventListener('click',()=>historyMove(true));
function closeReset(){document.querySelector('.reset-menu').open=false;}
function currentStartingWork(){
 const profile=new DOMParser().parseFromString(work.html,'text/html');
 const skills=[...profile.querySelectorAll('ul.skills button[data-skill]')].map(el=>el.getAttribute('data-skill'));
 return C.initial(profileCharacter(work.html),skills);
}
$('reset-page').addEventListener('click',()=>{const page=work.activePage,initial=currentStartingWork();edit(s=>C.setPageSource(s,C.pageSource(initial,page),page));closeReset();toast(page+'を最初のHTMLに戻しました。CSSと画像一覧は残っています。');});
$('reset').addEventListener('click',openSelection);
$('restart-open').addEventListener('click',openSelection);
function expandPreview(on){window.PixelCodeNavigation?.close();if(on)window.PixelFonts?.close(false);document.body.classList.toggle('preview-expanded',on);$('preview-expand').textContent=on?'×':'⤢';$('preview-expand').setAttribute('aria-label',on?'編集画面に戻す':'表示結果を大きくする');}
$('preview-expand').addEventListener('click',()=>{window.PixelStudio?.close();expandPreview(!document.body.classList.contains('preview-expanded'));});
document.addEventListener('keydown',e=>{if(window.PixelChallenge?.isOpen())return;if(e.key==='Escape'){expandPreview(false);closeReset();}if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())&&!e.isComposing){const target=e.target,editable=target?.matches('input,textarea,[contenteditable="true"]');if(editable&&!['html-editor','css-editor','js-editor'].includes(target.id))return;e.preventDefault();historyMove(e.key.toLowerCase()==='y'||e.shiftKey);}});
all('[data-maximize]').forEach(el=>el.addEventListener('click',()=>{const kind=el.dataset.maximize;window.PixelLesson?.setView(window.PixelLesson.getView()===kind?'both':kind);}));
function setSplit(n){split=Math.min(65,Math.max(30,n));$('workspace').style.setProperty('--editor-width',split+'%');$('splitter').setAttribute('aria-valuenow',String(Math.round(split)));}
$('splitter').addEventListener('pointerdown',e=>{e.preventDefault();$('splitter').setPointerCapture(e.pointerId);document.body.classList.add('resizing');});$('splitter').addEventListener('pointermove',e=>{if(!$('splitter').hasPointerCapture(e.pointerId))return;const r=$('workspace').getBoundingClientRect();setSplit((e.clientX-r.left)/r.width*100);});for(const ev of ['pointerup','pointercancel'])$('splitter').addEventListener(ev,e=>{if($('splitter').hasPointerCapture(e.pointerId))$('splitter').releasePointerCapture(e.pointerId);document.body.classList.remove('resizing');});$('splitter').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setSplit(split+(e.key==='ArrowLeft'?-2:2));}});

function openDialog(id){window.PixelSkills?.close();window.PixelCodeNavigation?.close();window.PixelCodeHelp?.hide();window.PixelPalette?.close(false);window.PixelFonts?.close(false);closeHistory();if(id==='export-dialog')refreshExport();if(id==='assets-dialog')window.PixelImages?.refresh();$(id).showModal();}

for(const [button,id]of [['help-open','help-dialog'],['assets-open','assets-dialog'],['export-open','export-dialog'],['html-find','reference-dialog'],['css-tip','reference-dialog']])$(button).addEventListener('click',()=>openDialog(id));all('.close-dialog').forEach(x=>x.addEventListener('click',()=>x.closest('dialog').close()));
all('dialog').forEach(el=>el.addEventListener('click',e=>{if(e.target!==el)return;const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el.close();}));
window.PixelImages?.init({getState:()=>work,commit:edit,notify:toast,onApplied:({path,htmlNeedle})=>{$('assets-dialog').close();selectCode('html',htmlNeedle||('src="'+path+'"'));toast('画像を入れ替えました。srcに画像の場所が入っています。');}});
function refreshExport(){$('codepen-note').hidden=false;$('export-code').value=$('copy-kind').value==='html'?C.embedAssets(C.pageSource(work),window.PIXEL_ART,work.assets):work.css;}$('copy-kind').addEventListener('change',refreshExport);
async function copy(kind){const source=kind==='html'?C.embedAssets(C.pageSource(work),window.PIXEL_ART,work.assets):work.css;try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(source);toast(kind.toUpperCase()+'をコピーしました。');}catch(e){$('copy-kind').value=kind;refreshExport();$('manual-copy').open=true;$('export-code').focus();$('export-code').select();toast('コードを選択しました。⌘Cでコピーできます。');}}
$('copy-html').addEventListener('click',()=>copy('html'));$('copy-css').addEventListener('click',()=>copy('css'));
function download(name,source,type){const url=URL.createObjectURL(new Blob([source],{type})),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('download-html').addEventListener('click',()=>{download('my-character.html',P.fullExport(work),'text/html;charset=utf-8');toast('2ページと画像、特技の動きをまとめて保存しました。');});$('save-project').addEventListener('click',()=>{download('character-page-student.json',JSON.stringify(work,null,2),'application/json');toast('編集データを保存しました。');});$('load-project').addEventListener('click',()=>$('project-file').click());$('project-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>6000000)throw new Error('この教材で保存したJSONを選んでください。最大6MBまで読み込めます。');const next=C.normalize(JSON.parse(await file.text()));edit(s=>Object.assign(s,next));nav=[work.activePage];navAt=0;renderUI();$('export-dialog').close();toast('編集データを読み込みました。');}catch(err){toast(err instanceof SyntaxError?'JSONファイルを読み取れませんでした。':err.message);}finally{$('project-file').value='';}});
$('to-codepen').addEventListener('click',()=>{const form=document.createElement('form');form.method='POST';form.action='https://codepen.io/pen/define/';form.target='_blank';form.rel='noopener';const data=document.createElement('input');data.type='hidden';data.name='data';data.value=JSON.stringify(P.codepenData(work));form.append(data);document.body.append(form);form.submit();form.remove();toast('CodePenへコードを送りました。');});
function openSelection(){window.PixelSkills?.close();window.PixelStudio?.close();window.PixelPalette?.close(false);window.PixelFonts?.close(false);leaveTour();closeReset();expandPreview(false);document.querySelector('.tools-menu').open=false;for(const d of all('dialog'))if(d.open)d.close();$('character-select').hidden=false;document.body.classList.add('selecting');$('resume-work').hidden=!(hasSavedWork||sessionActive);renderCharacterChoice();$('start-character').focus();}
function closeSelection(){document.body.classList.remove('selecting');$('character-select').hidden=true;sessionActive=true;hasSavedWork=true;save();}
function renderCharacterChoice(){
 all('[data-character]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.character===selectedCharacter)));
 const c=C.CHARACTERS[selectedCharacter];$('selected-character-name').textContent=c.name;$('character-description').textContent=c.bio||c.alt;
 const available=c.skills||['jump','dash','shield'];
 $('skill-options').innerHTML=available.map(id=>{const skill=C.SKILLS[id],selected=selectedSkills.includes(id);return '<button class="skill-choice" data-skill-choice="'+id+'" aria-pressed="'+selected+'"'+(!selected&&selectedSkills.length>=3?' disabled':'')+'><strong>'+C.escapeHTML(skill.name)+'</strong><small>'+C.escapeHTML(skill.description)+'</small></button>';}).join('');
 all('[data-skill-choice]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.skillChoice;if(selectedSkills.includes(id))selectedSkills=selectedSkills.filter(x=>x!==id);else if(selectedSkills.length<3)selectedSkills.push(id);renderCharacterChoice();document.querySelector('[data-skill-choice="'+id+'"]').focus({preventScroll:true});}));
 $('skill-count').textContent=selectedSkills.length+' / 3';$('start-character').disabled=!selectedSkills.length;
}
function initSelection(){
 $('character-grid').innerHTML=Object.entries(C.CHARACTERS).map(([id,c])=>'<button class="character-choice" data-character="'+id+'" aria-pressed="'+String(id===selectedCharacter)+'"><img src="assets/'+id+'.svg" alt="'+C.escapeHTML(c.alt)+'"><strong>'+C.escapeHTML(c.name)+'</strong><span>'+C.escapeHTML(c.category||'')+'</span></button>').join('');
 selectedSkills=(C.CHARACTERS[selectedCharacter].skills||['jump','dash','shield']).slice(0,3);
 all('[data-character]').forEach(el=>el.addEventListener('click',()=>{if(selectedCharacter!==el.dataset.character){selectedCharacter=el.dataset.character;selectedSkills=C.CHARACTERS[selectedCharacter].skills.slice(0,3);}renderCharacterChoice();}));
 $('start-character').addEventListener('click',()=>{if(!selectedSkills.length)return;const first=!hasSavedWork&&!sessionActive;starterId=selectedCharacter;edit(s=>Object.assign(s,C.initial(starterId,selectedSkills)));if(first){past=[];future=[];}nav=[work.activePage];navAt=0;closeSelection();window.PixelLesson?.choose('touch');renderUI();});
 $('resume-work').addEventListener('click',()=>{if(hasSavedWork||sessionActive){closeSelection();renderUI();}});
 $('resume-work').hidden=!hasSavedWork;renderCharacterChoice();
}
const jsSource=window.PIXEL_ACTION_LOGIC_SOURCE||window.PIXEL_ACTION_SOURCE||'';$('js-editor').value=jsSource;$('js-highlight').innerHTML=C.highlight(jsSource,'js');$('js-lines').textContent=Array.from({length:jsSource.split('\n').length},(_,i)=>i+1).join('\n');
$('js-editor').addEventListener('scroll',()=>syncScroll('js'));$('js-editor').addEventListener('click',()=>position('js'));$('js-editor').addEventListener('keyup',()=>position('js'));
window.PixelLesson?.init({getSource:()=>C.pageSource(work),getCSS:()=>work.css,showArrival,leaveTour,navigate,selectCode,openDialog,expandPreview,notify:toast,testSkill:()=>{if(ready)$('preview').contentWindow.postMessage({type:'pixel-test-skill'},'*');},onViewChange:()=>{window.PixelCodeNavigation?.close();renderUI();for(const k of ['html','css','js'])syncScroll(k);}});
window.PixelPalette?.init({notify:toast});
window.PixelFonts?.init({notify:toast,goToPaste:()=>{leaveTour();expandPreview(false);const end=$('css-editor').value.length;selectCode('css',{start:end,end});showArrival('css');}});
window.PixelStudio?.init({getState:()=>work,commit:edit,selectCode,showArrival,navigate,notify:toast,leaveTour,setView:kind=>window.PixelLesson?.setView(kind)});
$('skills-open').addEventListener('click',()=>{document.querySelector('.tools-menu').open=false;expandPreview(false);window.PixelPalette?.close(false);window.PixelFonts?.close(false);window.PixelStudio?.close();window.PixelSkills?.open();});
$('challenge-open').addEventListener('click',()=>window.PixelChallenge?.open());
window.PixelSkills?.init({getState:()=>work,commit:edit,navigate,selectCode,showArrival,notify:toast,leaveTour});
window.PixelChallenge?.init({onOpen:()=>{leaveTour();window.PixelCodeNavigation?.close();window.PixelCodeHelp?.hide();window.PixelEditorSelection?.cancel();window.PixelSkills?.close();window.PixelPalette?.close(false);window.PixelFonts?.close(false);window.PixelStudio?.close();expandPreview(false);closeHistory();},onClose:()=>{$('challenge-open').focus({preventScroll:true});},notify:toast});
$('character-open').addEventListener('click',()=>{document.querySelector('.tools-menu').open=false;expandPreview(false);window.PixelPalette?.close(false);window.PixelFonts?.close(false);window.PixelStudio?.open();});
initSelection();window.addEventListener('beforeunload',()=>{if(sessionActive||hasSavedWork)save();});syncEditors();renderUI();if(hasSavedWork)save();$('preview').srcdoc=P.shell();
for(const [kind,needle]of [['html','<h1'],['css','.character {']])selectCode(kind,needle,false);
window.PixelCodeHelp?.init();
window.PixelCodeNavigation?.init({
 getContext:()=>({html:$('html-editor').value,css:$('css-editor').value,page:active().activePage}),
 jump:target=>{
  if(!target||!['html','css'].includes(target.kind))return false;
  window.PixelCodeHelp?.hide();window.PixelPalette?.close(false);window.PixelFonts?.close(false);window.PixelStudio?.close(false);
  hoverInfo=null;hoverRange=target.kind==='html'?{start:target.start,end:target.end}:null;
  if(!selectCode(target.kind,{start:target.start,end:target.end}))return false;
  drawCodeGlow();renderUI();showArrival(target.kind);return true;
 },
 notify:toast
});
window.PixelEditorSelection?.init();
})();
