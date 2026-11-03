"""Render a trip's invitation email: the corgi-capital.com look (black, ivory, gold), a button to the trip plan, a button
to the vote, the password, the route and how the vote works.

  python tools/invite_email.py --file trips/niseko-2027.json --name Bill --password "<password>" --out invite.html

Reads the trip file's "invite" block:
  {"subtitle": "Ski Trip", "dates": "February 18-28, 2027", "plan": "<trip plan URL, e.g. Notion>",
   "vote": "<the vote page URL>", "intro": "<one or two sentences>",
   "stops": [["Sapporo", "Feb 19-21 · two nights"], ...], "facts": [["Ski days", "Mon Grand Hirafu · ..."], ...]}
Writes <out> (HTML) and <out>.txt (the plain-text part). Email-safe: tables and inline styles, buttons that work without
images or web fonts, nothing remote to load (Gmail strips remote images anyway).
"""
import argparse
import html
import json
import os

INK, BG, CARD, GOLD, GOLD2, DIM, MUTED, LINE = "#f0ece0", "#0b0b0b", "#131313", "#c9a55a", "#e2c88e", "#a38851", "#bdb7a8", "#2b2822"
SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "'Inconsolata', Menlo, Consolas, 'Courier New', monospace"


def esc(s):
    return html.escape(str(s), quote=True)


def label(text, color=DIM):
    return f'<div style="font-family:{MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:{color};">{esc(text)}</div>'


def button(text, url, filled):
    bg, fg, border = (GOLD, BG, GOLD) if filled else (BG, GOLD2, GOLD)
    return (f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'
            f'<td align="center" bgcolor="{bg}" style="border:1px solid {border};border-radius:999px;">'
            f'<a href="{esc(url)}" target="_blank" style="display:block;padding:15px 24px;font-family:{SANS};font-size:16px;font-weight:700;'
            f'letter-spacing:.3px;color:{fg};text-decoration:none;border-radius:999px;">{esc(text)}</a></td></tr></table>')


def render(trip, name, password):
    inv = trip["invite"]
    title, subtitle, dates = inv.get("title") or trip["title"].split(" ")[0], inv.get("subtitle", ""), inv.get("dates", "")
    pre = f"{dates}. The trip plan, the vote on where we eat, drink and go, and the password."
    stops = "".join(
        f'<tr><td valign="top" style="padding:10px 0;border-top:1px solid {LINE};font-family:{SERIF};font-size:21px;line-height:1.2;color:{INK};width:44%;">{esc(a)}</td>'
        f'<td valign="top" style="padding:12px 0 10px 12px;border-top:1px solid {LINE};font-family:{SANS};font-size:14px;line-height:1.5;color:{MUTED};">{esc(b)}</td></tr>'
        for a, b in inv.get("stops", []))
    facts = "".join(
        f'<tr><td style="padding:0 0 18px;">{label(a)}<div style="padding-top:6px;font-family:{SANS};font-size:15px;line-height:1.55;color:{INK};">{esc(b)}</div></td></tr>'
        for a, b in inv.get("facts", []))
    steps = [("Open the vote", "enter the password, then tap your name."),
             ("Mark each spot", "MUST, I WANT, MEH or NAH. The list re-ranks by the group's total."),
             ("Know a place?", "Suggest Spot: paste a Google Maps or Tabelog link, or just the name, and our agent will look it up and add it.")]
    how = "".join(
        f'<tr><td valign="top" style="padding:0 12px 14px 0;font-family:{MONO};font-size:13px;color:{GOLD};width:22px;">{n}</td>'
        f'<td valign="top" style="padding:0 0 14px;font-family:{SANS};font-size:15px;line-height:1.55;color:{MUTED};"><b style="color:{INK};">{esc(a if a.endswith('?') else a + ':')}</b> {esc(b)}</td></tr>'
        for n, (a, b) in enumerate(steps, 1))
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<style>@media (max-width:480px){{.card{{padding:34px 20px 26px!important}}.title{{font-size:36px!important;letter-spacing:3px!important}}}}</style>
<title>{esc(trip['title'])}</title></head>
<body style="margin:0;padding:0;background:{BG};" bgcolor="{BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG};">{esc(pre)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{BG}" style="background:{BG};"><tr><td align="center" style="padding:28px 14px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
 <tr><td style="padding:0 6px 22px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
   <td style="font-family:{MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:{GOLD};">Corgi Capital</td>
   <td align="right" style="font-family:{MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:{DIM};">By invitation</td>
  </tr></table></td></tr>
 <tr><td class="card" bgcolor="{CARD}" style="background:{CARD};border:1px solid {LINE};border-radius:18px;padding:44px 32px 34px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
   <tr><td align="center" style="padding-bottom:6px;"><div style="width:1px;height:40px;background:{GOLD};opacity:.7;margin:0 auto;"></div></td></tr>
   <tr><td class="title" align="center" style="padding-top:18px;font-family:{SERIF};font-size:42px;line-height:1;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:{INK};">{esc(title)}</td></tr>
   <tr><td align="center" style="padding-top:10px;font-family:Georgia, 'Times New Roman', serif;font-style:italic;font-size:30px;line-height:1.1;color:{GOLD};">{esc(subtitle)}</td></tr>
   <tr><td align="center" style="padding-top:16px;">{label(dates, MUTED)}</td></tr>
   <tr><td align="center" style="padding:26px 0 0;"><div style="width:1px;height:40px;background:{GOLD};opacity:.7;margin:0 auto;"></div></td></tr>
   <tr><td style="padding-top:28px;font-family:{SANS};font-size:16px;line-height:1.65;color:{INK};">Hi {esc(name)},</td></tr>
   <tr><td style="padding-top:10px;font-family:{SANS};font-size:16px;line-height:1.65;color:{MUTED};">{esc(inv.get('intro', ''))}</td></tr>
   <tr><td style="padding-top:28px;">{button(inv.get('planLabel', 'Trip Plan'), inv['plan'], True)}</td></tr>
   <tr><td style="padding-top:12px;">{button(inv.get('voteLabel', trip['title']), inv['vote'], False)}</td></tr>
   <tr><td style="padding-top:22px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
     <td style="border:1px solid {LINE};border-radius:12px;padding:16px 18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
       <td>{label('Password')}<div style="padding-top:4px;font-family:{SANS};font-size:13px;line-height:1.5;color:{MUTED};">For the vote page. Not secret, just keeps it private.</div></td>
       <td align="right" style="font-family:{MONO};font-size:26px;font-weight:700;letter-spacing:4px;color:{GOLD2};white-space:nowrap;padding-left:12px;">{esc(password)}</td>
      </tr></table></td></tr></table></td></tr>
   <tr><td style="padding-top:36px;">{label('The route')}</td></tr>
   <tr><td style="padding-top:8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{stops}</table></td></tr>
   <tr><td style="padding-top:30px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{facts}</table></td></tr>
   <tr><td style="padding-top:10px;">{label('How the vote works')}</td></tr>
   <tr><td style="padding-top:14px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{how}</table></td></tr>
  </table></td></tr>
 <tr><td align="center" style="padding:24px 10px 0;font-family:{MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{DIM};">Corgi Capital &middot; Private</td></tr>
</table></td></tr></table></body></html>"""
    text = "\n".join([f"{trip['title']}: {title} {subtitle}, {dates}", "", f"Hi {name},", "", inv.get("intro", ""), "",
                      f"{inv.get('planLabel', 'Trip Plan')}: {inv['plan']}", f"{inv.get('voteLabel', trip['title'])}: {inv['vote']}",
                      f"Password: {password} (for the vote page; not secret, just keeps it private)", "", "The route:"]
                     + [f"  {a}: {b}" for a, b in inv.get("stops", [])] + [""] + [f"{a}: {b}" for a, b in inv.get("facts", [])]
                     + ["", "How the vote works:"] + [f"  {n}. {a if a.endswith('?') else a + ':'} {b}" for n, (a, b) in enumerate(steps, 1)] + ["", "Corgi Capital"])
    return doc, text


if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--file", required=True)
    a.add_argument("--name", required=True, help="the recipient's first name")
    a.add_argument("--password", required=True)
    a.add_argument("--out", required=True)
    o = a.parse_args()
    with open(o.file, encoding="utf-8") as f:
        trip = json.load(f)
    doc, text = render(trip, o.name, o.password)
    with open(o.out, "w", encoding="utf-8") as f:
        f.write(doc)
    with open(o.out + ".txt", "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {o.out} ({len(doc):,} bytes) and {os.path.basename(o.out)}.txt")
