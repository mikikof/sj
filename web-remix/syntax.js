(function(root){
'use strict';
// A display-only lexer. Every source character is escaped exactly once; tokens
// never add spaces, change line endings, or change the editor's font metrics.
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const span=(kind,text)=>text?'<span class="tok-'+kind+'">'+escape(text)+'</span>':'';
const identifier=/^(?:--|-?(?:[A-Za-z_\u0080-\uFFFF]|\\[^\r\n]))(?:[\w\u0080-\uFFFF-]|\\[^\r\n])*/;
const number=/^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?(?:[a-z]+|%)?/i;
function quotedEnd(source,start){
 const quote=source[start];let i=start+1;
 while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i]===quote)return i+1;i++;}return source.length;
}
function css(source,inline=false){
 let out='',i=0,start=0,mode=inline?'property':'selector',paren=0;const stack=[];
 const take=(kind,end)=>{out+=kind?span(kind,source.slice(i,end)):escape(source.slice(i,end));i=end;};
 while(i<source.length){
  const rest=source.slice(i),ch=source[i];let m;
  if((m=/^\s+/.exec(rest))){take(null,i+m[0].length);continue;}
  if(rest.startsWith('/*')){const end=source.indexOf('*/',i+2);take('comment',end<0?source.length:end+2);continue;}
  if(ch==='"'||ch==="'"){take('string',quotedEnd(source,i));continue;}
  if(ch==='{'){
   const header=source.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();
   const contentMode=/^@(media|supports|container|layer|scope|document|starting-style|(?:-\w+-)?keyframes)\b/i.test(header)?'selector':'property';
   stack.push({mode,paren,contentMode});paren=0;mode=contentMode;
   take('punctuation',i+1);start=i;continue;
  }
  if(ch==='}'){
   const frame=stack.pop();mode=stack.length?stack[stack.length-1].contentMode:(inline?'property':'selector');paren=frame?frame.paren:0;
   take('punctuation',i+1);start=i;continue;
  }
  if(ch===';'&&paren===0){mode=stack.length?stack[stack.length-1].contentMode:(inline?'property':'selector');take('punctuation',i+1);start=i;continue;}
  if(ch===':'&&mode==='property'&&paren===0){mode='value';take('punctuation',i+1);continue;}
  if(ch==='@'&&(m=/^@[\w-]+/.exec(rest))){take('atrule',i+m[0].length);continue;}
  if(mode==='selector'&&(ch==='.'||ch==='#')&&(m=identifier.exec(rest.slice(1)))){take('selector',i+m[0].length+1);continue;}
  if(ch==='#'&&mode!=='selector'&&(m=/^#[\da-f]{3,8}(?![\w-])/i.exec(rest))){take('color',i+m[0].length);continue;}
  if((m=number.exec(rest))){take('number',i+m[0].length);continue;}
  if((m=/^!\s*important\b/i.exec(rest))){take('keyword',i+m[0].length);continue;}
  if((m=identifier.exec(rest))){
   const word=m[0],end=i+word.length,after=source.slice(end),next=/^\s*/.exec(after)[0].length;
   if(word.toLowerCase()==='url'&&after[next]==='('){
    take('function',end);take(null,i+next);take('punctuation',i+1);
    const white=/^\s*/.exec(source.slice(i))[0];take(null,i+white.length);
    if(source[i]==='"'||source[i]==="'"){
     const quote=source[i],qEnd=quotedEnd(source,i);take('punctuation',i+1);
     const closed=qEnd>i&&source[qEnd-1]===quote;take('link',closed?qEnd-1:qEnd);if(closed)take('punctuation',i+1);
    }else{let endLink=i;while(endLink<source.length&&source[endLink]!==')'){if(source[endLink]==='\\')endLink++;endLink++;}take('link',Math.min(endLink,source.length));}
    const trailing=/^\s*/.exec(source.slice(i))[0];take(null,i+trailing.length);if(source[i]===')')take('punctuation',i+1);continue;
   }
   const isFunction=after[next]==='(';
   const mediaProperty=mode==='selector'&&paren>0&&/^\s*:/.test(after)&&/^\s*@/.test(source.slice(start,i));
   const kind=(mode==='property'&&/^\s*(?:\/\*[\s\S]*?\*\/\s*)*:/.test(after))||mediaProperty?'prop':
    isFunction?'function':mode==='selector'?'selector':word.startsWith('--')?'variable':'value';
   take(kind,end);continue;
  }
  if(ch==='(')paren++;if(ch===')')paren=Math.max(0,paren-1);
  take(/[{}()[\]:;,.>+~*=|/&!%-]/.test(ch)?'punctuation':null,i+1);
 }
 return out;
}
function javascript(source){
 let out='',i=0;const keywords=new Set('async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield true false null undefined'.split(' '));
 while(i<source.length){
  const rest=source.slice(i),ch=source[i];let m,end,type;
  if(rest.startsWith('//')){end=source.indexOf('\n',i+2);if(end<0)end=source.length;type='comment';}
  else if(rest.startsWith('/*')){end=source.indexOf('*/',i+2);end=end<0?source.length:end+2;type='comment';}
  else if(ch==='"'||ch==="'"||ch==='`'){end=quotedEnd(source,i);type='string';}
  else if((m=/^(?:0[xob][\da-f]+|(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?n?)/i.exec(rest))){end=i+m[0].length;type='number';}
  else if((m=/^[A-Za-z_$\u0080-\uFFFF][\w$\u0080-\uFFFF]*/.exec(rest))){end=i+m[0].length;type=keywords.has(m[0])?'keyword':/^\s*\(/.test(source.slice(end))?'function':null;}
  else{end=i+1;type=/[{}()[\].,:;?~+*\/%&|^!=<>-]/.test(ch)?'punctuation':null;}
  out+=type?span(type,source.slice(i,end)):escape(source.slice(i,end));i=end;
 }
 return out;
}
function html(source){
 let out='',i=0;
 const take=(kind,end)=>{out+=kind?span(kind,source.slice(i,end)):escape(source.slice(i,end));i=end;};
 while(i<source.length){
  const rest=source.slice(i);let m;
  if(rest.startsWith('<!--')){const end=source.indexOf('-->',i+4);take('comment',end<0?source.length:end+3);continue;}
  if(/^<!|^<\?/.test(rest)){
   let end=i+2;while(end<source.length&&source[end]!=='>'){if(source[end]==='"'||source[end]==="'")end=quotedEnd(source,end);else end++;}take('doctype',end<source.length?end+1:end);continue;
  }
  if((m=/^<(\/?)([A-Za-z][\w:-]*)/.exec(rest))){
   const closing=!!m[1],tag=m[2].toLowerCase();take('punctuation',i+1+m[1].length);take('tag',i+m[2].length);
   let selfClosing=false,complete=false;
   while(i<source.length){
    if((m=/^\s+/.exec(source.slice(i)))){take(null,i+m[0].length);continue;}
    if(source.startsWith('/>',i)){selfClosing=true;complete=true;take('punctuation',i+2);break;}
    if(source[i]==='>'){complete=true;take('punctuation',i+1);break;}
    if(source[i]==='<')break;
    m=/^[^\s=<>\/"']+/.exec(source.slice(i));
    if(!m){take('punctuation',i+1);continue;}
    const attr=m[0].toLowerCase();take('attr',i+m[0].length);
    const white=/^\s*/.exec(source.slice(i))[0];take(null,i+white.length);
    if(source[i]!=='=')continue;
    take('punctuation',i+1);const gap=/^\s*/.exec(source.slice(i))[0];take(null,i+gap.length);
    const kind=/^(href|src|srcset|action|poster|cite|formaction)$/.test(attr)?'link':'string';
    if(source[i]==='"'||source[i]==="'"){
     // HTML does not use backslash escapes inside quoted attributes.
     const quote=source[i];take('punctuation',i+1);const end=source.indexOf(quote,i);
     take(kind,end<0?source.length:end);if(end>=0)take('punctuation',i+1);
    }else{const value=/^[^\s>]+/.exec(source.slice(i));if(value)take(kind,i+value[0].length);}
   }
   if(complete&&!closing&&!selfClosing&&/^(script|style|textarea|title)$/.test(tag)){
    const close=new RegExp('</'+tag+'(?=[\\s>])','ig');close.lastIndex=i;const found=close.exec(source),end=found?found.index:source.length,raw=source.slice(i,end);
    out+=tag==='style'?css(raw):tag==='script'?javascript(raw):escape(raw);i=end;
   }
   continue;
  }
  if((m=/^&(?:#[xX][\da-fA-F]+|#\d+|[A-Za-z][A-Za-z\d]+);/.exec(rest))){take('entity',i+m[0].length);continue;}
  let end=i+1;while(end<source.length&&source[end]!=='<'&&source[end]!=='&')end++;take(null,end);
 }
 return out;
}
function highlight(source,kind){source=String(source??'');return(kind==='html'?html(source):kind==='css'?css(source):kind==='js'||kind==='javascript'?javascript(source):escape(source))+'\n';}
const api={highlight};root.PixelSyntax=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
