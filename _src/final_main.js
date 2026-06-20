// ════════════════════════════════════════
//  메인 플래시카드 (구술/실기 통합 카드)
// ════════════════════════════════════════
let filterMode = '전체';
let filterSub  = 'all';
let filteredCards = [...ALL_CARDS];
let currentIndex = 0;
let blurOn = false;
let timerSec = 30, timerInt = null, timerActive = false;
let wrongSet = new Set(JSON.parse(localStorage.getItem('bbWrong') || '[]'));
let examDateStr = localStorage.getItem('examDate') || '2026-06-27';

const SUBS_GUL = ['운동생리학','스포츠영양학','기능해부학','트레이닝론','도핑방지','스포츠안전','스포츠인권','생활체육'];
const SUBS_SIL = ['동작','포징'];

// ── 유형/과목 매핑 ──
function cardType(c){
  if(c.cat==='규정' && ['IFBB 종목','IFBB 복장','IFBB 규정'].includes(c.sub)) return '실기';
  if(c.cat==='트레이닝' && c.sub==='운동 동작') return '실기';
  return '구술';
}
function cardSubject(c){
  if(cardType(c)==='실기') return c.cat==='트레이닝' ? '동작' : '포징';
  if(c.cat==='생리학') return '운동생리학';
  if(c.cat==='영양학') return '스포츠영양학';
  if(c.cat==='해부학') return '기능해부학';
  if(c.cat==='트레이닝') return '트레이닝론';
  if(c.cat==='규정'){
    if(c.sub==='도핑관리') return '도핑방지';
    if(c.sub==='응급처치') return '스포츠안전';
    if(c.sub.indexOf('윤리')>=0) return '스포츠인권';
    if(c.sub==='생활체육') return '생활체육';
  }
  return c.cat;
}
function extractKw(t){
  const m = t.match(/<em>(.*?)<\/em>/);
  if(m) return m[1];
  let plain = t.replace(/<[^>]+>/g,'').trim();
  let kw = plain.split(/[—:→·]/)[0].trim();
  if(kw.length>22) kw = kw.slice(0,20)+'…';
  return kw || plain.slice(0,20);
}

// ── 필터 ──
function setFilterMode(mode, el){
  filterMode = mode; filterSub = 'all';
  document.querySelectorAll('.filter-main .btn-flt').forEach(b=>b.classList.remove('act'));
  el.classList.add('act');
  buildSubFilter(); applyFilter();
}
function buildSubFilter(){
  const row = document.getElementById('subFilterRow');
  let subs = null;
  if(filterMode==='구술') subs = SUBS_GUL;
  else if(filterMode==='실기') subs = SUBS_SIL;
  if(!subs){ row.innerHTML=''; return; }
  row.innerHTML = `<button class="btn-sub act" onclick="setSubFilter('all',this)">전체</button>` +
    subs.map(s=>`<button class="btn-sub" onclick="setSubFilter('${s}',this)">${s}</button>`).join('');
}
function setSubFilter(sub, el){
  filterSub = sub;
  document.querySelectorAll('#subFilterRow .btn-sub').forEach(b=>b.classList.remove('act'));
  el.classList.add('act');
  applyFilter();
}
function applyFilter(){
  filteredCards = ALL_CARDS.filter(c=>{
    if(filterMode!=='전체' && cardType(c)!==filterMode) return false;
    if(filterSub!=='all'   && cardSubject(c)!==filterSub) return false;
    return true;
  });
  currentIndex = 0; blurOn = false; resetTimer(); render();
}

// ── 렌더 ──
function render(){
  const total = filteredCards.length;
  const fill  = document.getElementById('progressFill');
  const ptxt  = document.getElementById('progressText');
  const psub  = document.getElementById('progSubject');
  const pstar = document.getElementById('progStars');
  const cardEl= document.getElementById('card');

  if(!total){
    cardEl.innerHTML = `<div class="card-empty">해당 카드가 없습니다.</div>`;
    if(fill) fill.style.width='0%';
    if(ptxt) ptxt.textContent='0 / 0';
    if(psub){ psub.textContent = filterSub!=='all' ? filterSub : filterMode; psub.style.borderLeftColor='var(--accent)'; }
    if(pstar) pstar.textContent='';
    document.getElementById('prevBtn').disabled=true;
    document.getElementById('nextBtn').disabled=true;
    return;
  }

  const card  = filteredCards[currentIndex];
  const color = CAT_COLORS[card.cat] || '#4f5de8';

  if(fill){ fill.style.width = `${((currentIndex+1)/total)*100}%`; fill.style.background=color; }
  if(ptxt) ptxt.textContent = `${currentIndex+1} / ${total}`;
  if(psub){ psub.innerHTML = `<span class="ps-cat" style="color:${color}">${card.cat}</span><span class="ps-sub">(${card.sub})</span>`; psub.style.borderLeftColor = color; }
  if(pstar) pstar.textContent = card.freq ? '★'.repeat(card.freq) : '';
  document.getElementById('prevBtn').disabled = currentIndex===0;
  document.getElementById('nextBtn').disabled = currentIndex===total-1;

  const w = wrongSet.has(card.q);

  // 답안 아코디언
  const grid = card.items.map((it,idx)=>{
    const kw = extractKw(it.t);
    return `<div class="ci" onclick="tapItem(${idx})">
      <div class="ci-head">
        <span class="ci-n">${it.n}</span>
        <span class="ci-kw">${kw}</span>
        <span class="ci-chev">▾</span>
      </div>
      <div class="ci-full">${it.t}</div>
    </div>`;
  }).join('');

  const gloss = (typeof GLOSSARY!=='undefined') ? GLOSSARY[card.q] : null;
  const hasGloss = gloss && gloss.length;
  const glossHtml = hasGloss ? gloss.map(g=>`<div class="gloss-item"><span class="gloss-term">${g.t}</span><span class="gloss-def">${g.d}</span></div>`).join('') : '';
  const hasPrin = (card.extra && card.extra.trim()) || (card.flow && card.flow.length);
  const prinHtml = buildPrinciple(card);

  cardEl.style.setProperty('--cc', color);
  cardEl.className = blurOn ? 'blind' : '';
  cardEl.innerHTML = `
    <div class="ck-q" onclick="revealAll()">
      <span class="ck-q-txt">${card.q}</span>
      <span class="ck-q-hint">전체공개</span>
    </div>
    <div class="ck-ctrl">
      <button class="ck-blind-btn${blurOn?' on':''}" onclick="toggleBlind();event.stopPropagation();">${blurOn?'🫣 가리는 중':'👁 답 가리기'}</button>
      <button class="ck-blind-btn${w?' on':''}" onclick="toggleWrong();event.stopPropagation();" style="${w?'border-color:#f43f5e;color:#f43f5e;background:color-mix(in srgb,#f43f5e 13%,transparent);':''}">${w?'❌ 오답됨':'❌ 오답'}</button>
      <button class="ck-timer-btn" id="timerBtn" onclick="startTimer();event.stopPropagation();">⏱ 30초</button>
    </div>
    <div class="ck-summary">
      <span class="ck-sum-lbl">요약</span>
      <span class="ck-sum-txt">${card.summary}</span>
    </div>
    <div class="ck-grid">${grid}</div>
    ${(hasGloss||hasPrin)?`
    <div class="ck-bottom">
      <div class="ck-bottom-row">
        ${hasGloss?`<button class="ck-def-btn" id="defBtn" onclick="toggleDefPanel()"${hasPrin?'':' style="border-right:none;"'}>용어 정의 ▼</button>`:''}
        ${hasPrin?`<button class="ck-prin-btn" id="prinBtn" onclick="togglePrinPanel()"${hasGloss?'':' style="border-right:none;"'}>원리 설명 ▼</button>`:''}
      </div>
      ${hasGloss?`<div class="ck-panel" id="defPanel">${glossHtml}</div>`:''}
      ${hasPrin?`<div class="ck-panel" id="prinPanel">${prinHtml}</div>`:''}
    </div>`:''}
  `;
  cardEl.style.animation='none'; cardEl.offsetHeight; cardEl.style.animation='';
}

// ── 원리 설명 구성 (기존 데이터만 사용, 가독성 정리) ──
function buildPrinciple(card){
  let html = '';
  if(card.flow && card.flow.length){
    html += '<div class="prin-flow">' + card.flow.map(f=>
      f==='→' ? '<span class="pf-arr">→</span>' : `<span class="pf-step">${f}</span>`
    ).join('') + '</div>';
  }
  if(card.extra && card.extra.trim()){
    const lines = card.extra
      .split(/\n+/).join(' ')
      .split(/(?<=[.。])\s+/)
      .map(s=>s.trim()).filter(Boolean);
    html += lines.map(s=>`<div class="prin-line">${s}</div>`).join('');
  }
  return html;
}

// ── 카드 상호작용 ──
function tapItem(idx){
  const ci = document.querySelectorAll('#card .ci')[idx];
  if(ci) ci.classList.toggle('open');
}
function revealAll(){
  const c = document.getElementById('card');
  const on = c.classList.toggle('allopen');
  c.querySelectorAll('.ci').forEach(e=>e.classList.toggle('open', on));
  const s = c.querySelector('.ck-summary');
  if(s) s.classList.toggle('show', on);
}
function toggleBlind(){
  blurOn = !blurOn;
  const c = document.getElementById('card');
  c.classList.toggle('blind', blurOn);
  const b = c.querySelector('.ck-blind-btn');
  if(b){ b.classList.toggle('on', blurOn); b.textContent = blurOn?'🫣 가리는 중':'👁 답 가리기'; }
  if(blurOn){
    c.classList.remove('allopen');
    c.querySelectorAll('.ci').forEach(e=>e.classList.remove('open'));
    const s=c.querySelector('.ck-summary'); if(s)s.classList.remove('show');
  }
}
function toggleDefPanel(){
  document.getElementById('defBtn').classList.toggle('open');
  document.getElementById('defPanel').classList.toggle('open');
}
function togglePrinPanel(){
  document.getElementById('prinBtn').classList.toggle('open');
  document.getElementById('prinPanel').classList.toggle('open');
}

// ── 타이머 ──
function startTimer(){
  const b=document.getElementById('timerBtn'); if(!b)return;
  if(timerActive){ resetTimer(); return; }
  timerActive=true; timerSec=30; b.classList.add('running'); updateTimerBtn();
  timerInt=setInterval(()=>{ timerSec--; updateTimerBtn(); if(timerSec<=0) resetTimer(); },1000);
}
function updateTimerBtn(){
  const b=document.getElementById('timerBtn'); if(!b)return;
  b.textContent = timerActive ? `⏱ ${timerSec}초` : '⏱ 30초';
}
function resetTimer(){
  clearInterval(timerInt); timerActive=false; timerSec=30;
  const b=document.getElementById('timerBtn');
  if(b){ b.classList.remove('running'); b.textContent='⏱ 30초'; }
}

// ── 이동 ──
function move(dir){
  if(!filteredCards.length) return;
  currentIndex = Math.max(0, Math.min(filteredCards.length-1, currentIndex+dir));
  resetTimer(); render();
}
function shuffle(){
  if(!filteredCards.length) return;
  for(let i=filteredCards.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [filteredCards[i],filteredCards[j]]=[filteredCards[j],filteredCards[i]];
  }
  currentIndex=0; resetTimer(); render();
}

// ── 테마 ──
function toggleTheme(){
  const dark = document.documentElement.classList.toggle('dark');
  const t=document.getElementById('themeBtn'); if(t)t.textContent = dark?'☀️':'🌙';
  localStorage.setItem('theme', dark?'dark':'light');
}

// ── D-day ──
function updateDday(){
  const e=document.getElementById('ddayBadge'); if(!e)return;
  const today=new Date(); today.setHours(0,0,0,0);
  const exam=new Date(examDateStr+'T00:00:00');
  const diff=Math.round((exam-today)/86400000);
  e.textContent = diff>0 ? `D-${diff}` : (diff===0 ? 'D-DAY' : `D+${-diff}`);
}
function openDdayEdit(){
  document.getElementById('ddayInput').value = examDateStr;
  document.getElementById('ddayModal').classList.add('open');
}
function closeDdayEdit(){ document.getElementById('ddayModal').classList.remove('open'); }
function saveDday(){
  const v=document.getElementById('ddayInput').value;
  if(v){ examDateStr=v; localStorage.setItem('examDate',v); updateDday(); }
  closeDdayEdit();
}

// ── 오답노트 ──
function toggleWrong(){
  const c=filteredCards[currentIndex]; if(!c)return;
  if(wrongSet.has(c.q)) wrongSet.delete(c.q); else wrongSet.add(c.q);
  localStorage.setItem('bbWrong', JSON.stringify([...wrongSet]));
  updateWrongBadge(); render();
}
function updateWrongBadge(){
  const e=document.getElementById('wrongCountBadge'); if(e)e.textContent=wrongSet.size;
}
function openWrongMode(){
  const cards = ALL_CARDS.filter(c=>wrongSet.has(c.q));
  document.getElementById('cmTitle').textContent = `❌ 오답노트 (${cards.length})`;
  const list = document.getElementById('cmCardList');
  if(!cards.length){
    list.innerHTML = `<div class="cm-empty">오답으로 표시한 카드가 없습니다.<br><span style="font-size:11px;">카드의 ❌ 버튼을 눌러 추가하세요.</span></div>`;
  } else {
    list.innerHTML = cards.map(c=>{
      const items = c.items.map(it=>`<div style="margin-top:4px;">${it.n} ${it.t}</div>`).join('');
      const color = CAT_COLORS[c.cat]||'#4f5de8';
      return `<div class="cm-card-item" style="border-color:color-mix(in srgb,#f43f5e 35%,transparent);">
        <div style="font-family:var(--mono);font-size:10px;font-weight:700;color:${color};margin-bottom:5px;">${c.cat} · ${cardSubject(c)}</div>
        <div class="cm-card-q">${c.q}</div>
        <div class="cm-card-a"><b>요약:</b> ${c.summary}${items}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('cardModeOverlay').style.display='block';
}
function closeCardMode(){ document.getElementById('cardModeOverlay').style.display='none'; }

// ── 키보드 ──
document.addEventListener('keydown', e=>{
  if(document.getElementById('examOverlay').style.display==='block') return;
  if(document.getElementById('cardModeOverlay').style.display==='block') return;
  if(document.getElementById('ddayModal').classList.contains('open')) return;
  if(e.key==='ArrowRight'||e.key==='ArrowDown') move(1);
  if(e.key==='ArrowLeft'||e.key==='ArrowUp') move(-1);
  if(e.key===' '){ e.preventDefault(); revealAll(); }
});

// ── 초기화 ──
function init(){
  if(localStorage.getItem('theme')==='dark'){
    document.documentElement.classList.add('dark');
    const t=document.getElementById('themeBtn'); if(t)t.textContent='☀️';
  }
  updateDday(); setInterval(updateDday, 60000);
  updateWrongBadge();
  applyFilter();
}
document.addEventListener('DOMContentLoaded', init);

