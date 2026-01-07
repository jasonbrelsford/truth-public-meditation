Truth improve app

Hosting notes
- Frontend (GitHub Pages): commit and push this repo, then enable Pages on the `main` branch.
- AI proxy (Render): create a new Web Service from this repo and set `OPENAI_API_KEY` in the Render environment.

Config
- Update `config.js` with your deployed AI proxy URL.
- For local overrides, create `config.local.js` (ignored by git) and include it after `config.js` in `index.html`.
