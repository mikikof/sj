(function(root){
'use strict';

// All ranges use the original strings' UTF-16 offsets, as textarea selections do.
// The detached document is used only for selector matching. It is never displayed.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set('script style textarea title xmp iframe noembed noframes plaintext'.split(' '));
const GROUPS = new Set(['media','supports','layer','container','document','-moz-document','starting-style']);
const STATES = new Set('hover active focus focus-visible focus-within visited link any-link target target-within checked disabled enabled required optional read-only read-write valid invalid user-valid user-invalid in-range out-of-range placeholder-shown autofill default indeterminate defined fullscreen modal open'.split(' '));
const PSEUDO_ELEMENTS = new Set('before after first-line first-letter marker placeholder selection backdrop file-selector-button'.split(' '));
const STRUCTURAL_FUNCTIONS = new Set(['not','is','where','has','nth-child','nth-last-child','nth-of-type','nth-last-of-type','lang','dir']);
const space = c => !!c && /\s/.test(c);
const inRange = (index,start,end) => index >= start && index < end;
const lineAt = (source,index) => source.slice(0,index).split('\n').length;
const compact = value => value.replace(/\s+/g,' ').trim();
const short = (value,n=74) => value.length > n ? value.slice(0,n-1)+'…' : value;

function tagEnd(source,start){
  let quote='';
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(quote){if(c===quote)quote='';}
    else if(c==='"'||c==="'")quote=c;
    else if(c==='>')return i+1;
  }
  return source.length;
}
function autoClose(stack,name,end){
  const top=()=>stack[stack.length-1];
  const closeUntil = names => {
    for(let i=stack.length-1;i>=0;i--){
      if(names.has(stack[i].name)){
        while(stack.length>i){const node=stack.pop();node.contentEnd=end;}
        return;
      }
      if(['table','ul','ol','select','body','html'].includes(stack[i].name))return;
    }
  };
  if(name==='li')closeUntil(new Set(['li']));
  if(name==='dt'||name==='dd')closeUntil(new Set(['dt','dd']));
  if(name==='option')closeUntil(new Set(['option']));
  if(name==='td'||name==='th')closeUntil(new Set(['td','th']));
  if(name==='tr')closeUntil(new Set(['tr']));
  if(['address','article','aside','blockquote','div','dl','fieldset','footer','form','h1','h2','h3','h4','h5','h6','header','hr','main','nav','ol','p','pre','section','table','ul'].includes(name))closeUntil(new Set(['p']));
  if(name==='body'&&top()?.name==='head'){top().contentEnd=end;stack.pop();}
}
function readHTML(source){
  const nodes=[],zones=[],stack=[];
  let i=0;
  while(i<source.length){
    const raw=stack[stack.length-1];
    if(raw&&RAW.has(raw.name)){
      if(raw.name==='plaintext'){zones.push({start:i,end:source.length,raw:true,node:raw});i=source.length;break;}
      const re=new RegExp('</'+raw.name+'(?=[\\s/>])','ig');re.lastIndex=i;
      const m=re.exec(source),end=m?m.index:source.length;
      if(end>i)zones.push({start:i,end,raw:true,node:raw});
      i=end;if(!m)break;
    }
    if(source[i]!=='<'){
      let end=source.indexOf('<',i);if(end<0)end=source.length;
      zones.push({start:i,end,node:stack[stack.length-1]||null});i=end;continue;
    }
    if(source.startsWith('<!--',i)){
      const close=source.indexOf('-->',i+4),end=close<0?source.length:close+3;
      zones.push({start:i,end,ignored:true});i=end;continue;
    }
    if(/^<!|^<\?/.test(source.slice(i,i+2))){
      const end=tagEnd(source,i+2);zones.push({start:i,end,ignored:true});i=end;continue;
    }
    const m=/^<(\/?)\s*([A-Za-z][A-Za-z0-9:_-]*)/.exec(source.slice(i));
    if(!m){zones.push({start:i,end:i+1,node:stack[stack.length-1]||null});i++;continue;}
    const name=m[2].toLowerCase(),end=tagEnd(source,i+m[0].length);
    if(m[1]){
      let node=null;
      for(let k=stack.length-1;k>=0;k--)if(stack[k].name===name){
        node=stack[k];while(stack.length>k){const closed=stack.pop();closed.contentEnd=i;}break;
      }
      zones.push({start:i,end,node});i=end;continue;
    }
    autoClose(stack,name,i);
    const node={id:nodes.length,name,start:i,end,nameEnd:i+m[0].length,contentEnd:source.length};
    nodes.push(node);zones.push({start:i,end,node});
    // A slash only closes foreign elements. HTML's <div/> is an opening div.
    const foreign=name==='svg'||name==='math'||stack.some(n=>n.name==='svg'||n.name==='math');
    if(!VOID.has(name)&&!(foreign&&/\/\s*>$/.test(source.slice(i,end))))stack.push(node);
    else node.contentEnd=end;
    i=end;
  }
  let marker='data-pixel-source-ref';
  while(source.toLowerCase().includes(marker))marker+='x';
  let marked='',last=0;
  for(const node of nodes){marked+=source.slice(last,node.nameEnd)+' '+marker+'="'+node.id+'"';last=node.nameEnd;}
  marked+=source.slice(last);
  let doc;
  const Parser=root.DOMParser||(typeof DOMParser!=='undefined'?DOMParser:null);
  if(!Parser)return {nodes,zones,error:'このブラウザではコードの対応を調べられません。'};
  try{doc=new Parser().parseFromString(marked,'text/html');}
  catch(_){return {nodes,zones,error:'HTML を読み取れませんでした。タグの書き方を確認してください。'};}
  const mapped=new Map();
  for(const element of doc.querySelectorAll('['+marker+']')){
    const id=Number(element.getAttribute(marker));
    if(nodes[id]&&!mapped.has(id))mapped.set(id,element);
  }
  return {nodes,zones,doc,mapped};
}

function commentEnd(source,start,end=source.length){const x=source.indexOf('*/',start+2);return x<0?end:Math.min(x+2,end);}
function skipSpace(source,start,end){
  while(start<end){if(space(source[start]))start++;else if(source.startsWith('/*',start))start=commentEnd(source,start,end);else break;}
  return start;
}
function trimRange(source,start,end){
  start=skipSpace(source,start,end);
  let last=start,i=start,quote='';
  while(i<end){
    const c=source[i];
    if(quote){last=i+1;if(c==='\\'&&i+1<end){i+=2;last=i;continue;}if(c===quote)quote='';i++;continue;}
    if(c==='\"'||c==="'"){quote=c;last=++i;continue;}
    if(source.startsWith('/*',i)){i=commentEnd(source,i,end);continue;}
    if(!space(c))last=i+1;i++;
  }
  return {start,end:last};
}
// Find a top-level punctuation mark, ignoring strings, comments and functions.
function nextMark(source,start,end,marks){
  let quote='',round=0,square=0;
  for(let i=start;i<end;i++){
    const c=source[i];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote='';continue;}
    if(c==='\\'){i++;continue;}
    if(source.startsWith('/*',i)){i=commentEnd(source,i,end)-1;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='(')round++;else if(c===')')round=Math.max(0,round-1);
    else if(c==='[')square++;else if(c===']')square=Math.max(0,square-1);
    else if(!round&&!square&&marks.includes(c))return i;
  }
  return end;
}
function closeBrace(source,open,end){
  let depth=1,i=open+1;
  while(i<end){
    const mark=nextMark(source,i,end,'{}');if(mark===end)return end;
    if(source[mark]==='{')depth++;else if(--depth===0)return mark;
    i=mark+1;
  }
  return end;
}
function selectorParts(source,start,end){
  const parts=[];let pos=start;
  while(pos<end){const comma=nextMark(source,pos,end,','),range=trimRange(source,pos,comma);
    if(range.start<range.end)parts.push({...range,raw:source.slice(range.start,range.end)});
    pos=comma+1;
  }
  return parts;
}
function readCSS(source){
  const rules=[],ignored=[],comments=[];
  // Collect comments separately so clicking commentary never navigates unexpectedly.
  let quote='';
  for(let i=0;i<source.length;i++){
    const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(source.startsWith('/*',i)){const end=commentEnd(source,i);comments.push({start:i,end});i=end-1;}
  }
  function sheet(start,end,conditions){
    let pos=start;
    while(pos<end){
      pos=skipSpace(source,pos,end);if(pos>=end)break;
      const mark=nextMark(source,pos,end,'{;}');
      if(mark===end)break;
      if(source[mark]!== '{'){pos=mark+1;continue;}
      const close=closeBrace(source,mark,end),header=source.slice(pos,mark),at=/^@([\w-]+)/.exec(header);
      if(at){
        if(GROUPS.has(at[1].toLowerCase()))sheet(mark+1,close,[...conditions,compact(header)]);
        else ignored.push({start:pos,end:Math.min(close+1,end),reason:'このブロックは HTML の要素を直接選ぶ指定ではありません。'});
      }else{
        const parts=selectorParts(source,pos,mark);
        const rule={start:pos,end:Math.min(close+1,end),bodyStart:mark+1,bodyEnd:close,parts,conditions,nested:[]};
        rules.push(rule);
        // CSS nesting is intentionally not guessed. Its source range is explicit.
        let cursor=mark+1,segment=cursor;
        while(cursor<close){
          const token=nextMark(source,cursor,close,';{');
          if(token===close)break;
          if(source[token]===';'){cursor=token+1;segment=cursor;}
          else {const nestedClose=closeBrace(source,token,close),nestedStart=skipSpace(source,segment,token);
            rule.nested.push({start:nestedStart,end:Math.min(nestedClose+1,close)});cursor=nestedClose+1;segment=cursor;}
        }
      }
      pos=close+1;
    }
  }
  sheet(0,source.length,[]);return {rules,ignored,comments};
}
function stripComments(value){
  let result='',quote='';
  for(let i=0;i<value.length;i++){
    const c=value[i];if(quote){result+=c;if(c==='\\'&&i+1<value.length)result+=value[++i];else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"){quote=c;result+=c;continue;}
    if(value.startsWith('/*',i)){i=commentEnd(value,i)-1;continue;}
    result+=c;
  }
  return result;
}
function parenthesisEnd(value,start){
  let depth=1,quote='';
  for(let i=start+1;i<value.length;i++){
    const c=value[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='\\'){i++;continue;}if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='(')depth++;else if(c===')'&&--depth===0)return i;
  }
  return -1;
}
function prepareSelector(raw,insideFunction=false){
  const source=stripComments(raw);let out='',quote='',bracket=0;
  const notes=[];
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quote){out+=c;if(c==='\\'&&i+1<source.length)out+=source[++i];else if(c===quote)quote='';continue;}
    if(c==='\\'){out+=c;if(i+1<source.length)out+=source[++i];continue;}
    if(c==='"'||c==="'"){quote=c;out+=c;continue;}
    if(c==='['){bracket++;out+=c;continue;}
    if(c===']'){bracket--;out+=c;continue;}
    if(c==='&'&&!bracket)return {error:'入れ子の CSS は、対応先をまだ調べられません。'};
    if(c!==':'||bracket){out+=c;continue;}
    const m=/^(:{1,2})([\w-]+)/.exec(source.slice(i));
    if(!m){out+=c;continue;}
    const name=m[2].toLowerCase(),end=i+m[0].length,isElement=m[1]==='::'||['before','after','first-line','first-letter'].includes(name);
    if(source[end]==='('){
      const close=parenthesisEnd(source,end);if(close<0)return {error:'セレクタのかっこが閉じられていません。'};
      if(isElement||!STRUCTURAL_FUNCTIONS.has(name))return {error:'このセレクタの書き方にはまだ対応していません。'};
      const nested=prepareSelector(source.slice(end+1,close),true);
      if(nested.error)return nested;
      out+=source.slice(i,close+1);i=close;continue;
    }
    if(name==='scope'||name==='host')return {error:'このセレクタの書き方にはまだ対応していません。'};
    if(isElement||STATES.has(name)){
      if(insideFunction)return {error:'かっこの中にある状態条件は、対応先をまだ調べられません。'};
      if(isElement&&!PSEUDO_ELEMENTS.has(name))return {error:'この疑似要素の対応先はまだ調べられません。'};
      if(!out||/[\s>+~,]$/.test(out))out+='*';
      notes.push(isElement?'疑似要素 '+m[0]+' の元になる要素':'条件 '+m[0]+'（成立は未判定）');
      i=end-1;continue;
    }
    out+=m[0];i=end-1;
  }
  return {selector:out.trim(),notes};
}
function matchElement(element,part){
  const prepared=prepareSelector(part.raw);
  if(prepared.error)return {...prepared,matched:false};
  try{return {...prepared,matched:element.matches(prepared.selector)};}
  catch(_){return {...prepared,matched:false,error:'このセレクタの書き方にはまだ対応していないか、入力途中です。'};}
}
function sourceLabel(node,element){
  const id=element.getAttribute('id'),classes=(element.getAttribute('class')||'').trim();
  return short('<'+node.name+(id?' id="'+id+'"':'')+(classes?' class="'+classes+'"':'')+'>');
}
function nodeText(element){
  if(['script','style'].includes(element.localName))return '';
  const text=compact(element.textContent||'');return text?short(text,40):'';
}
function contextNotes(rule,notes){return [...rule.conditions,...notes].join(' / ');}
function clickedIdentity(source,node,index){
  const tag=source.slice(node.start,node.end),re=/(?:\s)(class|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while((match=re.exec(tag))){
    const value=match[2]??match[3]??match[4]??'',start=node.start+match.index+match[0].lastIndexOf(value);
    if(!inRange(index,start,start+value.length))continue;
    const words=/[^\s]+/g;let word;
    while((word=words.exec(value)))if(inRange(index,start+word.index,start+word.index+word[0].length))return (match[1].toLowerCase()==='id'?'#':'.')+word[0];
  }
  return '';
}
function mentionsIdentity(selector,identity){
  if(!identity)return false;
  const at=selector.indexOf(identity),after=selector[at+identity.length];
  return at>=0&&(!after||!/[\p{L}\p{N}_-]/u.test(after));
}
function empty(message){return {targets:[],message};}
function resolve(options){
  const kind=options?.kind,html=String(options?.html??''),css=String(options?.css??''),index=Number(options?.index);
  if((kind!=='html'&&kind!=='css')||!Number.isInteger(index)||index<0||index>=(kind==='html'?html.length:css.length))return empty('タグやセレクタ、プロパティの上で Shift＋クリックしてください。');
  const parsedCSS=readCSS(css);
  if(kind==='css'){
    if(parsedCSS.comments.some(zone=>inRange(index,zone.start,zone.end)))return empty('コメントではなく、セレクタやプロパティを Shift＋クリックしてください。');
    const excluded=parsedCSS.ignored.find(zone=>inRange(index,zone.start,zone.end));if(excluded)return empty(excluded.reason);
  }
  const parsedHTML=readHTML(html);if(parsedHTML.error)return empty(parsedHTML.error);
  if(kind==='html'){
    const zone=parsedHTML.zones.find(item=>inRange(index,item.start,item.end));
    if(!zone||zone.ignored||!zone.node)return empty('HTML のタグや、その中の文字を Shift＋クリックしてください。');
    if(zone.raw)return empty('この部分は HTML のタグではありません。開始タグを Shift＋クリックしてください。');
    const node=zone.node,element=parsedHTML.mapped.get(node.id);
    if(!element)return empty('このタグの対応を読み取れませんでした。タグの書き方を確認してください。');
    let targets=[];const identity=clickedIdentity(html,node,index);
    for(const rule of parsedCSS.rules)for(const part of rule.parts){
      const result=matchElement(element,part);if(!result.matched)continue;
      const context=contextNotes(rule,result.notes);
      targets.push({kind:'css',start:part.start,end:part.end,label:short(compact(part.raw)),detail:'CSS '+lineAt(css,part.start)+' 行'+(context?' · '+context:''),rank:(context?2:0)+(mentionsIdentity(part.raw,identity)?0:1),universal:stripComments(part.raw).trim()==='*'});
    }
    // A universal reset should not force a chooser for every classroom example.
    if(targets.some(target=>!target.universal))targets=targets.filter(target=>!target.universal);
    targets.sort((a,b)=>a.rank-b.rank||a.start-b.start);
    targets=targets.map(({rank,universal,...target})=>({...target,detail:target.detail+(universal?' · すべての要素に共通する指定':'')}));
    return targets.length?{targets}:empty('この要素を直接選んでいる CSS は見つかりませんでした。親から引き継ぐ見た目は、親のタグから確認できます。');
  }
  const rule=parsedCSS.rules.find(item=>inRange(index,item.start,item.end));
  if(!rule)return empty('セレクタか、{ } の中のプロパティを Shift＋クリックしてください。');
  if(rule.nested.some(zone=>inRange(index,zone.start,zone.end)))return empty('入れ子の CSS は、対応先をまだ調べられません。');
  const exact=rule.parts.find(part=>inRange(index,part.start,part.end)),parts=exact?[exact]:rule.parts;
  const found=new Map();let unsupported='';
  for(const part of parts){
    for(const node of parsedHTML.nodes){
      const element=parsedHTML.mapped.get(node.id);if(!element)continue;
      const result=matchElement(element,part);if(result.error){unsupported=result.error;break;}if(!result.matched)continue;
      let target=found.get(node.id);
      if(!target){target={node,element,notes:new Set(),selectors:new Set()};found.set(node.id,target);}
      target.selectors.add(compact(part.raw));for(const note of result.notes)target.notes.add(note);
    }
  }
  const targets=[...found.values()].sort((a,b)=>a.node.start-b.node.start).map(({node,element,notes})=>{
    const text=nodeText(element),condition=contextNotes(rule,[...notes]);
    return {kind:'html',start:node.start,end:node.end,label:sourceLabel(node,element),detail:(options.page||'HTML')+' '+lineAt(html,node.start)+' 行'+(text?' · '+text:'')+(condition?' · '+condition:'')};
  });
  if(targets.length)return {targets,...(unsupported?{message:'対応を調べられるセレクタの結果を表示しています。 '+unsupported}:{})};
  return empty(unsupported||'今開いている HTML に、このセレクタと一致する要素はありません。別のページの要素を指定している場合もあります。');
}
root.PixelCodeReferences=Object.freeze({resolve});
})(typeof window!=='undefined'?window:globalThis);
