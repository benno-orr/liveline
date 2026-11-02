(function(root){
const closed=['DONE','~done','missed','abandon'],finished=['DONE','~done'];
function severity(s){return s?Math.min(4,(s.match(/★/g)||[]).length):-1}
function deadline(r,mode='auto'){let value=mode==='hard'?r.hard:mode==='soft'?r.soft:r.hard||r.soft;return {value,kind:mode==='soft'||(!r.hard&&mode==='auto')?'soft':'hard'}}
function days(value,now=new Date()){if(!value)return null;if(value.length===10){let [y,m,d]=value.split('-').map(Number);let local=new Date(y,m-1,d);let today=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((Date.UTC(local.getFullYear(),local.getMonth(),local.getDate())-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000)}return (new Date(value)-now)/86400000}
function active(rows){return rows.filter(r=>!closed.includes(r.status))}
function completed(rows){return rows.filter(r=>finished.includes(r.status))}

// Benefit comes from whatever Notion column is named like "benefit", in whatever format it uses.
// Returns a level 0–4, or -1 when unset/unreadable. Numbers are scaled against `scale` (see benefitScale).
const WORDS=[[/^(none|no|zero|nil)\b/,0],[/^(very\s*high|huge|max|maximum|massive|critical|top|game.?chang)/,4],[/^(high|big|major|large)\b/,3],[/^(med|medium|moderate|mid|some)\b/,2],[/^(low|small|minor|little|tiny|meh)\b/,1]];
const num=raw=>typeof raw==='number'?raw:(String(raw??'').match(/-?\d+(\.\d+)?/)||[])[0];
function benefit(raw,scale=4){
  if(raw===null||raw===undefined||raw==='')return -1;
  let s=String(raw).trim();
  if(typeof raw!=='number'&&/[★☆]/.test(s))return Math.min(4,(s.match(/★/g)||[]).length);
  let n=num(raw);if(n!==undefined)return Math.max(0,Math.min(4,Math.round(Number(n)/(scale||4)*4)));
  let w=s.toLowerCase();for(const [re,l] of WORDS)if(re.test(w))return l;
  let chars=[...s.replace(/[\s️]/g,'')];if(chars.length&&chars.every(c=>c===chars[0]))return Math.min(4,chars.length); // 💰💰💰, $$$
  return -1;
}
// Pick a scale for numeric benefits from the values present: 0–1, 0–4, 1–5, 0–10, 0–100, or the observed max.
function benefitScale(rows){let m=Math.max(0,...rows.map(r=>r.benefit).filter(v=>v!==null&&v!==undefined&&!/[★☆]/.test(String(v))).map(num).filter(v=>v!==undefined).map(Number));
  return m<=1&&m>0?1:m<=4?4:m<=5?5:m<=10?10:m<=100?100:m}
const WORTH=[10,20,40,70,100];
// Points for shooting down a finished task: set by its benefit; +25 if it was finished on or before its deadline.
function points(r,mode='auto',scale=4){let base=WORTH[benefit(r.benefit,scale)]??10,d=deadline(r,mode).value;let onTime=!!(d&&r.edited&&days(d,new Date(r.edited))>=0);return base+(onTime?25:0)}
const api={severity,deadline,days,active,completed,benefit,benefitScale,points,WORTH};if(typeof module!=='undefined')module.exports=api;else root.Logic=api;
})(globalThis);
