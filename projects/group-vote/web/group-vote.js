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
// Each region's sections, in order. "tastes" are picked for this group (and where Suggest Spot puts new places).
const GROUPS=[["specialty","Regional Specialties"],["favorite","Local Favorites"],["tastes","Group Tastes"],["event","Events"]];
const TIER={casual:"Casual",mid:"Mid-Range",splurge:"Splurge"};
// Small line icons for the card pills and the matching filters (16px grid, drawn in the text color).
const ICON={
  casual:'<path d="M2.5 8.5h11a5.5 5.5 0 0 1-11 0z"/><path d="M6 6.5l6.5-4M8.5 6.5l5.5-3"/>',
  mid:'<path d="M4.5 2v4a1.5 1.5 0 0 0 3 0V2M6 7.5V14M11.5 14V2c-1.6.8-2.3 2.6-2.3 5.2h2.3"/>',
  splurge:'<path d="M4.2 2.5h7.6L14.5 6 8 13.5 1.5 6z"/><path d="M1.5 6h13M6.3 2.5 8 13.5l1.7-11"/>',
  sweets:'<path d="M4.6 7.4a3.4 3.4 0 1 1 6.8 0z"/><path d="M5 7.4 8 14l3-6.6"/>',
  drinks:'<path d="M2.5 2.5h11L8 8.5z"/><path d="M8 8.5v5M5.5 13.5h5"/>',
  izakaya:'<path d="M6 2h4M6 14h4M8 3.2c-2.9 0-4.6 2.1-4.6 4.8s1.7 4.8 4.6 4.8 4.6-2.1 4.6-4.8S10.9 3.2 8 3.2z"/><path d="M3.5 6.4h9M3.5 9.6h9"/>',
  specialty:'<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
  slotted:'<path d="M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3"/><path d="M5.8 10.1l1.6 1.6 3-3"/>',
  todo:'<path d="M10.5 2.5l3 3-8 8h-3v-3z"/>',
  event:'<path d="M2.5 5h11v2a1.5 1.5 0 0 0 0 3v2h-11v-2a1.5 1.5 0 0 0 0-3z"/><path d="M9.5 5.5v1M9.5 8v1M9.5 10.5v1"/>',
  tastes:'<path d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z"/>',
  ig:'<rect x="2.5" y="2.5" width="11" height="11" rx="3.2"/><circle cx="8" cy="8" r="2.6"/><path d="M11.3 4.6v.1"/>',
  plus:'<path d="M8 3v10M3 8h10"/>',
  comment:'<path d="M2.5 3.5h11v7.5h-6.2L4.5 13.5V11h-2z"/><path d="M5.5 6.5h5M5.5 8.5h3"/>'
};
const FILTER_ICON={slotted:"slotted",casual:"casual",splurge:"splurge",izakaya:"izakaya",treats:"sweets",events:"event",todo:"todo"};
const icon=k=>ICON[k]?'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true">'+ICON[k]+'</svg>':"";
function pill(k,label,cls){ const s=el("span","tag"+(cls?" "+cls:"")); s.innerHTML=icon(k); s.appendChild(document.createTextNode(label)); return s }
const FILTERS=[["all","All"],["slotted","On the Itinerary"],["casual","Casual"],["splurge","Splurge"],["izakaya","Izakaya"],["treats","Sweets & Drinks"],["events","Events"],["todo","Needs Rating"]];
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
boat:`<rect x="10" y="30" width="30" height="34" fill="#9b5a3c"/><path d="M8 30 L25 19 L42 30 Z" fill="#6b3a2a"/><rect x="16" y="38" width="6" height="8" fill="#f2d78a"/><rect x="28" y="38" width="6" height="8" fill="#f2d78a"/><rect x="8" y="64" width="84" height="22" fill="#3d6f8f"/><path d="M44 66 L80 66 L74 74 L50 74 Z" fill="#e8e2d6"/><path d="M60 66 L60 54" stroke="#6b5b4b" stroke-width="2"/><path d="M14 75 q6 -3 12 0 t12 0 M58 81 q6 -3 12 0 t12 0" stroke="#8fc9e6" stroke-width="2" fill="none"/><path d="M87 64 L87 40" stroke="#4a4f55" stroke-width="2"/><circle cx="87" cy="38" r="4" fill="#f2d78a"/>`
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
    if(typeof j.rev==="number"&&j.rev!==REV) await reloadTrip();   // places changed (a suggestion landed, or a new upload)
    else if(JSON.stringify(ballots)!==before) refresh(); else status("");
    if(Array.isArray(j.suggestions)) setSugs(j.suggestions);
    if(unsent){ unsent=false; saveVote() }
  } finally { loading=false; pace() }
}
// The trip's places again (after a suggestion was added): re-rendered in place, scrolled to where you were, with the new
// cards flashed.
async function reloadTrip(){
  const j=await api(tripPath+"?code="+encodeURIComponent(code));
  if(!j||!j.ok){ if(j&&j.error==="code") lockOut(CHANGED); return }
  const had=new Set(ITEMS.map(i=>i.id)), first=[...document.querySelectorAll(".card")].find(c=>c.getBoundingClientRect().bottom>90);
  const anchor=first?{id:first.dataset.id, y:first.getBoundingClientRect().top}:null;
  setTrip(j.trip||{}); REV=+j.rev||0;
  render();
  if(anchor){ const c=document.querySelector('.card[data-id="'+anchor.id+'"]'); if(c) scrollBy(0,c.getBoundingClientRect().top-anchor.y) }
  ITEMS.filter(i=>!had.has(i.id)).forEach(i=>{ const k=cards[i.id]; if(k) k.c.classList.add("flash") });
}
function setTrip(t){
  TRIP=t; TRAVELERS=TRIP.travelers||[]; REGIONS=TRIP.regions||[];
  ITEMS=(TRIP.items||[]).map(i=>Object.assign({},i,{dish:titleCase(i.dish),badge:titleCase(i.badge)}));
}

// ---------- Suggest Spot ----------
// Anyone can paste Google Maps links, Tabelog links or names; the server queues each and Claude (agent.py) looks it up,
// writes its card and adds it, or says why not. The panel shows the last few days of suggestions; while any is still
// being looked up the page checks every 5 seconds.
let REV=0, SUGS=[], paceTimer=0;
const SUG_STATE={queued:"Waiting",working:"Looking it up",added:"Added",duplicate:"Already listed",rejected:"Couldn't add",failed:"Couldn't add"};
const TASTE_STATE={queued:"Waiting",working:"Updating tastes",added:"Tastes updated",rejected:"Not a taste",failed:"Couldn't update"};
const sugPending=()=>SUGS.some(s=>s.status==="queued"||s.status==="working");
function pace(){ clearTimeout(paceTimer); if(sugPending()) paceTimer=setTimeout(loadVotes,5000) }
function setSugs(xs){ const before=JSON.stringify(SUGS); SUGS=xs; if(JSON.stringify(SUGS)!==before) renderSugs() }
const sugWhat=t=>/google\.|goo\.gl/.test(t)?"a Google Maps link":/tabelog\.com/.test(t)?"a Tabelog link":/^https?:\/\//.test(t)?"a link":"“"+(t.length>60?t.slice(0,58)+"…":t)+"”";
function renderSugs(){
  const S=$("#sugs"); if(!S) return;
  S.textContent=""; S.hidden=!SUGS.length; if(!SUGS.length) return;
  S.appendChild(el("h2","sugs-h","Suggestions"));
  const ul=el("ul","sugs-l");
  SUGS.slice(0,8).forEach(s=>{
    const taste=s.kind==="taste", li=el("li","sug "+s.status), busy=s.status==="queued"||s.status==="working";
    li.appendChild(el("span","sug-st",(taste?TASTE_STATE:SUG_STATE)[s.status]||s.status));
    li.appendChild(el("span","sug-txt",busy?sugWhat(s.text)+" from "+s.by:money(s.reason||sugWhat(s.text))+" · "+s.by));
    if(taste&&s.status==="added"){ const a=el("button","sug-see","See it"); a.type="button"; a.onclick=seeTastes; li.appendChild(a) }
    else if(s.item&&ITEMS.some(i=>i.id===s.item)){ const a=el("button","sug-see","See it"); a.type="button"; a.onclick=()=>seeItem(s.item); li.appendChild(a) }
    ul.appendChild(li) });
  S.appendChild(ul);
}
function seeItem(id){
  if(!visibleItems().some(i=>i.id===id)){ filter="all"; syncTools(); render() }
  const k=cards[id]; if(!k) return;
  k.c.scrollIntoView({behavior:REDUCED?"auto":"smooth",block:"center"}); k.c.classList.remove("flash"); void k.c.offsetWidth; k.c.classList.add("flash");
}
function seeTastes(){
  if(sortMode!=="region"||filter!=="all"){ sortMode="region"; filter="all"; syncTools(); render() }
  const n=document.querySelector(".subnote"); if(n) n.scrollIntoView({behavior:REDUCED?"auto":"smooth",block:"center"});
}
function nudgeWho(){ const w=$("#whoWrap"); w.classList.remove("nudge"); void w.offsetWidth; w.classList.add("nudge"); toast("Pick your name first") }
// One dialog for both: "spot" takes links or names (one per line, up to 5); "taste" takes one comment on what the group
// loves or avoids, which the agent folds into the Group Tastes notes.
function openSuggest(kind){
  if(!me) return nudgeWho();
  if(document.querySelector(".sg")) return;
  const taste=kind==="taste", from=document.activeElement;
  const d=el("div","sg"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","sgTitle");
  d.innerHTML='<form class="sg-card" novalidate><h2 id="sgTitle">'+(taste?"Add to Group Tastes":"Suggest a Spot")+'</h2>'
    +(taste?'<p class="sg-help">What does this group love, or avoid? Our agent folds it into the Group Tastes notes, then goes looking for spots that fit and adds them under Group Tastes. It never removes any.</p>'
      +'<label class="sg-l" for="sgText">Tastes</label><textarea id="sgText" rows="3" maxlength="500" placeholder="Spicy is always a plus&#10;Alice doesn&#39;t eat raw fish"></textarea>'
      :'<p class="sg-help">Paste a Google Maps link, a Tabelog link, or just the name: one per line, up to 5. Our agent looks each one up, writes its card and adds it under Group Tastes (events under Events). It takes a minute or two, and everyone sees it.</p>'
      +'<label class="sg-l" for="sgText">Spots</label><textarea id="sgText" rows="4" maxlength="2600" spellcheck="false" autocapitalize="none" placeholder="https://maps.app.goo.gl/…&#10;https://tabelog.com/…&#10;Or a name and the location"></textarea>')
    +'<p class="sg-msg" role="status" aria-live="polite"></p>'
    +'<div class="sg-row"><button type="button" class="sg-cancel">Cancel</button><button type="submit" class="sg-go">'+(taste?"Add":"Suggest")+'</button></div></form>';
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
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const lines=ta.value.split("\n").map(s=>s.trim()).filter(Boolean);
    if(!lines.length){ msg.textContent=taste?"Write what the group loves or avoids.":"Paste a link or type a name."; ta.focus(); return }
    if(!taste&&lines.length>5){ msg.textContent="Up to 5 at a time, please."; ta.focus(); return }
    go.disabled=true; msg.textContent="Sending…";
    const j=await post(tripPath+"/suggestions",taste?{code,name:me,kind:"taste",text:lines.join(" ")}:{code,name:me,text:lines.join("\n")});
    go.disabled=false;
    if(j&&j.ok){ close(); setSugs(j.suggestions||SUGS); toast(taste?"Our agent is updating Group Tastes":lines.length>1?"Our agent is looking them up":"Our agent is looking it up"); pace();
      const S=$("#sugs"); if(!taste&&S&&S.getBoundingClientRect().top<0) S.scrollIntoView({behavior:REDUCED?"auto":"smooth"}) }
    else if(j&&j.error==="code") lockOut(CHANGED);
    else msg.textContent=j&&j.error==="limit"?"That's today's limit for suggestions. Try again tomorrow.":j&&j.error==="text"?(taste?"Keep it to a short comment.":"One link or name per line, up to 5."):"Couldn't send that. Try again in a moment.";
  });
  ta.focus();
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
// The page can't see why Google refused (the browser hides the answer), but it's nearly always the daily photo quota,
// which resets at midnight Pacific: say when that is in the viewer's own time.
function quotaReset(){
  try{
    const now=new Date(), parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hourCycle:"h23",hour:"numeric",minute:"numeric",second:"numeric"}).formatToParts(now);
    const g=t=>+parts.find(x=>x.type===t).value, left=86400-(g("hour")%24*3600+g("minute")*60+g("second"));
    return new Date(now.getTime()+left*1000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  }catch(e){ return "" }
}
function photosOff(){
  if(photosDown) return; photosDown=true; const at=quotaReset();
  banner("Google isn't sending photos right now. That's usually its daily photo limit"+(at?", which resets at "+at+" your time":"")+". Until then places show illustrations, and each Google Maps button has every photo.");
}
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
  if(filter==="izakaya") return ITEMS.filter(i=>i.izakaya);
  if(filter==="treats") return ITEMS.filter(i=>i.kind==="sweets"||i.kind==="drinks");
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
  if(it.placeId||it.q){ const g=el("a","lnk gmaps"); g.href=mapsLink(it); g.target="_blank"; g.rel="noopener"; g.dataset.id=it.id;
    g.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
    g.appendChild(gm()); g.setAttribute("aria-label",it.place+" on Google Maps: every photo and review"); links.appendChild(g) }
  if(links.firstChild) act.appendChild(links);
  const vote=el("div","vote"); vote.setAttribute("role","group"); vote.setAttribute("aria-label","Your vote: "+it.dish);
  [3,2,1,0].forEach(v=>{const btn=el("button",null,VLABEL[v]); btn.type="button"; btn.dataset.v=v; btn.id="v-"+it.id+"-"+v; btn.onclick=()=>cast(it.id,v); vote.appendChild(btn)});
  act.appendChild(vote);
  const tally=el("div","tally"); act.appendChild(tally);
  b.appendChild(act);
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
  // Colored by the average vote (all MUSTs = MUST green, all NAHs = NAH red); uncolored until someone votes.
  const tot=el("span","total"+(tt.n?" grad":""),String(tt.t));
  tot.title="Group points: Must 3, I want 2, Meh 1, Nah 0"+(tt.n?" · average "+(tt.t/tt.n).toFixed(1):"");
  if(tt.n) tot.style.setProperty("--t",(tt.t/tt.n/3).toFixed(3));
  k.tally.append(tot,el("span","pts",tt.t===1?"Point":"Points"),el("span","nvoted",tt.n+"/"+TRAVELERS.length+" Voted"));
  const dots=el("span","dots");
  TRAVELERS.forEach(p=>{const v=ballots[p]&&ballots[p][id]; const d=el("span","dot"+(typeof v==="number"?" v"+v:""),p[0]); d.title=p+": "+(typeof v==="number"?VLABEL[v]:"not voted yet"); dots.appendChild(d)});
  k.tally.appendChild(dots);
}
function refreshBar(){
  const n=ITEMS.filter(i=>typeof mineOf(i.id)==="number").length;
  $("#mine").textContent=me?"You've rated "+n+" of "+ITEMS.length:"Pick your name to vote";
  const tc=$("#todoCount"); if(tc){ const left=ITEMS.length-n; tc.textContent=left>99?"99+":String(left); tc.hidden=!me||left<1;
    tc.setAttribute("aria-label",left+" not rated yet") }
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
  L.textContent="";
  if(!me) L.appendChild(el("p","callout","Pick your name in the bar above to start voting. Everyone's votes show on each card."));
  const xs=visibleItems();
  if(!xs.length) L.appendChild(el("p","empty",filter==="todo"?"You've rated everything. Nice.":"Nothing here yet."));
  else if(sortMode==="region"){
    // Each region: what it's known for, then its regional specialties, then local favorites.
    REGIONS.forEach(g=>{ const its=xs.filter(i=>i.r===g); if(!its.length) return;
      const s=el("section","region"); s.id="region-"+slug(g);
      const w=when(g), h=el("h2","sec",g);
      h.appendChild(el("small",null,its.length+(its.length===1?" Spot":" Spots")+(w?" · "+w.days+(w.days==="1.0"?" Day":" Days"):""))); s.appendChild(h);
      if(w){ const p=el("p","when"); w.stays.forEach(([w1,d1,c1,w2,d2,c2],n)=>{ if(n) p.appendChild(el("span","sep",", "));
        const st=el("span","stay"); st.append(el("span","w",w1)," ",el("span","d",d1)," ",el("span","t",c1),el("span","sep"," – "));
        if(d2) st.append(el("span","w",w2)," ",el("span","d",d2)," "); st.appendChild(el("span","t",c2)); p.appendChild(st) }); s.appendChild(p) }
      const known=(TRIP.knownFor||{})[g]; if(known&&known.length) s.appendChild(el("p","known","Known for "+known.join(", ")));
      const parts=GROUPS.map(([k,label])=>[k,label,its.filter(i=>i.group===k)]);
      parts.push(["",TRIP.otherLabel||"More to Try",its.filter(i=>!GROUPS.some(([k])=>k===i.group))]);
      const used=parts.filter(([,,v])=>v.length);
      used.forEach(([k,label,v])=>{ if(used.length>1){ const sh=el("h3","sub",label); sh.appendChild(el("small",null,String(v.length)));
          if(k==="tastes"){ const t=el("button","tastes-btn"); t.type="button"; t.innerHTML=icon("comment"); t.title="Add to Group Tastes"; t.setAttribute("aria-label","Add to Group Tastes"); t.onclick=()=>openSuggest("taste"); sh.appendChild(t) }
          s.appendChild(sh)
          if(k==="tastes"&&TRIP.tastesLine) s.appendChild(el("p","subnote",TRIP.tastesLine)) }
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
  if(!me) return nudgeWho();
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
    +'<h1 id="title"></h1><p id="intro"></p><nav class="jump" id="jump" aria-label="Jump to"></nav><section class="board" id="board" aria-label="Scoreboard"></section><div class="banner" id="setupBanner" hidden></div>'
    +'<section class="sugs" id="sugs" hidden aria-live="polite"></section></header>'
    +'<div class="bar"><div class="bar-in"><div class="who" id="whoWrap"><span class="label">I am</span><div class="chips" id="who"></div></div>'
    +'<div class="bar-r"><div class="counts"><span id="mine"></span><span class="status" id="status"></span></div>'
    +'<button type="button" class="sugg-btn" id="suggestBtn">'+icon("plus")+'Suggest Spot</button></div></div>'
    +'<div class="progress" aria-hidden="true"><i id="progress"></i></div></div>'
    +'<div class="tools"><div class="seg" id="sort" role="group" aria-label="Sort"><button type="button" data-s="region">Region</button><button type="button" data-s="rank">Ranking</button></div>'
    +'<div class="filters" id="filters" role="group" aria-label="Show"></div><div class="legend"><span class="key"><i class="k3"></i>Must 3<i class="k2"></i>I want 2<i class="k1"></i>Meh 1<i class="k0"></i>Nah 0</span>'
    +'<button type="button" class="cbt" id="cbt" aria-pressed="false" title="Blue to orange instead of green to red"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>Color-blind colors</button>'
    +'<div class="seg cur" id="cur" role="group" aria-label="Prices in"><button type="button" data-c="usd">USD</button><button type="button" data-c="local"></button></div></div></div>'
    +'<main class="list" id="list"></main>'
    +'<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(v);
  document.title=TRIP.title||"Trip vote"; $("#title").textContent=TRIP.title||""; $("#intro").textContent=TRIP.intro||"";
  const jump=$("#jump");
  REGIONS.forEach(g=>{ const n=ITEMS.filter(i=>i.r===g).length; if(!n) return;
    const a=el("a",null,g); a.href="#region-"+slug(g); a.appendChild(el("small",null,String(n)));
    a.onclick=e=>{ e.preventDefault(); if(filter!=="all"){ filter="all"; syncTools(); render() }
      const s=document.getElementById("region-"+slug(g)); if(s) s.scrollIntoView({behavior:REDUCED?"auto":"smooth"}) };
    jump.appendChild(a) });
  const F=$("#filters"), has={slotted:ITEMS.some(i=>i.slot), casual:ITEMS.some(i=>i.tier==="casual"), splurge:ITEMS.some(i=>i.tier==="splurge"), izakaya:ITEMS.some(i=>i.izakaya), treats:ITEMS.some(i=>i.kind==="sweets"||i.kind==="drinks")};
  FILTERS.forEach(([f,label])=>{ if(f in has&&!has[f]) return; const b=el("button","chip"); b.innerHTML=icon(FILTER_ICON[f]); b.appendChild(document.createTextNode(label)); b.type="button"; b.dataset.f=f;
    if(f==="todo"){ const c=el("span","cnt"); c.id="todoCount"; c.hidden=true; b.appendChild(c) }   // how many you haven't rated
    F.appendChild(b) });
  F.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; filter=b.dataset.f; syncTools(); render() });
  $("#sort").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; sortMode=b.dataset.s; ls("sort",sortMode); syncTools(); render() });
  $("#lock").addEventListener("click",()=>{ ls("code",null); ls("me",null); location.reload() });
  $("#suggestBtn").addEventListener("click",()=>openSuggest("spot"));
  $('#cur [data-c="local"]').textContent=TRIP.currency||"JPY";
  $("#cur").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b&&b.dataset.c!==cur) setCur(b.dataset.c) });
  document.querySelectorAll("#cur button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.c===cur)));
  let cb=false; try{ cb=localStorage.getItem("gv-cb")==="1" }catch(e){}
  setCb(cb); $("#cbt").addEventListener("click",()=>setCb(!document.documentElement.classList.contains("cb"),true));
  syncTools();
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
    setTrip(j.trip||{}); REV=+j.rev||0; SUGS=j.suggestions||[];
    me=ls("me"); if(TRAVELERS.indexOf(me)<0) me=null;
    ballots=j.ballots||{};
    const swap=()=>{
      stopField(); gate.remove(); document.body.classList.remove("gv-locked"); window.scrollTo(0,0);
      mountBallot(); renderWho(); render(); renderSugs(); pace();
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
