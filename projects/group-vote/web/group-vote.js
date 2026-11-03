/* Group Vote: reusable ballot for group trips.
   A trip page sets window.TRIP = {id: "..."} and loads this file (see events/2026/niseko/index.html). The trip's title,
   travelers, items and votes come from the vote server, which sends them only with the trip's password: until then the
   page is a password gate in the corgi-capital.com home page style. The server's URL is in group-vote-config.js. */
(function(){
"use strict";
const CFG=Object.assign({apiUrl:""},window.GROUP_VOTE||{});
const TRIP_ID=String((window.TRIP&&window.TRIP.id)||"");
let TRIP={}, TRAVELERS=[], ITEMS=[], REGIONS=[];   // filled in from the server once the password checks out
const VLABEL={3:"Must",2:"I want",1:"Meh",0:"Nah"};   // shown in capitals; 3/2/1/0 points
const GROUPS=[["specialty","Regional specialties"],["favorite","Local favorites"]];
const TIER={casual:"Casual",mid:"Mid-range",splurge:"Splurge"};
const FILTERS=[["all","All"],["slotted","On the itinerary"],["casual","Casual"],["splurge","Splurge"],["treats","Sweets & drinks"],["todo","To rate"]];
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
ice:`<rect x="8" y="78" width="84" height="8" fill="#e8f1f7"/><path d="M30 78 L38 30 L50 18 L62 30 L70 78z" fill="#9fd3f0" opacity=".85"/><path d="M40 70 L46 34 M56 70 L54 36" stroke="#ffffff" stroke-width="2" opacity=".8"/><circle cx="50" cy="18" r="14" fill="#5fb3e6" opacity=".25"/><path d="M18 20 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z M80 34 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z" fill="#ffffff"/>`,
burger:`<path d="M16 46 Q16 22 50 22 Q84 22 84 46 Z" fill="#e0a24a"/><g fill="#fff4d6"><ellipse cx="38" cy="31" rx="2.2" ry="1.3"/><ellipse cx="52" cy="28" rx="2.2" ry="1.3"/><ellipse cx="64" cy="34" rx="2.2" ry="1.3"/><ellipse cx="45" cy="38" rx="2.2" ry="1.3"/></g><path d="M14 49 q6 6 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke="#7cb342" stroke-width="5" fill="none"/><path d="M18 52 L82 52 L76 61 L68 54 L58 62 L48 54 L38 62 L28 54 Z" fill="#f2c94c"/><rect x="16" y="56" width="68" height="12" rx="6" fill="#6b3a1f"/><path d="M18 70 L82 70 Q82 82 50 82 Q18 82 18 70 Z" fill="#d9953f"/>`,
onigiri:`<path d="M50 16 Q57 16 61 24 L84 64 Q88 76 76 78 L24 78 Q12 76 16 64 L39 24 Q43 16 50 16 Z" fill="#fbf8f1" stroke="#e3dccb" stroke-width="1.5"/><rect x="36" y="54" width="28" height="24" rx="2" fill="#1f2a24"/><circle cx="50" cy="40" r="5" fill="#e04a3a"/>`,
yakitori:`<g stroke="#c8a77a" stroke-width="3" stroke-linecap="round"><path d="M12 82 L82 22"/><path d="M24 88 L92 32"/></g><g fill="#b5683a"><circle cx="30" cy="66" r="8"/><circle cx="56" cy="44" r="8"/></g><g fill="#7cb342"><circle cx="43" cy="55" r="6"/></g><g fill="#c97a45"><circle cx="44" cy="70" r="8"/><circle cx="58" cy="58" r="8"/><circle cx="72" cy="46" r="8"/></g><path d="M40 68 l8 -6 M54 56 l8 -6 M68 44 l8 -6" stroke="#8a4a24" stroke-width="2"/>`,
truck:`<path d="M10 40 L64 40 L58 31 L16 31 Z" fill="#f6c453"/><rect x="10" y="40" width="54" height="30" rx="4" fill="#e85d4f"/><rect x="17" y="46" width="40" height="12" rx="2" fill="#ffe8b3"/><rect x="64" y="48" width="24" height="22" rx="3" fill="#c94a3e"/><rect x="68" y="52" width="13" height="9" rx="1" fill="#bfe3f2"/><circle cx="26" cy="72" r="7" fill="#2b2e33"/><circle cx="26" cy="72" r="3" fill="#8a9099"/><circle cx="74" cy="72" r="7" fill="#2b2e33"/><circle cx="74" cy="72" r="3" fill="#8a9099"/><path d="M30 26 q3-6 0-12 M40 26 q3-6 0-12" stroke="#c8d2da" stroke-width="2" fill="none"/>`
};
const $=s=>document.querySelector(s);
function el(tag,cls,text){const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e}
const K=k=>"gv-"+TRIP_ID+"-"+k;
function ls(k,v){try{if(v===undefined) return localStorage.getItem(K(k)); if(v===null) localStorage.removeItem(K(k)); else localStorage.setItem(K(k),v)}catch(e){return null}}
const REDUCED=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

let me=null, code=ls("code")||"";
let sortMode=ls("sort")==="rank"?"rank":"region", filter="all";
let ballots={}, pending=Promise.resolve(), saving=0, unsent=false, loading=false;
const photos={}, cards={};   // photos: per item, Google's photo list and what this page has fetched; cards: per item, its card
const status=t=>{const s=$("#status"); if(s) s.textContent=t};
const tripPath="/trips/"+encodeURIComponent(TRIP_ID);
let toastTimer=0;
function toast(t){ const e=$("#toast"); if(!e) return; e.textContent=t; e.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>e.classList.remove("show"),2600) }

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
// The password stopped working while the page was open (it was changed): forget it and go back to the gate.
const CHANGED="The password has changed. Enter the new one.";
function lockOut(msg){
  if(lockOut.done) return; lockOut.done=true;
  ls("code",null);
  try{ if(msg) sessionStorage.setItem("gv-msg",msg) }catch(e){}
  location.reload();
}

// ---------- Votes ----------
// Refreshes every 30 seconds and when the tab comes back. The server's copy wins, except my own ballot while a save of
// it is in flight or waiting to be resent: so a vote I just cast doesn't flicker back, and votes I cast on another
// device show up here. Cards update in place, so photo strips keep their place.
async function loadVotes(){
  if(loading) return; loading=true;
  try{
    const j=await api(tripPath+"?only=ballots&code="+encodeURIComponent(code));
    if(!j){ status("Can't reach the vote server right now"); return }
    if(!j.ok){ if(j.error==="code") lockOut(CHANGED); else status("Vote server error"); return }
    const mine=(me&&(saving||unsent))?ballots[me]:null, before=JSON.stringify(ballots);
    ballots=j.ballots||{};
    if(mine) ballots[me]=mine;
    if(JSON.stringify(ballots)!==before) refresh(); else status("");
    if(unsent){ unsent=false; saveVote() }
  } finally { loading=false }
}
function saveVote(){
  const who=me; if(!who) return;
  saving++;
  pending=pending.then(()=>post(tripPath+"/ballots",{code,name:who,votes:ballots[who]||{}})).then(j=>{
    if(j&&j.ok){ ballots=Object.assign({},j.ballots,{[who]:ballots[who]}); refresh() }
    else if(!j){ unsent=true; status("Vote not saved yet. Retrying shortly."); toast("Vote not saved yet. Retrying shortly.") }
    else if(j.error==="code") lockOut(CHANGED);
    else { status("Couldn't save that vote"); toast("Couldn't save that vote") } }).catch(()=>{}).finally(()=>{ saving-- });
}

// ---------- Photos (Google Maps Places API) ----------
// Each card has a photo strip, like a Google Maps place card. Google calls are counted against the server's monthly
// budget: a place lookup is reserved just before it runs (as its card nears the screen), and each photo just before it
// is fetched (the first at once, the rest as they're swiped to), so a failed lookup never spends photo budget. Lookups
// go one at a time until one works, then three at once. They stop for this page view if Google fails before any
// success (or three times running), and photos stop if Google refuses them (its daily cap, say): a dead key or a
// spent quota then costs one lookup or one photo per view, and the Google Maps buttons still show everything.
// An item with a placeId is looked up by id, so it's always the same place; otherwise by its q search. Its "photos" are
// positions in the place's photo list (Google gives up to 10, with no food label, so they're picked by eye), best first.
// Without them: positions 1, 2, 3, then 0, because Google's first photo is usually the storefront.
const PHOTO_PX=960;   // one size for strip and full screen, so each photo is fetched (and counted) once per page view
const DEFAULT_PICKS=[1,2,3,0];
let placesLib=null, budgetSpent=false, mapsDown=false, photosDown=false, worked=0, failRun=0, active=0, shownOk=0, badRun=0;
const queue=[], tried={};
window.gm_authFailure=()=>{ mapsDown=true };
function loadMaps(key){   // the key comes with the trip, after the password
  return new Promise((res,rej)=>{
    if(!key) return rej(new Error("no key"));
    window.__gvMapsReady=()=>res();
    const s=document.createElement("script");
    s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&v=weekly&loading=async&callback=__gvMapsReady";
    s.async=true; s.onerror=()=>rej(new Error("maps load failed")); document.head.appendChild(s);
  });
}
const io=("IntersectionObserver" in window)?new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ io.unobserve(e.target); wantPhoto(e.target.dataset.id) } }),{rootMargin:"500px"}):null;
const byId=id=>ITEMS.find(i=>i.id===id);
// The place on Google Maps, with every photo and review: exact when its id is known, else a search. No API call, so the
// link works with photos off or the budget spent.
function mapsLink(it){
  const u="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(it.q||it.place||"");
  return it.placeId?u+"&query_place_id="+encodeURIComponent(it.placeId):u;
}
// "Google Maps" as Google's attribution rules want it: exactly that text, never translated.
const gm=()=>{ const t=el("span",null,"Google Maps"); t.setAttribute("translate","no"); return t };
function banner(t){ const b=$("#setupBanner"); if(b){ b.hidden=false; b.textContent=t } }
// Only the server's own "limit" answer means the budget is spent; a throttle or network error is just a failed try.
async function reserve(kind){
  if(budgetSpent) return false;
  const j=await post("/usage",{trip:TRIP_ID,code,kinds:[kind]});
  if(j&&j.ok) return true;
  if(j&&j.error==="code") lockOut(CHANGED);
  else if(j&&j.error==="limit"&&!budgetSpent){ budgetSpent=true; banner("This month's photo budget is used up, so places show illustrations until next month. Each Google Maps button still has every photo.") }
  return false;
}
function photosOff(){ if(photosDown) return; photosDown=true; banner("Google isn't sending photos right now, so places show illustrations. Each Google Maps button still has every photo.") }
function wantPhoto(id){ if(tried[id]) return; tried[id]=true; queue.push(id); pumpPhotos() }
function pumpPhotos(){
  while(placesLib&&!mapsDown&&!photosDown&&!budgetSpent&&queue.length&&active<(worked?3:1)){
    const id=queue.shift(); active++;
    lookUp(id).catch(()=>{}).finally(()=>{ active--; pumpPhotos() });
  }
}
async function lookUp(id){
  const it=byId(id); if(!it||!(it.placeId||it.q)) return;
  if(!(await reserve("search"))){ delete tried[id]; return }   // no go-ahead: a later render can try again
  let list;
  try{
    if(it.placeId){ const pl=new placesLib.Place({id:it.placeId, requestedLanguage:"en"}); await pl.fetchFields({fields:["photos"]}); list=pl.photos }
    else { const r=await placesLib.Place.searchByText({textQuery:it.q, fields:["id","photos"], maxResultCount:1, language:"en", region:TRIP.region||"us"});
      const p=r.places&&r.places[0]; if(p){ list=p.photos; it.placeId=p.id; document.querySelectorAll('.gmaps[data-id="'+id+'"]').forEach(a=>{ a.href=mapsLink(it) }) } }
    worked++; failRun=0;
  }catch(e){ if(!worked||++failRun>=3) mapsDown=true; return }
  list=list||[];
  const picks=(Array.isArray(it.photos)&&it.photos.length?it.photos:DEFAULT_PICKS).filter(k=>Number.isInteger(k)&&k>=0&&k<list.length);
  if(!picks.length) return;   // nothing to show: the illustration stays
  photos[id]={list,picks,shots:{},wait:{}};
  if(cards[id]) buildStrip(id);
}
function shot(ph,size){ const a=(ph.authorAttributions||[])[0]||{}; return {url:ph.getURI({maxWidth:size,maxHeight:size}), credit:a.displayName||"Google Maps user", creditUrl:a.uri||"", avatar:a.photoURI||""} }
// The photo at position p: reserved, and its URL made, the first time this page asks for it.
function ensureShot(ph,p){
  if(ph.shots[p]) return Promise.resolve(ph.shots[p]);
  if(photosDown||budgetSpent) return Promise.resolve(null);
  if(!ph.wait[p]) ph.wait[p]=reserve("photo").then(ok=>{ ph.wait[p]=null; if(ok&&!photosDown) ph.shots[p]=shot(ph.list[p],PHOTO_PX); return ph.shots[p]||null });
  return ph.wait[p];
}
// Loads photo position p into an <img>. Keeps the default referrer: the photo URL carries the key, which Google only
// honors from corgi-capital.com.
async function fill(ph,p,img,done){
  const s=await ensureShot(ph,p);
  if(!s||!img.isConnected||img.dataset.p===String(p)) return;
  img.dataset.p=p;
  img.onload=()=>{ shownOk++; badRun=0; done(s) };
  img.onerror=()=>{ delete img.dataset.p; if(!shownOk||++badRun>=3) photosOff() };
  img.src=s.url;
}
// A card's photo strip: swipe it (or use the arrows), tap a photo for full screen. The illustration shows until the
// first photo has loaded, and for good if none does. No photographer credit here: Google allows leaving it off
// gallery-size photos when the full-size view shows it, which the viewer does.
function buildStrip(id){
  const k=cards[id], ph=photos[id]; if(!k||!ph||k.track) return;
  const it=byId(id)||{}, n=ph.picks.length, box=k.ph;
  const track=el("div","ph-track"); track.tabIndex=0;
  track.setAttribute("aria-label","Photos of "+it.dish+(n>1?", "+n+" photos; arrow keys move":"")+"; Enter opens full screen");
  const slides=ph.picks.map((p,i)=>{ const s=el("div","ph-slide"); s.dataset.i=i; const img=el("img"); img.alt=i?"":(it.dish||""); img.draggable=false; s.appendChild(img); track.appendChild(s); return s });
  box.appendChild(track);
  k.track=track; k.cur=0;
  const dots=el("div","ph-dots"); let prev=null, next=null;
  const load=i=>fill(ph,ph.picks[i],slides[i].firstChild,()=>{ slides[i].classList.add("on"); box.classList.add("has-photo") });
  const at=i=>{ k.cur=i; [...dots.children].forEach((d,j)=>d.classList.toggle("on",j===i));
    if(prev){ prev.hidden=i===0; next.hidden=i===n-1 } load(i) };
  k.go=i=>track.scrollTo({left:Math.max(0,Math.min(n-1,i))*track.clientWidth,behavior:REDUCED?"auto":"smooth"});
  if(n>1){
    slides.forEach(()=>dots.appendChild(el("i")));
    prev=el("button","ph-nav prev","‹"); next=el("button","ph-nav next","›"); prev.type=next.type="button"; prev.tabIndex=next.tabIndex=-1;
    prev.setAttribute("aria-label","Previous photo"); next.setAttribute("aria-label","Next photo");
    prev.onclick=()=>k.go(k.cur-1); next.onclick=()=>k.go(k.cur+1);
    box.append(prev,next,dots);
  }
  const seen=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) at(+e.target.dataset.i) }),{root:track,threshold:.6});
  slides.forEach(s=>seen.observe(s));
  track.addEventListener("click",()=>{ if(slides[k.cur].classList.contains("on")) openViewer(id,k.cur) });
  track.addEventListener("keydown",e=>{
    if(e.key==="ArrowRight"){ e.preventDefault(); k.go(k.cur+1) }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); k.go(k.cur-1) }
    else if(e.key==="Enter"&&slides[k.cur].classList.contains("on")){ e.preventDefault(); openViewer(id,k.cur) } });
  at(0);
}

// ---------- Full-screen viewer ----------
// The item's photos large, starting at the one tapped: swipe, arrow keys or the buttons. Same photo URLs as the strip,
// so nothing is fetched or counted twice. Links to every photo on Google Maps.
function openViewer(id,start){
  const it=byId(id), ph=photos[id]; if(!it||!ph||document.querySelector(".lb")) return;
  const n=ph.picks.length;
  const lb=el("div","lb"); lb.setAttribute("role","dialog"); lb.setAttribute("aria-modal","true"); lb.setAttribute("aria-label","Photos of "+it.dish);
  const bar=el("div","lb-bar"), title=el("div","lb-title");
  title.appendChild(el("b",null,it.dish)); title.appendChild(document.createTextNode(" · "+it.place));
  const all=el("a","lb-all"); all.append("All photos on "); all.appendChild(gm()); all.href=mapsLink(it); all.target="_blank"; all.rel="noopener";
  const x=el("button","lb-x","✕"); x.type="button"; x.setAttribute("aria-label","Close");
  bar.append(title,all,x);
  const track=el("div","lb-track");
  const slides=ph.picks.map((p,i)=>{ const s=el("figure","lb-slide"); s.dataset.i=i;
    s.innerHTML='<div class="lb-img"><span class="lb-wait">Loading…</span><img alt=""></div><figcaption class="lb-credit"></figcaption>'; track.appendChild(s); return s });
  const nav=el("div","lb-nav"), prev=el("button","lb-prev","‹"), count=el("span","lb-count"), next=el("button","lb-next","›");
  prev.type=next.type="button"; prev.setAttribute("aria-label","Previous photo"); next.setAttribute("aria-label","Next photo");
  nav.append(prev,count,next); nav.hidden=n<2;
  lb.append(bar,track,nav); document.body.appendChild(lb); document.body.classList.add("lb-open");
  let cur=Math.max(0,Math.min(n-1,start|0));
  const go=i=>track.scrollTo({left:Math.max(0,Math.min(n-1,i))*track.clientWidth,behavior:REDUCED?"auto":"smooth"});
  const show=i=>{ const s=slides[i], img=s.querySelector("img"), wait=s.querySelector(".lb-wait");
    if(!ph.shots[ph.picks[i]]&&(photosDown||budgetSpent)) wait.textContent=budgetSpent?"This month's photo budget is used up.":"Google isn't sending photos right now.";
    fill(ph,ph.picks[i],img,b=>{ s.classList.add("on"); wait.remove(); const cr=s.querySelector(".lb-credit");
      if(!cr.firstChild){ const a=el("a",null,b.credit); a.href=b.creditUrl||mapsLink(it); a.target="_blank"; a.rel="noopener";
        if(b.avatar){ const av=el("img","av"); av.alt=""; av.src=b.avatar; av.referrerPolicy="no-referrer"; a.prepend(av) } cr.appendChild(a) } }) };
  const at=i=>{ cur=i; count.textContent=(i+1)+" / "+n; prev.disabled=i===0; next.disabled=i===n-1; show(i) };
  track.scrollLeft=cur*track.clientWidth;
  const seen=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) at(+e.target.dataset.i) }),{root:track,threshold:.6});
  slides.forEach(s=>seen.observe(s));
  at(cur);
  function close(){
    seen.disconnect(); lb.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown",key,true);
    const k=cards[id]; if(k&&k.track){ k.track.scrollLeft=cur*k.track.clientWidth; k.track.focus({preventScroll:true}) }
  }
  function key(e){
    if(e.key==="Escape"){ e.preventDefault(); close() }
    else if(e.key==="ArrowRight"){ e.preventDefault(); go(cur+1) }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); go(cur-1) }
    else if(e.key==="Tab"){   // keep focus inside the viewer
      const f=[...lb.querySelectorAll("a[href],button:not([disabled])")].filter(z=>z.offsetParent), j=f.indexOf(document.activeElement);
      if(e.shiftKey&&j<=0){ e.preventDefault(); f[f.length-1].focus() } else if(!e.shiftKey&&j===f.length-1){ e.preventDefault(); f[0].focus() } }
  }
  addEventListener("keydown",key,true);
  x.onclick=close; prev.onclick=()=>go(cur-1); next.onclick=()=>go(cur+1);
  track.addEventListener("click",e=>{ if(!e.target.closest("img,a")) close() });   // a tap beside the photo closes
  x.focus();
}

// ---------- Ballot ----------
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-");
function totals(id){let t=0,n=0; TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; if(typeof v==="number"){t+=v;n++}}); return {t,n}}
const mineOf=id=>me&&ballots[me]?ballots[me][id]:undefined;
function visibleItems(){
  if(filter==="casual") return ITEMS.filter(i=>i.tier==="casual");
  if(filter==="splurge") return ITEMS.filter(i=>i.tier==="splurge");
  if(filter==="treats") return ITEMS.filter(i=>i.kind==="sweets"||i.kind==="drinks");
  if(filter==="todo") return ITEMS.filter(i=>typeof mineOf(i.id)!=="number");
  if(filter==="slotted") return ITEMS.filter(i=>i.slot);
  return ITEMS;
}
function renderWho(){
  const w=$("#who"); w.textContent="";
  TRAVELERS.forEach(n=>{const b=el("button","chip",n); b.type="button"; b.id="who-"+n; b.setAttribute("aria-pressed",String(me===n));
    b.onclick=()=>{ me=n; ls("me",n); $("#whoWrap").classList.remove("nudge"); renderWho(); render() }; w.appendChild(b)});
}
function card(it,rank){
  const c=el("article","card"); c.dataset.id=it.id;
  const ph=el("div","ph"); ph.dataset.id=it.id;
  const art=el("div","ph-art"); art.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true">'+(ART[it.art]||"")+'</svg>'; ph.appendChild(art);
  if(rank) ph.appendChild(el("span","ph-rank","#"+rank));
  if(it.slot) ph.appendChild(el("span","ph-slot","On the itinerary"+(typeof it.slot==="string"?" · "+it.slot:"")));
  c.appendChild(ph);
  const b=el("div","cb");
  b.appendChild(el("h3","dish",it.dish));
  b.appendChild(el("div","place",it.place+(it.area?" · "+it.area:"")));
  const tags=el("div","tags");
  if(it.score) tags.appendChild(el("span","score", it.score==="n/a"?"Not on Tabelog":(TRIP.scoreLabel||"Rating")+" "+it.score));
  if(it.badge) tags.appendChild(el("span","badge",it.badge));
  if(TIER[it.tier]) tags.appendChild(el("span","tag",TIER[it.tier]));
  if(it.kind==="sweets"||it.kind==="drinks") tags.appendChild(el("span","tag",it.kind==="sweets"?"Sweets":"Drinks"));
  if(rank&&it.group==="specialty") tags.appendChild(el("span","tag spec","Regional specialty"));
  b.appendChild(tags);
  if(it.note) b.appendChild(el("p","note",it.note));
  // Tabelog (or the place's own page) first, then Google Maps: whichever the place has.
  const links=el("div","links");
  if(it.url){ let h=""; try{ h=new URL(it.url).hostname }catch(e){}
    const a=el("a","lnk",/(^|\.)tabelog\.com$/.test(h)?"Tabelog":/tablecheck\.com$/.test(h)?"Book on TableCheck":"Website");
    a.href=it.url; a.target="_blank"; a.rel="noopener"; links.appendChild(a) }
  if(it.placeId||it.q){ const g=el("a","lnk gmaps"); g.href=mapsLink(it); g.target="_blank"; g.rel="noopener"; g.dataset.id=it.id;
    g.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
    g.appendChild(gm()); g.setAttribute("aria-label",it.place+" on Google Maps: every photo and review"); links.appendChild(g) }
  if(links.firstChild) b.appendChild(links);
  const vote=el("div","vote"); vote.setAttribute("role","group"); vote.setAttribute("aria-label","Your vote: "+it.dish);
  [3,2,1,0].forEach(v=>{const btn=el("button",null,VLABEL[v]); btn.type="button"; btn.dataset.v=v; btn.id="v-"+it.id+"-"+v; btn.onclick=()=>cast(it.id,v); vote.appendChild(btn)});
  b.appendChild(vote);
  const tally=el("div","tally"); b.appendChild(tally);
  c.appendChild(b);
  cards[it.id]={c,ph,vote,tally};
  patch(it.id);
  if(photos[it.id]) buildStrip(it.id); else if(!tried[it.id]){ if(io) io.observe(ph); else wantPhoto(it.id) }
  return c;
}
// Updates one card's vote buttons and group tally without rebuilding it.
function patch(id){
  const k=cards[id]; if(!k) return;
  const mine=mineOf(id);
  k.vote.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(mine===+b.dataset.v)));
  const tt=totals(id); k.tally.textContent="";
  const tot=el("span","total",String(tt.t)); tot.title="Group points: Must 3, I want 2, Meh 1, Nah 0"; k.tally.append(tot,el("span","pts","pts"),el("span","nvoted",tt.n+"/"+TRAVELERS.length+" voted"));
  const dots=el("span","dots");
  TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; const d=el("span","dot"+(typeof v==="number"?" v"+v:""),p[0]); d.title=p+": "+(typeof v==="number"?VLABEL[v]:"not voted yet"); dots.appendChild(d)});
  k.tally.appendChild(dots);
}
function refreshBar(){
  const n=ITEMS.filter(i=>typeof mineOf(i.id)==="number").length;
  $("#mine").textContent=me?"You've rated "+n+" of "+ITEMS.length:"Pick your name to vote";
  $("#progress").style.width=(me&&ITEMS.length?100*n/ITEMS.length:0)+"%";
  status(""); renderBoard();
}
// The scoreboard: per person, how many of their MUSTs, I WANTs, MEHs and NAHs got a dedicated slot on the itinerary
// ("slot" on an item in the trip file; every other place stays on as an alternative). Before any slot is set, it just
// counts each person's votes.
function renderBoard(){
  const B=$("#board"); if(!B) return;
  const planned=ITEMS.some(i=>i.slot);
  B.textContent="";
  const t=el("table","board-t"), hr=el("tr");
  hr.appendChild(el("th",null,planned?"Made the itinerary":"Votes so far"));
  [3,2,1,0].forEach(v=>hr.appendChild(el("th","c"+v,VLABEL[v])));
  hr.appendChild(el("th",null,"Rated"));
  t.appendChild(el("thead")).appendChild(hr);
  const tb=t.appendChild(el("tbody"));
  TRAVELERS.forEach(p=>{ const b=ballots[p]||{}, tr=el("tr",p===me?"me":null);
    tr.appendChild(el("th",null,p));
    [3,2,1,0].forEach(v=>{ const mine=ITEMS.filter(i=>b[i.id]===v), got=mine.filter(i=>i.slot).length;
      const td=el("td",null,planned?got+"/"+mine.length:String(mine.length));
      td.title=planned?got+" of "+p+"'s "+mine.length+" "+VLABEL[v]+" picks have a slot":p+" gave "+mine.length+" "+VLABEL[v];
      tr.appendChild(td) });
    tr.appendChild(el("td","rated",ITEMS.filter(i=>typeof b[i.id]==="number").length+"/"+ITEMS.length));
    tb.appendChild(tr) });
  B.appendChild(t);
  if(!planned) B.appendChild(el("p","board-note","Once places get a dedicated slot on the itinerary, this shows how many of each person's picks made it. Every place stays on as an alternative."));
}
function refresh(){ Object.keys(cards).forEach(patch); refreshBar() }
function render(){
  const L=$("#list"); if(!L) return;
  Object.keys(cards).forEach(id=>{ if(io) io.unobserve(cards[id].ph); delete cards[id] });
  L.textContent="";
  if(!me) L.appendChild(el("p","callout","Pick your name in the bar above to start voting. Everyone's votes show on each card."));
  const xs=visibleItems();
  if(!xs.length) L.appendChild(el("p","empty",filter==="todo"?"You've rated everything. Nice.":"Nothing here yet."));
  else if(sortMode==="region"){
    // Each region: what it's known for, then its regional specialties, then local favorites.
    REGIONS.forEach(g=>{ const its=xs.filter(i=>i.r===g); if(!its.length) return;
      const s=el("section","region"); s.id="region-"+slug(g);
      const h=el("h2","sec",g); h.appendChild(el("small",null,its.length+(its.length===1?" spot":" spots"))); s.appendChild(h);
      const known=(TRIP.knownFor||{})[g]; if(known&&known.length) s.appendChild(el("p","known","Known for "+known.join(", ")));
      const parts=GROUPS.map(([k,label])=>[label,its.filter(i=>i.group===k)]);
      parts.push(["More to try",its.filter(i=>!GROUPS.some(([k])=>k===i.group))]);
      const used=parts.filter(([,v])=>v.length);
      used.forEach(([label,v])=>{ if(used.length>1){ const sh=el("h3","sub",label); sh.appendChild(el("small",null,String(v.length))); s.appendChild(sh) }
        const grid=el("div","grid"); v.forEach(i=>grid.appendChild(card(i))); s.appendChild(grid) });
      L.appendChild(s) });
  } else {
    const grid=el("div","grid");
    xs.slice().sort((a,b)=>totals(b.id).t-totals(a.id).t||totals(b.id).n-totals(a.id).n).forEach((i,n)=>grid.appendChild(card(i,n+1)));
    L.appendChild(grid);
  }
  refreshBar();
}
function cast(id,v){
  if(!me){ const w=$("#whoWrap"); w.classList.remove("nudge"); void w.offsetWidth; w.classList.add("nudge"); toast("Pick your name first"); return }
  const cur=Object.assign({},ballots[me]||{});
  if(cur[id]===v) delete cur[id]; else cur[id]=v;
  ballots=Object.assign({},ballots,{[me]:cur}); patch(id); refreshBar(); saveVote();
}
function syncTools(){
  document.querySelectorAll("#sort button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.s===sortMode)));
  document.querySelectorAll("#filters button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.f===filter)));
  $("#jump").hidden=sortMode!=="region";
}
function mountBallot(){
  const v=el("div","gv-ballot");
  v.innerHTML='<header class="hd"><div class="hd-top"><a class="mark" href="/">Corgi Capital</a>'
    +'<button type="button" class="lock" id="lock" title="Forget the password on this device">Lock</button></div>'
    +'<h1 id="title"></h1><p id="intro"></p><nav class="jump" id="jump" aria-label="Jump to"></nav><section class="board" id="board" aria-label="Scoreboard"></section><div class="banner" id="setupBanner" hidden></div></header>'
    +'<div class="bar"><div class="bar-in"><div class="who" id="whoWrap"><span class="label">I am</span><div class="chips" id="who"></div></div>'
    +'<div class="counts"><span id="mine"></span><span class="status" id="status"></span></div></div>'
    +'<div class="progress" aria-hidden="true"><i id="progress"></i></div></div>'
    +'<div class="tools"><div class="seg" id="sort" role="group" aria-label="Sort"><button type="button" data-s="region">Region</button><button type="button" data-s="rank">Ranking</button></div>'
    +'<div class="filters" id="filters" role="group" aria-label="Show"></div><span class="key"><i class="k3"></i>Must 3<i class="k2"></i>I want 2<i class="k1"></i>Meh 1<i class="k0"></i>Nah 0</span></div>'
    +'<main class="list" id="list"></main>'
    +'<footer class="ft"><p class="gattr">Photos and places from <span translate="no">Google Maps</span>; tap a photo to see who took it. Ratings from Tabelog.</p></footer>'
    +'<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(v);
  document.title=TRIP.title||"Trip vote"; $("#title").textContent=TRIP.title||""; $("#intro").textContent=TRIP.intro||"";
  const jump=$("#jump");
  REGIONS.forEach(g=>{ const n=ITEMS.filter(i=>i.r===g).length; if(!n) return;
    const a=el("a",null,g); a.href="#region-"+slug(g); a.appendChild(el("small",null,String(n)));
    a.onclick=e=>{ e.preventDefault(); if(filter!=="all"){ filter="all"; syncTools(); render() }
      const s=document.getElementById("region-"+slug(g)); if(s) s.scrollIntoView({behavior:REDUCED?"auto":"smooth"}) };
    jump.appendChild(a) });
  const F=$("#filters"), has={slotted:ITEMS.some(i=>i.slot), casual:ITEMS.some(i=>i.tier==="casual"), splurge:ITEMS.some(i=>i.tier==="splurge"), treats:ITEMS.some(i=>i.kind==="sweets"||i.kind==="drinks")};
  FILTERS.forEach(([f,label])=>{ if(f in has&&!has[f]) return; const b=el("button","chip",label); b.type="button"; b.dataset.f=f; F.appendChild(b) });
  F.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; filter=b.dataset.f; syncTools(); render() });
  $("#sort").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; sortMode=b.dataset.s; ls("sort",sortMode); syncTools(); render() });
  $("#lock").addEventListener("click",()=>{ ls("code",null); ls("me",null); location.reload() });
  syncTools();
}

// ---------- Password gate ----------
// The corgi-capital.com home page look (VISUAL_IDENTITY.md): black, gold particle field, corner marks, Cormorant and
// Inconsolata. A remembered password skips the form; a wrong or changed one brings it back.
function buildGate(){
  const g=el("section","gate"); g.setAttribute("aria-labelledby","gateTitle");
  g.innerHTML='<canvas class="gate-field" aria-hidden="true"></canvas><div class="gate-grain" aria-hidden="true"></div>'
    +'<div class="gate-corner tl" aria-hidden="true"></div><div class="gate-corner tr" aria-hidden="true"></div><div class="gate-corner bl" aria-hidden="true"></div><div class="gate-corner br" aria-hidden="true"></div>'
    +'<header class="gate-top"><a class="gate-mark" href="/">Corgi Capital</a><span>Private</span></header>'
    +'<div class="gate-center"><div class="gate-line top"></div>'
    +'<h1 class="gate-title" id="gateTitle">By Invitation</h1><p class="gate-gold">Only.</p>'
    +'<div class="gate-line bottom"></div>'
    +'<form class="gate-form"><input type="password" name="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Password" aria-label="Password"><button type="submit">Enter</button></form>'
    +'<p class="gate-msg" role="status" aria-live="polite"></p></div>'
    +'<footer class="gate-bottom"><div class="gate-coords">40.7128° N<br>74.0060° W</div><a class="gate-contact" href="mailto:hello@corgi-capital.com">hello@corgi-capital.com</a></footer>';
  return g;
}
// The home page's gold particle field. Returns a stop function, called once the gate is gone.
function particleField(canvas){
  if(REDUCED||!canvas.getContext) return ()=>{};
  const ctx=canvas.getContext("2d"), N=72, LINK=180, SPEED=.18, ps=[], rand=(a,b)=>a+Math.random()*(b-a);
  let W=0, H=0, raf=0;
  function reset(p,init){ p.x=rand(0,W); p.y=init?rand(0,H):(Math.random()<.5?-4:H+4); p.vx=rand(-SPEED,SPEED); p.vy=rand(-SPEED,SPEED);
    if(Math.abs(p.vx)<.05) p.vx=SPEED*(Math.random()<.5?1:-1); p.r=rand(.6,1.6); p.a=rand(.25,.65) }
  function size(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; ps.forEach(p=>{ if(p.x>W) p.x=rand(0,W); if(p.y>H) p.y=rand(0,H) }) }
  function frame(){
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
      const a=ps[i], b=ps[j], d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<LINK){ const t=1-d/LINK; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.strokeStyle="rgba(201,165,90,"+(t*t*.12)+")"; ctx.lineWidth=.5; ctx.stroke() }
    }
    for(const p of ps){ p.x+=p.vx; p.y+=p.vy; if(p.x<-10||p.x>W+10||p.y<-10||p.y>H+10) reset(p,false);
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle="rgba(201,165,90,"+p.a+")"; ctx.fill() }
    raf=requestAnimationFrame(frame);
  }
  size(); for(let i=0;i<N;i++){ const p={}; reset(p,true); ps.push(p) }
  addEventListener("resize",size); frame();
  return ()=>{ cancelAnimationFrame(raf); removeEventListener("resize",size) };
}
function boot(){
  if(!TRIP_ID||!CFG.apiUrl){ document.body.textContent="This page isn't set up yet."; return }
  const gate=buildGate(); document.body.appendChild(gate);
  const stopField=particleField(gate.querySelector("canvas"));
  const form=gate.querySelector("form"), input=form.querySelector("input"), btn=form.querySelector("button"), msg=gate.querySelector(".gate-msg");
  const say=t=>{ msg.textContent=t||"" }, fine=window.matchMedia&&matchMedia("(pointer: fine)").matches;
  let busy=false;
  async function attempt(pw,remembered){
    pw=String(pw||"").trim();
    if(!pw){ say("Enter the password."); input.focus(); return }
    if(busy) return; busy=true; btn.disabled=true; input.readOnly=true; say(remembered?"Opening…":"Checking…");
    const j=await api(tripPath+"?code="+encodeURIComponent(pw));
    if(j&&j.ok){ code=pw; ls("code",pw); return open(j) }   // the form stays disabled while the gate fades out
    busy=false; btn.disabled=false; input.readOnly=false; form.hidden=false;
    if(j&&j.error==="code"){
      if(remembered){ ls("code",null); code=""; input.value=""; say(CHANGED) } else { say("Incorrect password."); input.select() }
    } else { if(remembered) input.value=pw; say("Can't reach the server. Try again in a moment.") }
    if(fine) input.focus();
  }
  function open(j){
    TRIP=j.trip||{}; TRAVELERS=TRIP.travelers||[]; ITEMS=TRIP.items||[]; REGIONS=TRIP.regions||[];
    me=ls("me"); if(TRAVELERS.indexOf(me)<0) me=null;
    ballots=j.ballots||{};
    const swap=()=>{
      stopField(); gate.remove(); document.body.classList.remove("gv-locked"); window.scrollTo(0,0);
      mountBallot(); renderWho(); render();
      loadMaps(j.mapsApiKey).then(()=>google.maps.importLibrary("places")).then(lib=>{ placesLib=lib; pumpPhotos() }).catch(()=>{});
      setInterval(()=>{ if(document.visibilityState==="visible") loadVotes() },30000);
      document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") loadVotes() });
    };
    if(REDUCED) swap(); else { gate.classList.add("leaving"); setTimeout(swap,350) }
  }
  form.addEventListener("submit",e=>{ e.preventDefault(); attempt(input.value,false) });
  let note=""; try{ note=sessionStorage.getItem("gv-msg")||""; sessionStorage.removeItem("gv-msg") }catch(e){}
  if(code){ form.hidden=true; attempt(code,true) }
  else { say(note); if(fine) input.focus({preventScroll:true}) }
}
boot();
})();
