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

## Releasing, adding and updating feed apps

The steps are in the README:

- [Releasing](README.md#releasing): one tag releases the main app and every feed app.
- [Publishing a new feed app](README.md#publishing-a-new-feed-app)
- [Updating a feed app](README.md#updating-a-feed-app)
