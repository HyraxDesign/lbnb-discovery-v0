/* NAVA 1.6 — operational prototype, preserving existing local data. */
'use strict';
window.NAVA_VERSION='1.6.0';
const v16Style=document.createElement('style');
v16Style.textContent=`.rangePicker{padding:16px;background:#faf8f4;border-radius:20px;margin:12px 0}.rangePicker header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.rangePicker header button{width:40px!important;margin:0!important;padding:8px!important}.rangePicker .rangeSummary{font-size:13px;margin:12px 0;color:#666}.rangeGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.rangeGrid span{text-align:center;font-size:11px;color:#888;padding:8px 0}.rangeGrid button{margin:0!important;padding:0!important;height:40px;border-radius:10px;font-size:13px!important;text-align:center!important;background:transparent}.rangeGrid button.inRange{background:#e6dfd2}.rangeGrid button.endpoint{background:#111;color:white}.rangeGrid button:disabled{opacity:.25}.rangeGrid i{height:40px}.actionSheet{max-height:85dvh;overflow-y:auto}.calDay{overflow-wrap:anywhere}.calEvent{font-size:9px}.calDay{font-size:12px;min-height:64px}.reelFullscreen{touch-action:pan-x}.nodeHandle{touch-action:none}`;
document.head.appendChild(v16Style);

// An explicit date range with native inputs retained for keyboard/accessibility.
function attachRangePicker(startInput,endInput,{overnight=false}={}){
  const panel=document.createElement('div');panel.className='rangePicker';
  const row=startInput.closest('.formRow');row.append(panel);
  let month=new Date((startInput.value||todayISO())+'T12:00:00');month.setDate(1);
  let selectingEnd=false;
  function draw(){
    const y=month.getFullYear(),m=month.getMonth(),count=new Date(y,m+1,0).getDate(),offset=(month.getDay()+6)%7;
    let days='<i></i>'.repeat(offset);
    for(let d=1;d<=count;d++){
      const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      days+=`<button type="button" data-date="${iso}" class="${iso===startInput.value||iso===endInput.value?'endpoint':iso>startInput.value&&iso<endInput.value?'inRange':''}" aria-label="${esc(fmtDate(iso))}" aria-pressed="${iso===startInput.value||iso===endInput.value}" ${iso<todayISO()?'disabled':''}>${d}</button>`;
    }
    panel.innerHTML=`<header><button type="button" data-month="-1" aria-label="Previous month">‹</button><strong>${new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" data-month="1" aria-label="Next month">›</button></header><div class="rangeGrid">${['M','T','W','T','F','S','S'].map(d=>`<span>${d}</span>`).join('')}${days}</div><div class="rangeSummary" aria-live="polite">${selectingEnd?(overnight?'Choose check-out':'Choose the end date'):(overnight?'Choose check-in':'Choose the start date')} · ${esc(fmtDateRange(startInput.value,endInput.value))}</div>`;
    panel.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month.setMonth(month.getMonth()+Number(b.dataset.month));draw()});
    panel.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{
      const iso=b.dataset.date;
      if(!selectingEnd||iso<startInput.value||(overnight&&iso===startInput.value)){
        startInput.value=iso;endInput.value=overnight?nextDay(iso):iso;selectingEnd=true;
      }else{endInput.value=iso;selectingEnd=false}
      endInput.min=overnight?nextDay(startInput.value):startInput.value;draw();
    });
  }
  startInput.min=todayISO();
  startInput.addEventListener('change',()=>{endInput.min=overnight?nextDay(startInput.value):startInput.value;if(endInput.value<endInput.min)endInput.value=endInput.min;draw()});
  endInput.addEventListener('change',draw);draw();
}
const legacyDatePicker=openDatePicker;
openDatePicker=function(){legacyDatePicker();attachRangePicker($('journeyStartInput'),$('journeyEndInput'))};
const legacyBookingSheet=openBookingSheet;
openBookingSheet=function(o,unit){legacyBookingSheet(o,unit);if($('bookingStart')&&$('bookingEnd'))attachRangePicker($('bookingStart'),$('bookingEnd'),{overnight:true})};

// Browse the same feed order in fullscreen; horizontal carousel gestures stay local.
const legacyFullscreen=openReelFullscreen;
openReelFullscreen=function(reel){
  legacyFullscreen(reel);
  const content=$('reelFullscreenContent');let start=null;
  content.onpointerdown=e=>{start=e.target.closest('.railShell,button,a')?null:{x:e.clientX,y:e.clientY}};
  content.onpointerup=e=>{
    if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
    if(Math.abs(dy)<60||Math.abs(dy)<Math.abs(dx)*1.4)return;
    stepFullscreen(dy<0?1:-1);
  };
  content.onpointercancel=()=>{start=null};
};
function stepFullscreen(step){
  const reels=[...document.querySelectorAll('#feed .reel')],id=$('reelFullscreenContent').querySelector('.reel')?.dataset.reel;
  const index=reels.findIndex(r=>r.dataset.reel===id),next=reels[index+step];
  if(next){openReelFullscreen(next);next.scrollIntoView({block:'start'})}
}
document.addEventListener('keydown',e=>{if(!$('reelFullscreen').hidden&&$('sheet').hidden&&$('actionSheet').hidden){if(e.key==='ArrowDown')stepFullscreen(1);if(e.key==='ArrowUp')stepFullscreen(-1)}});
// Keep the chosen random/personalized feed order stable during media hydration.
const legacyOrderedReels=orderedReels;
let sessionReelIds=null;
orderedReels=function(){
  if(!sessionReelIds)sessionReelIds=legacyOrderedReels().map(r=>r.id);
  const byId=new Map(data.reels.map(r=>[r.id,r]));
  return sessionReelIds.map(id=>byId.get(id)).filter(Boolean);
};
