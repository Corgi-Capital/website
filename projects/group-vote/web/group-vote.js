/* Group Vote: reusable ballot for group trips.
   A trip page defines window.TRIP (see events/2026/niseko/index.html) and loads this file.
   Shared settings (API URL, Maps key) live in group-vote-config.js. */
(function(){
"use strict";
const CFG=Object.assign({apiUrl:"",mapsApiKey:""},window.GROUP_VOTE||{},(window.TRIP&&window.TRIP.config)||{});
const TRIP=window.TRIP;
const TRAVELERS=TRIP.travelers, ITEMS=TRIP.items, REGIONS=TRIP.regions;
const VLABEL={3:"Must",2:"Keen",1:"Maybe",0:"Skip"};
const BOWL=(broth,top)=>`<ellipse cx="50" cy="52" rx="38" ry="12" fill="${broth}"/>${top}<path d="M12 52 Q14 84 50 86 Q86 84 88 52 Z" fill="#f4efe6" stroke="#c9bfae" stroke-width="1.5"/><path d="M20 70 Q50 78 80 70" stroke="#b23a2e" stroke-width="2.5" fill="none"/>`;
const NOODLE=c=>`<path d="M22 50 q6-5 12 0 t12 0 t12 0 t12 0 t10 0" stroke="${c}" stroke-width="2.2" fill="none"/><path d="M24 55 q6-5 12 0 t12 0 t12 0 t12 0" stroke="${c}" stroke-width="2.2" fill="none"/>`;
const ART={
miso:BOWL("#d99a3e",NOODLE("#f3d27a")+`<circle cx="66" cy="47" r="6" fill="#fff"/><circle cx="66" cy="47" r="3.2" fill="#f2a91f"/><rect x="28" y="40" width="14" height="9" rx="3" fill="#b9714a"/><path d="M46 38 l10 0 l-2 12 l-10 0z" fill="#2f3b2a"/><circle cx="56" cy="55" r="2" fill="#7cb342"/><circle cx="60" cy="57" r="2" fill="#7cb342"/>`),
curry:BOWL("#b5512a",`<ellipse cx="36" cy="48" rx="9" ry="6" fill="#e8a33d"/><rect x="50" y="42" width="7" height="14" rx="3" fill="#6d8f3a" transform="rotate(-25 53 49)"/><ellipse cx="66" cy="52" rx="7" ry="5" fill="#8d5a3b"/><circle cx="44" cy="55" r="3" fill="#d44a2c"/><circle cx="60" cy="46" r="3" fill="#f2d14a"/>`),
udon:BOWL("#e8c98a",`<path d="M22 50 q8-6 16 0 t16 0 t16 0 t10 0" stroke="#fbf6e9" stroke-width="4" fill="none"/><path d="M24 56 q8-6 16 0 t16 0 t16 0" stroke="#fbf6e9" stroke-width="4" fill="none"/><circle cx="64" cy="46" r="5" fill="#fff" stroke="#f0a3b5" stroke-width="2"/><circle cx="38" cy="45" r="2" fill="#7cb342"/>`),
gosetsu:BOWL("#dfe9ee",`<path d="M22 50 q8-6 16 0 t16 0 t16 0 t10 0" stroke="#ffffff" stroke-width="4" opacity=".9" fill="none"/><path d="M24 56 q8-6 16 0 t16 0 t16 0" stroke="#ffffff" stroke-width="4" opacity=".9" fill="none"/><circle cx="40" cy="46" r="2" fill="#7cb342"/>`),
soba:BOWL("#6b4a32",`<path d="M22 50 q6-4 12 0 t12 0 t12 0 t12 0 t10 0" stroke="#9b8063" stroke-width="2.4" fill="none"/><path d="M24 55 q6-4 12 0 t12 0 t12 0 t12 0" stroke="#9b8063" stroke-width="2.4" fill="none"/><circle cx="62" cy="46" r="2.2" fill="#7cb342"/>`),
don:BOWL("#f7f3ea",`<circle cx="34" cy="48" r="7" fill="#ef7d22"/><circle cx="31" cy="46" r="1.6" fill="#ffb35c"/><circle cx="36" cy="50" r="1.6" fill="#ffb35c"/><path d="M44 42 l14 0 l-2 14 l-14 0z" fill="#f28b6d"/><path d="M46 46 l10 0 M45 50 l10 0" stroke="#ffd3c4" stroke-width="1.2"/><circle cx="66" cy="49" r="6" fill="#f3ece0" stroke="#d9cbb3"/><path d="M60 56 l14 -2" stroke="#e04a3a" stroke-width="3"/>`),
teppan:`<rect x="8" y="58" width="84" height="16" rx="3" fill="#3b3f44"/><rect x="8" y="56" width="84" height="4" fill="#5a6068"/><rect x="24" y="44" width="30" height="13" rx="5" fill="#7a3b2a"/><path d="M28 47 l22 0 M28 52 l22 0" stroke="#5a2a1e" stroke-width="1.5"/><circle cx="66" cy="52" r="5" fill="#f3ece0"/><circle cx="76" cy="52" r="4" fill="#7cb342"/><path d="M40 40 q3-6 0-12 M48 40 q3-6 0-12" stroke="#c8d2da" stroke-width="2" fill="none"/>`,
lamb:`<ellipse cx="50" cy="72" rx="40" ry="8" fill="#2b2e33"/><path d="M14 70 Q50 18 86 70 Z" fill="#41464d"/><path d="M24 64 Q50 28 76 64" stroke="#5b616a" stroke-width="1.5" fill="none"/><ellipse cx="40" cy="48" rx="9" ry="5" fill="#a5543f"/><ellipse cx="58" cy="46" rx="9" ry="5" fill="#b5634c"/><path d="M18 70 q8-6 16 0 M66 70 q8-6 16 0" stroke="#8bc34a" stroke-width="4" fill="none"/><circle cx="50" cy="62" r="3" fill="#f2d14a"/>`,
okonomi:`<ellipse cx="50" cy="62" rx="40" ry="14" fill="#3b3f44"/><ellipse cx="50" cy="56" rx="32" ry="14" fill="#c98a43"/><ellipse cx="50" cy="53" rx="28" ry="11" fill="#6b3a1f"/><path d="M26 50 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6" stroke="#fff6d8" stroke-width="2" fill="none"/><circle cx="38" cy="55" r="1.8" fill="#7cb342"/><circle cx="60" cy="52" r="1.8" fill="#7cb342"/><path d="M44 47 l4 -2 M56 58 l4 -2" stroke="#e7a2b6" stroke-width="2"/>`,
katsu:`<ellipse cx="50" cy="66" rx="40" ry="12" fill="#f4efe6" stroke="#c9bfae"/><path d="M66 40 q14 10 6 24 l-10 0z" fill="#cfe8a8"/><g fill="#d9952f"><rect x="18" y="48" width="9" height="16" rx="2"/><rect x="28" y="47" width="9" height="17" rx="2"/><rect x="38" y="46" width="9" height="18" rx="2"/><rect x="48" y="47" width="9" height="17" rx="2"/></g><g fill="#f3e6cf"><rect x="20" y="52" width="5" height="9"/><rect x="30" y="52" width="5" height="9"/><rect x="40" y="52" width="5" height="9"/><rect x="50" y="52" width="5" height="9"/></g>`,
tempura:`<ellipse cx="50" cy="68" rx="40" ry="10" fill="#f4efe6" stroke="#c9bfae"/><path d="M18 62 Q40 30 70 40 q-4 8 -12 10 Q40 54 24 66z" fill="#e2b04a"/><path d="M30 66 Q52 40 82 48 q-4 8 -12 10 Q52 62 36 70z" fill="#d9a03c"/><path d="M70 40 l8 -6 M82 48 l8 -4" stroke="#e0533c" stroke-width="3"/>`,
crab:`<ellipse cx="50" cy="56" rx="22" ry="14" fill="#d94a2b"/><circle cx="44" cy="44" r="2.5" fill="#222"/><circle cx="56" cy="44" r="2.5" fill="#222"/><g stroke="#d94a2b" stroke-width="4" stroke-linecap="round" fill="none"><path d="M30 58 l-14 6 l-4 8"/><path d="M30 64 l-12 10"/><path d="M70 58 l14 6 l4 8"/><path d="M70 64 l12 10"/><path d="M34 48 l-12 -12"/><path d="M66 48 l12 -12"/></g><circle cx="20" cy="34" r="6" fill="#d94a2b"/><circle cx="80" cy="34" r="6" fill="#d94a2b"/>`,
sushi:`<rect x="10" y="60" width="80" height="12" rx="3" fill="#c89a62"/><rect x="18" y="46" width="26" height="12" rx="6" fill="#fbf8f1"/><path d="M16 46 q14 -10 30 0 l0 4 q-15 -6 -30 0z" fill="#f17e5f"/><path d="M20 44 l4 6 M28 42 l4 6 M36 42 l4 6" stroke="#ffd0c0" stroke-width="1.4"/><rect x="54" y="46" width="26" height="12" rx="6" fill="#fbf8f1"/><path d="M52 46 q14 -10 30 0 l0 4 q-15 -6 -30 0z" fill="#c6283b"/><rect x="62" y="44" width="6" height="14" fill="#1f2a24"/>`,
ankake:`<ellipse cx="50" cy="66" rx="40" ry="12" fill="#f4efe6" stroke="#c9bfae"/><ellipse cx="50" cy="60" rx="30" ry="10" fill="#d9a34a"/><path d="M24 58 l52 0 M26 62 l48 0" stroke="#b9812d" stroke-width="1.5"/><ellipse cx="50" cy="54" rx="24" ry="8" fill="#c98a3a" opacity=".75"/><circle cx="40" cy="52" r="3" fill="#f28b6d"/><circle cx="52" cy="50" r="3" fill="#7cb342"/><circle cx="60" cy="54" r="3" fill="#f3ece0"/><ellipse cx="46" cy="57" rx="4" ry="2" fill="#e5733a"/>`,
chicken:`<ellipse cx="50" cy="70" rx="40" ry="10" fill="#f4efe6" stroke="#c9bfae"/><path d="M24 64 Q20 36 48 32 Q74 30 78 54 Q78 66 60 68z" fill="#c9732a"/><path d="M32 56 Q34 42 48 40" stroke="#e39a4a" stroke-width="3" fill="none"/><path d="M74 52 l10 -6" stroke="#f1e3c8" stroke-width="5" stroke-linecap="round"/><path d="M66 68 q10 -4 14 -12" fill="#d9e8a8"/>`,
still:`<rect x="8" y="80" width="84" height="4" fill="#8a6a4a"/><ellipse cx="46" cy="62" rx="20" ry="18" fill="#c77a3e"/><path d="M40 46 L44 26 L50 26 L52 46z" fill="#b56a32"/><path d="M47 26 Q60 16 76 30 L76 52" stroke="#b56a32" stroke-width="4" fill="none"/><rect x="70" y="52" width="12" height="26" rx="2" fill="#9a5a2c"/><path d="M32 60 q14 8 28 0" stroke="#e6a46b" stroke-width="2" fill="none"/><path d="M20 14 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z" fill="#ffffff" opacity=".8"/>`,
pot:`<ellipse cx="50" cy="74" rx="30" ry="6" fill="#2b2e33"/><path d="M16 46 L84 46 Q82 72 50 74 Q18 72 16 46z" fill="#b8bec4"/><ellipse cx="50" cy="46" rx="34" ry="9" fill="#e9e1cf"/><path d="M28 44 q10 -6 20 0" fill="#e5a0a0" stroke="#c86a6a"/><path d="M52 42 q10 -6 18 2" fill="#e5a0a0" stroke="#c86a6a"/><path d="M40 48 l10 -2" stroke="#d94a2b" stroke-width="4"/><circle cx="66" cy="48" r="2.5" fill="#7cb342"/><path d="M36 34 q3-6 0-12 M50 32 q3-6 0-12 M64 34 q3-6 0-12" stroke="#c8d2da" stroke-width="2" fill="none"/>`,
plate:`<ellipse cx="50" cy="62" rx="40" ry="16" fill="#ffffff" stroke="#cfd6db"/><ellipse cx="50" cy="62" rx="26" ry="10" fill="#f4f6f7"/><path d="M34 64 q16 -10 32 0" stroke="#7a2f3a" stroke-width="3" fill="none"/><rect x="44" y="52" width="12" height="9" rx="2" fill="#e7c48f"/><circle cx="58" cy="55" r="2.5" fill="#6aa84f"/><circle cx="42" cy="57" r="2" fill="#e65c7b"/>`,
cone:`<path d="M38 54 L50 88 L62 54z" fill="#e2b06a"/><path d="M40 60 l18 0 M42 68 l14 0 M45 76 l8 0" stroke="#c48a43" stroke-width="1.5"/><path d="M34 54 Q30 42 42 40 Q40 28 52 28 Q50 18 56 14 Q62 22 60 30 Q70 32 66 42 Q72 50 66 54z" fill="#fffdf6" stroke="#e8dfcc"/>`,
conewhisky:`<path d="M38 54 L50 88 L62 54z" fill="#e2b06a"/><path d="M34 54 Q30 42 42 40 Q40 28 52 28 Q50 18 56 14 Q62 22 60 30 Q70 32 66 42 Q72 50 66 54z" fill="#fffdf6" stroke="#e8dfcc"/><path d="M48 26 q6 10 -2 18 q8 4 4 12" stroke="#b8651c" stroke-width="3" fill="none"/>`,
parfait:`<path d="M32 30 L68 30 L62 74 L38 74z" fill="#ffffff" opacity=".6" stroke="#c8d2da"/><path d="M34 40 L66 40 L64 52 L36 52z" fill="#f3d6a0"/><path d="M36 52 L64 52 L62 62 L38 62z" fill="#a85a6e"/><path d="M38 62 L62 62 L62 74 L38 74z" fill="#fff6e6"/><path d="M32 30 Q50 14 68 30z" fill="#fffdf6"/><circle cx="50" cy="18" r="5" fill="#d6283b"/><rect x="44" y="74" width="12" height="8" fill="#c8d2da"/><rect x="36" y="82" width="28" height="3" rx="1.5" fill="#c8d2da"/>`,
matcha:`<path d="M18 46 Q20 80 50 80 Q80 80 82 46z" fill="#3d3a36"/><ellipse cx="50" cy="46" rx="32" ry="8" fill="#7fae3e"/><ellipse cx="50" cy="46" rx="20" ry="4" fill="#a8d05a"/><path d="M70 18 l-10 26" stroke="#d8c49a" stroke-width="4"/><path d="M62 40 q-2 -8 4 -12 q6 6 4 12z" fill="#e8d9b0"/>`,
whisky:`<path d="M28 34 L72 34 L68 80 L32 80z" fill="#ffffff" opacity=".55" stroke="#c8d2da" stroke-width="1.5"/><path d="M30 52 L70 52 L68 78 L32 78z" fill="#c8781e"/><rect x="38" y="42" width="18" height="16" rx="3" fill="#eaf4fa" opacity=".85"/>`,
cocktail:`<path d="M20 28 Q50 62 80 28z" fill="#ffffff" opacity=".55" stroke="#c8d2da" stroke-width="1.5"/><path d="M26 34 Q50 58 74 34z" fill="#d98a2e"/><rect x="48" y="52" width="4" height="24" fill="#c8d2da"/><rect x="36" y="76" width="28" height="4" rx="2" fill="#c8d2da"/><path d="M40 26 q-4 -8 2 -14 q6 6 2 14" fill="#b9c4cc" opacity=".7"/><path d="M52 22 q-4 -8 2 -14" stroke="#b9c4cc" stroke-width="2" fill="none" opacity=".7"/>`,
boba:`<path d="M30 30 L70 30 L64 84 L36 84z" fill="#d8b48a"/><rect x="28" y="26" width="44" height="6" rx="2" fill="#e8e2d6"/><path d="M58 10 L54 70" stroke="#2f6f9c" stroke-width="5" stroke-linecap="round"/><g fill="#3a2418"><circle cx="42" cy="76" r="3"/><circle cx="50" cy="78" r="3"/><circle cx="58" cy="76" r="3"/><circle cx="46" cy="70" r="3"/><circle cx="56" cy="70" r="3"/></g>`,
cake:`<path d="M20 70 L80 70 L80 50 L20 58z" fill="#f3e2c4"/><path d="M20 58 L80 50 L80 42 L20 50z" fill="#fffaf2"/><path d="M20 62 L80 56" stroke="#e6a1b0" stroke-width="3"/><circle cx="66" cy="40" r="6" fill="#d6283b"/><rect x="14" y="70" width="72" height="4" rx="2" fill="#cfd6db"/>`,
ice:`<rect x="8" y="78" width="84" height="8" fill="#e8f1f7"/><path d="M30 78 L38 30 L50 18 L62 30 L70 78z" fill="#9fd3f0" opacity=".85"/><path d="M40 70 L46 34 M56 70 L54 36" stroke="#ffffff" stroke-width="2" opacity=".8"/><circle cx="50" cy="18" r="14" fill="#5fb3e6" opacity=".25"/><path d="M18 20 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z M80 34 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z" fill="#ffffff"/>`
};
const $=s=>document.querySelector(s);
function el(tag,cls,text){const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e}
const K=k=>"gv-"+TRIP.id+"-"+k;
function ls(k,v){try{if(v===undefined) return localStorage.getItem(K(k)); if(v===null) localStorage.removeItem(K(k)); else localStorage.setItem(K(k),v)}catch(e){return null}}

let me=ls("me"); if(TRAVELERS.indexOf(me)<0) me=null;
let code=ls("code")||"";
let sortMode="region", ballots={}, online=false, pending=Promise.resolve();
const photos={};
const status=t=>{$("#status").textContent=t};
const voted=()=>Object.keys(ballots).filter(n=>Object.keys(ballots[n]||{}).length).length+" of "+TRAVELERS.length+" have voted";

// ---------- Vote server ----------
// Lambda answers 429 "Rate Exceeded" (not our JSON) when its concurrency cap of 5 is busy, e.g. several people opening
// the page at once. That, network errors and 5xx are retried with backoff. Whatever the server itself says comes back
// as-is (it always sends {"ok": ...}); null means it never answered.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,opts){
  for(let i=0;;i++){
    try{ const r=await fetch(CFG.apiUrl.replace(/\/$/,"")+path,opts);
      if(r.status<500){ const j=await r.json().catch(()=>null); if(j&&typeof j.ok==="boolean") return j } }catch(e){}
    if(i===3) return null;
    await wait(300*2**i+Math.random()*300);
  }
}
const post=(path,body)=>api(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

// ---------- Votes ----------
let unsent=false;   // my ballot has changes the server hasn't taken yet: sent after the next successful load
async function loadVotes(){
  if(!CFG.apiUrl){ status("Votes save on this device only (backend not set up)"); return }
  if(!code){ $("#codeBanner").hidden=false; status("Enter the trip code"); return }
  const j=await api("/trips/"+encodeURIComponent(TRIP.id)+"?code="+encodeURIComponent(code));
  if(!j){ status("Can't reach the vote server right now"); return }
  if(!j.ok){ if(j.error==="code"){ ls("code",null); code=""; $("#codeBanner").hidden=false; status("Wrong trip code") } else status("Vote server error"); return }
  $("#codeBanner").hidden=true;
  // Online, my in-page ballot wins over the copy just read. Coming online with votes cast before the server answered,
  // those are laid over the saved ballot rather than replacing it.
  const mine=(me&&(online||unsent))?ballots[me]:null, was=online; online=true; ballots=j.ballots||{};
  if(mine) ballots[me]=was?mine:Object.assign({},ballots[me]||{},mine);
  status(voted()); render();
  if(unsent){ unsent=false; saveVote() }
}
function saveVote(){
  const who=me;
  if(!online){ ls("local-"+who, JSON.stringify(ballots[who]||{})); if(CFG.apiUrl) unsent=true; return }
  pending=pending.then(()=>post("/trips/"+encodeURIComponent(TRIP.id)+"/ballots",{code,name:who,votes:ballots[who]||{}})).then(j=>{
    if(j&&j.ok){ ballots=Object.assign({},j.ballots,{[who]:ballots[who]}); status(voted()); render() }
    else if(!j){ unsent=true; status("Vote not saved yet. Retrying shortly.") }
    else status("Couldn't save that vote") }).catch(()=>{});
}

// ---------- Photos (Google Maps Places API) ----------
// Google calls are counted against the server's monthly budget. A text search is reserved just before it runs, and a
// photo only once the search has found one, so a failed or empty search never spends photo budget. Lookups go one at
// a time until one works, then three at once, and stop for this page view if Google fails before any success (or three
// times running): a dead or misconfigured key then costs one search per view, not a search and a photo per item.
let placesLib=null, budgetSpent=false, mapsDown=false, worked=0, failRun=0, active=0;
const queue=[], tried={};
window.gm_authFailure=()=>{ mapsDown=true };
async function getMapsKey(){
  if(CFG.mapsApiKey) return CFG.mapsApiKey;
  if(!CFG.apiUrl) return "";
  const j=await api("/config"); return (j&&j.ok&&j.mapsApiKey)||"";
}
function loadMaps(){
  return getMapsKey().then(key=>{ CFG.mapsApiKey=key; return new Promise((res,rej)=>{
    if(!CFG.mapsApiKey) return rej(new Error("no key"));
    window.__gvMapsReady=()=>res();
    const s=document.createElement("script");
    s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(CFG.mapsApiKey)+"&v=weekly&loading=async&callback=__gvMapsReady";
    s.async=true; s.onerror=()=>rej(new Error("maps load failed")); document.head.appendChild(s);
  }) });
}
const io=("IntersectionObserver" in window)?new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ io.unobserve(e.target); wantPhoto(e.target.dataset.id) } }),{rootMargin:"400px"}):null;
const byId=id=>ITEMS.find(i=>i.id===id);
// Only the server's own "limit" answer means the budget is spent; a throttle or network error is just a failed try.
async function reserve(kind){
  if(budgetSpent||!CFG.apiUrl) return false;
  const j=await post("/usage",{kinds:[kind]});
  if(j&&j.ok) return true;
  if(j&&j.error==="limit"&&!budgetSpent){ budgetSpent=true; const b=$("#setupBanner"); b.hidden=false; b.textContent="This month's photo budget is used up, so items show illustrations until next month." }
  return false;
}
function wantPhoto(id){ if(tried[id]) return; tried[id]=true; queue.push(id); pumpPhotos() }
function pumpPhotos(){
  while(placesLib&&!mapsDown&&!budgetSpent&&queue.length&&active<(worked?3:1)){
    const id=queue.shift(); active++;
    lookUp(id).catch(()=>{}).finally(()=>{ active--; pumpPhotos() });
  }
}
async function lookUp(id){
  const it=byId(id); if(!it||!it.q) return;
  if(!(await reserve("search"))){ delete tried[id]; return }   // no go-ahead: a later render can try again
  let p;
  try{ const r=await placesLib.Place.searchByText({textQuery:it.q, fields:["displayName","photos","googleMapsURI"], maxResultCount:1, language:"en", region:TRIP.region||"us"}); p=r.places&&r.places[0]; worked++; failRun=0 }
  catch(e){ if(!worked||++failRun>=3) mapsDown=true; return }
  const ph=p&&p.photos&&p.photos[0];
  if(!ph) return;   // nothing to show: the illustration stays
  if(!(await reserve("photo"))){ delete tried[id]; return }
  const a=(ph.authorAttributions||[])[0]||{};
  photos[id]={url:ph.getURI({maxWidth:400,maxHeight:400}), credit:a.displayName||"Google Maps user", creditUrl:a.uri||"", mapsUrl:p.googleMapsURI||""};
  paintPhoto(id);
}
// Paints every tile on the page for this item (after a lookup), or the one tile row() is building: that tile isn't in
// the document yet, so a document query would miss it and every re-render would drop the photos.
function paintPhoto(id,tile){
  const ph=photos[id]; if(!ph) return;
  (tile?[tile]:document.querySelectorAll('.pic[data-id="'+id+'"]')).forEach(pic=>{
    if(pic.querySelector("img")) return;
    // Keep the default referrer: the photo URL carries the key, which Google only honors from corgi-capital.com.
    // The illustration stays until the photo has loaded (at once when it's cached), and for good if it fails.
    const img=el("img"); img.alt="";
    const show=()=>{ if(pic.querySelector("img")) return; pic.textContent=""; pic.appendChild(img); credit(pic,ph) };
    img.onerror=()=>{ photos[id]=null };
    if(ph.loaded){ img.src=ph.url; show() }
    else { img.onload=()=>{ ph.loaded=true; show() }; img.src=ph.url }
  });
}
function credit(pic,ph){
  const cr=pic.parentElement.querySelector(".credit");
  if(!cr||cr.childNodes.length) return;
  cr.appendChild(document.createTextNode("Photo: ")); const a=el("a",null,ph.credit); a.href=ph.creditUrl||ph.mapsUrl||"#"; a.target="_blank"; a.rel="noopener"; cr.appendChild(a);
  if(ph.mapsUrl){ cr.appendChild(document.createTextNode(" · ")); const m=el("a",null,"Google Maps"); m.href=ph.mapsUrl; m.target="_blank"; m.rel="noopener"; cr.appendChild(m) }
}

// ---------- Render ----------
function renderWho(){
  const w=$("#who"); w.textContent="";
  TRAVELERS.forEach(n=>{const b=el("button","chip",n); b.id="who-"+n; b.setAttribute("aria-pressed",String(me===n));
    b.onclick=()=>{ me=n; ls("me",n); if(!online){ try{ ballots[n]=JSON.parse(ls("local-"+n)||"{}") }catch(e){} } renderWho(); render() }; w.appendChild(b)});
  $("#dotsKey").textContent="Squares under each total: "+TRAVELERS.map(t=>t[0]).join(" · ");
}
function totals(id){let t=0,n=0; TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; if(typeof v==="number"){t+=v;n++}}); return {t,n}}
function row(it){
  const r=el("div","row");
  const pic=el("div","pic"); pic.dataset.id=it.id; pic.setAttribute("role","img"); pic.setAttribute("aria-label",it.dish);
  pic.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true">'+(ART[it.art]||"")+'</svg>';
  r.appendChild(pic);
  const m=el("div","main");
  m.appendChild(el("div","dish",it.dish));
  const pl=el("div","place");
  if(it.url){const a=el("a",null,it.place); a.href=it.url; a.target="_blank"; a.rel="noopener"; pl.appendChild(a)} else pl.textContent=it.place;
  if(it.area) pl.appendChild(document.createTextNode(" · "+it.area)); m.appendChild(pl);
  const meta=el("div","meta");
  if(it.score) meta.appendChild(el("span","score", it.score==="n/a"?"Not on Tabelog":(TRIP.scoreLabel||"Rating")+" "+it.score));
  if(it.badge) meta.appendChild(el("span","badge",it.badge));
  m.appendChild(meta);
  if(it.note) m.appendChild(el("div","note",it.note));
  m.appendChild(el("div","credit",""));
  r.appendChild(m);
  const side=el("div","side");
  const tt=totals(it.id);
  const tot=el("div","total",String(tt.t)); tot.appendChild(el("small",null,tt.n+"/"+TRAVELERS.length+" voted")); side.appendChild(tot);
  const dots=el("div","dots");
  TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][it.id]; const d=el("span","dot"+(typeof v==="number"?" v"+v:""),p[0]); d.title=p+": "+(typeof v==="number"?VLABEL[v]:"not voted"); dots.appendChild(d)});
  side.appendChild(dots); r.appendChild(side);
  const vote=el("div","vote");
  [3,2,1,0].forEach(v=>{const b=el("button",null,VLABEL[v]); b.dataset.v=v; b.id="v-"+it.id+"-"+v;
    const mine=me&&ballots[me]?ballots[me][it.id]:undefined; b.setAttribute("aria-pressed",String(mine===v));
    b.disabled=!me; b.onclick=()=>cast(it.id,v); vote.appendChild(b)});
  r.appendChild(vote);
  if(photos[it.id]) paintPhoto(it.id,pic); else if(!tried[it.id]){ if(io) io.observe(pic); else wantPhoto(it.id) }
  return r;
}
function render(){
  const L=$("#list"); L.textContent="";
  if(!me) L.appendChild(el("p","empty","Pick your name above to start voting. Everyone's votes show here once they're in."));
  if(sortMode==="region"){ REGIONS.forEach(g=>{L.appendChild(el("h2",null,g)); ITEMS.filter(i=>i.r===g).forEach(i=>L.appendChild(row(i)))}) }
  else { L.appendChild(el("h2",null,"Group ranking")); ITEMS.slice().sort((a,b)=>totals(b.id).t-totals(a.id).t||totals(b.id).n-totals(a.id).n).forEach(i=>L.appendChild(row(i))) }
}
function cast(id,v){
  if(!me) return;
  const cur=Object.assign({},ballots[me]||{});
  if(cur[id]===v) delete cur[id]; else cur[id]=v;
  ballots=Object.assign({},ballots,{[me]:cur}); render(); saveVote();
}

// ---------- Boot ----------
document.title=TRIP.title; $("#title").textContent=TRIP.title; $("#intro").textContent=TRIP.intro||"";
$("#sort").addEventListener("click",e=>{const b=e.target.closest("button"); if(!b) return; sortMode=b.dataset.s;
  document.querySelectorAll("#sort button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); render()});
$("#codeForm").addEventListener("submit",e=>{e.preventDefault(); code=$("#codeInput").value.trim(); ls("code",code); loadVotes()});
renderWho();
if(me&&!CFG.apiUrl){ try{ ballots[me]=JSON.parse(ls("local-"+me)||"{}") }catch(e){} }
render();
const missing=[]; if(!CFG.apiUrl) missing.push("the vote server (shared votes and photos)");
if(missing.length){ const b=$("#setupBanner"); b.hidden=false; b.textContent="Setup pending: "+missing.join(" and ")+". Until then the page shows illustrations and keeps votes on this device." }
loadVotes();
loadMaps().then(()=>google.maps.importLibrary("places")).then(lib=>{ placesLib=lib; pumpPhotos() }).catch(()=>{});
// Keeps polling while a code is set, so a page that couldn't reach the server at first catches up on its own.
setInterval(()=>{ if(code&&CFG.apiUrl&&document.visibilityState==="visible") loadVotes() },30000);
})();
