# TorrentFlxi

Free movie and TV site: a TMDB catalog, your own player on every title, where-to-watch information, subtitles, and a
full torrent search with every filter. No accounts, no subscription. Node 22, no npm dependencies.

## What's in it

- **Catalog:** home (trending, in cinemas, popular, top rated, airing today), Movies and TV with genre / year / sort
  filters, Top rated, Genres, Upcoming and In cinemas, Calendar (airing today, this week), collections, search.
- **Title pages:** poster, backdrop, rating, certification, runtime, genres, synopsis, cast, director/creators,
  studio, network, keywords, images, trailer, IMDb/TMDB links, related titles, JSON-LD for search engines.
- **TV:** seasons and episode lists, and an episode page per episode with previous/next.
- **Player:** your player (`PLAYER_URL/embed/movie/:id`, `/embed/tv/:id/:s/:e`). It only loads when the viewer
  presses play, so page views and search-engine crawlers never start a torrent on your player server.
- **Where to watch:** streaming, free, rent and buy services for `WATCH_REGION` (JustWatch data via TMDB).
- **Torrents:** Prowlarr and Comet searched together, merged by info hash, grouped 4K / 1080p / 720p / SD.
  Each release shows quality, source (REMUX, BluRay, WEB-DL, WEBRip, HDTV, CAM…), codec and 10-bit, HDR and
  Dolby Vision, audio (Atmos, TrueHD, DTS-HD, DD+, AAC…) and channels, audio languages, subtitles, seeders,
  leechers, size, indexer, age and a 0–100 score. Magnet, copy magnet and .torrent download.
  Filters: quality, name, source, codec, audio, audio language, minimum seeders, maximum size, HDR, subtitles,
  hide CAM; sort by score, seeders, size or date. Prowlarr's download links (which carry its API key) never reach
  browsers: magnets and .torrent files for releases without an info hash are fetched by the server.
- **Subtitles:** online subtitles for every title and episode, downloadable as WebVTT.
- **My list:** saved in the visitor's browser.
- **Languages:** English, Español, Français, Deutsch, Português, Italiano (interface and TMDB text).
- **Legal pages:** About, Legal notice, DMCA (uses `CONTACT_EMAIL`), Terms, Privacy. robots.txt and sitemap.xml.
- **Ads:** paste your ad tags into `ads.js`; they go into every page's `<head>`. `ADS_ENABLED=false` turns them off.

## Settings

See `.env.example`. The essentials:

| Variable | What |
|---|---|
| `TMDB_API_KEY` | Your TMDB key (the one Moviepire uses). Or `TMDB_READ_TOKEN`, or `TMDB_BASE_URL` pointing at your own TMDB proxy |
| `PLAYER_URL` | Your player's address, e.g. `https://player.yourdomain.com` |
| `SITE_URL` | This site's address, e.g. `https://torrentflxi.org` |
| `PROWLARR_URL`, `PROWLARR_API_KEY` | Torrent search |
| `COMET_URL` | Your Comet manifest link (optional) |

If the player sets `ALLOWED_EMBED_ORIGINS`, add this site's address there, or the player refuses to load in the iframe.

## Run

```bash
cp .env.example .env   # fill it in
node --env-file=.env server.js
npm test
```

## Coolify

New resource → this repository → Dockerfile build pack, port 3000, health check `/healthz`. Add the environment
variables, attach the domain, deploy. It needs no volume.
