# Google Drive Index — CDN Assets

This repository is the **static asset store** for [Google Drive Index (GDI)](https://gitlab.com/GoogleDriveIndex/Google-Drive-Index).

It contains no server-side logic. Its sole purpose is to allow [jsDelivr](https://www.jsdelivr.com/) to serve GDI's CSS, JavaScript, and images globally with low latency — without consuming Cloudflare Worker CPU time for static file delivery.

[![jsDelivr Hits/Month](https://data.jsdelivr.com/v1/package/gh/PBhadoo/Google-Drive-Index-CDN/badge/month)](https://www.jsdelivr.com/package/gh/PBhadoo/Google-Drive-Index-CDN)
[![jsDelivr Hits/Week](https://data.jsdelivr.com/v1/package/gh/PBhadoo/Google-Drive-Index-CDN/badge/week)](https://www.jsdelivr.com/package/gh/PBhadoo/Google-Drive-Index-CDN)
[![jsDelivr Rank](https://data.jsdelivr.com/v1/package/gh/PBhadoo/Google-Drive-Index-CDN/badge/rank)](https://www.jsdelivr.com/package/gh/PBhadoo/Google-Drive-Index-CDN)

---

## Repository Layout

```
Google-Drive-Index-CDN/
├── src/
│   ├── app.js          ← Frontend source (unminified, for reference)
│   └── app.min.js      ← Minified frontend bundle (loaded in production)
├── assets/
│   ├── gdi.css         ← GDI design system stylesheet (source)
│   ├── gdi.min.css     ← Minified stylesheet
│   ├── homepage.js     ← Homepage grid animation (source)
│   └── homepage.min.js ← Minified homepage script
├── images/
│   ├── favicon.ico     ← Browser favicon
│   ├── bhadoo-cloud-logo-white.svg  ← Navbar logo
│   ├── poster.jpg      ← Default video poster image
│   └── music.jpg       ← Default audio cover art
└── sw.js               ← Service worker (offline caching, loaded from CDN)
```

---

## How It Is Used

When the main GDI worker runs in `production` mode, it injects `<script>` and `<link>` tags pointing to this repo via jsDelivr. For example:

```
https://cdn.jsdelivr.net/gh/PBhadoo/Google-Drive-Index-CDN@v2.5.0/src/app.min.js
https://cdn.jsdelivr.net/gh/PBhadoo/Google-Drive-Index-CDN@v2.5.0/assets/gdi.min.css
```

The version tag (`@v2.5.0`) pins the CDN to a specific release so cached assets never break live deployments. The main worker reads the version from `uiConfig.version` in `worker.js`.

This design means:
- **The Cloudflare Worker serves zero static bytes** — all assets come from jsDelivr's global CDN
- **jsDelivr caches assets at the edge** — low latency worldwide, independent of Worker location
- **Versioned tags** prevent breaking changes; existing deployments keep working until they opt in to a new version

---

## Why a Separate Repository?

jsDelivr requires a public GitHub repository to serve files. The main GDI repository lives on GitLab (`gitlab.com/GoogleDriveIndex/Google-Drive-Index`). Since jsDelivr's GitHub CDN service (`cdn.jsdelivr.net/gh/...`) only supports GitHub repos, assets are published here as a companion mirror.

The split also keeps the main repo lean: no compiled artifacts in source control, clean diffs, and a clear separation between worker logic and frontend assets.

---

## Building and Updating Assets

Assets are built from the main repository using:

```bash
# In google-drive-index (main repo):
npm run build:cdn
```

This runs `esbuild` to minify `src/app.js` → `src/app.min.js`, `assets/gdi.css` → `assets/gdi.min.css`, and `assets/homepage.js` → `assets/homepage.min.js`, then copies the results to this directory (the CDN repo must be cloned alongside the main repo as `../Google-Drive-Index-CDN`).

After building, commit and tag this repo:

```bash
cd ../Google-Drive-Index-CDN
git add -A
git commit -m "Release v2.5.0"
git tag v2.5.0
git push && git push --tags
```

jsDelivr picks up the new tag automatically within a few minutes. Then update `uiConfig.version` in the main `worker.js` to the new tag.

---

## Local Development

For local Wrangler development, `wrangler.toml` in the main repo has:

```toml
[assets]
directory = "../Google-Drive-Index-CDN"
```

This tells Wrangler to serve all files in this directory as static assets during local dev — identical to production jsDelivr delivery. No separate static server needed.

---

## Links

| | |
|---|---|
| Main repository | [gitlab.com/GoogleDriveIndex/Google-Drive-Index](https://gitlab.com/GoogleDriveIndex/Google-Drive-Index) |
| Live CDN base URL | `https://cdn.jsdelivr.net/gh/PBhadoo/Google-Drive-Index-CDN` |
| jsDelivr package page | [jsdelivr.com/package/gh/PBhadoo/Google-Drive-Index-CDN](https://www.jsdelivr.com/package/gh/PBhadoo/Google-Drive-Index-CDN) |
| Author | [Parveen Bhadoo](https://parveenbhadoo.com) — [@PBhadoo](https://github.com/PBhadoo) |

---

## License

[MIT License](https://gitlab.com/GoogleDriveIndex/Google-Drive-Index/-/blob/master/LICENSE) — same as the main GDI repository.
