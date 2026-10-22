(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const KEY = 'shinagawa-profile-lab-v1';
const titles = ['準備する','コードを貼る','AIに頼む'];
const examples = {
 color:'カードの背景を薄い水色にして。文字の色は読みやすい濃い紺にして。',
 space:'カードの中の余白を少し広げて、項目と項目の間もゆったりさせて。',
 shape:'カードの角をもっと丸くして。中の文字や配置は変えないで。',
 layout:'名前と丸いアイコンをカードの上部中央に並べて。その他の項目は今の順番のままにして。'
};
let state={html:'',css:'',request:'',checks:{},reflection:{change:'',prompt:'',learn:''},source:'',savedAt:'',needsRefresh:false,fresh:{html:false,css:false},sent:false,sentCount:0,lastPrompt:''};
let storageNotice=false;
try {const old=JSON.parse(localStorage.getItem(KEY));if(old&&old.version===1){for(const k of ['html','css','request','source','savedAt'])if(typeof old[k]==='string')state[k]=old[k];if(typeof old.needsRefresh==='boolean')state.needsRefresh=old.needsRefresh;if(typeof old.sent==='boolean')state.sent=old.sent;if(Number.isInteger(old.sentCount)&&old.sentCount>=0)state.sentCount=old.sentCount;if(typeof old.lastPrompt==='string')state.lastPrompt=old.lastPrompt;if(old.fresh&&typeof old.fresh==='object')state.fresh={html:old.fresh.html===true,css:old.fresh.css===true};if(old.checks&&typeof old.checks==='object')state.checks=old.checks;if(old.reflection&&typeof old.reflection==='object')for(const k of ['change','prompt','learn'])if(typeof old.reflection[k]==='string')state.reflection[k]=old.reflection[k];}}
catch(e){storageNotice=true;}
let step=0,codeTab='html',currentTab='html',aiTab=0,toastTimer,copied={html:false,css:false};
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({...state,version:1}));}catch(e){if(!storageNotice){toast('このブラウザでは控えを保存できません。ページを閉じる前にコードを保存してください。');storageNotice=true;}}}
function saveCurrent(){state[currentTab]=$('#current-code').value;state.source='current';state.fresh[currentTab]=true;state.savedAt=new Date().toISOString();persist();renderSource();renderPrompt();}
function showStep(n,focus=true){n=Math.max(0,Math.min(titles.length-1,n));step=n;$$('[data-panel]').forEach(el=>el.hidden=Number(el.dataset.panel)!==n);$$('[data-step]').forEach(el=>{const active=Number(el.dataset.step)===n;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});$('#previous').disabled=n===0;$('#next').disabled=n===titles.length-1;$('#next').textContent=n===titles.length-1?'おつかれさまでした':titles[n+1]+' →';$('#footer-step').textContent=String(n+1).padStart(2,'0')+' / '+String(titles.length).padStart(2,'0');renderCounts();$('#main').scrollTop=0;try{history.replaceState(null,'','#step-'+(n+1));}catch(e){}if(focus)$('#title-'+n).focus({preventScroll:true});}
function setAi(n){if(n===0&&aiTab===2&&state.sent&&!state.needsRefresh){state.needsRefresh=true;state.fresh={html:false,css:false};persist();toast('貼り戻したあとの、最新のHTMLとCSSに入れ替えてください。');}aiTab=n;$$('[data-ai-panel]').forEach(el=>el.hidden=Number(el.dataset.aiPanel)!==n);$$('[data-ai]').forEach(el=>el.setAttribute('aria-selected',String(Number(el.dataset.ai)===n)));if(n===1)renderPrompt();}
function preview(css=true){const safeCss=STARTER.css.replace(/<\/style/gi,'<\\/style');return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>'+(css?safeCss:'body{font-family:sans-serif;margin:20px;color:#142238;font-size:18px;font-weight:600}h1{font-size:30px}')+'</style></head><body>'+STARTER.html+'</body></html>';}
function stylePreview(on){$('#intro-preview').srcdoc=preview(on);$('#styled-on').setAttribute('aria-pressed',String(on));$('#styled-off').setAttribute('aria-pressed',String(!on));$('#style-caption').textContent=on?'内容は同じ。CSSが色・文字の大きさ・配置を決めています。':'カード用のCSSを外しました。文字の内容と順番はそのままです。';}
function setCodeTab(t){codeTab=t;$('#starter-code').value=STARTER[t];$('#starter-code').setAttribute('aria-label','コピー用'+t.toUpperCase()+'コード');$('#copy-starter').textContent=t.toUpperCase()+'をコピー';$('#paste-target').textContent='CodePenの「'+t.toUpperCase()+'」欄へ、下のコードを全部貼り付ける。';$$('[data-code]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.code===t)));}
async function copy(text,field){if(!text){toast('まだコードがありません。先にCodePenから貼り付けてください。');return false;}let ok=false;try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true;}}catch(e){}if(!ok){const tmp=document.createElement('textarea');tmp.value=text;tmp.style.position='fixed';tmp.style.left='-9999px';document.body.appendChild(tmp);tmp.focus();tmp.select();try{ok=document.execCommand('copy');}catch(e){}tmp.remove();}if(ok){toast('コピーしました。貼り付け先に移動してください。');return true;}if(field){field.focus();field.select();}toast(field?'自動コピーができませんでした。選択した文字を⌘＋C（WindowsはCtrl＋C）でコピーしてください。':'自動コピーができませんでした。上の文を選択し、⌘＋C（WindowsはCtrl＋C）でコピーしてください。');return false;}
function setCurrentTab(t){currentTab=t;$('#current-code').value=state[t];$('#current-code').setAttribute('aria-label','いまCodePenにある'+t.toUpperCase());$('#current-code').placeholder='CodePenの'+t.toUpperCase()+'欄をクリック → 全部選択 → コピー → ここに貼る';$$('[data-current]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.current===t)));renderSource();}
function renderSource(){const h=!!state.html.trim(),c=!!state.css.trim();$('#code-paste-state').textContent=state.needsRefresh?('最新HTML '+(state.fresh.html?'✓':'要更新')+' / 最新CSS '+(state.fresh.css?'✓':'要更新')):(h?'HTML ✓':'HTML 未入力')+' / '+(c?'CSS ✓':'CSS 未入力');$('#source-state').textContent=h&&c?(state.source==='sample'?'見本のコードを使用':'貼り付けたコードを使用'):'コード未入力';}
function checkFresh(){if(state.needsRefresh&&(!state.fresh.html||!state.fresh.css)){toast('最新のHTMLとCSSを、両方ともCodePenから貼り直してください。前回の控えはそのまま残っています。');setAi(0);setCurrentTab(state.fresh.html?'css':'html');$('#current-code').focus();return false;}return true;}
function buildPrompt(){return `CodePenのClassic Editorで、自己紹介カードを作っています。以下の現在のHTMLとCSSをもとに変更してください。

【変えたいこと】
${state.request.trim()||'（ここに、変えたい場所と変え方を書きます）'}

【守ってほしいこと】
・指示していない名前・文章・項目は変更しないでください。
・HTMLとCSSだけで作り、JavaScriptや外部ライブラリ、外部画像は追加しないでください。
・読みやすい文字サイズと色にし、狭い画面でもはみ出さないようにしてください。
・変更後のHTMLとCSSを、それぞれ別のコードブロックで、省略せず全文出してください。
・HTMLはbodyの中に入る部分だけにしてください。doctype、html、head、body、styleタグは不要です。
・「ここを変える」という案内コメントは残し、追加した項目にも同じように付けてください。
・最後に、主に変えた箇所を1〜2文で教えてください。

【現在のHTML】
${state.html}

【現在のCSS】
${state.css}`;}
function renderPrompt(){$('#generated-prompt').value=buildPrompt();renderSource();}
function download(filename,content,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openDialog(id){const d=$(id);if(typeof d.showModal==='function')d.showModal();else{d.setAttribute('open','');}}
function openBackup(){const ready=!!(state.html.trim()||state.css.trim());$('#backup-status').textContent=ready?'「03 AIに頼む」に最後に入れたコードです。CodePenでその後に変えた内容は含まれません。':'まだコードを控えていません。「03 AIに頼む」でHTMLとCSSを貼り付けてください。';$('#backup-code').value=state.html;$$('[data-backup]').forEach(el=>el.disabled=!state[el.dataset.backup].trim());$('#download-backup').disabled=!ready;openDialog('#backup-dialog');}
$$('[data-step]').forEach(el=>el.addEventListener('click',()=>showStep(+el.dataset.step)));
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>showStep(+el.dataset.go)));
$('#previous').addEventListener('click',()=>showStep(step-1));$('#next').addEventListener('click',()=>showStep(step+1));
$('.brand').addEventListener('click',e=>{e.preventDefault();showStep(0);});
window.addEventListener('hashchange',()=>{const match=location.hash.match(/^#step-([1-3])$/);if(match)showStep(Number(match[1])-1);});
$('#styled-on').addEventListener('click',()=>stylePreview(true));$('#styled-off').addEventListener('click',()=>stylePreview(false));
$$('[data-code]').forEach(el=>el.addEventListener('click',()=>setCodeTab(el.dataset.code)));
$('#copy-starter').addEventListener('click',async()=>{const t=codeTab;if(await copy(STARTER[t],$('#starter-code'))){copied[t]=true;$('#copy-progress').textContent=(copied.html?'HTML コピー済み':'HTML 未コピー')+' / '+(copied.css?'CSS コピー済み':'CSS 未コピー');}});
$('#select-starter').addEventListener('click',()=>{$('#starter-code').focus();$('#starter-code').select();toast('全文を選択しました。⌘＋C（WindowsはCtrl＋C）でコピーできます。');});
$$('[data-ai]').forEach(el=>el.addEventListener('click',()=>setAi(+el.dataset.ai)));
$$('[data-ai-go]').forEach(el=>el.addEventListener('click',()=>setAi(+el.dataset.aiGo)));
$$('[data-current]').forEach(el=>el.addEventListener('click',()=>setCurrentTab(el.dataset.current)));
$('#current-code').addEventListener('input',saveCurrent);
$('#use-starter').addEventListener('click',()=>{if((state.html||state.css)&&!confirm('ここに控えたHTMLとCSSを、見本のコードに置き換えます。よろしいですか？'))return;state.html=STARTER.html;state.css=STARTER.css;state.source='sample';state.needsRefresh=false;state.fresh={html:true,css:true};state.savedAt=new Date().toISOString();setCurrentTab(currentTab);persist();renderPrompt();toast('見本のコードを入れました。編集済みならCodePenのコードに置き換えてください。');});
$('#code-next').addEventListener('click',()=>{if(!checkFresh())return;if(!state.html.trim()||!state.css.trim()){toast('HTMLとCSSの両方を貼り付けてください。');setCurrentTab(state.html.trim()?'css':'html');$('#current-code').focus();return;}setAi(1);$('#change-request').focus();});
$('#change-request').value=state.request;
$('#change-request').addEventListener('input',()=>{state.request=$('#change-request').value;persist();renderPrompt();});
$$('[data-example]').forEach(el=>el.addEventListener('click',()=>{if(state.request.trim()&&!Object.values(examples).includes(state.request)&&!confirm('入力中の指示文を、この例に置き換えますか？'))return;state.request=examples[el.dataset.example];$('#change-request').value=state.request;persist();renderPrompt();$('#change-request').focus();}));
$('#copy-prompt').addEventListener('click',async()=>{if(!checkFresh())return;if(!state.html.trim()||!state.css.trim()){toast('先に、いまのHTMLとCSSを入れましょう。');setAi(0);return;}if(!state.request.trim()){toast('変えたい場所と変え方を、ひと言書いてください。');$('#change-request').focus();return;}const prompt=buildPrompt();if(await copy(prompt,$('#generated-prompt'))){state.sent=true;if(prompt!==state.lastPrompt){state.sentCount=(state.sentCount||0)+1;state.lastPrompt=prompt;}persist();renderSentCount();}});
$$('[data-copy-text]').forEach(el=>el.addEventListener('click',()=>copy(el.dataset.copyText)));
$$('[data-check]').forEach(el=>{el.checked=!!state.checks[el.dataset.check];el.addEventListener('change',()=>{state.checks[el.dataset.check]=el.checked;persist();renderCounts();});});

function renderCounts(){$$('[data-count]').forEach(el=>{const panel=document.querySelector('[data-panel="'+el.dataset.count+'"]');if(!panel)return;const boxes=Array.from(panel.querySelectorAll('[data-check]')),done=boxes.filter(b=>b.checked).length;el.textContent=boxes.length?done+' / '+boxes.length:'';el.closest('[data-step]').classList.toggle('done',boxes.length>0&&done===boxes.length);});}
function renderSentCount(){const n=state.sentCount||0;$('#sent-count').textContent=String(n);$('.count-badge').classList.toggle('done',n>=2);}
$('#again').addEventListener('click',()=>{state.request='';$('#change-request').value='';state.needsRefresh=true;state.fresh={html:false,css:false};for(const k of ['changed','readable','kept'])state.checks[k]=false;$$('[data-check="changed"],[data-check="readable"],[data-check="kept"]').forEach(el=>el.checked=false);persist();aiTab=0;setAi(0);setCurrentTab('html');renderPrompt();renderCounts();$('#current-code').focus();toast('CodePenの最新のHTMLとCSSを、もう一度ここへ貼ってください。');});
$('#help-open').addEventListener('click',()=>openDialog('#help-dialog'));$('#teacher-open').addEventListener('click',()=>openDialog('#teacher-dialog'));
$$('[data-close]').forEach(el=>el.addEventListener('click',()=>el.closest('dialog').close()));
$$('dialog').forEach(el=>el.addEventListener('click',e=>{if(e.target===el){const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el.close();}}));
$$('[data-reset-start]').forEach(el=>el.addEventListener('click',()=>{$('#help-dialog').close();showStep(1);}));
$('#backup-open').addEventListener('click',openBackup);$('#help-backup').addEventListener('click',()=>{$('#help-dialog').close();openBackup();});
$$('[data-backup]').forEach(el=>el.addEventListener('click',()=>{const t=el.dataset.backup;$('#backup-code').value=state[t];copy(state[t],$('#backup-code'));}));
$('#download-backup').addEventListener('click',()=>{download('自己紹介カード-コードの控え.txt','【HTML】\n'+state.html+'\n\n【CSS】\n'+state.css);});
stylePreview(true);$('#copy-preview').srcdoc=preview(true);setCodeTab('html');setCurrentTab('html');renderPrompt();
renderSentCount();const match=location.hash.match(/^#step-([1-3])$/);showStep(match?Number(match[1])-1:0,false);
if(storageNotice)toast('このブラウザでは控えを保存できない場合があります。必要なコードは端末にも保存してください。');
})();
