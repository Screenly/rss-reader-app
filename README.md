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

```bash
screenly edge-app create --name rss-reader --in-place
bun run deploy
screenly edge-app instance create
```

### Releasing

Pushes to `main` start a stage deploy, which waits for approval. To release to production, tag a commit on `main` with the next CalVer version (`vYY.MM.N`, e.g. `v26.11.0`; check `git tag --sort=-v:refname | head -1` for the latest) and push the tag. The workflows refuse tags not on `main` and only treat numeric `v[0-9]*` tags as releases; the production deploy also waits for approval. Replace `vYY.MM.N` below with the new version:

```bash
git checkout main && git pull
git tag vYY.MM.N
git push origin vYY.MM.N
```

Then publish a GitHub Release whose notes list the pull requests merged since the previous release. Add `--draft` to review the notes before publishing:

```bash
gh release create vYY.MM.N --verify-tag --generate-notes --title vYY.MM.N
```

## Configuration

| Setting             | Description                                                          | Type     | Default                                |
| ------------------- | -------------------------------------------------------------------- | -------- | -------------------------------------- |
| `bypass_cors`       | Route the RSS feed URL through the CORS proxy                        | optional | `true`                                 |
| `cache_interval`    | How often (in seconds) to refresh the feed                           | required | `1800`                                 |
| `display_errors`    | Show errors on screen for debugging purposes                         | optional | `false`                                |
| `override_locale`   | Override the locale used for date formatting (e.g. `en`, `fr`, `de`) | optional | `en`                                   |
| `override_timezone` | Override the timezone for date display (e.g. `Europe/London`)        | optional | system timezone                        |
| `rss_title`         | Source label displayed on each card                                  | required | `BBC News`                             |
| `rss_url`           | URL of the RSS feed to display                                       | required | `http://feeds.bbci.co.uk/news/rss.xml` |

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
