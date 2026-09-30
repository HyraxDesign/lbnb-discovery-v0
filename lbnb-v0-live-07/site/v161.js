/* NAVA V1.6.1 — multi-day Journey scheduling foundation. */
'use strict';
window.NAVA_VERSION='1.6.1';
document.querySelector('meta[name="nava-version"]')?.setAttribute('content','1.6.1');
function journeyDateList(start,end){
  if(!start)return[];const last=end||start,a=new Date(start+'T12:00:00'),b=new Date(last+'T12:00:00');
  if(!Number.isFinite(a.valueOf())||!Number.isFinite(b.valueOf())||b<a)return[];
  const dates=[];for(const d=new Date(a);d<=b&&dates.length<90;d.setDate(d.getDate()+1))dates.push([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'));
  return dates;
}
function scheduledJourneyDays(nodes,plan=readPlan()){
  const dates=plan?.planned?journeyDateList(plan.start_date,plan.end_date):[];
  const core=nodes.filter(n=>!n._anchor);
  const groups=[];let group=null;
  for(const n of core){
    if(n.role!=='context'){group={nodes:[]};groups.push(group)}
    if(!group){group={nodes:[]};groups.push(group)}
    group.nodes.push(n);
  }
  if(!dates.length)return[{date:'',index:0,nodes:core,stayNodes:nodes.filter(n=>n._anchor)}];
  const days=dates.map((date,index)=>({date,index,nodes:[],stayNodes:[]}));
  groups.forEach((g,i)=>{
    const dayIndex=groups.length<=1?0:Math.round(i*(days.length-1)/(groups.length-1));
    days[dayIndex].nodes.push(...g.nodes);
  });
  const bookings=readBookings();
  for(const n of nodes.filter(n=>n._anchor)){
    const b=n._booking||bookings.find(x=>x.object_id===n.object_id);
    for(const d of days)if(b&&dateInRange(d.date,bookingStart(b),bookingEnd(b)))d.stayNodes.push(n);
  }
  return days;
}
function multiDayItineraryHTML(j,nodes,plan){
  const days=scheduledJourneyDays(nodes,plan),isMulti=days.length>1;
  if(!isMulti)return null;
  const primary=days.flatMap(d=>d.nodes);
  return `<div class="itineraryLead"><div><strong>${days.length} days · ${esc(fmtDateRange(days[0].date,days.at(-1).date))}</strong><span>Stops are spread across your selected dates. Open days stay free.</span></div><span class="planBadge">${primary.filter(n=>n.role!=='context').length} stops</span></div><div class="multiDayItinerary">${days.map(d=>{const iso=d.date,label=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long'}).format(new Date(iso+'T12:00:00')),stops=d.nodes.map(n=>{const o=obj(n.object_id);if(!o)return'';return `<button class="dayStop ${n.role==='context'?'context':''}" data-itin-object="${esc(o.id)}">${n.role==='context'?'':imageFrame(o.image,'itinVisual',o.subtype==='stay'?'Historical photo':'Photo')}<div class="itinCopy"><small>${esc(n.role==='context'?'along the way':displayType(o))}${n._displayTime?` · ${esc(n._displayTime)}`:''}</small><strong>${esc(o.title)}</strong><span>${esc(n.note||'')}</span></div></button>`}).join(''),stays=d.stayNodes.map(n=>{const o=obj(n.object_id);if(!o)return'';return `<button class="dayStay" data-itin-object="${esc(o.id)}"><span>Stay · ${esc(stayPhase(n._booking,iso)||'in your Journey')}</span><strong>${esc(o.title)}</strong></button>`}).join('');return `<section class="journeyDayModule" data-journey-date="${iso}"><header><span>DAY ${d.index+1}</span><h3>${esc(label)}</h3><time datetime="${iso}">${esc(iso)}</time></header><div class="journeyDayStops">${stays}${stops||(!stays?'<p class="openDay">Open day · no stops scheduled</p>':'')}</div></section>`}).join('')}</div><div class="journeyCta"><div><strong>Adjust your Journey</strong><span>Your calendar shows the same full date range.</span></div><button id="backToEdit">Edit Journey</button></div>`;
}
const priorItineraryHTML=itineraryHTML;
itineraryHTML=function(j,nodes,plan){return multiDayItineraryHTML(j,nodes,plan)||priorItineraryHTML(j,nodes,plan)};
const priorCalendarHTML=calendarHTML;
calendarHTML=function(plan){
  let html=priorCalendarHTML(plan);if(!plan?.planned||!plan.start_date)return html;
  const dates=journeyDateList(plan.start_date,plan.end_date),label=data.journeys?.[0]?.title||'Journey';
  const bookings=readBookings(),base=plan.start_date?new Date(plan.start_date+'T12:00:00'):(bookings.length?new Date(bookingStart(bookings[0])+'T12:00:00'):new Date()),monthDate=new Date(base.getFullYear(),base.getMonth()+calendarMonthOffset,1),year=monthDate.getFullYear(),monthIndex=monthDate.getMonth();
  const holder=document.createElement('div');holder.innerHTML=html;
  const cells=[...holder.querySelectorAll('.calDay:not(.empty)')];
  for(const cell of cells){const day=Number(cell.firstChild?.textContent?.trim()||cell.textContent.trim());if(!day)continue;
    const iso=`${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const idx=dates.indexOf(iso);if(idx<0)continue;
    cell.classList.add('journeyDay');cell.querySelectorAll('.calEvent:not(.confirmed):not(.pending):not(.planned)').forEach(x=>x.remove());const tag=document.createElement('span');tag.className='calEvent journeyEvent';tag.textContent=`Day ${idx+1}`;tag.title=`${label} · Day ${idx+1}`;tag.setAttribute('aria-label',`${label} · Day ${idx+1} · ${iso}`);cell.append(tag);
  }
  return holder.innerHTML;
};
const style=document.createElement('style');style.textContent=`.multiDayItinerary{display:grid;gap:14px;margin:12px 0}.journeyDayModule{background:#fff;border:1px solid #e9e4db;border-radius:18px;overflow:hidden;box-shadow:0 5px 18px rgba(0,0,0,.035)}.journeyDayModule>header{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:16px 17px 13px;background:#f3f0e9;border-bottom:1px solid #ebe6dd}.journeyDayModule>header>span{grid-column:1/-1;color:#8b7554;font-size:9px;letter-spacing:.12em;font-weight:750}.journeyDayModule h3{margin:0;font-size:17px}.journeyDayModule time{color:#8b857b;font-size:10px;align-self:center}.journeyDayStops{padding:10px;display:grid;gap:8px}.dayStop{display:flex!important;align-items:stretch;gap:11px;text-align:left!important;padding:0!important;border:0!important;border-radius:13px!important;background:#f8f7f4!important;overflow:hidden;min-height:82px}.dayStop .itinVisual{width:86px;height:auto;min-height:82px;flex:0 0 86px}.dayStop .itinCopy{padding:11px 10px 11px 0;display:grid;align-content:center;gap:4px}.dayStop .itinCopy strong{font-size:14px}.dayStop .itinCopy>span{font-size:11px;color:#716c64}.dayStop.context{margin-left:24px;min-height:58px;border-left:3px solid #d9d2c6!important}.dayStop.context .itinCopy{padding:8px 10px}.dayStay{display:grid!important;text-align:left!important;gap:5px;background:#e8e3d9!important;border:0!important;border-radius:12px!important;padding:12px 14px!important}.dayStay span{font-size:9px;text-transform:uppercase;color:#736a5b}.dayStay strong{font-size:13px}.openDay{margin:0;padding:18px 12px;color:#817b72;font-size:12px}.journeyDay .journeyEvent{background:#675b48;color:white}.calendarHead{flex-wrap:wrap}.calDay.journeyDay{background:#f0ede6}.calDay .calEvent{white-space:normal}.rangeSummary{line-height:1.5}`;document.head.append(style);

const priorJourneyRender161=renderJourney;
renderJourney=function(){priorJourneyRender161();const plan=readPlan(),dates=plan?.planned?journeyDateList(plan.start_date,plan.end_date):[];if(dates.length){const heading=document.querySelector('#journeyContent .journeyHero small');if(heading)heading.textContent=`${data.journeys[0].destination} · ${dates.length} ${dates.length===1?'day':'days'}`}};
