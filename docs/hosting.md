# Hosting the arcade

The arcade is a set of static files with no backend. Running `npm run site` builds every game in `games/` into `site/`, with an index page linking to each one. Any static host can serve that folder.

## GitHub Pages (recommended)

GitHub Pages is free for public repositories. Pages on a private repository needs a paid GitHub plan.

The workflow is already in `.github/workflows/pages.yml`. It runs on every push to `main`, builds the site, and deploys it.

1. Create the repository on GitHub.
2. Add it as the remote: `git remote add origin https://github.com/<user>/<repo>.git`.
3. Push `main`: `git push -u origin main`.
4. In the repository, go to Settings → Pages → Source and choose **GitHub Actions**.

The site appears at `https://<user>.github.io/<repo>/`. Each game is at `/<repo>/<game>/`, for example `/<repo>/sample-3d/`.

## itch.io

itch.io is free and built for games, with good discoverability.

- Zip the game folder (for example `site/sample-3d`) and upload it as an HTML5 project, or
- Use the `butler push` CLI to publish a folder.

## Cloudflare Pages

Cloudflare Pages is free, with unlimited bandwidth.

- Deploy from the command line: `npx wrangler pages deploy site`, or
- Connect the GitHub repository in the Cloudflare dashboard.

## Netlify

Netlify has a free tier.

- Drag the `site` folder onto the dashboard, or
- Connect the repository with build command `npm run site` and publish directory `site`.

## Multiplayer note

The planned multiplayer (WebRTC peer-to-peer, see `docs/design/multiplayer-royale.md`) also works from static hosting. Only a dedicated game server would need more than that.

## Comparison

| Host | Cost | Setup effort | Custom domain | Best use |
| --- | --- | --- | --- | --- |
| GitHub Pages | Free (public repos) | Low: workflow already included | Yes | Source-controlled builds, the default choice |
| itch.io | Free | Low: upload a zip | Yes (paid tiers and custom domain setup) | Reaching players and discovery |
| Cloudflare Pages | Free | Low to medium | Yes | Fast global delivery, unlimited bandwidth |
| Netlify | Free tier | Low | Yes | Drag-and-drop deploys and simple previews |
