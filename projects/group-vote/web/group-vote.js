/* Group Vote: reusable ballot for group trips, in the order a trip gets planned: Trip Dates, then Lodging (each its own
   vote, or shown as decided once settled), then the places to eat, drink and go.
   A trip page sets window.TRIP = {id: "..."} and loads this file (see events/2026/niseko/index.html). The trip's title,
   travelers, items and votes come from the vote server, which sends them only with the trip's password: until then the
   page is a password gate in the corgi-capital.com home page style. The server's URL is in group-vote-config.js. */
(function(){
"use strict";
const CFG=Object.assign({apiUrl:""},window.GROUP_VOTE||{});
const TRIP_ID=String((window.TRIP&&window.TRIP.id)||"");
let TRIP={}, TRAVELERS=[], ITEMS=[], OPTS=[], ALL=[], REGIONS=[];   // filled in from the server once the password checks out
// ITEMS: the places on the ballot. OPTS: trip-date and lodging options ("stage": "dates" or "lodging"), voted the same way.
// A vote is stored as its level: 3 Must, 2 I want, 1 Meh, 0 Nah. POINTS turns a level into the points it adds.
const VLABEL={3:"Must",2:"I want",1:"Meh",0:"Nah"};   // shown in capitals
const DLABEL={3:"Best",2:"Works",1:"If needed",0:"Can't"};   // the same levels, worded for trip-date options
const POINTS={3:3,2:1,1:0,0:-1};   // a Nah counts against a place
const labels=it=>it&&it.stage==="dates"?DLABEL:VLABEL;
// Each region's sections: the trip's categories, in order (TRIP.categories: key, label, about, thumbs; editable in
// Settings). Without them, these. The agent puts each suggestion in the category whose "about" fits it best.
const DEFAULT_GROUPS=[["specialty","Regional Specialties"],["favorite","Local Favorites"],["tastes","Group Tastes"],["coffee","Coffee"],["event","Events"]];
let GROUPS=DEFAULT_GROUPS;
// The categories whose cards get thumbs (up: a good pick; down: off the list if unwanted): the ones suggestions fill.
let THUMBS_IN=new Set(["tastes","coffee"]);
// Every section is ON (AI picks plus everyone's suggestions) or OFF (suggestions only: AI picks are hidden there and
// the agent stops adding to it; suggestions still get looked up). Anyone can flip one in Settings, for everyone. AI
// picks are the trip file's own places and the agent's finds ("found"); a suggestion is what a traveler sent.
const STAGE_SECT=[["locations","Trip Locations"],["dates","Trip Dates"],["lodging","Lodging"]];
let SECT=STAGE_SECT.concat(GROUPS);
const secOn=k=>!(TRIP.sections&&TRIP.sections[k]===false);
const aiPick=i=>!i.suggestedBy||!!i.found;
const hiddenPick=i=>!secOn(i.stage||i.group||"")&&aiPick(i);
const secLabel=k=>k==="photos"?"Photos":(SECT.find(([x])=>x===k)||[k,k])[1];
// Google photos on the cards, for everyone (Settings). Off, the page makes no Google calls at all.
const photosOn=()=>!(TRIP.sections&&TRIP.sections.photos===false);
// Why photos are off, from the trip ("photosOffNote", e.g. "Until final vote day"): in Recent Updates and Settings.
const offWhy=(lower)=>{ const n=String(TRIP.photosOffNote||""); return n?(lower?" "+n.charAt(0).toLowerCase()+n.slice(1):n):"" };
const TIER={casual:"Casual",mid:"Mid-Range",splurge:"Splurge"};
// Small line icons for the card pills and the matching filters (16px grid, drawn in the text color).
const ICON={
  casual:'<path d="M2.5 8.5h11a5.5 5.5 0 0 1-11 0z"/><path d="M6 6.5l6.5-4M8.5 6.5l5.5-3"/>',
  mid:'<path d="M4.5 2v4a1.5 1.5 0 0 0 3 0V2M6 7.5V14M11.5 14V2c-1.6.8-2.3 2.6-2.3 5.2h2.3"/>',
  splurge:'<path d="M4.2 2.5h7.6L14.5 6 8 13.5 1.5 6z"/><path d="M1.5 6h13M6.3 2.5 8 13.5l1.7-11"/>',
  sweets:'<path d="M4.6 7.4a3.4 3.4 0 1 1 6.8 0z"/><path d="M5 7.4 8 14l3-6.6"/>',
  drinks:'<path d="M2.5 2.5h11L8 8.5z"/><path d="M8 8.5v5M5.5 13.5h5"/>',
  coffee:'<path d="M2.5 6.5h9v3a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4z"/><path d="M11.5 7.5h.8a2 2 0 0 1 0 4h-1.3"/><path d="M5.6 1.8c-.7.8.7 1.6 0 2.6M8.4 1.8c-.7.8.7 1.6 0 2.6"/>',
  lock:'<path d="M5.4 7.4V5.6a2.6 2.6 0 0 1 5.2 0v1.8"/><rect x="3.6" y="7.2" width="8.8" height="6.6" rx="1.6" fill="currentColor"/>',
  unlock:'<path d="M5.4 7.4V5.6a2.6 2.6 0 0 1 5-1"/><rect x="3.6" y="7.2" width="8.8" height="6.6" rx="1.6" fill="currentColor"/>',
  izakaya:'<path d="M6 2h4M6 14h4M8 3.2c-2.9 0-4.6 2.1-4.6 4.8s1.7 4.8 4.6 4.8 4.6-2.1 4.6-4.8S10.9 3.2 8 3.2z"/><path d="M3.5 6.4h9M3.5 9.6h9"/>',
  specialty:'<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
  slotted:'<path d="M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3"/><path d="M5.8 10.1l1.6 1.6 3-3"/>',
  todo:'<path d="M10.5 2.5l3 3-8 8h-3v-3z"/>',
  event:'<path d="M2.5 5h11v2a1.5 1.5 0 0 0 0 3v2h-11v-2a1.5 1.5 0 0 0 0-3z"/><path d="M9.5 5.5v1M9.5 8v1M9.5 10.5v1"/>',
  tastes:'<path d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z"/>',
  avoid:'<circle cx="8" cy="8" r="5.5"/><path d="M4.1 11.9l7.8-7.8"/>',
  ig:'<rect x="2.5" y="2.5" width="11" height="11" rx="3.2"/><circle cx="8" cy="8" r="2.6"/><path d="M11.3 4.6v.1"/>',
  plus:'<path d="M8 3v10M3 8h10"/>',
  comment:'<path d="M2.5 3.5h11v7.5h-6.2L4.5 13.5V11h-2z"/><path d="M5.5 6.5h5M5.5 8.5h3"/>',
  up:'<path d="M2.5 7.5h2.6v6H2.5z"/><path d="M5.1 7.5l2.6-4.9c1 0 1.7.9 1.5 1.8l-.5 2.4h3.6a1.3 1.3 0 0 1 1.3 1.6l-1 4.3a1.3 1.3 0 0 1-1.3 1H5.1"/>',
  dates:'<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M5 9.2h1.4M7.3 9.2h1.4M9.6 9.2H11M5 11.4h1.4M7.3 11.4h1.4"/>',
  stay:'<path d="M1.5 3.5v10M1.5 10.5h13v3"/><circle cx="4.3" cy="8.3" r="1.4"/><path d="M7 10.5v-3h5a2.5 2.5 0 0 1 2.5 2.5v.5"/>',
  pin:'<path d="M8 14.2s4.6-4.4 4.6-7.7a4.6 4.6 0 0 0-9.2 0c0 3.3 4.6 7.7 4.6 7.7z"/><circle cx="8" cy="6.5" r="1.7"/>',
  map:'<path d="M1.8 3.8l4-1.6 4.4 1.6 4-1.6v10l-4 1.6-4.4-1.6-4 1.6z"/><path d="M5.8 2.2v10M10.2 3.8v10"/>',
  gear:'<circle cx="8" cy="8" r="2.1"/><path d="M8 1.6v1.7M8 12.7v1.7M1.6 8h1.7M12.7 8h1.7M3.5 3.5l1.2 1.2M11.3 11.3l1.2 1.2M3.5 12.5l1.2-1.2M11.3 4.7l1.2-1.2"/><circle cx="8" cy="8" r="4.4"/>',
  funnel:'<path d="M2.5 3.5h11l-4.2 5v4.3l-2.6 1.2V8.5z"/>'
};
const FILTER_ICON={slotted:"slotted",casual:"casual",splurge:"splurge",treats:"sweets",coffee:"coffee",events:"event",todo:"todo"};
const icon=k=>ICON[k]?'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true">'+ICON[k]+'</svg>':"";
function pill(k,label,cls){ const s=el("span","tag"+(cls?" "+cls:"")); s.innerHTML=icon(k); s.appendChild(document.createTextNode(label)); return s }
const FILTERS=[["all","All"],["slotted","On the Itinerary"],["casual","Casual"],["splurge","Splurge"],["treats","Sweets & Drinks"],["coffee","Coffee"],["events","Events"],["todo","Needs Rating"]];
// Card headings and award badges in title case. Small words stay lower case mid-title, and only a lower-case first
// letter changes, so "IWSC", "TableCheck" and "2017-19" come through as written.
const SMALL=new Set(["a","an","and","as","at","but","by","for","from","in","into","nor","of","on","or","per","the","to","via","vs","with"]);
function titleCase(s){
  const ws=String(s||"").split(" ");
  return ws.map((w,i)=>w.split("-").map((p,j)=>{
    const m=/^([^\p{L}]*)(\p{Ll})(.*)$/u.exec(p); if(!m||/\d/.test(m[1])) return p;   // "3am", "2nd" stay as written
    const small=SMALL.has((m[2]+m[3]).replace(/[^\p{L}]/gu,""))&&!m[1]&&(i>0||j>0)&&i<ws.length-1&&!/:$/.test(ws[i-1]||"");
    return small?p:m[1]+m[2].toUpperCase()+m[3];
  }).join("-")).join(" ");
}
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
coffee:`<ellipse cx="50" cy="81" rx="36" ry="7" fill="#e9e1d3" stroke="#c9bfae" stroke-width="1.5"/><path d="M72 47 q15 -1 14 11 q-1 11 -20 11" stroke="#c9bfae" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M72 47 q15 -1 14 11 q-1 11 -20 11" stroke="#f4efe6" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="48" cy="40" rx="28" ry="8" fill="#5a341c"/><ellipse cx="48" cy="40" rx="21" ry="6" fill="#a8693a"/><path d="M48 39.5 c-5 -2.6 -4.8 -6 -2.3 -6 c1.2 0 2 .8 2.3 1.6 c.3 -.8 1.1 -1.6 2.3 -1.6 c2.5 0 2.7 3.4 -2.3 6z" fill="#f3e3c8"/><path d="M20 40 L76 40 Q74 75 48 78 Q22 75 20 40z" fill="#f4efe6" stroke="#c9bfae" stroke-width="1.5"/><path d="M25 57 Q48 63 71 57" stroke="#8a6a4a" stroke-width="2.5" fill="none"/><g stroke="#e8e2d6" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".75"><path d="M38 28 q-4 -5 0 -10 q4 -5 0 -10"/><path d="M50 26 q-4 -5 0 -10 q4 -5 0 -10"/><path d="M62 28 q-4 -5 0 -10 q4 -5 0 -10"/></g>`,
cake:`<path d="M20 70 L80 70 L80 50 L20 58z" fill="#f3e2c4"/><path d="M20 58 L80 50 L80 42 L20 50z" fill="#fffaf2"/><path d="M20 62 L80 56" stroke="#e6a1b0" stroke-width="3"/><circle cx="66" cy="40" r="6" fill="#d6283b"/><rect x="14" y="70" width="72" height="4" rx="2" fill="#cfd6db"/>`,
ice:`<rect x="8" y="78" width="84" height="8" fill="#e8f1f7"/><path d="M30 78 L38 30 L50 18 L62 30 L70 78z" fill="#9fd3f0" opacity=".85"/><path d="M40 70 L46 34 M56 70 L54 36" stroke="#ffffff" stroke-width="2" opacity=".8"/><circle cx="50" cy="18" r="14" fill="#5fb3e6" opacity=".25"/><path d="M18 20 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z M80 34 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0z" fill="#ffffff"/>`,
burger:`<path d="M16 46 Q16 22 50 22 Q84 22 84 46 Z" fill="#e0a24a"/><g fill="#fff4d6"><ellipse cx="38" cy="31" rx="2.2" ry="1.3"/><ellipse cx="52" cy="28" rx="2.2" ry="1.3"/><ellipse cx="64" cy="34" rx="2.2" ry="1.3"/><ellipse cx="45" cy="38" rx="2.2" ry="1.3"/></g><path d="M14 49 q6 6 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke="#7cb342" stroke-width="5" fill="none"/><path d="M18 52 L82 52 L76 61 L68 54 L58 62 L48 54 L38 62 L28 54 Z" fill="#f2c94c"/><rect x="16" y="56" width="68" height="12" rx="6" fill="#6b3a1f"/><path d="M18 70 L82 70 Q82 82 50 82 Q18 82 18 70 Z" fill="#d9953f"/>`,
onigiri:`<path d="M50 16 Q57 16 61 24 L84 64 Q88 76 76 78 L24 78 Q12 76 16 64 L39 24 Q43 16 50 16 Z" fill="#fbf8f1" stroke="#e3dccb" stroke-width="1.5"/><rect x="36" y="54" width="28" height="24" rx="2" fill="#1f2a24"/><circle cx="50" cy="40" r="5" fill="#e04a3a"/>`,
yakitori:`<g stroke="#c8a77a" stroke-width="3" stroke-linecap="round"><path d="M12 82 L82 22"/><path d="M24 88 L92 32"/></g><g fill="#b5683a"><circle cx="30" cy="66" r="8"/><circle cx="56" cy="44" r="8"/></g><g fill="#7cb342"><circle cx="43" cy="55" r="6"/></g><g fill="#c97a45"><circle cx="44" cy="70" r="8"/><circle cx="58" cy="58" r="8"/><circle cx="72" cy="46" r="8"/></g><path d="M40 68 l8 -6 M54 56 l8 -6 M68 44 l8 -6" stroke="#8a4a24" stroke-width="2"/>`,
truck:`<path d="M10 40 L64 40 L58 31 L16 31 Z" fill="#f6c453"/><rect x="10" y="40" width="54" height="30" rx="4" fill="#e85d4f"/><rect x="17" y="46" width="40" height="12" rx="2" fill="#ffe8b3"/><rect x="64" y="48" width="24" height="22" rx="3" fill="#c94a3e"/><rect x="68" y="52" width="13" height="9" rx="1" fill="#bfe3f2"/><circle cx="26" cy="72" r="7" fill="#2b2e33"/><circle cx="26" cy="72" r="3" fill="#8a9099"/><circle cx="74" cy="72" r="7" fill="#2b2e33"/><circle cx="74" cy="72" r="3" fill="#8a9099"/><path d="M30 26 q3-6 0-12 M40 26 q3-6 0-12" stroke="#c8d2da" stroke-width="2" fill="none"/>`,
izakaya:`<rect x="8" y="86" width="84" height="4" rx="2" fill="#8a6a4a"/><path d="M33 4 L33 13" stroke="#3a2a20" stroke-width="2"/><rect x="23" y="12" width="20" height="6" rx="2" fill="#2b2420"/><ellipse cx="33" cy="39" rx="20" ry="22" fill="#d9432f"/><path d="M14 31 Q33 35 52 31 M13 39 Q33 43 53 39 M14 47 Q33 51 52 47" stroke="#a8301f" stroke-width="1.5" fill="none"/><ellipse cx="26" cy="33" rx="4" ry="9" fill="#ef6a52" opacity=".7"/><rect x="23" y="59" width="20" height="6" rx="2" fill="#2b2420"/><path d="M33 65 L33 72" stroke="#2b2420" stroke-width="2"/><rect x="66" y="40" width="8" height="15" rx="3" fill="#f1ead9"/><ellipse cx="70" cy="40" rx="5.5" ry="2" fill="#e6dcc6"/><path d="M66 53 Q56 63 57 73 Q58 86 70 86 Q82 86 83 73 Q84 63 74 53 Z" fill="#f1ead9"/><path d="M58 70 Q70 74 82 70" stroke="#3b6aa0" stroke-width="2.5" fill="none"/><path d="M38 76 L52 76 L50 86 L40 86 Z" fill="#f1ead9"/><ellipse cx="45" cy="76" rx="7" ry="2" fill="#d9c9a5"/>`,
robata:`<rect x="10" y="62" width="80" height="22" rx="3" fill="#7a4e2d"/><rect x="10" y="62" width="80" height="5" fill="#8f5d36"/><g fill="#e8572f"><circle cx="22" cy="60" r="4"/><circle cx="34" cy="61" r="4"/><circle cx="46" cy="60" r="4"/><circle cx="58" cy="61" r="4"/><circle cx="70" cy="60" r="4"/><circle cx="80" cy="61" r="3.5"/></g><g fill="#f6a03a"><circle cx="28" cy="58" r="2"/><circle cx="52" cy="58" r="2"/><circle cx="74" cy="58" r="2"/></g><path d="M12 54 L88 54" stroke="#4a4f55" stroke-width="2"/><ellipse cx="34" cy="46" rx="20" ry="7" fill="#c98a4a"/><path d="M54 46 L64 39 L64 53 Z" fill="#b5763a"/><circle cx="19" cy="44.5" r="1.6" fill="#2b2420"/><path d="M28 41 l4 10 M36 40 l4 11 M44 41 l4 10" stroke="#8a5428" stroke-width="1.6"/><path d="M68 52 Q64 38 77 36 Q90 38 86 52 Z" fill="#f2d3b0"/><path d="M77 37 L72 51 M77 37 L77 51 M77 37 L82 51" stroke="#d9ae86" stroke-width="1.2"/><path d="M30 30 q3-6 0-12 M44 28 q3-6 0-12" stroke="#c8d2da" stroke-width="2" fill="none"/>`,
onsen:`<ellipse cx="50" cy="68" rx="40" ry="14" fill="#5f6b73"/><ellipse cx="50" cy="66" rx="33" ry="9.5" fill="#8fc9e6"/><ellipse cx="40" cy="64" rx="11" ry="3" fill="#c9e9f6" opacity=".85"/><g fill="#7a8288"><circle cx="15" cy="66" r="5.5"/><circle cx="85" cy="66" r="5.5"/><circle cx="26" cy="77" r="5.5"/><circle cx="74" cy="77" r="5.5"/><circle cx="50" cy="80" r="5.5"/></g><path d="M34 48 q-6 -8 0 -16 q6 -8 0 -16 M50 46 q-6 -8 0 -16 q6 -8 0 -16 M66 48 q-6 -8 0 -16 q6 -8 0 -16" stroke="#e8eef2" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
ski:`<path d="M8 76 L40 30 L55 50 L66 37 L92 76 Z" fill="#cfd8de"/><path d="M40 30 L48 41 L43 40 L38 45 L33 40 Z" fill="#fff"/><path d="M66 37 L72 46 L68 45 L64 48 L61 45 Z" fill="#fff"/><path d="M14 87 L84 71 M20 92 L88 77" stroke="#e85d4f" stroke-width="4" stroke-linecap="round"/><g fill="#fff"><circle cx="20" cy="22" r="1.8"/><circle cx="80" cy="18" r="1.8"/><circle cx="60" cy="24" r="1.4"/></g>`,
shop:`<rect x="16" y="40" width="68" height="42" rx="2" fill="#efe6d4"/><path d="M12 40 L20 25 L80 25 L88 40 Z" fill="#e85d4f"/><path d="M27 25 L25 40 M40 25 L40 40 M53 25 L55 40 M66 25 L70 40" stroke="#fff" stroke-width="5"/><rect x="23" y="50" width="24" height="17" rx="2" fill="#bfe3f2"/><rect x="56" y="50" width="20" height="32" rx="2" fill="#8a6a4a"/><circle cx="72" cy="67" r="1.6" fill="#f2c94c"/><circle cx="35" cy="58" r="4" fill="#f2c94c"/>`,
lantern:`<path d="M6 22 Q50 42 94 22" stroke="#6b5b4b" stroke-width="1.5" fill="none"/><g fill="#f2b541"><ellipse cx="20" cy="38" rx="7" ry="9"/><ellipse cx="40" cy="45" rx="7" ry="9"/><ellipse cx="60" cy="45" rx="7" ry="9"/><ellipse cx="80" cy="38" rx="7" ry="9"/></g><g fill="#fff3c4" opacity=".75"><circle cx="20" cy="38" r="3"/><circle cx="40" cy="45" r="3"/><circle cx="60" cy="45" r="3"/><circle cx="80" cy="38" r="3"/></g><path d="M8 80 Q30 70 50 78 Q70 86 92 76 L92 90 L8 90 Z" fill="#e8eef2"/><g fill="#fff"><circle cx="30" cy="64" r="1.6"/><circle cx="70" cy="60" r="1.6"/><circle cx="52" cy="68" r="1.3"/></g>`,
steam:`<path d="M6 80 L22 58 L36 66 L50 52 L64 64 L78 56 L94 80 Z" fill="#c89a62"/><path d="M6 80 L94 80 L94 88 L6 88 Z" fill="#a8763f"/><circle cx="40" cy="74" r="4" fill="#e3c25a"/><circle cx="66" cy="72" r="3" fill="#e3c25a"/><path d="M30 56 q-5 -8 0 -16 q5 -8 0 -16 M52 48 q-5 -8 0 -16 q5 -8 0 -16 M72 54 q-5 -8 0 -16" stroke="#f2f2f0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>`,
boat:`<rect x="10" y="30" width="30" height="34" fill="#9b5a3c"/><path d="M8 30 L25 19 L42 30 Z" fill="#6b3a2a"/><rect x="16" y="38" width="6" height="8" fill="#f2d78a"/><rect x="28" y="38" width="6" height="8" fill="#f2d78a"/><rect x="8" y="64" width="84" height="22" fill="#3d6f8f"/><path d="M44 66 L80 66 L74 74 L50 74 Z" fill="#e8e2d6"/><path d="M60 66 L60 54" stroke="#6b5b4b" stroke-width="2"/><path d="M14 75 q6 -3 12 0 t12 0 M58 81 q6 -3 12 0 t12 0" stroke="#8fc9e6" stroke-width="2" fill="none"/><path d="M87 64 L87 40" stroke="#4a4f55" stroke-width="2"/><circle cx="87" cy="38" r="4" fill="#f2d78a"/>`,
hotel:`<rect x="8" y="84" width="84" height="6" rx="3" fill="#e8eef2"/><rect x="24" y="24" width="52" height="60" rx="2" fill="#c9b79c"/><rect x="20" y="18" width="60" height="8" rx="2" fill="#8a6a4a"/><path d="M20 18 Q50 8 80 18z" fill="#f4f6f7"/><g fill="#f2d78a"><rect x="31" y="33" width="9" height="9" rx="1"/><rect x="45.5" y="33" width="9" height="9" rx="1"/><rect x="60" y="33" width="9" height="9" rx="1"/><rect x="31" y="49" width="9" height="9" rx="1"/><rect x="60" y="49" width="9" height="9" rx="1"/></g><rect x="45.5" y="49" width="9" height="9" rx="1" fill="#6b5b4b"/><path d="M42 84 L42 69 Q50 62 58 69 L58 84 Z" fill="#6b4a32"/><g fill="#fff"><circle cx="12" cy="20" r="1.6"/><circle cx="88" cy="14" r="1.6"/><circle cx="90" cy="44" r="1.3"/><circle cx="10" cy="52" r="1.3"/></g>`,
calendar:`<rect x="16" y="22" width="68" height="62" rx="7" fill="#f4efe6" stroke="#c9bfae" stroke-width="1.5"/><path d="M16 29a7 7 0 0 1 7-7h54a7 7 0 0 1 7 7v9H16z" fill="#d94a2b"/><path d="M33 15v14M67 15v14" stroke="#5a6068" stroke-width="4.5" stroke-linecap="round"/><g fill="#d8cdb8"><rect x="24" y="46" width="11" height="8" rx="2"/><rect x="39" y="46" width="11" height="8" rx="2"/><rect x="54" y="46" width="11" height="8" rx="2"/><rect x="24" y="61" width="11" height="8" rx="2"/><rect x="39" y="61" width="11" height="8" rx="2"/></g><rect x="54" y="61" width="11" height="8" rx="2" fill="#d94a2b"/>`
};
const $=s=>document.querySelector(s);
function el(tag,cls,text){const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e}
const K=k=>"gv-"+TRIP_ID+"-"+k;
function ls(k,v){try{if(v===undefined) return localStorage.getItem(K(k)); if(v===null) localStorage.removeItem(K(k)); else localStorage.setItem(K(k),v)}catch(e){return null}}
const REDUCED=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

let me=null, code=ls("code")||"";
// The trip owner's code, on their own devices (from an owner link): their suggestions run at once. The agent runs on the
// owner's Claude subscription, which may only run the owner's own requests, so anyone else's wait for the owner's OK.
let OWNER=ls("owner")||"", isOwner=false;
let sortMode=ls("sort")==="rank"?"rank":"region", filter="all";
let ballots={}, THUMBS={}, pending=Promise.resolve(), saving=0, unsent=false, loading=false;   // THUMBS: per person, their Group Tastes thumbs up
const photos={}, cards={};   // photos: per item, Google's photo list and what this page has fetched; cards: per item, its card
const status=t=>{const s=$("#status"); if(s) s.textContent=t};
const tripPath="/trips/"+encodeURIComponent(TRIP_ID);
let toastTimer=0;
// A short message at the foot of the screen. With an action (Undo, say), a button in it, and it stays longer.
function toast(t,act){ const e=$("#toast"); if(!e) return; e.textContent=t; e.classList.toggle("act",!!act);
  if(act){ const b=el("button","toast-b",act.label); b.type="button"; b.onclick=()=>{ e.classList.remove("show"); act.fn() }; e.appendChild(b) }
  e.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>e.classList.remove("show"),act?8000:2600) }

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
    const busy=me&&(saving||unsent), mine=busy?ballots[me]:null, myUp=busy?THUMBS[me]:null, before=JSON.stringify([ballots,THUMBS]);
    ballots=j.ballots||{}; THUMBS=j.thumbs||{};
    if(mine) ballots[me]=mine;
    if(myUp) THUMBS[me]=myUp;
    if(typeof j.rev==="number"&&j.rev!==REV) await reloadTrip();   // places changed (a suggestion landed, a removal, a new upload)
    else if(JSON.stringify([ballots,THUMBS])!==before) refresh(); else status("");
    if(Array.isArray(j.suggestions)) setSugs(j.suggestions);
    if(unsent){ unsent=false; saveVote() }
  } finally { loading=false; pace() }
}
// The trip's places again (after a suggestion was added): re-rendered in place, scrolled to where you were, with the new
// cards flashed.
async function reloadTrip(){
  const j=await api(tripPath+"?code="+encodeURIComponent(code));
  if(!j||!j.ok){ if(j&&j.error==="code") lockOut(CHANGED); return }
  const had=new Set([...ITEMS,...OPTS].map(i=>i.id)), first=[...document.querySelectorAll(".card")].find(c=>c.getBoundingClientRect().bottom>90);
  const anchor=first?{id:first.dataset.id, y:first.getBoundingClientRect().top}:null;
  setTrip(j.trip||{}); REV=+j.rev||0;
  render(); renderSugs(); renderGoals(); startPhotos();   // the Updates buttons depend on which places are on the page (Undo for a removed one)
  if(anchor){ const c=document.querySelector('.card[data-id="'+anchor.id+'"]'); if(c) scrollBy(0,c.getBoundingClientRect().top-anchor.y) }
  [...ITEMS,...OPTS].filter(i=>!had.has(i.id)).forEach(i=>{ const k=cards[i.id]; if(k) k.c.classList.add("flash") });
}
function setTrip(t){
  TRIP=t; TRAVELERS=TRIP.travelers||[]; REGIONS=TRIP.regions||[];
  const cats=Array.isArray(TRIP.categories)&&TRIP.categories.length?TRIP.categories:null;
  GROUPS=cats?cats.map(c=>[c.key,c.label]):DEFAULT_GROUPS; SECT=STAGE_SECT.concat(GROUPS);
  THUMBS_IN=new Set(cats?cats.filter(c=>c.thumbs).map(c=>c.key):["tastes","coffee"]);
  const all=(TRIP.items||[]).map(i=>Object.assign({},i,{dish:titleCase(i.dish),badge:titleCase(i.badge)}));
  ALL=all; ITEMS=all.filter(i=>!i.stage&&!hiddenPick(i)); OPTS=all.filter(i=>i.stage&&!hiddenPick(i));   // OFF sections drop their AI picks
}

// ---------- Suggestions ----------
// Anyone can paste Google Maps links, Tabelog links or names; the server queues each and Claude (agent.py) looks it up,
// writes its card and adds it, or says why not. The Updates panel, one line until it's opened, shows the last week of
// suggestions, Group Tastes comments and removals; while any is still being looked up the page checks every 5 seconds.
let REV=0, SUGS=[], paceTimer=0;
const SUG_STATE={held:"Awaiting OK",declined:"Skipped",queued:"Waiting",working:"Looking it up",added:"Added",duplicate:"Already listed",rejected:"Couldn't add",failed:"Couldn't add"};
const TASTE_STATE={held:"Awaiting OK",declined:"Skipped",queued:"Waiting",working:"Updating tastes",added:"Tastes updated",rejected:"Not a taste",failed:"Couldn't update"};
const REMOVE_STATE={removed:"Removed",restored:"Back on the List"};
const SECTION_STATE={on:"AI Picks On",off:"Suggestions Only"}, PHOTO_STATE={on:"Photos On",off:"Photos Off"}, GOALS_STATE={updated:"Goals Updated"}, CATS_STATE={updated:"Categories Updated"}, LOCK_STATE={locked:"Locked",unlocked:"Unlocked"};
const sugPending=()=>SUGS.some(s=>s.status==="queued"||s.status==="working");
function pace(){ clearTimeout(paceTimer); if(sugPending()) paceTimer=setTimeout(loadVotes,5000) }
function setSugs(xs){ const before=JSON.stringify(SUGS); SUGS=xs; if(JSON.stringify(SUGS)!==before) renderSugs() }
const sugWhat=t=>/google\.|goo\.gl/.test(t)?"a Google Maps link":/tabelog\.com/.test(t)?"a Tabelog link":/^https?:\/\//.test(t)?"a link":"“"+(t.length>60?t.slice(0,58)+"…":t)+"”";
function renderSugs(){
  const S=$("#sugs"); if(!S) return;
  S.hidden=!SUGS.length; if(!SUGS.length) return;
  const sum=S.querySelector("summary"), ul=S.querySelector("ul"), busy=SUGS.filter(s=>s.status==="queued"||s.status==="working").length, held=SUGS.filter(s=>s.status==="held").length;
  sum.textContent=""; sum.appendChild(el("span","sugs-h","Recent Updates"));
  sum.appendChild(busy?el("span","sugs-busy",busy+" in progress"):held?el("span","sugs-held",held+(isOwner?" waiting for your OK":" waiting for "+ownerName()+"'s OK"))
    :el("span","sugs-last",lastLine(SUGS[0])));
  ul.textContent="";
  SUGS.slice(0,12).forEach(s=>{
    const kind=s.kind||"spot", li=el("li","sug "+s.status), going=s.status==="queued"||s.status==="working", shown=!!s.item&&ITEMS.some(i=>i.id===s.item);
    li.appendChild(el("span","sug-st",(kind==="taste"?TASTE_STATE:kind==="remove"?REMOVE_STATE:kind==="section"?(s.text==="photos"?PHOTO_STATE:SECTION_STATE):kind==="goals"?GOALS_STATE:kind==="categories"?CATS_STATE:kind==="lock"?LOCK_STATE:SUG_STATE)[s.status]||s.status));
    const wait=s.status==="held"||s.status==="declined";
    li.appendChild(el("span","sug-txt",kind==="goals"?"Squad Goals · "+s.by:kind==="categories"?s.text+" · "+s.by:kind==="lock"?secLabel(s.text)+" · "+s.by:kind==="section"?(s.text==="photos"&&s.status==="off"&&offWhy()?offWhy():secLabel(s.text))+" · "+s.by:kind==="remove"?s.text+" · "+s.by+(s.restoredBy?", back by "+s.restoredBy:"")
      :going||wait?sugWhat(s.text)+" from "+s.by+(s.status==="held"&&!isOwner?" · runs once "+ownerName()+" OKs it":"")
      :money(s.reason||sugWhat(s.text))+" · "+s.by));
    const btn=(t,f,c)=>{ const a=el("button","sug-see"+(c?" "+c:""),t); a.type="button"; a.onclick=f; li.appendChild(a) };
    if(s.status==="held"&&isOwner){ btn("Run",()=>approve([s.id],true),"go"); btn("Skip",()=>approve([s.id],false)) }
    else if(kind==="remove"&&s.status==="removed"&&!shown) btn("Undo",()=>undoRemove(s.item));
    else if(kind==="taste"&&s.status==="added") btn("See it",()=>openSuggest("taste"));
    else if(kind==="spot"&&s.status==="failed"&&s.by===me&&!SUGS.some(x=>x.id>s.id&&x.text===s.text&&x.by===s.by)) btn("Try Again",()=>retrySug(s));
    else if(shown) btn("See it",()=>seeItem(s.item));
    ul.appendChild(li) });
}
// The closed panel's one line: the newest update, short.
function lastLine(s){
  const it=s.item&&byId(s.item), back=s.kind==="remove"&&s.status==="restored", who=" · "+(back&&s.restoredBy?s.restoredBy:s.by);
  if(s.kind==="remove") return (back?"Back on the list: ":"Removed ")+s.text+who;
  if(s.kind==="section") return s.text==="photos"?"Photos "+(s.status==="on"?"on":"off"+offWhy(true))+who:(s.status==="on"?"AI picks on in ":"Suggestions only in ")+secLabel(s.text)+who;
  if(s.kind==="goals") return "Squad Goals updated"+who;
  if(s.kind==="categories") return "Categories updated"+who;
  if(s.kind==="lock") return secLabel(s.text)+" "+s.status+who;
  if(s.kind==="taste") return (TASTE_STATE[s.status]||s.status)+who;
  return (s.status==="added"&&it?"Added "+it.place:(SUG_STATE[s.status]||s.status)+": "+sugWhat(s.text))+who;
}
function seeItem(id){
  const pg=pageOf((byId(id)||{}).stage||"eats"); if(pg!==PAGE&&pageOk(pg)) setPage(pg,true);   // its own page first
  if(ITEMS.some(i=>i.id===id)&&!visibleItems().some(i=>i.id===id)){ filter="all"; syncTools(); render() }
  const k=cards[id]; if(!k) return;
  k.c.scrollIntoView({behavior:REDUCED?"auto":"smooth",block:"center"}); k.c.classList.remove("flash"); void k.c.offsetWidth; k.c.classList.add("flash");
}
// A suggestion the agent couldn't look up (an error, not a no): sent again as a new one; the button goes once it is.
async function retrySug(s){
  if(!me) return nudgeWho();
  const j=await post(tripPath+"/suggestions",Object.assign({code,name:me,text:s.text,why:s.why||""},OWNER?{owner:OWNER}:{}));
  if(j&&j.ok){ setSugs(j.suggestions||SUGS); pace(); toast("Our agent is looking it up again") }
  else if(j&&j.error==="code") lockOut(CHANGED);
  else toast(j&&j.error==="limit"?"That's your limit for today. Try again tomorrow.":"Couldn't send that. Try again in a moment.");
}
const ownerName=()=>TRIP.owner||"the trip's owner";
// The owner runs (or skips) suggestions held for their OK.
async function approve(ids,run){
  const j=await post(tripPath+"/approve",{code,owner:OWNER,ids,run});
  if(j&&j.ok){ setSugs(j.suggestions||SUGS); pace(); toast(run?"Running it now":"Skipped") }
  else if(j&&j.error==="code") lockOut(CHANGED);
  else if(j&&j.error==="owner"){ OWNER=""; isOwner=false; ls("owner",null); renderSugs(); toast("This device's owner link stopped working") }
  else toast("Couldn't do that. Try again in a moment.");
}
// ---------- Categories ----------
// The places' categories, in order: what each is called and what goes in it. Our agent reads "what goes here" to put
// each suggestion in the right one. Anyone can rename, describe, add, reorder or remove them, for everyone (logged);
// places in a removed one show under More to Try.
function openCategories(){
  if(!me) return nudgeWho();
  if(document.querySelector(".sg")) return;
  const from=document.activeElement, d=el("div","sg"), f=el("form","sg-card cats"); f.noValidate=true;
  d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","catTitle"); d.appendChild(f);
  const h=el("h2",null,"Categories"); h.id="catTitle"; f.appendChild(h);
  f.appendChild(el("p","sg-help","Where places go on the ballot, in this order. Our agent puts each suggestion in the category whose description fits it best. Changes apply for everyone."));
  const list=el("ol","cat-l"), msg=el("p","sg-msg"), count=k=>ALL.filter(i=>!i.stage&&i.group===k).length;
  msg.setAttribute("role","status"); msg.setAttribute("aria-live","polite");
  function row(c){
    const li=el("li","cat-row"), top=el("div","cat-top"), lab=el("input"), about=el("input"), note=el("p","cat-note");
    if(c.key) li.dataset.key=c.key;
    lab.className="cat-label"; lab.maxLength=40; lab.value=c.label||""; lab.placeholder="Name"; lab.setAttribute("aria-label","Category name");
    about.className="cat-about"; about.maxLength=200; about.value=c.about||""; about.placeholder="What goes here (our agent reads this)"; about.setAttribute("aria-label","What goes in it");
    const btn=(t,label,fn)=>{ const b=el("button","cat-b",t); b.type="button"; b.setAttribute("aria-label",label); b.onclick=fn; return b };
    const up=btn("↑","Move up",()=>{ const p=li.previousElementSibling; if(p) list.insertBefore(li,p) });
    const dn=btn("↓","Move down",()=>{ const n=li.nextElementSibling; if(n) list.insertBefore(n,li) });
    const rm=btn("✕","Remove",()=>{ const gone=!li.classList.contains("gone"), n=c.key?count(c.key):0;
      li.classList.toggle("gone",gone); rm.textContent=gone?"Undo":"✕"; rm.setAttribute("aria-label",gone?"Keep it":"Remove");
      note.textContent=gone?(n?n+(n===1?" place moves":" places move")+" to More to Try.":"Removed when you save."):"" });
    top.append(lab,up,dn,rm); li.append(top,about,note); return li;
  }
  (TRIP.categories&&TRIP.categories.length?TRIP.categories:GROUPS.map(([key,label])=>({key,label,about:""}))).forEach(c=>list.appendChild(row(c)));
  const add=el("button","tx-b cat-add"); add.type="button"; add.id="catAdd"; add.innerHTML=icon("plus"); add.appendChild(document.createTextNode("Add Category"));
  add.onclick=()=>{ if(list.children.length>=12){ msg.textContent="Up to 12 categories."; return } const li=row({}); list.appendChild(li); li.querySelector(".cat-label").focus() };
  const r=el("div","sg-row"), no=el("button","sg-cancel","Cancel"), go=el("button","sg-go","Save"); no.type="button"; go.type="submit"; r.append(no,go);
  f.append(list,add,msg,r);
  document.body.appendChild(d); document.body.classList.add("lb-open");
  function close(){ d.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown",key,true); if(from&&from.focus) from.focus({preventScroll:true}) }
  function key(e){
    if(e.key==="Escape"){ e.preventDefault(); close() }
    else if(e.key==="Tab"){ const fs=[...d.querySelectorAll("input,button:not([disabled])")], i=fs.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); fs[fs.length-1].focus() } else if(!e.shiftKey&&i===fs.length-1){ e.preventDefault(); fs[0].focus() } }
  }
  addEventListener("keydown",key,true);
  d.addEventListener("click",e=>{ if(e.target===d) close() });
  no.onclick=close;
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const rows=[...list.children].filter(li=>!li.classList.contains("gone")), blank=rows.find(li=>!li.querySelector(".cat-label").value.trim());
    if(!rows.length){ msg.textContent="Keep at least one category."; return }
    if(blank){ msg.textContent="Give each category a name."; blank.querySelector(".cat-label").focus(); return }
    const cats=rows.map(li=>Object.assign({label:li.querySelector(".cat-label").value.trim(),about:li.querySelector(".cat-about").value.trim()},li.dataset.key?{key:li.dataset.key}:{}));
    go.disabled=true; msg.textContent="Saving…";
    const j=await post(tripPath+"/categories",{code,name:me,categories:cats});
    go.disabled=false;
    if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); await reloadTrip(); toast("Categories saved for everyone") }
    else if(j&&j.error==="code") lockOut(CHANGED);
    else msg.textContent=j&&j.error==="categories"?"Names up to 40 characters, descriptions up to 200, and at most 12.":"Couldn't save that. Try again in a moment.";
  });
  list.querySelector(".cat-label").focus();
}
// ---------- Trip Map ----------
// The whole trip on one Google map, in the page's colors: the route between the regions (each leg a curved gold line
// with its date), the regions with their dates, where we stay, and every spot as a dot in its category's color (tap
// one for its card). Google's map loads only when this page opens, counted against the month's map budget; the
// places' coordinates come from the server, which looks each up once and keeps it up to 25 days (TRIP.map: points,
// legs, center, zoom).
let tripMap=null, mapBusy=false, mapPop=null, mapView=ls("mapview")||"all";
const mapLayers={route:[], dots:[]}, mapOff={route:false, cats:{}}, mapBox={}, mapLabels=[];   // mapBox: each region's bounds
const WEEK=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// "2/19 1PM - 2/21 12PM" as "Fri Feb 19 – Sun Feb 21", a single day as "Sat Feb 20": the map shows days, not times.
function mapDays(s){
  const ds=(String(s).match(/\d{1,2}\/\d{1,2}/g)||[]).map(md=>{ const [m,d]=md.split("/").map(Number), t=new Date(Date.UTC(+TRIP.year||2000,m-1,d));
    return WEEK[t.getUTCDay()]+" "+MONTHS.substr((m-1)*3,3)+" "+d });
  return ds.length?(ds.length>1&&ds[1]!==ds[0]?ds[0]+" – "+ds[1]:ds[0]):String(s);
}
// Durations as "1 Hr 40 Min".
const mapDur=s=>String(s||"").replace(/\b(\d+(?:\.\d+)?)\s*hrs?\b/gi,"$1 Hr").replace(/\b(\d+)\s*mins?\b/gi,"$1 Min");
// A named point: its dot exactly on the spot, its label just above (one line per date range), which moves aside when
// another label is in the way (tied back to its dot by a thin line once it's moved well away).
function mapPt(kind,name,lines,ic){
  const n=el("div","map-pt "+kind), box=el("div","map-box"), tie=el("i","map-tie");
  if(ic) box.insertAdjacentHTML("beforeend",ic);
  box.appendChild(el("b",null,name)); lines.filter(Boolean).forEach(t=>box.appendChild(el("small",null,t)));
  tie.hidden=true; n.append(tie,el("i","map-anchor"),box); return n;
}
// Labels never sit on top of each other: after every move or zoom, each takes a place clear of the others and of every
// point's dot, inside the map. A point's label tries places right around its dot, then the nearest clear place anywhere
// in the map, tied back to its dot by a thin line that crosses no other dot or label; it hides only when the map has
// no room left for it. A route's date tries places along its own line, and hides at a zoom with no room for it. Who
// goes first decides the rest, so a few orders are tried (as listed, west to east, east to west, north to south, south
// to north, the most crowded first) and the tidiest layout wins: fewest hidden, no crossings, shortest ties.
function mapDeclutter(){
  if(!tripMap) return;
  const t0=performance.now(), M=$("#tripMap").getBoundingClientRect(), pad=4, L0=M.left+pad, T0=M.top+pad, R0=M.right-pad, B0=M.bottom-pad;
  const L=mapLabels.filter(o=>o.getMap()&&o.node.isConnected).map(o=>{
    const n=o.node.querySelector(".map-box")||o.node, tie=o.node.querySelector(".map-tie");
    n.style.setProperty("--dx","0px"); n.style.setProperty("--dy","0px"); n.style.visibility=""; if(tie) tie.hidden=true;
    return {o,n,tie,anc:o.node.querySelector(".map-anchor"),leg:!!o.path} });
  L.forEach(x=>{ const r=x.n.getBoundingClientRect(); x.r={l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};   // all the reads after all the writes: one layout
    if(x.anc){ const q=x.anc.getBoundingClientRect(); x.dot={l:q.left,t:q.top,r:q.right,b:q.bottom}; x.ax=(q.left+q.right)/2; x.ay=(q.top+q.bottom)/2;
      x.shown=x.ax>=M.left&&x.ax<=M.right&&x.ay>=M.top&&x.ay<=M.bottom } });
  // A place to try: its offset and the box the label would fill there.
  const box=(x,dx,dy)=>{ const l=x.r.l+dx, t=x.r.t+dy, r=x.r.r+dx, b=x.r.b+dy; return {dx,dy,l,t,r,b,in:l>=L0&&r<=R0&&t>=T0&&b<=B0} };
  const near=[[0,0],[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],[0,-2],[0,2],[2,0],[-2,0],[1,-2],[-1,-2],[1,2],[-1,2],[2,-1],[-2,-1],[2,1],[-2,1]];
  L.forEach(x=>{ const w=x.r.w+4, h=x.r.h+4; let ds=near.map(([a,b])=>[a*w*.6,b*h]);
    if(x.shown) ds=ds.map(([dx,dy])=>{ const l=x.r.l+dx, r=x.r.r+dx, t=x.r.t+dy, b=x.r.b+dy; return [dx+(l<L0?L0-l:r>R0?R0-r:0), dy+(t<T0?T0-t:b>B0?B0-b:0)] });   // its point is in view: so is the label
    const pr=x.leg&&x.o.getProjection();
    if(pr){ const px=i=>pr.fromLatLngToDivPixel(new google.maps.LatLng(x.o.path[i].lat,x.o.path[i].lng)), c=px(16); ds=[];
      [16,12,20,9,23,6,26,4,28].forEach(i=>{ const p=px(i); [0,-1,1].forEach(k=>ds.push([p.x-c.x,p.y-c.y+k*h])) }) }
    x.cands=ds.map(([dx,dy])=>box(x,dx,dy)) });
  const st=Math.max(10,Math.round(Math.sqrt(M.width*M.height/2500)));
  const far=x=>x.far||(x.far=(()=>{ const c=[];   // every place in the map, nearest its dot first: worked out once, and only when needed
    for(let y=T0; y+x.r.h<=B0; y+=st) for(let v=L0; v+x.r.w<=R0; v+=st){ const q=box(x,v-x.r.l,y-x.r.t);
      q.k=Math.hypot(Math.max(v-x.ax,0,x.ax-v-x.r.w),Math.max(y-x.ay,0,x.ay-y-x.r.h)); c.push(q) }
    return c.sort((a,b)=>a.k-b.k) })());
  // Does the segment from (x0,y0) toward (x1,y1), short of its far end, pass through box q grown by g? (slab clipping)
  const hits=(x0,y0,x1,y1,q,g)=>{ const dx=x1-x0, dy=y1-y0; let a=0, b=.97;
    if(dx){ const t=(q.l-g-x0)/dx, u=(q.r+g-x0)/dx; a=Math.max(a,Math.min(t,u)); b=Math.min(b,Math.max(t,u)) } else if(x0<q.l-g||x0>q.r+g) return false;
    if(dy){ const t=(q.t-g-y0)/dy, u=(q.b+g-y0)/dy; a=Math.max(a,Math.min(t,u)); b=Math.min(b,Math.max(t,u)) } else if(y0<q.t-g||y0>q.b+g) return false;
    return a<b };
  const end=(x,q)=>{ const nx=q.l>x.ax?q.l:q.r<x.ax?q.r:x.ax, ny=q.t>x.ay?q.t:q.b<x.ay?q.b:x.ay; return [nx,ny,Math.hypot(nx-x.ax,ny-x.ay)] };   // where its tie meets the label
  const dots=L.filter(x=>x.dot).map(x=>x.dot);
  const lay=order=>{ const placed=dots.slice(), ties=[], out=new Map(); let cost=0;
    const free=q=>{ for(let i=0;i<placed.length;i++){ const p=placed[i]; if(q.l<p.r&&q.r>p.l&&q.t<p.b&&q.b>p.t) return false } return true };
    const cuts=q=>{ for(let i=0;i<ties.length;i++){ const s=ties[i]; if(hits(s[0],s[1],s[2],s[3],q,0)) return true } return false };   // across an earlier label's tie
    const crosses=(x,q)=>{ const [nx,ny,len]=end(x,q); if(len<=16) return false;
      for(let i=0;i<placed.length;i++){ const p=placed[i]; if(p!==x.dot&&hits(x.ax,x.ay,nx,ny,p,2)) return true } return false };
    order.forEach(x=>{ const ok=q=>q.in&&free(q), neat=q=>q.in&&free(q)&&!cuts(q)&&!(x.shown&&crosses(x,q));
      let c=x.cands.find(neat);
      if(!c&&x.shown){ const F=far(x); for(let i=0,n=Math.min(F.length,900);i<n&&!c;i++) if(neat(F[i])) c=F[i]; c=c||x.cands.find(ok)||F.find(ok) }
      if(!c&&x.leg) c=x.cands.find(ok);
      if(!c&&!x.leg&&!x.shown) c=x.cands.find(free);   // a point just out of view: its label may hang off the edge
      if(!c){ cost+=x.leg?150:x.shown?5000:0; return }
      if(cuts(c)) cost+=400;
      if(x.shown){ const [nx,ny,len]=end(x,c); if(len>16){ cost+=len+(crosses(x,c)?400:0); ties.push([x.ax,x.ay,nx,ny]) } }
      placed.push(c); out.set(x,c) });
    return {out,cost} };
  const pts=L.filter(x=>!x.leg), legs=L.filter(x=>x.leg), by=f=>pts.slice().sort((a,b)=>f(a)-f(b));
  const crowd=x=>pts.filter(y=>y!==x&&Math.hypot(y.ax-x.ax,y.ay-x.ay)<150).length, seen=new Set();
  let best=null;
  [by(x=>-(+x.o.node.style.zIndex||0)),by(x=>x.ax),by(x=>-x.ax),by(x=>x.ay),by(x=>-x.ay),by(x=>-crowd(x))].forEach(o=>{
    const key=o.map(x=>pts.indexOf(x)).join(); if((best&&best.cost===0)||seen.has(key)) return; seen.add(key);
    const r=lay(o.concat(legs)); if(!best||r.cost<best.cost) best=r });
  L.forEach(x=>{ const c=best.out.get(x);
    if(!c){ x.n.style.visibility="hidden"; return }
    x.n.style.setProperty("--dx",c.dx+"px"); x.n.style.setProperty("--dy",c.dy+"px");
    if(x.tie&&x.shown){ const [nx,ny,len]=end(x,c);
      if(len>16){ x.tie.style.width=len+"px"; x.tie.style.transform="rotate("+Math.atan2(ny-x.ay,nx-x.ax)+"rad)"; x.tie.hidden=false } } });
  try{ performance.clearMeasures("gv-map-layout"); performance.measure("gv-map-layout",{start:t0}) }catch(e){}
}
// The views: the whole trip, then the trip's own (TRIP.map.views: a label, the region whose spots it shows, a center
// and zoom), or else each region fitted to its spots.
const mapViewList=()=>{ const vs=(TRIP.map&&TRIP.map.views)||[];
  return vs.length?vs.map(v=>({v:v.label,label:v.label,r:v.r,center:v.center,zoom:v.zoom})):REGIONS.filter(r=>mapBox[r]).map(r=>({v:r,label:r,r})) };
const MAP_COLORS=["#e2c88e","#5fc3ad","#e58a92","#8ab8e6","#c3a6e8","#f0a868","#a6d86e","#d9d2c4","#f2d16b","#7fd1e0","#e0a2c8","#b8c97a"];
const MAP_STYLE=[{elementType:"geometry",stylers:[{color:"#161615"}]},{elementType:"labels.text.fill",stylers:[{color:"#8d877a"}]},
  {elementType:"labels.text.stroke",stylers:[{color:"#0b0b0b"}]},{featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#3b352a"}]},
  {featureType:"administrative.locality",elementType:"labels.text.fill",stylers:[{color:"#b8ae98"}]},{featureType:"poi",stylers:[{visibility:"off"}]},
  {featureType:"road",elementType:"geometry",stylers:[{color:"#26241f"}]},{featureType:"road.highway",elementType:"geometry",stylers:[{color:"#3a3328"}]},
  {featureType:"road",elementType:"labels.icon",stylers:[{visibility:"off"}]},{featureType:"transit",stylers:[{visibility:"off"}]},
  {featureType:"water",elementType:"geometry",stylers:[{color:"#0c171e"}]},{featureType:"water",elementType:"labels.text.fill",stylers:[{color:"#46606d"}]},
  {featureType:"landscape.natural",elementType:"geometry",stylers:[{color:"#1a1a17"}]}];
// Google's map script, loaded once for the photos and the map alike.
let mapsJsP=null;
const mapsJs=()=>mapsJsP||(mapsJsP=loadMaps(MAPS_KEY).catch(e=>{ mapsJsP=null; throw e }));
// A curved line from a to b ([lat, lng]), bowed to its right, so a leg and its way back never overlap.
function mapArc(a,b,k){
  const x1=a[1], y1=a[0], x2=b[1], y2=b[0], cx=(x1+x2)/2-(y2-y1)*k, cy=(y1+y2)/2+(x2-x1)*k, pts=[];
  for(let i=0;i<=32;i++){ const t=i/32, u=1-t; pts.push({lat:u*u*y1+2*u*t*cy+t*t*y2, lng:u*u*x1+2*u*t*cx+t*t*x2}) }
  return pts;
}
const catColor=k=>{ const i=GROUPS.findIndex(([g])=>g===k); return MAP_COLORS[(i<0?GROUPS.length:i)%MAP_COLORS.length] };
function mapNote(t){ const n=$("#mapNote"); if(n){ n.textContent=t||""; n.hidden=!t } }
async function ensureMap(){
  if(tripMap||mapBusy||!TRIP.map) return;
  if(!MAPS_KEY) return mapNote("The map isn't available right now. Each place's Google Maps button still works.");
  mapBusy=true; mapNote("Loading the map…");
  try{
    const r=await post("/usage",{trip:TRIP_ID,code,kinds:["map"]});
    if(!(r&&r.ok)){ mapBusy=false; if(r&&r.error==="code") return lockOut(CHANGED);
      return mapNote(r&&r.error==="limit"?"This month's map budget is used up. Each place's Google Maps button still works.":"Couldn't load the map. Try again in a moment.") }
    await mapsJs();
    const {Map,OverlayView,Polyline}=await google.maps.importLibrary("maps"), {LatLng,LatLngBounds}=await google.maps.importLibrary("core");
    let at={};
    for(let i=0;i<3;i++){ const g=await api(tripPath+"/map?code="+encodeURIComponent(code)); if(!(g&&g.ok)) break; at=g.points||{}; if(!g.left) break }
    class Pin extends OverlayView{
      constructor(pos,node,z){ super(); this.pos=new LatLng(pos[0],pos[1]); this.node=node; this.node.style.zIndex=z||1; OverlayView.preventMapHitsAndGesturesFrom(node) }
      onAdd(){ this.getPanes().overlayMouseTarget.appendChild(this.node) }
      draw(){ const p=this.getProjection().fromLatLngToDivPixel(this.pos); if(p){ this.node.style.left=p.x+"px"; this.node.style.top=p.y+"px" } }
      onRemove(){ this.node.remove() }
    }
    const M=TRIP.map, P=M.points||{}, box=$("#tripMap"), bounds=new LatLngBounds(), core=new LatLngBounds();   // core: the route and stays
    tripMap=new Map(box,{center:{lat:(M.center||[43,141.2])[0],lng:(M.center||[43,141.2])[1]},zoom:M.zoom||8,styles:MAP_STYLE,backgroundColor:"#0b0b0b",
      disableDefaultUI:true,zoomControl:true,fullscreenControl:true,gestureHandling:"cooperative",clickableIcons:false});
    const put=(pos,node,z,r)=>{ const o=new Pin(pos,node,z); o.setMap(tripMap); bounds.extend({lat:pos[0],lng:pos[1]});
      if(r) (mapBox[r]=mapBox[r]||new LatLngBounds()).extend({lat:pos[0],lng:pos[1]}); return o };
    // The route: each leg a curved gold line, an arrow along it, and its date halfway.
    (M.legs||[]).forEach(L=>{ const a=P[L.from], b=P[L.to]; if(!a||!b) return;
      const path=mapArc([a.lat,a.lng],[b.lat,b.lng],L.bend==null?.16:L.bend);
      const line=new Polyline({map:tripMap,path,strokeColor:"#c9a55a",strokeOpacity:.9,strokeWeight:2.5,clickable:false,
        icons:[{icon:{path:"M -2.6 2.2 L 0 -2.2 L 2.6 2.2",strokeColor:"#f0dcaa",strokeWeight:2,scale:1.4},offset:"58%"}]});
      mapLayers.route.push(line);
      const mid=path[16], lab=el("div","map-leg",L.when+(L.how?" · "+mapDur(L.how):"")), o=put([mid.lat,mid.lng],lab,6); o.path=path; mapLayers.route.push(o); mapLabels.push(o);
      core.extend({lat:a.lat,lng:a.lng}); core.extend({lat:b.lat,lng:b.lng}) });
    // The regions and other named points (the airport, a stay without a Google place), with their dates.
    Object.values(P).forEach(p=>{ const w=p.r&&(TRIP.time||{})[p.r], lines=p.note?String(p.note).split(/\s+·\s+/):(Array.isArray(w)?w.map(mapDays):[]);
      mapLabels.push(put([p.lat,p.lng],mapPt(p.kind||"region",p.name,lines),p.kind==="stay"?9:8,p.r)); core.extend({lat:p.lat,lng:p.lng}) });
    // Where we stay, by Google place.
    (TRIP.lodging||[]).forEach(x=>{ const c=x.placeId&&at[x.placeId]; if(!c) return;
      mapLabels.push(put(c,mapPt("stay",x.name||x.where,[x.when||""],icon("stay")),9,REGIONS.includes(x.where)?x.where:"")); core.extend({lat:c[0],lng:c[1]}) });
    // Every spot, as a dot in its category's color; tap for its card.
    let shown=0;
    ITEMS.forEach(it=>{ const c=it.placeId&&at[it.placeId]; if(!c) return; shown++;
      const k=GROUPS.some(([g])=>g===it.group)?it.group:"", d=el("button","map-dot"); d.type="button"; d.style.background=catColor(k);
      d.dataset.id=it.id; d.setAttribute("aria-label",it.dish+", "+it.place); d.title=it.place;
      mapLayers.dots.push({o:put(c,d,5,it.r),r:it.r,k}); d.onclick=()=>mapCard(it,c,Pin) });
    mapBox.all=core.isEmpty()?bounds:core;   // Whole Trip frames the route and stays; outlying spots are a pan away
    tripMap.addListener("click",()=>{ if(mapPop){ mapPop.setMap(null); mapPop=null } });
    tripMap.addListener("idle",()=>requestAnimationFrame(mapDeclutter));   // after every move or zoom
    mapViews(); mapLegend(); mapShow(true);
    mapNote(shown?"":"Places show once their spots are found on Google.");
  }catch(e){ tripMap=null; mapNote("Couldn't load Google's map. Try again in a moment.") }
  mapBusy=false;
}
// A spot's card on the map: what to get, where, its score, and a way to its card on the ballot.
function mapCard(it,c,Pin){
  if(mapPop){ mapPop.setMap(null); mapPop=null }
  const n=el("div","map-pop"), x=el("button","map-x","✕"); x.type="button"; x.setAttribute("aria-label","Close"); x.onclick=()=>{ mapPop.setMap(null); mapPop=null };
  n.append(x,el("b",null,it.dish),el("p",null,it.place+(it.area?" · "+it.area:"")));
  const tags=el("p","map-tags"); if(it.score&&it.score!=="n/a") tags.append((TRIP.scoreLabel||"Rating")+" "+it.score+" · "); tags.append(secLabel(it.group)); n.appendChild(tags);
  const row=el("div","map-acts"), see=el("button","tx-b","See on the Ballot"); see.type="button";
  see.onclick=()=>{ mapPop.setMap(null); mapPop=null; setPage("eats",true); seeItem(it.id) };
  const g=el("a","tx-b","Google Maps"); g.href=mapsLink(it); g.target="_blank"; g.rel="noopener"; row.append(see,g); n.appendChild(row);
  mapPop=new Pin(c,n,10); mapPop.setMap(tripMap);
}
// What shows: the route unless it's switched off; a spot if its category is on and it's in the view (the whole trip,
// or one region). fit: zoom to the view.
function mapShow(fit){
  if(!tripMap) return;
  mapLayers.route.forEach(o=>o.setMap(mapOff.route?null:tripMap));
  const cur=mapView==="all"?null:mapViewList().find(x=>x.v===mapView);
  mapLayers.dots.forEach(d=>d.o.setMap(!mapOff.cats[d.k]&&(!cur||d.r===cur.r)?tripMap:null));
  document.querySelectorAll("#mapViews button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===mapView)));
  if(fit){ if(cur&&cur.center){ tripMap.setCenter({lat:cur.center[0],lng:cur.center[1]}); tripMap.setZoom(cur.zoom||13) }
    else { const b=cur?mapBox[cur.r]:mapBox.all; if(b&&!b.isEmpty()) tripMap.fitBounds(b,cur?24:48) } }
  requestAnimationFrame(mapDeclutter);
}
// The view buttons: Whole Trip, then the trip's views. The choice is remembered on this device.
function mapViews(){
  const V=$("#mapViews"); if(!V) return; V.textContent="";
  const list=mapViewList(); if(mapView!=="all"&&!list.some(x=>x.v===mapView)) mapView="all";
  [{v:"all",label:"Whole Trip"}].concat(list).forEach(({v,label})=>{
    const b=el("button",null,label); b.type="button"; b.dataset.v=v;
    b.onclick=()=>{ mapView=v; ls("mapview",v); if(mapPop){ mapPop.setMap(null); mapPop=null } mapShow(true) };
    V.appendChild(b) });
}
// The legend: the route and each category (tap to hide or show).
function mapLegend(){
  const L=$("#mapLegend"); if(!L) return; L.textContent="";
  const chip=(label,color,on,set)=>{ const b=el("button","map-chip"); b.type="button"; b.setAttribute("aria-pressed",String(on));
    const dot=el("i"); if(color) dot.style.background=color; else dot.className="route"; b.append(dot,label);
    b.onclick=()=>{ const v=b.getAttribute("aria-pressed")!=="true"; b.setAttribute("aria-pressed",String(v)); set(!v); mapShow(false) };
    L.appendChild(b) };
  if(mapLayers.route.length) chip("Route",null,!mapOff.route,v=>{ mapOff.route=v });
  GROUPS.concat([["",TRIP.otherLabel||"More to Try"]]).forEach(([k,label])=>{ if(mapLayers.dots.some(d=>d.k===k)) chip(label,catColor(k),!mapOff.cats[k],v=>{ mapOff.cats[k]=v }) });
}
// ---------- Squad Goals ----------
// What the trip is for: a primary goal and a few secondary ones, under the intro. Anyone can edit them (for everyone,
// logged in Recent Updates), and our agent reads them when it looks up suggestions, updates Group Tastes and searches.
function renderGoals(){
  const G=$("#goals"); if(!G) return; G.textContent="";
  const g=TRIP.goals||{}, more=g.secondary||[];
  const h=el("div","goals-h"), e=el("button","goals-edit"); h.appendChild(el("span","goals-t","Squad Goals"));
  e.type="button"; e.id="goalsEdit"; e.innerHTML=icon("todo"); e.appendChild(document.createTextNode("Edit")); e.onclick=openGoals; h.appendChild(e); G.appendChild(h);
  if(g.primary){ const p=el("p","goal-1"); p.innerHTML=icon("specialty"); p.appendChild(document.createTextNode(g.primary)); G.appendChild(p) }
  else G.appendChild(el("p","goals-none","No goals yet. Add what this trip is for."));
  if(more.length){ const ul=el("ul","goal-2"); more.forEach(x=>ul.appendChild(el("li",null,x))); G.appendChild(ul) }
}
function openGoals(){
  if(!me) return nudgeWho();
  if(document.querySelector(".sg")) return;
  const g=TRIP.goals||{}, from=document.activeElement, d=el("div","sg");
  d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","glTitle");
  d.innerHTML='<form class="sg-card" novalidate><h2 id="glTitle">Squad Goals</h2>'
    +'<p class="sg-help">What this trip is for. Everyone sees them, and our agent reads them when it looks up suggestions and searches for spots.</p>'
    +'<label class="sg-l" for="glMain">Primary Goal</label><input id="glMain" maxlength="120" autocomplete="off">'
    +'<label class="sg-l" for="glMore">Secondary Goals</label><textarea id="glMore" class="gl" rows="3" maxlength="800" placeholder="One per line, up to 6"></textarea>'
    +'<p class="sg-msg" role="status" aria-live="polite"></p>'
    +'<div class="sg-row"><button type="button" class="sg-cancel">Cancel</button><button type="submit" class="sg-go">Save</button></div></form>';
  document.body.appendChild(d); document.body.classList.add("lb-open");
  const f=d.querySelector("form"), main=d.querySelector("#glMain"), ta=d.querySelector("#glMore"), msg=d.querySelector(".sg-msg"), go=d.querySelector(".sg-go");
  main.value=g.primary||""; ta.value=(g.secondary||[]).join("\n");
  function close(){ d.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown",key,true); if(from&&from.focus) from.focus({preventScroll:true}) }
  function key(e){
    if(e.key==="Escape"){ e.preventDefault(); close() }
    else if(e.key==="Tab"){ const fs=[...d.querySelectorAll("textarea,input,button:not([disabled])")], i=fs.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); fs[fs.length-1].focus() } else if(!e.shiftKey&&i===fs.length-1){ e.preventDefault(); fs[0].focus() } }
  }
  addEventListener("keydown",key,true);
  d.addEventListener("click",e=>{ if(e.target===d) close() });
  d.querySelector(".sg-cancel").onclick=close;
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const primary=main.value.trim(), secondary=ta.value.split("\n").map(s=>s.trim()).filter(Boolean);
    if(!primary){ msg.textContent="Write the primary goal."; main.focus(); return }
    if(secondary.length>6){ msg.textContent="Up to 6 secondary goals, please."; ta.focus(); return }
    go.disabled=true; msg.textContent="Saving…";
    const j=await post(tripPath+"/goals",{code,name:me,primary,secondary});
    go.disabled=false;
    if(j&&j.ok){ TRIP.goals=j.goals; renderGoals(); setSugs(j.suggestions||SUGS); close(); toast("Squad Goals saved for everyone") }
    else if(j&&j.error==="code") lockOut(CHANGED);
    else msg.textContent=j&&j.error==="goals"?"Keep each goal under 120 characters.":"Couldn't save that. Try again in a moment.";
  });
  main.focus();
}
function nudgeWho(){ const w=$("#whoWrap"); w.classList.remove("nudge"); void w.offsetWidth; w.classList.add("nudge"); toast("Pick your name first") }
// The Group Tastes as they stand, for the top of the dialog: what the group loves and avoids (short lists the agent keeps
// up to date) and the spots someone called exactly right, each a button to its card. Before the agent has written the
// lists, the notes themselves. Agent-written text goes in as text, never as HTML.
function tastesNow(close){
  const S=TRIP.tastesSummary||{}, box=el("div","sg-now"), ul=el("ul","tl");
  [["loves","tastes"],["avoids","avoid"]].forEach(([k,ic])=>(S[k]||[]).forEach(t=>{ const li=el("li",k); li.innerHTML=icon(ic); li.appendChild(document.createTextNode(t)); ul.appendChild(li) }));
  if(ul.children.length) box.appendChild(ul);
  else if(TRIP.tastes) box.appendChild(el("p","sg-brief",TRIP.tastes));
  const ex=(S.examples||[]).map(id=>ITEMS.find(i=>i.id===id)).filter(Boolean);
  if(ex.length){ box.appendChild(el("p","sg-l","Spots That Nail It")); const row=el("div","tx");
    ex.forEach(i=>{ const b=el("button","tx-b"); b.type="button"; b.dataset.id=i.id; b.innerHTML=icon("specialty"); b.appendChild(document.createTextNode(i.place+" · "+i.dish));
      b.onclick=()=>{ close(); seeItem(i.id) }; row.appendChild(b) });
    box.appendChild(row) }
  return box.children.length?box:null;
}
// One dialog for both: "spot" takes links or names (one per line, up to 5). "taste" shows the Group Tastes as they stand
// and takes one comment on what the group loves or avoids, which the agent folds in. Anyone can read the tastes; adding
// anything needs a name.
function openSuggest(kind){
  const taste=kind==="taste";
  if(!me&&!taste) return nudgeWho();
  if(document.querySelector(".sg")) return;
  const from=document.activeElement;
  const d=el("div","sg"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","sgTitle");
  d.innerHTML='<form class="sg-card" novalidate tabindex="-1"><h2 id="sgTitle">'+(taste?"Group Tastes":"Make a Suggestion")+'</h2>'
    +(taste?'<p class="sg-help">What does this group love, or avoid? Our agent folds it into these notes, then goes looking for spots that fit and adds them under Group Tastes (it never removes any). On those cards, a thumbs up asks for more like it, and a thumbs down takes one off the list if no one has voted it above Meh.</p>'
      +'<label class="sg-l" for="sgText">Add to Group Tastes</label><textarea id="sgText" rows="3" maxlength="500" placeholder="Spicy is always a plus&#10;Alice doesn&#39;t eat raw fish"></textarea>'
      :'<p class="sg-help">A place to eat, drink or do, somewhere to stay for an open night, or a change to the places or dates: paste a Google Maps, Tabelog or hotel link, or just write it, one per line, up to 5. Our agent looks each one up and adds it where it belongs, for everyone to vote on. A locked part takes no suggestions.</p>'
      +'<label class="sg-l" for="sgText">Suggestions</label><textarea id="sgText" rows="4" maxlength="2600" spellcheck="false" autocapitalize="none" placeholder="https://maps.app.goo.gl/…&#10;A hotel for the open night&#10;Or a name and the location"></textarea>')
    +'<p class="sg-msg" role="status" aria-live="polite"></p>'
    +'<div class="sg-row"><button type="button" class="sg-cancel">'+(taste?"Close":"Cancel")+'</button><button type="submit" class="sg-go">'+(taste?"Add":"Suggest")+'</button></div></form>';
  document.body.appendChild(d); document.body.classList.add("lb-open");
  const f=d.querySelector("form"), ta=d.querySelector("#sgText"), msg=d.querySelector(".sg-msg"), go=d.querySelector(".sg-go");
  function close(){ d.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown",key,true); if(from&&from.focus) from.focus({preventScroll:true}) }
  function key(e){
    if(e.key==="Escape"){ e.preventDefault(); close() }
    else if(e.key==="Tab"){ const fs=[...d.querySelectorAll("textarea,input,button:not([disabled])")], i=fs.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); fs[fs.length-1].focus() } else if(!e.shiftKey&&i===fs.length-1){ e.preventDefault(); fs[0].focus() } }
  }
  addEventListener("keydown",key,true);
  d.addEventListener("click",e=>{ if(e.target===d) close() });
  d.querySelector(".sg-cancel").onclick=close;
  if(TRIP.agentHold&&!isOwner) d.querySelector(".sg-help").append(" Our agent runs on "+ownerName()+"'s Claude plan, so each one waits for "+ownerName()+"'s OK first.");
  if(taste){ const now=tastesNow(close); if(now) f.insertBefore(now,f.querySelector(".sg-help")) }
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!me){ close(); return nudgeWho() }
    const lines=ta.value.split("\n").map(s=>s.trim()).filter(Boolean);
    if(!lines.length){ msg.textContent=taste?"Write what the group loves or avoids.":"Paste a link or type a name."; ta.focus(); return }
    if(!taste&&lines.length>5){ msg.textContent="Up to 5 at a time, please."; ta.focus(); return }
    go.disabled=true; msg.textContent="Sending…";
    const j=await post(tripPath+"/suggestions",Object.assign(taste?{code,name:me,kind:"taste",text:lines.join(" ")}:{code,name:me,text:lines.join("\n")},OWNER?{owner:OWNER}:{}));
    go.disabled=false;
    if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); toast(j.held?"Sent. It runs once "+ownerName()+" OKs it":taste?"Our agent is updating Group Tastes":lines.length>1?"Our agent is looking them up":"Our agent is looking it up"); pace();
      const S=$("#sugs"); if(S){ S.open=true; if(S.getBoundingClientRect().top<0) S.scrollIntoView({behavior:REDUCED?"auto":"smooth"}) } }
    else if(j&&j.error==="code") lockOut(CHANGED);
    else msg.textContent=j&&j.error==="limit"?"That's your limit for today. Try again tomorrow.":j&&j.error==="text"?(taste?"Keep it to a short comment.":"One link or name per line, up to 5."):"Couldn't send that. Try again in a moment.";
  });
  if(taste) f.focus({preventScroll:true}); else ta.focus();   // the tastes open to read: no keyboard popping up over them
}
function saveVote(){
  const who=me; if(!who) return;
  saving++;
  pending=pending.then(()=>post(tripPath+"/ballots",{code,name:who,votes:ballots[who]||{},up:THUMBS[who]||[]})).then(j=>{
    if(j&&j.ok){ ballots=Object.assign({},j.ballots,{[who]:ballots[who]}); THUMBS=Object.assign({},j.thumbs||{},{[who]:THUMBS[who]||[]}); refresh() }
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
let placesLib=null, budgetSpent=false, mapsDown=false, photosDown=false, worked=0, failRun=0, active=0, shownOk=0, badRun=0, photoTries=0;
const queue=[], tried={};
window.gm_authFailure=()=>{ mapsDown=true };
let MAPS_KEY=null, mapsLoading=false;
// Google Maps loads only while photos are on (Settings), and the first time they're on: from the start, or once someone
// turns them back on.
function startPhotos(){
  if(!photosOn()) return;
  if(placesLib) return pumpPhotos();
  if(mapsLoading||!MAPS_KEY) return;
  mapsLoading=true;
  mapsJs().then(()=>google.maps.importLibrary("places")).then(lib=>{ placesLib=lib; pumpPhotos() }).catch(()=>{});
}
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
const byId=id=>ITEMS.find(i=>i.id===id)||OPTS.find(i=>i.id===id);
// The place on Google Maps, with every photo and review: exact when its id is known, else a search. No API call, so the
// link works with photos off or the budget spent.
function mapsLink(it){
  const u="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(it.q||it.place||"");
  return it.placeId?u+"&query_place_id="+encodeURIComponent(it.placeId):u;
}
// The Google Maps button on a card or a stay: the place itself, with every photo and review. A plain link: no API call.
function gmapsBtn(it){
  const g=el("a","lnk gmaps"); g.href=mapsLink(it); g.target="_blank"; g.rel="noopener"; if(it.id) g.dataset.id=it.id;
  g.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  g.appendChild(gm()); g.setAttribute("aria-label",(it.place||it.q||"")+" on Google Maps: every photo and review"); return g;
}
// "Google Maps" as Google's attribution rules want it: exactly that text, never translated.
const gm=()=>{ const t=el("span",null,"Google Maps"); t.setAttribute("translate","no"); return t };
// The note under the title when places can't show photos: only while no photo shows on this page. Once any has (some
// come from the browser's cache even while Google refuses new ones), a place without one just keeps its illustration.
function photoNote(){
  const b=$("#setupBanner"); if(!b) return;
  const at=photosDown&&!budgetSpent?quotaReset():"";
  const why=budgetSpent?"This month's photo budget is used up, so places show illustrations until next month. Each Google Maps button still has every photo."
    :photosDown?"Google isn't sending photos right now. That's usually its daily photo limit"+(at?", which resets at "+at+" your time":"")+". Until then places show illustrations, and each Google Maps button has every photo.":"";
  if(why&&!shownOk){ b.hidden=false; b.textContent=why; b.dataset.photo="1" }
  else if(b.dataset.photo){ b.hidden=true; b.textContent=""; delete b.dataset.photo }
}
// Only the server's own "limit" answer means the budget is spent; a throttle or network error is just a failed try.
async function reserve(kind){
  if(budgetSpent) return false;
  const j=await post("/usage",{trip:TRIP_ID,code,kinds:[kind]});
  if(j&&j.ok) return true;
  if(j&&j.error==="code") lockOut(CHANGED);
  else if(j&&j.error==="off") TRIP.sections=Object.assign({},TRIP.sections,{photos:false});   // switched off since this page loaded
  else if(j&&j.error==="limit"&&!budgetSpent){ budgetSpent=true; photoNote() }
  return false;
}
// The page can't see why Google refused (the browser hides the answer), but it's nearly always the daily photo quota,
// which resets at midnight Pacific: say when that is in the viewer's own time.
function quotaReset(){
  try{
    const now=new Date(), parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hourCycle:"h23",hour:"numeric",minute:"numeric",second:"numeric"}).formatToParts(now);
    const g=t=>+parts.find(x=>x.type===t).value, left=86400-(g("hour")%24*3600+g("minute")*60+g("second"));
    return new Date(now.getTime()+left*1000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  }catch(e){ return "" }
}
function photosOff(){ if(photosDown) return; photosDown=true; photoNote() }
function wantPhoto(id){ if(tried[id]) return; tried[id]=true; queue.push(id); pumpPhotos() }
function pumpPhotos(){
  while(placesLib&&photosOn()&&!mapsDown&&!photosDown&&!budgetSpent&&queue.length&&active<(worked?3:1)){
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
  if(photosDown||budgetSpent||!photosOn()) return Promise.resolve(null);
  if(!ph.wait[p]) ph.wait[p]=reserve("photo").then(ok=>{ ph.wait[p]=null; if(ok&&!photosDown) ph.shots[p]=shot(ph.list[p],PHOTO_PX); return ph.shots[p]||null });
  return ph.wait[p];
}
// Loads photo position p into an <img>. Keeps the default referrer: the photo URL carries the key, which Google only
// honors from corgi-capital.com.
async function fill(ph,p,img,done){
  const s=await ensureShot(ph,p);
  if(!s||!img.isConnected||img.dataset.p===String(p)) return;
  img.dataset.p=p; img.dataset.credit=s.credit; if(s.creditUrl) img.dataset.creditUrl=s.creditUrl;   // the photographer, as metadata only
  img.onload=()=>{ photoTries--; shownOk++; badRun=0; photoNote(); done(s) };
  // Google refused it. Stop asking (each try costs budget) after two refusals with nothing shown and nothing else on its
  // way, or three in a row, which is nearly always its daily photo limit. One bad photo stops nothing.
  img.onerror=()=>{ photoTries--; delete img.dataset.p; badRun++; if((!shownOk&&photoTries<=0&&badRun>=2)||badRun>=3) photosOff() };
  photoTries++; img.src=s.url;
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
// t: the group's points; n: how many voted; lv: the votes' levels added up (the total's color is the average level).
function totals(id){let t=0,n=0,lv=0; TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; if(typeof v==="number"){t+=POINTS[v]||0;lv+=v;n++}}); return {t,n,lv}}
const mineOf=id=>me&&ballots[me]?ballots[me][id]:undefined;
function visibleItems(){
  if(filter==="casual") return ITEMS.filter(i=>i.tier==="casual");
  if(filter==="splurge") return ITEMS.filter(i=>i.tier==="splurge");
  if(filter==="treats") return ITEMS.filter(i=>i.kind==="sweets"||i.kind==="drinks");
  if(filter==="coffee") return ITEMS.filter(i=>i.kind==="coffee"||i.group==="coffee");
  if(filter==="events") return ITEMS.filter(i=>i.kind==="event"||i.group==="event");
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
  if(it.slot) ph.appendChild(el("span","ph-slot","On the Itinerary"+(typeof it.slot==="string"?" · "+titleCase(it.slot):"")));
  c.appendChild(ph);
  const b=el("div","cb");
  b.appendChild(el("h3","dish",it.dish));
  b.appendChild(el("div","place",it.place+(it.area?" · "+it.area:"")));
  const tags=el("div","tags");
  if(it.score){ const sc=el("span","score");
    if(it.score==="n/a") sc.textContent="Not on Tabelog";
    else { sc.textContent=(TRIP.scoreLabel||"Rating")+" "; const num=el("b",null,it.score), g=GRADE[it.id];
      if(g){ num.className="grad"; num.style.setProperty("--t",g.t.toFixed(3)); sc.title="#"+g.rank+" of "+g.n+" rated in "+it.r }
      sc.appendChild(num) }
    tags.appendChild(sc) }
  if(it.badge) tags.appendChild(el("span","badge",it.badge));
  if(TIER[it.tier]) tags.appendChild(pill(it.tier,TIER[it.tier]));
  if(it.izakaya) tags.appendChild(pill("izakaya","Izakaya"));
  if(it.kind==="sweets"||it.kind==="drinks") tags.appendChild(pill(it.kind,it.kind==="sweets"?"Sweets":"Drinks"));
  if(it.kind==="coffee") tags.appendChild(pill("coffee","Coffee"));
  if(it.kind==="event") tags.appendChild(pill("event","Event"));
  // IG: Instagram creators feature it; links to one of their posts (not the place's own account).
  if(/^https:\/\/(www\.)?instagram\.com\/(p|reel)\//.test(it.ig||"")){ const a=el("a","tag ig"); a.innerHTML=icon("ig"); a.appendChild(document.createTextNode("IG"));
    a.href=it.ig; a.target="_blank"; a.rel="noopener"; a.title="Featured by Instagram creators"; a.setAttribute("aria-label","Featured by Instagram creators: open a post"); tags.appendChild(a) }
  if(rank&&it.group==="specialty") tags.appendChild(pill("specialty","Regional Specialty","spec"));
  if(rank&&it.group==="tastes") tags.appendChild(pill("tastes","Group Taste","spec"));
  if(tags.firstChild) b.appendChild(tags);
  if(it.note){ const n=el("p","note",money(it.note)); n.dataset.raw=it.note; b.appendChild(n) }
  if(it.fits){ const f=el("p","fits"); f.innerHTML=icon("tastes"); f.appendChild(document.createTextNode(it.fits)); b.appendChild(f) }   // why it suits this group
  if(it.suggestedBy){ const sb=el("p","sugg-by","Suggested by "+it.suggestedBy); if(it.why) sb.appendChild(el("q",null,it.why)); b.appendChild(sb) }
  // The links, vote and tally sit together at the foot of the card with fixed gaps, so cards in a row line up.
  const act=el("div","act");
  // Tabelog (or the place's own page) first, then Google Maps: whichever the place has.
  const links=el("div","links");
  if(it.url){ let h=""; try{ h=new URL(it.url).hostname }catch(e){}
    const a=el("a","lnk",/(^|\.)tabelog\.com$/.test(h)?"Tabelog":/tablecheck\.com$/.test(h)?"Book on TableCheck":"Website");
    a.href=it.url; a.target="_blank"; a.rel="noopener"; links.appendChild(a) }
  if(it.placeId||it.q) links.appendChild(gmapsBtn(it));
  if(links.firstChild) act.appendChild(links);
  // AI picks in the categories suggestions fill: a thumbs up for a good pick (the agent looks for more like it), a thumbs
  // down to take it off the list. A member's own suggestion gets neither: the votes say what the group thinks of it.
  let th=null;
  if(THUMBS_IN.has(it.group)&&!it.stage&&aiPick(it)){
    th={up:el("button","th up"), down:el("button","th down")}; th.up.type=th.down.type="button";
    th.up.innerHTML=icon("up"); th.up.appendChild(el("span","th-n")); th.down.innerHTML=icon("up"); th.down.appendChild(document.createTextNode("Remove"));
    th.up.onclick=()=>thumbUp(it.id); th.down.onclick=()=>removeSpot(it.id);
    const row=el("div","thumbs"); row.append(el("span","th-l","Good Pick?"),th.up,th.down); act.appendChild(row) }
  const vote=el("div","vote"), L=labels(it); vote.setAttribute("role","group"); vote.setAttribute("aria-label","Your vote: "+it.dish);
  [3,2,1,0].forEach(v=>{const btn=el("button",null,L[v]); btn.type="button"; btn.dataset.v=v; btn.id="v-"+it.id+"-"+v; btn.onclick=()=>cast(it.id,v); vote.appendChild(btn)});
  act.appendChild(vote);
  const tally=el("div","tally"); act.appendChild(tally);
  b.appendChild(act);
  c.appendChild(b);
  cards[it.id]={c,ph,vote,tally,th};
  patch(it.id);
  if(photosOn()){ if(photos[it.id]) buildStrip(it.id); else if(!tried[it.id]){ if(io) io.observe(ph); else wantPhoto(it.id) } }
  return c;
}
// Updates one card's vote buttons and group tally without rebuilding it.
function patch(id){
  const k=cards[id]; if(!k) return;
  const mine=mineOf(id);
  k.vote.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(mine===+b.dataset.v)));
  const tt=totals(id); k.tally.textContent="";
  // Colored by the average vote (all MUSTs = MUST green, all NAHs = NAH red); uncolored until someone votes.
  const tot=el("span","total"+(tt.n?" grad":""),String(tt.t));
  const L=labels(byId(id));
  tot.title="Group points: "+[3,2,1,0].map(v=>L[v]+" "+POINTS[v]).join(", ")+(tt.n?" · average "+(tt.t/tt.n).toFixed(1):"");
  if(tt.n) tot.style.setProperty("--t",(tt.lv/tt.n/3).toFixed(3));
  k.tally.append(tot,el("span","pts",Math.abs(tt.t)===1?"Point":"Points"),el("span","nvoted",tt.n+"/"+TRAVELERS.length+" Voted"));
  const dots=el("span","dots");
  TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; const d=el("span","dot"+(typeof v==="number"?" v"+v:""),p[0]); d.title=p+": "+(typeof v==="number"?L[v]:"not voted yet"); dots.appendChild(d)});
  k.tally.appendChild(dots);
  if(k.th){ const ups=TRAVELERS.filter(p=>(THUMBS[p]||[]).includes(id)), keep=keepers(id);
    k.th.up.setAttribute("aria-pressed",String(!!me&&ups.includes(me))); k.th.up.querySelector(".th-n").textContent=ups.length?String(ups.length):"";
    k.th.up.title=ups.length?"Good pick: "+ups.join(", "):"Good pick: our agent looks for more like it";
    k.th.up.setAttribute("aria-label","Good pick"+(ups.length?" ("+ups.join(", ")+")":""));
    k.th.down.setAttribute("aria-disabled",String(keep.length>0));
    k.th.down.title=keep.length?keepMsg(keep):"Not a fit: take it off the list (anyone can undo)" }
}
function refreshBar(){
  const n=ITEMS.filter(i=>typeof mineOf(i.id)==="number").length;
  const tc=$("#todoCount"); if(tc){ const left=ITEMS.length-n; tc.textContent=left>99?"99+":String(left); tc.hidden=!me||left<1;
    tc.setAttribute("aria-label",left+" not rated yet") }
  // The count and progress are for the page you're on.
  const pool=PAGE==="eats"?ITEMS:OPTS.filter(i=>i.stage===PAGE&&(PAGE!=="lodging"||openStay(i.stay))), m=pool.filter(i=>typeof mineOf(i.id)==="number").length;
  $("#mine").textContent=!me?"Pick your name to vote":pool.length?"You've rated "+m+" of "+pool.length:"Nothing to vote on here";
  $("#progress").style.width=(me&&pool.length?100*m/pool.length:0)+"%";
  const H=$("#hello"); if(H){ H.textContent=""; if(!me) H.appendChild(el("p","callout","Pick your name in the bar above to start voting. Everyone's votes show on each card.")) }
  status(""); renderBoard(); renderTabs(); leaders();
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
// When the group is in a region, from the trip's "time": {"Region": ["2/19 1PM - 2/21 12PM", "2/20 10AM - 5PM", "2/22"]}.
// Each entry is a stay from its start to its end ("2/20 10AM - 5PM" stays on one day; a missing time is 9AM to start
// and 11PM to end, so a bare date is that whole day). A region's days count each day's 9AM-11PM inside its stays, over
// 14 hours, to the nearest tenth; a shorter stay inside one (a day trip from the hotel) counts for its own region.
const HR=36e5, DAY=864e5;
const clock=v=>{ const H=Math.floor(v), M=Math.round((v-H)*60); return (H%12||12)+(M?":"+String(M).padStart(2,"0"):"")+(H>=12?"PM":"AM") };
function stays(r){
  const yr=+TRIP.year||new Date().getFullYear();
  const hour=t=>{ const x=/^(\d{1,2})(?::(\d\d))?\s*([AP])M$/i.exec(t||""); return x?(+x[1])%12+(+(x[2]||0))/60+(/p/i.test(x[3])?12:0):null };
  return ((TRIP.time||{})[r]||[]).map(s=>{
    const m=/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}(?::\d\d)?\s*[AP]M))?(?:\s*-\s*(?:(\d{1,2})\/(\d{1,2}))?\s*(\d{1,2}(?::\d\d)?\s*[AP]M)?)?$/i.exec(String(s).trim());
    if(!m) return null;
    const a=hour(m[3]), b=hour(m[6]);
    return {s:Date.UTC(yr,+m[1]-1,+m[2])+(a==null?9:a)*HR, e:Date.UTC(yr,(m[4]?+m[4]:+m[1])-1,m[5]?+m[5]:+m[2])+(b==null?23:b)*HR};
  }).filter(x=>x&&x.e>x.s);
}
const awake=x=>{ let h=0; for(let d=Math.floor(x.s/DAY)*DAY; d<x.e; d+=DAY) h+=Math.max(0,Math.min(x.e,d+23*HR)-Math.max(x.s,d+9*HR)); return h/HR };
// A region's stays, one per line: weekday, date and time, to the end (its date only when it's another day).
function whenLines(w){
  const p=el("p","when");
  w.stays.forEach(([w1,d1,c1,w2,d2,c2])=>{ const st=el("span","stay");
    st.append(el("span","w",w1)," ",el("span","d",d1)," ",el("span","t",c1),el("span","sep"," – "));
    if(d2) st.append(el("span","w",w2)," ",el("span","d",d2)," "); st.appendChild(el("span","t",c2)); p.appendChild(st) });
  return p;
}
function when(r){
  const xs=stays(r); if(!xs.length) return null;
  let hrs=xs.reduce((t,x)=>t+awake(x),0);
  REGIONS.forEach(o=>{ if(o!==r) stays(o).forEach(y=>{ if(xs.some(x=>x.s<=y.s&&y.e<=x.e&&x.e-x.s>y.e-y.s)) hrs-=awake(y) }) });
  const at=t=>{ const D=new Date(t); return [(D.getUTCMonth()+1)+"/"+D.getUTCDate(), clock(D.getUTCHours()+D.getUTCMinutes()/60), "SunMonTueWedThuFriSat".substr(D.getUTCDay()*3,3)] };
  const parts=xs.map(x=>{ const [d1,c1,w1]=at(x.s), [d2,c2,w2]=at(x.e); return [w1,d1,c1,d2===d1?"":w2,d2===d1?"":d2,c2] });   // [weekday, date, time, then the end; end day only if another day]
  return {days:(Math.max(0,hrs)/14).toFixed(1), stays:parts};
}
// Each Tabelog score's place within its own region, best first: a thinly reviewed area scores lower across the board
// than a big city, so the color compares like with like. t runs 0 (the region's lowest) to 1 (its best); ties share.
let GRADE={};
function grade(){
  GRADE={};
  REGIONS.forEach(r=>{
    const xs=ITEMS.filter(i=>i.r===r&&/^\d\.\d+$/.test(i.score||"")), s=xs.map(i=>+i.score).sort((a,b)=>a-b), n=s.length;
    xs.forEach(i=>{ const v=+i.score, lo=s.indexOf(v), hi=s.lastIndexOf(v);
      GRADE[i.id]={t:n>1?(lo+hi)/2/(n-1):.5, rank:n-hi, n} });
  });
}
function render(){
  const L=$("#list"); if(!L) return;
  grade();
  Object.keys(cards).forEach(id=>{ if(io) io.unobserve(cards[id].ph); delete cards[id] });
  renderStages();
  const lv=hasStages();   // under Trip Dates and Lodging, the regions are a level down
  L.textContent="";

  const xs=visibleItems();
  if(!xs.length) L.appendChild(el("p","empty",filter==="todo"?"You've rated everything. Nice.":"Nothing here yet."));
  else if(sortMode==="region"){
    // Each region: what it's known for, then its regional specialties, then local favorites.
    REGIONS.forEach(g=>{ const its=xs.filter(i=>i.r===g); if(!its.length) return;
      const s=el("section","region"); s.id="region-"+slug(g);
      const w=when(g), h=el(lv?"h3":"h2","sec",g);
      h.appendChild(el("small",null,its.length+(its.length===1?" Spot":" Spots")+(w?" · "+w.days+(w.days==="1.0"?" Day":" Days"):""))); s.appendChild(h);
      if(w) s.appendChild(whenLines(w));
      const known=(TRIP.knownFor||{})[g]; if(known&&known.length) s.appendChild(el("p","known","Known for "+known.join(", ")));
      const parts=GROUPS.map(([k,label])=>[k,label,its.filter(i=>i.group===k)]);
      parts.push(["",TRIP.otherLabel||"More to Try",its.filter(i=>!GROUPS.some(([k])=>k===i.group))]);
      const used=parts.filter(([,,v])=>v.length);
      used.forEach(([k,label,v])=>{ if(used.length>1){ const sh=el(lv?"h4":"h3","sub",label); sh.appendChild(el("small",null,String(v.length))); offTag(sh,k);
          if(k==="tastes"){ const t=el("button","tastes-btn"); t.type="button"; t.innerHTML=icon("comment"); t.title="See or add to Group Tastes"; t.setAttribute("aria-label","See or add to Group Tastes"); t.onclick=()=>openSuggest("taste"); sh.appendChild(t) }
          s.appendChild(sh)
          if(k==="tastes"&&TRIP.tastesLine) s.appendChild(el("p","subnote",TRIP.tastesLine)) }
        const grid=el("div","grid"); v.forEach(i=>grid.appendChild(card(i))); s.appendChild(grid) });
      L.appendChild(s) });
  } else {
    const grid=el("div","grid");
    xs.slice().sort((a,b)=>totals(b.id).t-totals(a.id).t||totals(b.id).n-totals(a.id).n).forEach((i,n)=>grid.appendChild(card(i,n+1)));
    L.appendChild(grid);
  }
  applyPage(); refreshBar();
}
function cast(id,v){
  if(!me) return nudgeWho();
  const cur=Object.assign({},ballots[me]||{});
  if(cur[id]===v) delete cur[id]; else cur[id]=v;
  ballots=Object.assign({},ballots,{[me]:cur}); patch(id); refreshBar(); saveVote();
}
// Group Tastes and Coffee thumbs. Up: a good pick, which the agent's next search uses as a model. Down: takes the spot off the list,
// but only while no one has voted it above MEH (yourself included) and no one else has given it a thumbs up. Anyone can
// undo it, from the toast or the Updates panel. The server checks the same rule.
function keepers(id){ return TRAVELERS.filter(p=>(ballots[p]&&ballots[p][id]>=2)||(p!==me&&(THUMBS[p]||[]).includes(id))) }
function keepMsg(ns){ const w=ns.map(n=>n===me?"You":n), s=w.length<2?w.join(""):w.slice(0,-1).join(", ")+" and "+w[w.length-1];
  return s+(w.length===1&&w[0]!=="You"?" wants":" want")+" it, so it stays" }
function thumbUp(id){
  if(!me) return nudgeWho();
  const cur=new Set(THUMBS[me]||[]), on=!cur.has(id); if(on) cur.add(id); else cur.delete(id);
  THUMBS=Object.assign({},THUMBS,{[me]:[...cur]}); patch(id); saveVote();
  if(on) toast("Good pick: our agent will look for more like it");
}
async function removeSpot(id){
  if(!me) return nudgeWho();
  const it=byId(id), k=cards[id]; if(!it) return;
  const keep=keepers(id); if(keep.length) return toast(keepMsg(keep));
  if(k&&k.th) k.th.down.disabled=true;
  const j=await post(tripPath+"/remove",{code,name:me,item:id});
  if(k&&k.th) k.th.down.disabled=false;
  if(j&&j.ok){ setSugs(j.suggestions||SUGS); await reloadTrip(); toast("Removed "+it.place,{label:"Undo",fn:()=>undoRemove(id)}) }
  else if(j&&j.error==="code") lockOut(CHANGED);
  else if(j&&j.error==="wanted"){ toast(keepMsg(j.by||[])); loadVotes() }
  else toast("Couldn't remove that. Try again in a moment.");
}
async function undoRemove(id){
  if(!me) return nudgeWho();
  const j=await post(tripPath+"/remove",{code,name:me,item:id,undo:true});
  if(j&&j.ok){ setSugs(j.suggestions||SUGS); await reloadTrip(); seeItem(id) }
  else if(j&&j.error==="code") lockOut(CHANGED);
  else toast("Couldn't put it back. Try again in a moment.");
}

// ---------- Trip Dates and Lodging ----------
// Before the places, in the order a trip gets planned: when, then where to stay. Each is either settled (the trip's
// "dates.decided"; a stay's "status": "booked") or a vote on its options (items with "stage": "dates", or "lodging" and
// the open stay's id in "stay"), on the same cards and votes as the places. A trip with neither looks as it always did.
const hasStages=()=>!!(TRIP.locations||TRIP.dates||(TRIP.lodging||[]).length||OPTS.length);
// A part of the plan that's settled: Trip Locations or Trip Dates decided, or every night booked.
// Locked in Settings (anyone, for everyone), or else settled by the trip itself. A locked part takes no suggestions.
const settled=k=>TRIP.locks&&k in TRIP.locks?!!TRIP.locks[k]:k==="locations"?!!(TRIP.locations&&TRIP.locations.decided):k==="dates"?!!(TRIP.dates&&TRIP.dates.decided)
  :k==="lodging"?(TRIP.lodging||[]).length>0&&(TRIP.lodging||[]).every(x=>x.status==="booked"):false;
// A person's flights in short: each journey (legs that connect) as its date and departure time, like "2/18 12:55 AM",
// and its airports (JFK, HND, CTS). Legs without airport codes fall back to the flight numbers.
const MONTHS="JanFebMarAprMayJunJulAugSepOctNovDec";
function flightLine(legs){
  if(!legs.every(l=>l.from&&l.to)) return [{when:"",ports:legs.map(l=>l.flight)}];
  const out=[]; let cur=null;
  // A leg continues the journey when it leaves from where the last one landed, within a day; else a new one starts
  // (the way home leaves from where the way out landed, days later).
  const day=l=>{ const d=/([A-Z][a-z]{2})\s+(\d{1,2})/.exec(l.date||""); return d&&MONTHS.indexOf(d[1])>=0?Date.UTC(+TRIP.year||2000,MONTHS.indexOf(d[1])/3,+d[2])/864e5:null };
  legs.forEach(l=>{ const dd=day(l);
    if(cur&&cur.to===l.from&&dd!=null&&cur.day!=null&&dd-cur.day<=1){ cur.ports.push(l.to); cur.to=l.to; cur.day=dd }
    else { cur={first:l,ports:[l.from,l.to],to:l.to,day:dd}; out.push(cur) } });
  return out.map(j=>{ const d=/([A-Z][a-z]{2})\s+(\d{1,2})/.exec(j.first.date||""), t=/(\d{1,2}:\d\d)\s*([AP])M/i.exec(j.first.times||"");
    const md=d&&MONTHS.indexOf(d[1])>=0?(MONTHS.indexOf(d[1])/3+1)+"/"+d[2]:(j.first.date||"");
    return {when:[md,t?t[1]+" "+t[2].toUpperCase()+"M":""].filter(Boolean).join(" "), ports:j.ports} });
}
// "Suggestions Only" on a section's heading while its AI picks are off; not on a settled part, which takes none.
function offTag(h,k){ if(k&&!secOn(k)&&!settled(k)){ const t=el("span","off-tag","Suggestions Only"); t.title="AI picks are off here: only the group's suggestions show"; h.appendChild(t) } return h }
const openStay=id=>(TRIP.lodging||[]).some(x=>x.id===id&&x.status!=="booked");
const unrated=st=>me?OPTS.filter(i=>i.stage===st&&(st!=="lodging"||openStay(i.stay))&&typeof mineOf(i.id)!=="number").length:0;
const spotsN=()=>ITEMS.length+(ITEMS.length===1?" Spot":" Spots");
// ---------- Pages ----------
// Trip Locations, Trip Dates, Lodging and the places are each their own page, picked from the tabs in the bar (each
// with a red count of what you haven't voted on there). The address bar carries it (#lodging), so a link opens that
// page, and each device remembers the last one. A trip with only places has no tabs.
const PAGES=[["map","Map","map"],["plan","Locations & Dates","dates"],["lodging","Lodging","stay"],["eats","","mid"]];
// Each page's parts of the plan, and the page a part (or an old link to it) opens.
const PAGE_PARTS={plan:["locations","dates"],lodging:["lodging"]}, pageOf=k=>k==="locations"||k==="dates"?"plan":k;
const pageUnrated=k=>(PAGE_PARTS[k]||[]).reduce((n,s)=>n+unrated(s),0);
let PAGE="eats";
const pageOk=p=>p==="eats"||(p==="map"&&!!(TRIP.map&&TRIP.map.points))||(p==="plan"&&!!(TRIP.locations||TRIP.dates||OPTS.some(i=>i.stage==="dates"||i.stage==="locations")))||(p==="lodging"&&!!(TRIP.lodging||[]).length);
function startPage(){
  const h=pageOf((location.hash||"").slice(1)); if(PAGES.some(([k])=>k===h)&&pageOk(h)) return h;
  const s=pageOf(ls("page")||""); if(s&&pageOk(s)) return s;
  const open=PAGES.find(([k])=>k!=="eats"&&k!=="map"&&pageOk(k)&&pageUnrated(k)>0);   // a vote still waiting on you comes first
  return open?open[0]:"eats";
}
function setPage(k,quiet){
  k=pageOf(k); PAGE=pageOk(k)?k:"eats"; ls("page",PAGE);
  try{ history.replaceState(null,"",location.pathname+location.search+"#"+PAGE) }catch(e){}
  applyPage(); refreshBar();
  if(!quiet){ const t=$(PAGE==="eats"?"#eats":PAGE==="plan"?"#stage-locations":"#stage-"+PAGE), b=$("#bar");   // from the page's top, if you'd scrolled past it
    if(t){ const y=t.getBoundingClientRect().top+scrollY-(b?b.offsetHeight:0)-8; if(scrollY>y) window.scrollTo({top:Math.max(0,y)}) } }
}
function applyPage(){
  const eats=PAGE==="eats", map=PAGE==="map";
  ["locations","dates","lodging"].forEach(k=>{ const s=document.getElementById("stage-"+k); if(s) s.hidden=pageOf(k)!==PAGE });
  const mp=$("#stage-map"); if(mp) mp.hidden=!map; if(map) ensureMap();   // the map loads the first time its page opens
  $("#stages").hidden=eats||map||!hasStages(); $("#eats").hidden=$("#list").hidden=!eats;
  $("#eatsTools").hidden=!eats; if(!eats) showFilters(false);   // Suggestion stays on every page: it goes where it belongs
  document.querySelectorAll("#tabs .tab").forEach(t=>t.setAttribute("aria-current",t.dataset.p===PAGE?"page":"false"));
}
function renderTabs(){
  const T=$("#tabs"); if(!T) return; T.textContent="";
  T.hidden=PAGES.filter(([k])=>pageOk(k)).length<2; if(T.hidden) return;
  const D=TRIP.dates, dn=OPTS.filter(i=>i.stage==="dates").length, L=TRIP.lodging||[], open=L.filter(x=>x.status!=="booked").length,
    ln=OPTS.filter(i=>i.stage==="lodging").length;
  const note={locations:TRIP.locations&&TRIP.locations.decided?"Decided":"Vote", dates:D&&D.decided?"Decided":dn+(dn===1?" Option":" Options"),
    lodging:open?open+" to Decide":"All Booked", eats:spotsN()};
  // Trip Locations, Trip Dates and Lodging: a gold lock once settled, else a red count of the options on the ballot (or,
  // before any are listed, of the nights left to pick). Eats & Events: a red count of the spots you haven't rated.
  const lo=OPTS.filter(i=>i.stage==="locations").length;
  const locked={plan:settled("locations")&&settled("dates"), lodging:settled("lodging")};
  const left={plan:(settled("locations")?0:lo)+(settled("dates")?0:dn), lodging:ln||open, eats:me?ITEMS.filter(i=>typeof mineOf(i.id)!=="number").length:0};
  const what={plan:n=>n+(n===1?" suggested change":" suggested changes"), lodging:n=>ln?n+(n===1?" lodging option":" lodging options"):n+(n===1?" night":" nights")+" left to pick",
    eats:n=>n+" for you to rate"};
  PAGES.forEach(([k,label,ic])=>{ if(!pageOk(k)) return;
    const b=el("button","tab"); b.type="button"; b.dataset.p=k; b.setAttribute("aria-current",k===PAGE?"page":"false"); b.innerHTML=icon(ic);
    const t=el("b"); t.textContent=k==="eats"?TRIP.spotsTitle||"Eats & Events":label;
    b.appendChild(t); if(k==="eats") b.appendChild(el("small",null,note[k]));   // the plan's tabs: the badge says it
    if(locked[k]){ const c=el("span","tlock"); c.innerHTML=icon("lock"); c.setAttribute("role","img"); c.setAttribute("aria-label",k==="lodging"?"All booked":"Decided");
      c.title=k==="lodging"?"All booked":"Decided"; b.appendChild(c) }
    else if(left[k]){ const c=el("span","cnt",left[k]>99?"99+":String(left[k])); c.title=(what[k]||(n=>n+" options"))(left[k]); b.appendChild(c) }
    b.onclick=()=>setPage(k); T.appendChild(b) });
}
function renderStages(){
  const S=$("#stages"), H=$("#eatsH"); if(!S) return;
  S.textContent=""; S.hidden=!hasStages();
  if(H){ H.hidden=S.hidden; H.textContent=TRIP.spotsTitle||"Eats & Events"; H.appendChild(el("small",null,spotsN())) }
  if(S.hidden) return;

  const LO=TRIP.locations;
  if(LO){   // where the trip goes: each region with its stays and what it's known for
    const s=el("section","stage"); s.id="stage-locations";
    const h=el("h2","stage-h","Trip Locations"); h.appendChild(el("small",null,LO.decided?"Decided":"Vote")); offTag(h,"locations"); s.appendChild(h);
    if(LO.decided) s.appendChild(el("p","decided",LO.decided));
    if(LO.note) s.appendChild(el("p","stage-note",LO.note));
    const ul=el("ul","lodges");
    REGIONS.forEach(r=>{ const li=el("li","lodge place"), b=el("div","lodge-b"), w=when(r), top=el("p","lodge-top");
      top.appendChild(el("b",null,r)); if(w) top.appendChild(el("span","lodge-n"," · "+w.days+(w.days==="1.0"?" Day":" Days")));
      b.appendChild(top); if(w) b.appendChild(whenLines(w));
      const known=(TRIP.knownFor||{})[r]; if(known&&known.length) b.appendChild(el("p","note","Known for "+known.join(", ")));
      li.appendChild(b); ul.appendChild(li) });
    s.appendChild(ul);
    const lo=OPTS.filter(i=>i.stage==="locations"); if(lo.length){
      if(LO.decided){ const sh=el("h3","sub","Suggested Places"); sh.appendChild(el("small",null,String(lo.length))); s.appendChild(sh) }
      const g=el("div","grid"); lo.forEach(i=>g.appendChild(card(i))); s.appendChild(g) }
    S.appendChild(s) }
  const D=TRIP.dates, dOpts=OPTS.filter(i=>i.stage==="dates");
  if(D||dOpts.length){
    const s=el("section","stage"); s.id="stage-dates";
    const h=el("h2","stage-h","Trip Dates"); h.appendChild(el("small",null,D&&D.decided?"Decided":"Vote")); offTag(h,"dates"); s.appendChild(h);
    if(D&&D.decided) s.appendChild(el("p","decided",D.decided));
    if(D&&D.note) s.appendChild(el("p","stage-note",D.note));
    if(D&&D.decided&&Array.isArray(D.rows)&&D.rows.length){
      const w=el("div","dates-w"), t=el("table","dates-t");
      if(Array.isArray(D.head)&&D.head.length){ const tr=el("tr"); D.head.forEach(x=>tr.appendChild(el("th",null,x))); t.appendChild(el("thead")).appendChild(tr) }
      const tb=t.appendChild(el("tbody"));
      D.rows.forEach(r=>{ const tr=el("tr",r[0]===me?"me":null); r.forEach((x,n)=>tr.appendChild(el(n?"td":"th",null,x))); tb.appendChild(tr) });
      w.appendChild(t); s.appendChild(w);
      // Each person's flights, collapsed: their flight numbers on the line, every leg inside (dates.flights).
      const F=D.flights||{}, who=D.rows.map(r=>r[0]).filter(n=>Array.isArray(F[n])&&F[n].length);
      if(who.length){ const fl=el("div","flights"); fl.appendChild(el("p","sg-l","Flights"));
        who.forEach(n=>{ const d=el("details","fp"+(n===me?" me":"")), sm=el("summary"), ol=el("ol","fp-l"); d.dataset.who=n;
          sm.appendChild(el("b",null,n)); const js=el("span","fp-js");
          flightLine(F[n]).forEach(j=>{ const c=el("span","fp-j"); if(j.when) c.appendChild(el("span","fp-when",j.when));
            j.ports.forEach((p,i)=>{ if(i) c.appendChild(el("i","fp-dot","·")); c.appendChild(el("span","fp-port",p)) });
            c.setAttribute("aria-label",(j.when?j.when+", ":"")+j.ports.join(j.when?" to ":", ")); js.appendChild(c) });
          sm.appendChild(js);
          F[n].forEach(l=>{ const li=el("li"), top=el("div","fp-top"); top.append(el("b",null,l.flight),el("span",null,l.date)); li.appendChild(top);
            li.append(el("div","fp-rt",l.route),el("div","fp-tm",l.times)); if(l.note) li.appendChild(el("div","fp-note",l.note)); ol.appendChild(li) });
          d.append(sm,ol); fl.appendChild(d) });
        s.appendChild(fl) } }
    if(dOpts.length){   // date options to vote on, or, once the dates are decided, suggested changes
      if(D&&D.decided){ const sh=el("h3","sub","Suggested Changes"); sh.appendChild(el("small",null,String(dOpts.length))); s.appendChild(sh) }
      const g=el("div","grid"); dOpts.forEach(i=>g.appendChild(card(i))); s.appendChild(g) }
    S.appendChild(s) }
  const L=TRIP.lodging||[];
  if(L.length){
    const s=el("section","stage"); s.id="stage-lodging";
    const booked=L.filter(x=>x.status==="booked").length, open=L.length-booked;
    const h=el("h2","stage-h","Lodging"); h.appendChild(el("small",null,[booked?booked+" Booked":"",open?open+" to Decide":""].filter(Boolean).join(" · "))); offTag(h,"lodging"); s.appendChild(h);
    const ul=el("ul","lodges");
    L.forEach(x=>{ const li=el("li","lodge"+(x.status==="booked"?" booked":" open")), b=el("div","lodge-b"), top=el("p","lodge-top");
      li.appendChild(el("span","lodge-st",x.status==="booked"?"Booked":"To Decide"));
      top.append(el("b",null,x.where||"")," ",el("span","lodge-when",x.when||""));
      if(x.nights) top.appendChild(el("span","lodge-n"," · "+x.nights+(x.nights===1?" Night":" Nights")));
      b.appendChild(top);
      if(x.name){ const n=el("p","lodge-name");
        // The name is the link: the stay's own page (an AirBnB listing, say), else its place on Google Maps.
        const href=/^https:\/\//.test(x.url||"")?x.url:(x.placeId||x.q)?mapsLink({placeId:x.placeId,q:x.q||x.name}):"";
        if(href){ const a=el("a",null,x.name); a.href=href; a.target="_blank"; a.rel="noopener"; n.appendChild(a) } else n.textContent=x.name;
        if(x.area) n.append(" · "+x.area); b.appendChild(n) }
      if(x.note){ const p=el("p","note",money(x.note)); p.dataset.raw=x.note; b.appendChild(p) }
      li.appendChild(b); ul.appendChild(li) });
    s.appendChild(ul);
    L.filter(x=>x.status!=="booked").forEach(x=>{ const os=OPTS.filter(i=>i.stage==="lodging"&&i.stay===x.id); if(!os.length) return;
      const sh=el("h3","sub",[x.where,x.when].filter(Boolean).join(" · ")); sh.appendChild(el("small",null,os.length+(os.length===1?" Option":" Options"))); s.appendChild(sh);
      const lead=el("p","subnote lead"); lead.dataset.stay=x.id; s.appendChild(lead);
      const g=el("div","grid"); os.forEach(i=>g.appendChild(card(i))); s.appendChild(g) });
    S.appendChild(s) }
  leaders();
}
// Under each open stay, which option leads on the group's points once anyone has voted.
function leaders(){
  document.querySelectorAll(".lead[data-stay]").forEach(p=>{
    const os=OPTS.filter(i=>i.stay===p.dataset.stay).map(i=>Object.assign({it:i},totals(i.id))).filter(o=>o.n).sort((a,b)=>b.t-a.t||b.n-a.n);
    if(!os.length){ p.textContent="Vote on where we stay: the most points wins."; return }
    const top=os.filter(o=>o.t===os[0].t);
    p.textContent=(top.length>1?"Tied at the top: "+top.map(o=>o.it.dish).join(" and "):"Leading: "+os[0].it.dish)+" · "+os[0].t+(Math.abs(os[0].t)===1?" Point":" Points");
  });
}
function syncTools(){
  document.querySelectorAll("#sort button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.s===sortMode)));
  document.querySelectorAll("#filters button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.f===filter)));
  const fc=$("#fcur"); if(fc) fc.textContent=filter==="all"?"":(FILTERS.find(([f])=>f===filter)||["",""])[1];   // the filter in use, on the button
  $("#filterBtn").classList.toggle("on",filter!=="all");
  $("#jump").hidden=sortMode!=="region";
}
// The filters fold away behind their button in the bar; picking one folds them again.
function showFilters(open){ $("#filters").hidden=!open; $("#filterBtn").setAttribute("aria-expanded",String(open)) }
function mountBallot(){
  const v=el("div","gv-ballot");
  v.innerHTML='<header class="hd"><div class="hd-top"><a class="mark" href="/">Corgi Capital</a>'
    +'<button type="button" class="lock" id="lock" title="Forget the password on this device">Lock</button></div>'
    +'<h1 id="title"></h1><p id="intro"></p><section class="goals" id="goals" aria-label="Squad Goals"></section>'
    +'<details class="sugs" id="sugs" hidden><summary></summary><ul class="sugs-l" aria-live="polite"></ul></details><div class="banner" id="setupBanner" hidden></div></header>'
    +'<div class="bar" id="bar"><div class="bar-in"><div class="who" id="whoWrap"><span class="label">I am</span><div class="chips" id="who"></div></div>'
    +'<div class="counts"><span id="mine"></span><span class="status" id="status"></span></div>'
    +'<button type="button" class="sugg-btn" id="suggestBtn">'+icon("plus")+'Suggestion</button>'
    +'<button type="button" class="gear" id="gear" aria-label="Settings" title="Settings: sections, colors, prices, scoring">'+icon("gear")+'</button>'
    +'<i class="br" aria-hidden="true"></i><nav class="tabs" id="tabs" aria-label="Pages"></nav>'
    +'<div class="eats-tools" id="eatsTools"><div class="seg" id="sort" role="group" aria-label="Sort"><button type="button" data-s="region">Region</button><button type="button" data-s="rank">Ranking</button></div>'
    +'<button type="button" class="fbtn" id="filterBtn" aria-expanded="false" aria-controls="filters" title="Filters">'+icon("funnel")+'<span class="fl">Filters</span><span class="fcur" id="fcur"></span></button></div>'
    +'<div class="filters" id="filters" role="group" aria-label="Show" hidden></div></div>'
    +'<div class="progress" aria-hidden="true"><i id="progress"></i></div></div>'
    +'<section class="stage map-page" id="stage-map" hidden><h2 class="stage-h">Trip Map</h2><div class="seg map-views" id="mapViews" role="group" aria-label="Map view"></div><div class="map-legend" id="mapLegend"></div>'
    +'<div class="trip-map" id="tripMap" role="region" aria-label="Trip map"></div><p class="map-note" id="mapNote" hidden></p></section>'
    +'<div class="hello" id="hello"></div><div class="stages" id="stages" hidden></div>'
    +'<section class="eats" id="eats"><h2 class="stage-h" id="eatsH" hidden></h2><nav class="jump" id="jump" aria-label="Jump to"></nav><section class="board" id="board" aria-label="Scoreboard"></section></section>'
    +'<main class="list" id="list"></main>'
    +'<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(v);
  document.title=TRIP.title||"Trip vote"; $("#title").textContent=TRIP.title||""; $("#intro").textContent=TRIP.intro||""; $("#intro").hidden=!TRIP.intro;
  const U=$("#sugs"); if(ls("updates")==="1") U.open=true;   // the Updates panel stays open or closed on this device
  U.addEventListener("toggle",()=>ls("updates",U.open?"1":null));
  const jump=$("#jump");
  REGIONS.forEach(g=>{ const n=ITEMS.filter(i=>i.r===g).length; if(!n) return;
    const a=el("a",null,g); a.href="#region-"+slug(g); a.appendChild(el("small",null,String(n)));
    a.onclick=e=>{ e.preventDefault(); if(filter!=="all"){ filter="all"; syncTools(); render() }
      const s=document.getElementById("region-"+slug(g)); if(s) s.scrollIntoView({behavior:REDUCED?"auto":"smooth"}) };
    jump.appendChild(a) });
  const F=$("#filters"), has={slotted:ITEMS.some(i=>i.slot), casual:ITEMS.some(i=>i.tier==="casual"), splurge:ITEMS.some(i=>i.tier==="splurge"), treats:ITEMS.some(i=>i.kind==="sweets"||i.kind==="drinks"), coffee:ITEMS.some(i=>i.kind==="coffee"||i.group==="coffee")};
  FILTERS.forEach(([f,label])=>{ if(f in has&&!has[f]) return; const b=el("button","chip"); b.innerHTML=icon(FILTER_ICON[f]); b.appendChild(document.createTextNode(label)); b.type="button"; b.dataset.f=f;
    if(f==="todo"){ const c=el("span","cnt"); c.id="todoCount"; c.hidden=true; b.appendChild(c) }   // how many you haven't rated
    F.appendChild(b) });
  F.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; filter=b.dataset.f; showFilters(false); syncTools(); render(); toEats() });
  $("#filterBtn").addEventListener("click",()=>showFilters($("#filters").hidden));
  addEventListener("hashchange",()=>{ const h=pageOf(location.hash.slice(1)); if(h!==PAGE&&PAGES.some(([k])=>k===h)&&pageOk(h)) setPage(h,true) });
  $("#sort").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; sortMode=b.dataset.s; ls("sort",sortMode); syncTools(); render(); toEats() });
  $("#gear").addEventListener("click",openSettings);
  // Anchored sections stop just under the bar, whatever height it wraps to.
  const bar=$("#bar"), barH=()=>document.documentElement.style.setProperty("--bar-h",bar.offsetHeight+"px");
  barH(); if("ResizeObserver" in window) new ResizeObserver(barH).observe(bar);
  $("#lock").addEventListener("click",()=>{ ls("code",null); ls("me",null); location.reload() });
  $("#suggestBtn").addEventListener("click",()=>openSuggest("spot"));
  let cb=false; try{ cb=localStorage.getItem("gv-cb")==="1" }catch(e){}
  setCb(cb);
  syncTools();
}
// After a sort or filter change: the places from the top, just under the bar.
function toEats(){ const e=$("#eats"), b=$("#bar"); if(!e) return;
  const y=Math.max(0,e.getBoundingClientRect().top+scrollY-(b?b.offsetHeight:0)-8); if(Math.abs(scrollY-y)>4) window.scrollTo({top:y,behavior:REDUCED?"auto":"smooth"}) }
// Settings (the gear in the bar): the sections, then this device's colors and prices, then how scoring works. Flipping a
// section changes everyone's ballot, so it asks first.
function openSettings(){
  if(document.querySelector(".sg")) return;
  const from=document.activeElement, d=el("div","sg"), c=el("div","sg-card set");
  d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","setTitle"); c.tabIndex=-1; d.appendChild(c);
  const h=el("h2",null,"Settings"); h.id="setTitle"; c.appendChild(h);
  c.appendChild(el("p","sg-l","Sections"));
  c.appendChild(el("p","sg-help","AI On: AI picks plus everyone's suggestions. AI Off: suggestions only, so AI picks are hidden there and our agent stops adding to it (suggestions still get looked up). This changes the page for everyone."));
  const list=el("ul","set-l"), picks=k=>ALL.filter(i=>(i.stage||i.group||"")===k&&aiPick(i)).length;
  SECT.forEach(([k,label])=>{ const li=el("li","set-row"), on=secOn(k), n=picks(k), t=el("div","set-txt");
    t.append(el("b",null,label),el("small",null,n?n+(n===1?" AI Pick":" AI Picks"):"No AI Picks"));
    const sw=el("button","switch"); sw.type="button"; sw.dataset.k=k; sw.setAttribute("role","switch"); sw.setAttribute("aria-checked",String(on));
    sw.classList.add("ai"); sw.setAttribute("aria-label",label+": AI picks "+(on?"on":"off")); sw.appendChild(el("span","switch-t",on?"AI On":"AI Off"));
    sw.onclick=()=>ask(li,k,label,!on,n);
    const ctl=el("div","set-ctl"); ctl.appendChild(sw);
    if(STAGE_SECT.some(([x])=>x===k)){   // the plan's parts: a lock, for everyone (no more suggestions)
      const L=settled(k), lk=el("button","lockbtn"); lk.type="button"; lk.dataset.k=k; lk.setAttribute("aria-pressed",String(L)); lk.innerHTML=icon(L?"lock":"unlock");
      lk.setAttribute("aria-label",label+(L?": locked. Unlock it":": unlocked. Lock it")); lk.title=L?"Locked: it takes no suggestions":"Lock it: no more suggestions";
      lk.onclick=async()=>{ if(!me){ close(); return nudgeWho() } lk.disabled=true;
        const j=await post(tripPath+"/sections",{code,name:me,section:k,lock:!L});
        if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); await reloadTrip(); toast(label+(L?" unlocked":" locked")) }
        else if(j&&j.error==="code") lockOut(CHANGED);
        else { lk.disabled=false; toast("Couldn't change that. Try again in a moment.") } };
      ctl.appendChild(lk) }
    li.append(t,ctl); list.appendChild(li) });
  c.appendChild(list);
  const cw=el("div","set-disp cat-edit"), cb=el("button","tx-b"); cb.type="button"; cb.id="setCats"; cb.innerHTML=icon("todo");
  cb.appendChild(document.createTextNode("Edit Categories")); cb.onclick=()=>{ close(); openCategories() }; cw.appendChild(cb); c.appendChild(cw);
  // Photos, for everyone: off, the pages make no Google calls (places show illustrations; each Google Maps button still
  // has every photo), which saves the month's photo budget. One tap, logged in Recent Updates.
  c.appendChild(el("p","sg-l","Photos"));
  const pl=el("ul","set-l"), pli=el("li","set-row"), ptx=el("div","set-txt"), pon=photosOn(), psw=el("button","switch"), puse=el("small",null,"");
  ptx.append(el("b",null,"Google Photos"),puse);
  psw.type="button"; psw.id="photoSwitch"; psw.setAttribute("role","switch"); psw.setAttribute("aria-checked",String(pon));
  psw.setAttribute("aria-label","Google photos: "+(pon?"on":"off")+" for everyone"); psw.appendChild(el("span","switch-t",pon?"On":"Off"));
  psw.onclick=async()=>{ if(!me){ close(); return nudgeWho() } psw.disabled=true;
    const j=await post(tripPath+"/sections",{code,name:me,section:"photos",on:!pon});
    if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); await reloadTrip(); toast(pon?"Photos are off for everyone":"Photos are on for everyone") }
    else if(j&&j.error==="code") lockOut(CHANGED);
    else { psw.disabled=false; toast("Couldn't change that. Try again in a moment.") } };
  pli.append(ptx,psw); pl.appendChild(pli); c.appendChild(pl);
  c.appendChild(el("p","sg-help","Off saves the month's Google photo budget: places show illustrations, and each Google Maps button still has every photo."));
  api("/usage").then(u=>{ if(u&&u.ok&&u.used&&u.limits) puse.textContent=u.used.photo+" of "+u.limits.photo+" Used This Month" }).catch(()=>{});
  function ask(li,k,label,on,n){
    if(!me){ close(); return nudgeWho() }
    list.querySelectorAll(".set-ask").forEach(x=>x.remove());
    const a=el("li","set-ask"), p=el("p",null,on?"Turn AI picks back on in "+label+"?"+(n?" "+n+(n===1?" spot returns":" spots return")+" to everyone's ballot, votes and all.":"")
      :"Turn off AI picks in "+label+"?"+(n?" This hides "+n+(n===1?" spot":" spots")+" from everyone's ballot; their votes are kept and come back if it's turned on again.":"")+" Only suggestions will show there.");
    const no=el("button","sg-cancel","Cancel"), yes=el("button","sg-go",on?"Turn On":"Turn Off"), row=el("div","sg-row"); no.type=yes.type="button";
    no.onclick=()=>a.remove();
    yes.onclick=async()=>{ yes.disabled=true;
      const j=await post(tripPath+"/sections",{code,name:me,section:k,on});
      if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); await reloadTrip(); toast(label+(on?": AI picks are on":": suggestions only")) }
      else if(j&&j.error==="code") lockOut(CHANGED);
      else { yes.disabled=false; p.textContent="Couldn't change that. Try again in a moment." } };
    row.append(no,yes); a.append(p,row); li.after(a); yes.focus() }
  c.appendChild(el("p","sg-l","Group Tastes"));   // the same dialog as the comment button by each Group Tastes heading
  const gt=el("div","set-disp"), gb=el("button","tx-b"); gb.type="button"; gb.id="setTastes"; gb.innerHTML=icon("comment");
  gb.appendChild(document.createTextNode("See or Add to Group Tastes")); gb.onclick=()=>{ close(); openSuggest("taste") };
  gt.appendChild(gb); c.appendChild(gt);
  c.appendChild(el("p","sg-l","On This Device"));
  const disp=el("div","set-disp"), cbt=el("button","cbt"); cbt.type="button"; cbt.id="cbt"; cbt.title="Blue to orange instead of green to red";
  cbt.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>';
  cbt.appendChild(document.createTextNode("Color-blind colors")); cbt.setAttribute("aria-pressed",String(document.documentElement.classList.contains("cb")));
  cbt.onclick=()=>setCb(!document.documentElement.classList.contains("cb"),true);
  const seg=el("div","seg cur"); seg.id="cur"; seg.setAttribute("role","group"); seg.setAttribute("aria-label","Prices in");
  [["usd","USD"],["local",TRIP.currency||"JPY"]].forEach(([k,t])=>{ const b=el("button",null,t); b.type="button"; b.dataset.c=k; b.setAttribute("aria-pressed",String(cur===k)); seg.appendChild(b) });
  seg.onclick=e=>{ const b=e.target.closest("button"); if(b&&b.dataset.c!==cur) setCur(b.dataset.c) };
  disp.append(cbt,el("span","set-lbl","Prices In"),seg); c.appendChild(disp);
  c.appendChild(el("p","sg-l","How Scoring Works"));
  const lg=el("div","set-key"); lg.innerHTML='<span class="key"><i class="k3"></i>Must 3<i class="k2"></i>I want 1<i class="k1"></i>Meh 0<i class="k0"></i>Nah -1</span>'; c.appendChild(lg);
  c.appendChild(el("p","sg-help","A card's total adds up everyone's points, and Ranking sorts by it. The total's color is the average vote; a Tabelog score's color is its rank within its own region (3.5+ is very good, 3.8+ exceptional)."));
  const r=el("div","sg-row"), x=el("button","sg-cancel","Close"); x.type="button"; x.onclick=close; r.appendChild(x); c.appendChild(r);
  document.body.appendChild(d); document.body.classList.add("lb-open");
  function close(){ d.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown",onKey,true); if(from&&from.focus) from.focus({preventScroll:true}) }
  function onKey(e){
    if(e.key==="Escape"){ e.preventDefault(); close() }
    else if(e.key==="Tab"){ const fs=[...d.querySelectorAll("button:not([disabled])")], i=fs.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); fs[fs.length-1].focus() } else if(!e.shiftKey&&i===fs.length-1){ e.preventDefault(); fs[0].focus() } }
  }
  addEventListener("keydown",onKey,true); d.addEventListener("click",e=>{ if(e.target===d) close() });
  c.focus({preventScroll:true});
}
// Prices: notes are written in USD (at the trip's "fx" yen per dollar, 150 by default). The switch shows them in the
// local currency instead, rounded like Tabelog's price bands (¥500 steps from ¥1,000, ¥1,000 steps from ¥10,000), so
// "About $7-13" reads "About ¥1,000-2,000". Remembered on this device.
let cur="usd"; try{ if(localStorage.getItem("gv-cur")==="local") cur="local" }catch(e){}
function money(t){
  if(cur==="usd"||!t) return t;
  const fx=+TRIP.fx||150, sym=TRIP.currencySymbol||"¥";
  const conv=x=>{ const v=parseFloat(x.replace(/,/g,""))*fx, step=v>=10000?1000:v>=1000?500:50; return Math.max(step,Math.round(v/step)*step).toLocaleString("en-US") };
  return String(t).replace(/\$(\d[\d,]*(?:\.\d+)?)(?:(\s*[-–]\s*)\$?(\d[\d,]*(?:\.\d+)?))?/g,(m,a,d,b)=>sym+conv(a)+(b?"-"+conv(b):""));
}
function setCur(c){
  cur=c; try{ if(c==="local") localStorage.setItem("gv-cur","local"); else localStorage.removeItem("gv-cur") }catch(e){}
  document.querySelectorAll("#cur button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.c===cur)));
  document.querySelectorAll(".note[data-raw]").forEach(n=>{ n.textContent=money(n.dataset.raw) });
  renderSugs();
}
// Color-blind colors: the vote scale runs blue to orange instead of green to red. Remembered on this device, for every
// trip.
function setCb(on,say){
  document.documentElement.classList.toggle("cb",on);
  const b=$("#cbt"); if(b) b.setAttribute("aria-pressed",String(on));
  try{ if(on) localStorage.setItem("gv-cb","1"); else localStorage.removeItem("gv-cb") }catch(e){}
  if(say) toast(on?"Color-blind colors on":"Standard colors");
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
  // An owner link (#owner=<code>) marks this device as the owner's. The code is kept on the device and cleared from the
  // address bar; the server checks it when the page opens.
  const oh=/(?:^#|&)owner=([^&]+)/.exec(location.hash);
  if(oh){ try{ OWNER=decodeURIComponent(oh[1]) }catch(e){ OWNER=oh[1] } ls("owner",OWNER); history.replaceState(null,"",location.pathname+location.search) }
  const gate=buildGate(); document.body.appendChild(gate);
  const stopField=particleField(gate.querySelector("canvas"));
  const form=gate.querySelector("form"), input=form.querySelector("input"), btn=form.querySelector("button"), msg=gate.querySelector(".gate-msg");
  const say=t=>{ msg.textContent=t||"" }, fine=window.matchMedia&&matchMedia("(pointer: fine)").matches;
  let busy=false;
  // hold: for a remembered password, how long the gate shows it entered and locked before the page comes in.
  async function attempt(pw,remembered,hold){
    pw=String(pw||"").trim();
    if(!pw){ say("Enter the password."); input.focus(); return }
    if(busy) return; busy=true; btn.disabled=true; input.readOnly=true; if(!hold) say(remembered?"Opening…":"Checking…");
    const t0=Date.now(), j=await api(tripPath+"?code="+encodeURIComponent(pw)+(OWNER?"&owner="+encodeURIComponent(OWNER):""));
    if(j&&j.ok){ code=pw; ls("code",pw);
      if(hold){ await wait(Math.max(0,hold-(Date.now()-t0))); form.classList.add("open"); btn.innerHTML=icon("unlock")+"<span>Welcome Back</span>"; await wait(550) }
      return open(j) }   // the form stays disabled while the gate fades out
    busy=false; btn.disabled=false; input.readOnly=false; form.hidden=false; form.classList.remove("auto","open"); btn.textContent="Enter";
    if(j&&j.error==="code"){
      if(remembered){ ls("code",null); code=""; input.value=""; say(CHANGED) } else { say("Incorrect password."); input.select() }
    } else { if(remembered) input.value=pw; say("Can't reach the server. Try again in a moment.") }
    if(fine) input.focus();
  }
  function open(j){
    setTrip(j.trip||{}); REV=+j.rev||0; SUGS=j.suggestions||[]; MAPS_KEY=j.mapsApiKey||null;
    me=ls("me"); if(TRAVELERS.indexOf(me)<0) me=null;
    ballots=j.ballots||{}; THUMBS=j.thumbs||{};
    isOwner=j.owner===true; if(OWNER&&!isOwner){ OWNER=""; ls("owner",null) }   // a wrong or old owner code is forgotten
    PAGE=startPage();
    const swap=()=>{
      stopField(); gate.remove(); document.body.classList.remove("gv-locked"); window.scrollTo(0,0);
      mountBallot(); renderWho(); renderGoals(); render(); renderSugs(); pace();
      startPhotos();
      setInterval(()=>{ if(document.visibilityState==="visible") loadVotes() },30000);
      document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") loadVotes() });
    };
    if(REDUCED) swap(); else { gate.classList.add("leaving"); setTimeout(swap,350) }
  }
  form.addEventListener("submit",e=>{ e.preventDefault(); attempt(input.value,false) });
  let note=""; try{ note=sessionStorage.getItem("gv-msg")||""; sessionStorage.removeItem("gv-msg") }catch(e){}
  // A remembered password: shown entered (as dots), the button locked while a gold line fills and the server checks it,
  // then the lock opens and the page comes in. Without motion, straight in.
  if(code&&REDUCED){ form.hidden=true; attempt(code,true) }
  else if(code){ input.value=code; input.readOnly=true; form.classList.add("auto"); btn.disabled=true;
    btn.innerHTML=icon("lock")+"<span>Unlocking</span>"; btn.setAttribute("aria-label","Unlocking"); attempt(code,true,2300) }
  else { say(note); if(fine) input.focus({preventScroll:true}) }
}
boot();
})();
