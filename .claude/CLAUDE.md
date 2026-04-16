# General

- You are a principal software engineer writing Edge Apps for Screenly.

## Edge Apps

- Edge Apps is a framework for building and running content on Screenly's digital signage screens.
- Edge Apps allows you to build custom digital signage content without provisioning or managing servers.
- You could think of it as something similar to other serverless technologies like Cloudflare Workers
  or AWS Lambda.
- More details for Screenly's Edge Apps could be found in [https://developer.screenly.io/edge-apps](https://developer.screenly.io/edge-apps).

## Players

- When the term "player" is mentioned in prompts, it's shorthand for digital signage players.
- A digital signage player can be either a physical or virtual.
- Screenly offers two types of physical digital signage players.
  - Screenly Player, a Raspberry-pi based player
    - Compatible with Raspberry Pi 3 and 4 devices.
  - Screenly Player Max, a more powerful alternative to the Screenly Player
- See [https://www.screenly.io/digital-signage-players/](https://www.screenly.io/digital-signage-players/) for more details about the physical players.
- Screenly also offers a virtual alternative, which we call "Screenly Anywhere".
- Screenly Anywhere allows to you to deploy screens with no hardware required.
  - Screenly Anywhere can be set up on a web browser, on a smartphone, or on a smart TV.
  - See [https://www.screenly.io/end-user/screenly-anywhere/](https://www.screenly.io/end-user/screenly-anywhere/) for more details.

## Supported Resolutions

- When writing CSS styles and media queries, make sure to support both landscape and portrait displays.
- Standard landscape resolutions: 1280×720, 1920×1080, 3840×2160, 4096×2160.
- Standard portrait resolutions: 720×1280, 1080×1920, 2160×3840, 2160×4096.
- Also support smaller resolutions: 800×480 (landscape) and 480×800 (portrait).

## Committing Changes

When committing staged changes in Git:

- Use Conventional Commits for writing commit messages. Check [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/) for details.
- Use bullet points for the commit details
- If there are bullet points, keep them short and simple

## Creating Pull Requests

- Pull request could be created via the GitHub CLI.
- Pull requests should be created against the `master` branch.
- Pull requests should be marked as "Draft" until they are ready for review.
- Use Conventional Commits for writing pull request titles. Check [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/) for details.
- Make the pull request description concise.

## Pending GitHub Issues

### Centralize shared config across Edge App repositories

Both linting/formatting config and Claude AI config are currently hand-copied into each
standalone Edge App repo. A GitHub issue needs to be created to track centralizing these:

- **Linting and formatting** — Prettier, Stylelint, and ESLint rules (e.g., `.prettierrc.json`)
  should be exportable from `@screenly/edge-apps` (`Screenly/edge-apps-library`) as shareable
  presets so repos inherit consistent rules without copying files.

- **Claude AI config** — `.claude/CLAUDE.md`, `rules/`, and `skills/` are generic enough to
  be reused across all Edge App repos. A shared location (e.g., a dedicated `Screenly/claude-config`
  repo, or bundled into `edge-apps-library`) would eliminate manual copying and prevent drift.

When the GitHub repository for this app is created, open an issue to track this work.
