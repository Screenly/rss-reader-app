# Feed App Deployment Guide

This repo's code runs several Screenly Edge Apps. Besides the main RSS Reader app, each **feed app** (BBC News, Fox News, ...) is its own Edge App built from the same code, with its own name, icon and default feed.

- The **main RSS Reader app** deploys through `update-edge-app.yml`, using the repo variables `STAGE_EDGE_APP_ID` and `PRODUCTION_EDGE_APP_ID`, like every other Edge App.
- **Feed apps** are listed in `deployed-apps.yml`, which holds each one's settings and its stage and production app ids. `update-rss-reader-apps.yml` deploys them.

Both use the shared [edge-apps-actions](https://github.com/Screenly/edge-apps-actions). For each feed app, the workflow writes its `deployed-apps.yml` entry into `screenly.yml` (description, icon and the `rss_title` and `rss_url` defaults), then calls the shared `update` action with the app's id. All other settings come from `screenly.yml` unchanged, so a new setting reaches every feed app on the next deploy.

## Configuration

**File:** `deployed-apps.yml`

```yaml
apps:
  bbc-news: # app key, used to pick an app in the workflows
    app_name: 'BBC News' # Edge App name and instance title
    description: 'Latest news from BBC World Service' # manifest description
    rss_title: 'BBC News' # rss_title default, shown in the header
    icon_url: 'https://...' # manifest icon
    rss_url: 'http://feeds.bbci.co.uk/news/rss.xml' # rss_url default
    ids:
      stage: '01K7...'
      production: '01K8...' # leave empty until the app exists there
```

An app with no id for an environment is skipped there, not deployed with an empty id.

## Releasing

Feed apps release together with the main app:

- A push to `main` deploys every feed app with a stage id to **stage**.
- A `vYY.MM.N` tag on `main` deploys every feed app with a production id to **production**.

Each deploy waits for approval in its environment. See the README's release section for tagging.

## Adding a feed app

1. Add an entry to `deployed-apps.yml` with empty ids, and merge it to `main`.
2. Run **Actions → Initialize Custom RSS Reader App** from `main` with the app key and `stage`. It refuses to run if the app already has a stage id, or if an Edge App with that name already exists.
3. Copy the id from the run's summary into `ids.stage` and merge. The next stage deploy includes the app.
4. When it's ready for production, repeat steps 2 and 3 with `production`.

The shared action's summary also says to set a repo variable. Ignore that for feed apps; their ids live only in `deployed-apps.yml`.

## Updating feed apps by hand

Run **Actions → Update RSS Reader Apps** from `main` (stage) or from a release tag (production):

- **App key:** empty for every app, or one key such as `bbc-news`.
- **Overrides (optional):** description, RSS title, icon URL or RSS URL, used instead of `deployed-apps.yml` for this run only. To change one permanently, edit `deployed-apps.yml`.
