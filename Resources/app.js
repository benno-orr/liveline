const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={rows:[],updatedAt:null,source:'snapshot'},connected=false,selected=null;
const names=['Open field','Little shed','House','City block','Big city'],levels=['No consequence','Low consequence','Medium consequence','High consequence','Highest consequence'];
const native=(action,extra={})=>window.webkit?.messageHandlers.native.postMessage({action,...extra});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const PF=PixelFont;

// ---- Arcade palette ----
const WHITE='#f4f4f4',GREEN='#33ff66',RED='#ff3d6e',GREY='#8c8c8c',DIM='#3a3a3a';
// Worth bar: 4 segments filled by benefit level, colour heating up with value.
const WORTH_COLORS=['#555','#33ff66','#c8ff33','#ffd23f','#ff9f1a'],WORTH_NAMES=['No benefit','Small win','Solid win','Big win','Huge win'];
let scale=4; // numeric benefit scale, re-detected from Notion values on each render
const benefitOf=r=>r._practice?-1:Logic.benefit(r.benefit,scale);
function worthBar(level,y){if(level<0)return '';let s='';for(let i=0;i<4;i++)s+=`<rect x="${-13.5+i*7}" y="${y.toFixed(1)}" width="6" height="4" fill="${i<level?WORTH_COLORS[level]:'#262626'}"/>`;return `<g class="worth" shape-rendering="crispEdges">${s}</g>`}
function worthHTML(level){if(level<0)return '<span class="worth unset" title="Benefit not set">'+'<i></i>'.repeat(4)+'</span>';return `<span class="worth" style="--c:${WORTH_COLORS[level]}" title="${WORTH_NAMES[level]}">${[0,1,2,3].map(i=>`<i${i<level?' class="on"':''}></i>`).join('')}</span>`}

// ---- Field geometry (SVG units) ----
const W=920,H=584,LEFT=70,RIGHT=910,LANE=(RIGHT-LEFT)/5,TOP=80,GROUND=400,RAIL=426,BLDG=500;
const laneX=i=>LEFT+LANE*(i+.5),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MARCH=[0,4,8,4,0,-4,-8,-4];

// ---- Pixel sprites ----
function pixels(rows,p){let n=Math.max(...rows.map(r=>r.length)),d='';rows.forEach((row,r)=>[...row].forEach((c,col)=>{if(c==='#')d+=`M${+((col-n/2)*p).toFixed(2)} ${+((r-rows.length/2)*p).toFixed(2)}h${p}v${p}h${-p}z`}));return d}
const SPRITES=[
  {body:['...........','...#####...','..#######..','.##.#.#.##.','.#########.','.#.#.#.#.#.'],a:['#.#.#.#.#.#','...........'],b:['.#.#.#.#.#.','#.........#']},
  {body:['....###....','..#######..','.###...###.','####.#.####','.#########.','...#...#...'],a:['..#.....#..','.#.......#.'],b:['...#...#...','...#...#...']},
  {body:['#.........#','.#..###..#.','..#######..','.##.###.##.','###########','#.#######.#'],a:['#.#.....#.#','...##.##...'],b:['..#.....#..','.#.......#.']},
  {body:['...#####...','.#########.','##.##.##.##','###########','..##.#.##..','.##.....##.'],a:['##.......##','...........'],b:['.##.....##.','.#.......#.']},
  {body:['..#######..','.#########.','##..###..##','###########','#.#.###.#.#','#.#######.#'],a:['...#...#...','..##...##..'],b:['..#.....#..','.##.....##.']},
];
const PIX=[2.2,2.4,2.6,2.8,3.2];
const SPR=SPRITES.map((s,i)=>({a:pixels([...s.body,...s.a],PIX[i]),b:pixels([...s.body,...s.b],PIX[i]),w:11*PIX[i],h:8*PIX[i]}));
const CHECK=pixels(['.........##','........##.','##.....##..','.##...##...','..##.##....','...###.....','....#......'],1.6);
const CANNON=pixels(['.....#.....','....###....','.#..###..#.','.#########.','###########','###.....###'],2.6);
const SPLAT=pixels(['...#.....#...','.#..#...#..#.','..#.......#..','##.........##','..#.......#..','.#..#...#..#.','...#.....#...'],2.4);
const BOMB=pixels(['#.','.#','#.','.#','#.'],2);
// Pixel buildings, one per severity lane, drawn like green arcade bunkers.
const BUILDINGS=[
  ['........................','........................','........................','........................','........................','........................','..................#.....','.................###....','..................#.....','..#.....#.........#.....','.#.#...#.#...#....#..#..','#...#.#...#.#.#...#.#.#.','########################','########################'],
  ['........................','........................','........................','........................','..........####..........','........########........','......############......','....################....','......############......','......#.##.##.##.#......','......############......','......####....####......','########################','########################'],
  ['...............##.......','..........##...##.......','........######.##.......','......##########........','....##############......','..##################....','....##############......','....##..##..##..##......','....##############......','....######....####......','....######....####......','....######....####......','########################','########################'],
  ['........................','..........######........','..........#.##.#........','..#####...######........','..#.#.#...#.##.#..#####.','..#####...######..#.#.#.','..#.#.#...#.##.#..#####.','..#####...######..#.#.#.','..#.#.#...#.##.#..#####.','..#####...######..#.#.#.','..#.#.#...#.##.#..#####.','..#####...######..#####.','########################','########################'],
  ['............#...........','............#...........','...........###..........','......####.#####........','......#.##.#.#.#........','..###.####.#####.####...','..#.#.#.##.#.#.#.#.##...','..###.####.#####.####.##','..#.#.#.##.#.#.#.#.##.#.','..###.####.#####.####.##','..#.#.#.##.#.#.#.#.##.#.','..###.####.#####.####.##','########################','########################'],
].map(g=>pixels(g,3));
// Pixel lock-on brackets around a finished target.
function lock(bw,bh){let c='';for(let [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){let x=sx*bw,y=sy*bh;c+=`M${x.toFixed(1)} ${y.toFixed(1)}h${-sx*8}v${-sy*2}h${sx*6}v${-sy*6}h${sx*2}z`}return `<path class="lock" d="${c}" fill="${RED}"/>`}
// Small standalone invader for HTML (task list, side panel).
function invaderHTML(se,size,fill='currentColor'){if(se<0)return `<svg class="px" aria-hidden="true" width="${size}" height="${size*8/11}" viewBox="0 0 11 8"><path d="M0 0h11v8H0z M2 2v4h7V2z" fill-rule="evenodd" fill="${DIM}"/></svg>`;let s=SPRITES[se],d=pixels([...s.body,...s.a],1);return `<svg class="px" aria-hidden="true" width="${size}" height="${size*8/11}" viewBox="-5.5 -4 11 8"><path d="${d}" fill="${fill}" shape-rendering="crispEdges"/></svg>`}

// ---- Game state ----
const game={score:0,kills:0,defeated:new Set(),cannon:(LEFT+RIGHT)/2,target:null,queued:false,aimId:null,keys:{left:false,right:false},
  bullets:[],bombs:[],fx:[],targets:[],practice:[],step:0,stepAt:0,last:0,cooldown:0,bombClock:0,pinged:{},banner:null};
function save(){native('saveGame',{value:JSON.stringify({score:game.score,kills:game.kills,defeated:[...game.defeated]})})}
function load(text){try{let g=JSON.parse(text||'{}');game.score=+g.score||0;game.kills=+g.kills||0;game.defeated=new Set(Array.isArray(g.defeated)?g.defeated:[])}catch{}}

function info(r){let d=Logic.deadline(r,$('#deadline').value),n=Logic.days(d.value);return {...d,n}}
function dueText(r){let {n,kind}=info(r);if(n===null)return 'No deadline';return (n<0?`${Math.ceil(-n)}d overdue`:n<1?'Due today':`${Math.ceil(n)}d away`)+` · ${kind}`}
const isDone=r=>r._practice||Logic.completed([r]).length>0;
const pointsFor=r=>r._practice?0:Logic.points(r,$('#deadline').value,scale);
const pad=n=>String(n).padStart(5,'0');

// ---- Static field (rebuilt on data / selection changes) ----
function fieldSVG(rows,h){
  const yOf=n=>GROUND-16-(GROUND-16-TOP)*clamp(n,0,h)/h;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Invader field: invaders descend toward today as deadlines approach; lanes increase in consequence from left to right"><rect width="${W}" height="${H}" fill="#000"/>`;
  s+=`<g id="hud"></g>`;
  for(let t of [h/4,h/2,h*3/4,h]){let y=yOf(t);s+=`<path d="M${LEFT} ${y}H${RIGHT}" stroke="#141414" stroke-dasharray="2 6"/>`+PF.svg(`+${Math.round(t)}D`,LEFT-10,y+4,{s:1.2,fill:'#555',anchor:'end'})}
  s+=`<path d="M${LEFT} ${GROUND}H${RIGHT}" stroke="${GREEN}" stroke-opacity=".5" stroke-dasharray="4 4"/>`+PF.svg('TODAY',LEFT-10,GROUND+4,{s:1.2,fill:GREEN,anchor:'end'});
  s+=`<rect x="0" y="${RAIL+16}" width="${W}" height="2" fill="${GREEN}"/>`;
  for(let i=0;i<5;i++)s+=`<g transform="translate(${laneX(i)} ${BLDG})"><path class="bldg" id="bldg${i}" d="${BUILDINGS[i]}" fill="${GREEN}" shape-rendering="crispEdges"/></g>`+PF.svg(names[i],laneX(i),BLDG+38,{s:1.4,fill:GREEN,anchor:'middle'})+PF.svg(levels[i],laneX(i),BLDG+52,{s:1,fill:'#5a5a5a',anchor:'middle'});

  // Lane = severity, height = time to deadline. Finished tasks without a position sit at the top.
  const done=Logic.completed(state.rows).filter(r=>!game.defeated.has(r.id)).concat(game.practice);
  const field=rows.filter(r=>info(r).n!==null&&Logic.severity(r.severity)>=0).concat(done);
  const groups=new Map();
  for(let r of field){let n=info(r).n,se=Logic.severity(r.severity),lane=se>=0?se:2,ratio=n===null?1:clamp(n,0,h)/h,key=lane+':'+Math.round(ratio*12);if(!groups.has(key))groups.set(key,{lane,ratio:Math.round(ratio*12)/12,rows:[]});groups.get(key).rows.push(r)}
  game.targets=[];let inv='';
  for(let g of groups.values()){
    let baseY=yOf(g.ratio*h),dir=baseY<(TOP+GROUND)/2?1:-1,per=Math.min(4,g.rows.length);
    g.rows.forEach((r,j)=>{
      let d=info(r),se=Logic.severity(r.severity),sp=SPR[Math.max(0,se)],done=isDone(r),col=j%4,row=Math.floor(j/4);
      let x=laneX(g.lane)+(col-(per-1)/2)*38,y=baseY+dir*row*26,title=r.title||'Untitled task';
      let late=!done&&d.n!==null&&d.n<1,overdue=late&&d.n<0,soft=!done&&d.kind==='soft';
      // Colour bands like arcade cellophane: white sky, green near today, red for finished bonus targets.
      let fill=done?RED:late?GREEN:WHITE;
      let label=done?(r._practice?'Training drone':title):title;label=label.length>24?label.slice(0,23)+'…':label;
      let lw=PF.width(label,1.2)+6,ly=sp.h/2+(done?10:6);
      let worth=benefitOf(r),aria=done?`${title}, finished, ready to shoot down for ${pointsFor(r)} points`:`${title}, ${dueText(r)}, ${se>=0?levels[se]:'severity unset'}, worth ${pointsFor(r)} points when finished`;
      inv+=`<g class="inv${done?' done':''}${overdue?' overdue':''}${r.id===selected?' selected':''}" tabindex="0" role="button" aria-label="${esc(aria)}" data-id="${esc(r.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><title>${esc(title)} — ${done?'finished · shoot it down':esc(dueText(r))} · worth ${pointsFor(r)} pts</title><rect x="-20" y="-15" width="40" height="30" fill="transparent"/><path class="spr a" d="${sp.a}" fill="${fill}"${soft?' fill-opacity=".45"':''} shape-rendering="crispEdges"/><path class="spr b" d="${sp.b}" fill="${fill}"${soft?' fill-opacity=".45"':''} shape-rendering="crispEdges"/>${worthBar(worth,-sp.h/2-10)}${done?`${lock(sp.w/2+7,sp.h/2+6)}<path class="check" d="${CHECK}" fill="${RED}" shape-rendering="crispEdges" transform="translate(${(sp.w/2+12).toFixed(1)} ${(-sp.h/2-4).toFixed(1)})"/>`:''}<g class="label"><rect x="${(-lw/2).toFixed(1)}" y="${ly.toFixed(1)}" width="${lw.toFixed(1)}" height="13" fill="#000"/>${PF.svg(label,0,ly+10.4,{s:1.2,fill:done?RED:WHITE,anchor:'middle'})}</g></g>`;
      game.targets.push({id:r.id,x,y,w:sp.w,h:sp.h,lane:g.lane,n:d.n,done,practice:!!r._practice,pts:pointsFor(r),color:fill,dead:false});
    });
  }
  s+=`<g id="formation">${inv}</g><g id="cannon" transform="translate(${game.cannon.toFixed(1)} ${RAIL})"><path d="${CANNON}" fill="${GREEN}" shape-rendering="crispEdges"/></g><g id="fx"></g>`;
  let ready=done.length,hint=ready?`${ready} finished · ←→ move · space fire · click ✓ to auto-aim`:connected?'Finish a task in Notion · it turns ✓ here · then shoot it down':'Connect Notion for finished tasks · or press practice';
  s+=PF.svg(hint,(LEFT+RIGHT)/2,60,{s:1.4,fill:ready?RED:'#555',anchor:'middle'});
  let unmapped=rows.filter(r=>info(r).n!==null&&Logic.severity(r.severity)<0).length,noBenefit=state.source==='live'&&!state.benefitColumn;
  s+=PF.svg(`${noBenefit?'no benefit column found in notion · ':''}${unmapped?unmapped+' dated tasks have unset severity · ':''}overdue invaders have landed · beyond ${h}d they hold at the top`,W/2,H-6,{s:1,fill:'#444',anchor:'middle'});
  return s+'</svg>';
}

function render(){
  scale=Logic.benefitScale(state.rows);
  let rows=Logic.active(state.rows),h=+$('#horizon').value;
  let due=rows.filter(r=>{let n=info(r).n;return n!==null&&n>=0&&n<1}).length,over=rows.filter(r=>info(r).n!==null&&info(r).n<0).length,undated=rows.filter(r=>info(r).n===null).length;
  for(let [id,v] of [['due',due],['overdue',over],['undated',undated]]){let el=$('#'+id);el.innerHTML=PF.html(String(v).padStart(2,'0'),5);el.setAttribute('aria-label',v)}
  let focused=document.activeElement?.closest?.('#map .inv')?.dataset.id;
  $('#map').innerHTML=fieldSVG(rows,h);
  if(focused)$(`#map .inv[data-id="${CSS.escape(focused)}"]`)?.focus();
  let query=$('#search').value.toLowerCase();let filtered=rows.filter(r=>(r.title+' '+r.domain+' '+r.status).toLowerCase().includes(query)).sort((a,b)=>(info(a).n??Infinity)-(info(b).n??Infinity)||Logic.severity(b.severity)-Logic.severity(a.severity));$('#count').textContent=`${filtered.length} tasks`;
  $('#task-list').innerHTML=filtered.map(r=>{let n=info(r).n;return `<button class="task ${r.id===selected?'selected':''}${n!==null&&n<1?' late':''}" data-id="${esc(r.id)}"><span class="mini">${invaderHTML(Logic.severity(r.severity),26)}</span><span><span class="title">${esc(r.title||'Untitled task')}</span><small>${worthHTML(benefitOf(r))}${esc(dueText(r))} · ${esc(r.status)}${r.severity?'':' · severity unset'}</small></span></button>`}).join('')||'<p>No matching tasks.</p>';$('#task-list').querySelectorAll('button').forEach(el=>el.onclick=()=>choose(el.dataset.id));
  $('#connection').textContent=connected?'● Connected to Notion':'○ Imported snapshot';$('#updated').textContent=(state.source==='live'?'Last synced: ':'Snapshot imported: ')+(state.updatedAt?new Date(state.updatedAt).toLocaleString():'—');
  hud();if(selected)detail();
}
function hud(){
  let left=game.targets.filter(t=>t.done&&!t.dead).length,g=$('#hud');
  $('#hud-text').textContent=`Score ${game.score}. Downed ${game.kills}. ${left} finished tasks in range.`;
  if(!g)return;
  g.innerHTML=PF.svg('SCORE',LEFT,22,{s:1.6,fill:WHITE})+PF.svg(pad(game.score),LEFT,42,{s:2,fill:GREEN})
    +PF.svg('DOWNED',(LEFT+RIGHT)/2,22,{s:1.6,fill:WHITE,anchor:'middle'})+PF.svg(pad(game.kills),(LEFT+RIGHT)/2,42,{s:2,fill:GREEN,anchor:'middle'})
    +PF.svg('✓ IN RANGE',RIGHT,22,{s:1.6,fill:WHITE,anchor:'end'})+PF.svg(String(left).padStart(2,'0'),RIGHT,42,{s:2,fill:left?RED:GREEN,anchor:'end',cls:left?'blink':''});
}
function choose(id){selected=id;render()}
function detail(){let r=state.rows.find(r=>r.id===selected);if(!r){selected=null;return}let se=Logic.severity(r.severity),done=isDone(r),downed=game.defeated.has(r.id);
  let action=done?(downed?`<div class="detail-fact"><span>Status</span>Finished and shot down</div>`:`<button class="shoot" id="shoot">✓ Shoot it down · +${pointsFor(r)}</button>`):'';
  $('#detail').innerHTML=`<div class="eyebrow">MISSION CONTROL</div><div class="detail-icon${done?' done':''}">${invaderHTML(se,66)}</div><h2>${esc(r.title||'Untitled task')}</h2><p>${esc([r.domain,r.status].filter(Boolean).join(' · '))}</p><div class="detail-fact"><span>What you gain</span>${worthHTML(benefitOf(r))}${benefitOf(r)<0?'Benefit not set':WORTH_NAMES[benefitOf(r)]+(r.benefit!=null&&String(r.benefit)!==''?' · '+esc(r.benefit):'')}<br><small class="pts">Worth ${pointsFor(r)} pts${done?'':' when finished'}</small></div><div class="detail-fact"><span>What’s at stake</span>${se>=0?names[se]+' · '+levels[se]:'Severity not set'}</div><div class="detail-fact"><span>Hard deadline</span>${esc(r.hard||'Not set')}</div><div class="detail-fact"><span>Soft deadline</span>${esc(r.soft||'Not set')}</div><p>${esc(r.notes)}</p>${action}<button${done?'':' class="primary"'} id="open-row">Open task in Notion ↗</button><div class="aside-note">${done?'Points come from the task’s benefit, plus 25 if finished on time.':esc(dueText(r))+'. Edit the task in Notion, then refresh your map.'}</div>`;
  $('#open-row').onclick=()=>native('open',{url:r.url});if($('#shoot'))$('#shoot').onclick=()=>{aimAt(r.id);$('#map').focus()};
}

// ---- Gameplay ----
const offset=()=>reduced?0:MARCH[game.step];
function aimAt(id){let t=game.targets.find(t=>t.id===id&&!t.dead);if(!t)return;game.target=t.x;game.queued=true;game.aimId=id}
function fire(aim=null){if(game.bullets.length>=3||game.cooldown>0)return false;game.bullets.push({x:game.cannon,y:RAIL-10,aim});game.cooldown=.2;return true}
function burst(x,y,color,count,speed){for(let i=0;i<count;i++){let a=Math.random()*Math.PI*2,v=speed*(.3+Math.random()*.9);game.fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.6,max:.6,color})}}
function splat(x,y,color,life=.35){game.fx.push({splat:true,x,y,vx:0,vy:0,life,max:life,color})}
function popup(x,y,text,color){game.fx.push({text,x,y,vx:0,vy:-30,life:1.2,max:1.2,color})}
function destroy(t){
  t.dead=true;let x=t.x+offset();$(`#formation .inv[data-id="${CSS.escape(t.id)}"]`)?.classList.add('boom');
  splat(x,t.y,RED,.45);burst(x,t.y,RED,14,150);burst(x,t.y,WHITE,8,90);
  if(t.practice){game.practice=game.practice.filter(p=>p.id!==t.id);popup(x,t.y-18,'NICE SHOT',WHITE)}
  else{game.score+=t.pts;game.kills++;game.defeated.add(t.id);popup(x,t.y-18,`+${t.pts}`,RED);save()}
  if(!game.targets.some(o=>o.done&&!o.dead))game.banner={text:'SECTOR CLEAR',until:performance.now()+2400};
  hud();if(selected===t.id)detail();
}
function step(dt,ts){
  if(!reduced&&ts-game.stepAt>550){game.stepAt=ts;game.step=(game.step+1)%MARCH.length;let f=$('#formation');if(f){f.setAttribute('transform',`translate(${MARCH[game.step]} 0)`);f.classList.toggle('f2',game.step%2===1)}}
  game.cooldown=Math.max(0,game.cooldown-dt);
  let dir=(game.keys.right?1:0)-(game.keys.left?1:0);
  if(dir){game.cannon+=dir*380*dt;game.target=null;game.queued=false}
  else if(game.target!==null){let d=game.target-game.cannon;game.cannon+=Math.sign(d)*Math.min(Math.abs(d),560*dt)}
  game.cannon=clamp(game.cannon,LEFT+16,RIGHT-16);
  if(game.queued&&Math.abs(game.cannon-game.target)<1.5&&fire(game.aimId)){game.queued=false;game.aimId=null;game.target=null}
  $('#cannon')?.setAttribute('transform',`translate(${game.cannon.toFixed(1)} ${RAIL})`);
  let off=offset();
  game.bullets=game.bullets.filter(b=>{
    b.y-=580*dt;if(b.y<TOP-20)return false;
    for(let t of game.targets){
      if(t.dead||(b.aim&&t.id!==b.aim))continue;
      if(Math.abs(b.x-(t.x+off))<t.w/2+3&&Math.abs(b.y-t.y)<t.h/2+3){
        if(t.done){destroy(t);return false}
        splat(b.x,b.y-4,WHITE,.18);
        if(!(ts-(game.pinged[t.id]||0)<1500)){game.pinged[t.id]=ts;popup(t.x+off,t.y-18,'STILL ACTIVE',GREY)}
        return false;
      }
    }
    if(!b.aim)for(let k of game.bombs)if(!k.dead&&Math.abs(b.x-k.x)<6&&Math.abs(b.y-k.y)<10){k.dead=true;splat(k.x,k.y,WHITE,.2);return false}
    return true;
  });
  if(!reduced){game.bombClock+=dt;if(game.bombClock>1.8){game.bombClock=0;let late=game.targets.filter(t=>!t.done&&!t.dead&&t.n!==null&&t.n<1);if(late.length){let t=late[Math.floor(Math.random()*late.length)];game.bombs.push({x:t.x+off,y:t.y+t.h/2,lane:t.lane})}}}
  game.bombs=game.bombs.filter(k=>{if(k.dead)return false;k.y+=150*dt;if(k.y>=BLDG-6){splat(k.x,k.y,GREEN,.3);let b=$('#bldg'+k.lane);if(b){b.classList.remove('hit');void b.getBBox();b.classList.add('hit')}return false}return true});
  game.fx=game.fx.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;return p.life>0});
}
const snap=v=>Math.round(v/2)*2;
function draw(ts){
  let fx=$('#fx');if(!fx)return;let s='';
  for(let b of game.bullets)s+=`<rect x="${snap(b.x-1)}" y="${snap(b.y)}" width="2" height="10" fill="${WHITE}"/>`;
  for(let k of game.bombs)s+=`<path d="${BOMB}" fill="${WHITE}" transform="translate(${snap(k.x)} ${snap(k.y)})"/>`;
  for(let p of game.fx){
    if(p.splat)s+=`<path d="${SPLAT}" fill="${p.color}" transform="translate(${snap(p.x)} ${snap(p.y)})"/>`;
    else if(p.text)s+=PF.svg(p.text,p.x,p.y,{s:1.6,fill:p.color,anchor:'middle',attrs:p.life<.4&&Math.floor(p.life*20)%2?' opacity="0"':''});
    else s+=`<rect x="${snap(p.x)}" y="${snap(p.y)}" width="3" height="3" fill="${p.color}"/>`;
  }
  if(game.banner&&ts<game.banner.until)s+=PF.svg(game.banner.text,(LEFT+RIGHT)/2,245,{s:5,fill:RED,anchor:'middle',cls:'blink'});
  fx.innerHTML=s;
}
function loop(ts){let dt=Math.min(.05,(ts-(game.last||ts))/1000);game.last=ts;step(dt,ts);draw(ts);requestAnimationFrame(loop)}

function svgX(e){let svg=$('#map svg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse()).x}
$('#map').addEventListener('click',e=>{
  let inv=e.target.closest('.inv');
  if(inv){let id=inv.dataset.id,t=game.targets.find(t=>t.id===id);if(!t?.practice)choose(id);if(t?.done)aimAt(id);return}
  if(!$('#map svg'))return;game.target=clamp(svgX(e),LEFT+16,RIGHT-16);game.queued=true;game.aimId=null;$('#map').focus();
});
$('#map').addEventListener('keydown',e=>{let inv=e.target.closest?.('.inv');if(inv&&e.key==='Enter'){e.preventDefault();let id=inv.dataset.id,t=game.targets.find(t=>t.id===id);if(!t?.practice)choose(id);if(t?.done)aimAt(id)}});
const gameKey=e=>!$('#connect').open&&!e.metaKey&&!e.ctrlKey&&!e.target.closest?.('input,select,textarea,button,dialog');
document.addEventListener('keydown',e=>{if(!gameKey(e))return;let k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='a'){game.keys.left=true;e.preventDefault()}else if(k==='arrowright'||k==='d'){game.keys.right=true;e.preventDefault()}else if(k===' '){e.preventDefault();game.queued=false;fire()}});
document.addEventListener('keyup',e=>{let k=e.key.toLowerCase();if(k==='arrowleft'||k==='a')game.keys.left=false;if(k==='arrowright'||k==='d')game.keys.right=false});
window.addEventListener('blur',()=>{game.keys.left=game.keys.right=false});
$('#practice').onclick=()=>{game.practice=[1,2,3].map(i=>({id:'practice-'+i+'-'+Date.now(),title:'Training drone',severity:'★'.repeat(i),hard:null,soft:null,status:'DONE',_practice:true}));render();$('#map').focus()};

// Pixel lettering for static headings.
document.querySelectorAll('[data-pixel]').forEach(el=>{let t=el.textContent.trim();el.setAttribute('aria-label',t);el.innerHTML=PF.html(t,+el.dataset.pixel||3)});
document.querySelector('.empty-icon').innerHTML=invaderHTML(2,88);

window.receive=e=>{
  if(e.type==='game'){load(e.value);render()}
  if(e.type==='data'){state=e.value;connected=e.connected;
    if(state.source==='live'){let ids=new Set(state.rows.map(r=>r.id)),before=game.defeated.size;for(let id of game.defeated)if(!ids.has(id))game.defeated.delete(id);if(game.defeated.size!==before)save()}
    $('#notice').textContent='';$('#refresh').disabled=false;$('#refresh').textContent='↻ Refresh';render()}
  if(e.type==='error'){$('#notice').textContent=e.message;$('#connect-status').textContent=e.message;$('#refresh').disabled=false;$('#refresh').textContent='↻ Retry'}if(e.type==='connect')$('#connect').showModal();if(e.type==='syncing'){$('#refresh').disabled=true;$('#refresh').textContent='Syncing…'}if(e.type==='connected'){connected=true;$('#token').value='';$('#connect').close();render()}if(e.type==='disconnected'){connected=false;$('#connect-status').textContent='Disconnected. Your saved map remains available.';render()}};
$('#refresh').onclick=()=>native('sync');$('#settings').onclick=()=>$('#connect').showModal();$('#notion').onclick=()=>native('open');$('#save').onclick=()=>{if($('#token').value.trim())native('saveToken',{token:$('#token').value});else $('#connect-status').textContent='Enter an integration secret first.'};$('#disconnect').onclick=()=>native('disconnect');$('#integration-link').onclick=()=>native('open',{url:'https://www.notion.so/profile/integrations'});$('#deadline').onchange=render;$('#horizon').onchange=render;$('#search').oninput=render;setInterval(render,60000);render();requestAnimationFrame(loop);
