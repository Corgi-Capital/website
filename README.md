# corgi-capital.com

Placeholder site for [Corgi Capital](https://corgi-capital.com) — a systematic prediction markets trading operation.

## Stack

Single-file static HTML/CSS/JS. No dependencies, no build step. Hosted on Squarespace with custom domain.

## Local dev

```bash
open index.html
# or
python3 -m http.server 8080
```

## Deployment

The site is served via **Squarespace Code Injection** or a custom page block. To update:

1. Edit `index.html`
2. Copy the full contents into Squarespace → Settings → Advanced → Code Injection (or the relevant Code Block)
3. Publish

## Structure

```
/
├── index.html   # Entire site — HTML + CSS + JS, self-contained
└── README.md
```

## Contact

hello@corgi-capital.com
