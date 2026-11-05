[![Version](https://img.shields.io/github/v/release/Screenly/rss-reader-app)](https://github.com/Screenly/rss-reader-app/releases/latest)

# RSS Reader

Displays the latest entries from any RSS feed on your Screenly digital signage screens.

![Preview](screenshots/3840x2160.webp)

## Getting Started

This repository uses a git submodule for Claude AI configuration. Clone it with:

```bash
gh repo clone Screenly/rss-reader-app -- --recurse-submodules
```

Then install dependencies:

```bash
bun install
```

## Development

```bash
bun run dev
```

## Testing

```bash
bun test
```

## Build

```bash
bun run build
```

## Deployment

This code runs several Edge Apps:

- **The main RSS Reader app**, which deploys through `update-edge-app.yml` like every other Edge App, using the repo variables `STAGE_EDGE_APP_ID` and `PRODUCTION_EDGE_APP_ID`.
- **Feed apps** (BBC News, Fox News, ...): each is its own Edge App with its own name, icon and default feed, listed in [`deployed-apps.yml`](deployed-apps.yml) and deployed by `update-rss-reader-apps.yml`. All other settings come from `screenly.yml`, so a code or setting change reaches every feed app on the next release.

All of them release together, through the shared [edge-apps-actions](https://github.com/Screenly/edge-apps-actions). [DEPLOYMENT.md](DEPLOYMENT.md) covers how the feed-app workflows work.

### Releasing

Every deploy waits for approval in its GitHub environment.

1. **Stage:** merge to `main`. The push deploys the main app and every feed app with a stage id to stage.
2. **Production:** after checking stage, tag that commit on `main` with the next CalVer version, `vYY.M.PATCH` (for example `v26.11.0`, then `v26.11.1`; check `git tag --sort=-v:refname | head -1` for the latest), and push the tag. This deploys the main app and every feed app with a production id to production. Tags not on `main` are refused, and tags that aren't `v` followed by a digit (such as `vrc1`) are ignored.

   > **Any** tag that starts with `v` and a digit deploys to production, including pre-release tags such as `v26.11.0-rc.1`. Don't push one to test; use stage. (This comes from the shared edge-apps-actions tag filter, so it applies to every Edge App.)

```bash
git checkout main && git pull
git tag vYY.M.PATCH
git push origin vYY.M.PATCH
```

3. **Release notes:** publish a GitHub Release listing the pull requests merged since the previous release. Add `--draft` to review the notes before publishing:

```bash
gh release create vYY.M.PATCH --verify-tag --generate-notes --title vYY.M.PATCH
```

### Publishing a new feed app

A feed app needs no code: it is an entry in `deployed-apps.yml`.

1. **Host an icon** at a public URL. The existing icons are under `https://playground.srly.io/edge-apps/helpers/rss-reader/app-icons/`.
2. **Add an entry** to `deployed-apps.yml` with empty ids, and merge it to `main`:

   ```yaml
   apps:
     example-news: # app key: lowercase, used to pick the app in the workflows
       app_name: 'Example News' # Edge App name and instance title; must be unique
       description: 'Latest news from Example News'
       rss_title: 'Example News' # shown in the header
       icon_url: 'https://.../example-news.svg'
       rss_url: 'https://example.com/feed.xml' # check it loads first
       ids:
         stage: ''
         production: ''
   ```

   Apps without an id are skipped by deploys, so merging this changes nothing yet.

3. **Create it on stage:** run **Actions → Initialize Custom RSS Reader App** from `main`, with environment `stage` and the app key. It refuses to run if the app already has a stage id or an Edge App with that name exists.
4. **Record the id:** copy the id from the run's summary into `ids.stage` and merge. From now on every stage deploy includes the app.
5. **Check it on stage**, then repeat steps 3 and 4 with `production` to create it there and fill in `ids.production`. The next release tag deploys it with everything else.

The initialize summary also says to set a repo variable. Ignore that for feed apps; their ids live only in `deployed-apps.yml`.

### Updating a feed app

- **Its name, description, icon, header title or feed URL:** edit its entry in `deployed-apps.yml` and release as usual. Merging deploys the change to stage, and the next tag deploys it to production. (Changing `app_name` after the app exists doesn't rename it in Screenly; it is only used when the app is created.)
- **Code or other settings:** change the code or `screenly.yml`. Every feed app picks it up on the next release, with no change to `deployed-apps.yml`.
- **A one-off redeploy or test:** run **Actions → Update RSS Reader Apps**, from `main` for stage or from a release tag for production. Leave the app key empty for every app, or enter one such as `bbc-news`. The optional overrides (description, header title, icon URL, feed URL) apply to that run only, so set an app key when you use one; with the key empty, an override changes every feed app. To keep a change, put it in `deployed-apps.yml`.
- **Redeploying the main RSS Reader app:** a manual run of **Update Edge App** from `main` redeploys stage. For production, re-run the workflow run of the latest release tag; a manual run from a tag does nothing for the main app.
- **Removing an app from deploys:** clear its id for that environment in `deployed-apps.yml`. This stops deploying to it but doesn't delete the app in Screenly.

## Configuration

| Setting             | Description                                                                                                                                                                                              | Type     | Default                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| `bypass_cors`       | Route the RSS feed URL through the CORS proxy                                                                                                                                                            | optional | `true`                                 |
| `cache_interval`    | How often (in seconds) to refresh the feed, from 60 to 86400; values outside that range are clamped. If a refresh fails or the feed is empty, the last stories from this feed stay up for up to 24 hours | required | `1800`                                 |
| `display_errors`    | Show errors on screen for debugging purposes                                                                                                                                                             | optional | `false`                                |
| `mode`              | Layout: `headlines` (lead story with image, plus a list) or `list` (headlines only, for maximum readability)                                                                                             | optional | `headlines`                            |
| `override_locale`   | Override the locale used for date formatting (e.g. `en`, `fr`, `de`)                                                                                                                                     | optional | `en`                                   |
| `override_timezone` | Override the timezone for date display (e.g. `Europe/London`)                                                                                                                                            | optional | system timezone                        |
| `rss_title`         | Source name shown in the header                                                                                                                                                                          | required | `BBC News`                             |
| `rss_url`           | URL of the RSS feed to display                                                                                                                                                                           | required | `http://feeds.bbci.co.uk/news/rss.xml` |

## Example Feeds

The following feeds have been tested and are known to work. Some sources require the CORS proxy, so set `bypass_cors` accordingly.

| Source              | URL                                                         | `bypass_cors` |
| ------------------- | ----------------------------------------------------------- | ------------- |
| ABC News            | `https://abcnews.go.com/abcnews/topstories`                 | `true`        |
| Al Jazeera          | `https://www.aljazeera.com/xml/rss/all.xml`                 | `true`        |
| BBC News            | `http://feeds.bbci.co.uk/news/rss.xml`                      | `true`        |
| CNN                 | `http://rss.cnn.com/rss/cnn_topstories.rss`                 | `true`        |
| Fox News            | `https://moxie.foxnews.com/google-publisher/latest.xml`     | `true`        |
| NPR News            | `https://feeds.npr.org/1004/rss.xml`                        | `true`        |
| New York Times      | `https://rss.nytimes.com/services/xml/rss/nyt/World.xml`    | `false`       |
| Wall Street Journal | `https://feeds.content.dowjones.io/public/rss/RSSWorldNews` | `true`        |

## Screenshots

```bash
bun run screenshots
```
