# LBNB Discovery V0

Zero-backend validation build for the redesigned LBNB product.

## Public prototype
- `site/index.html` — Discovery experience
- `site/lbnb-content-v0.json` — portable content graph
- `site/404.html` — safe fallback for shared/deep links

## Curator
- `site/curator/index.html` — local curator for Places, Experiences, Stories, Reels and relationships
- The curator stores drafts in the browser and exports `lbnb-content-v0.json`.
- To publish content, replace `site/lbnb-content-v0.json` with the exported file and commit/push.

## V0 flow
Discover → contextual carousel → Place / Experience / Story → Save → My Place → Journey

## Intentionally excluded
AWS runtime dependency, Cognito requirement, booking, payments, payouts, host tools, chat, reviews, native apps and legacy migration data.

## GitHub Pages
The workflow in `.github/workflows/pages.yml` deploys the `site/` folder on pushes to the `discovery-v0` branch.

Root URL = Discovery.
`/curator/` = Curator.

## Safety
This V0 package is separated from legacy migration files and old credential-bearing scripts. Do not copy historical secrets or migration datasets into `site/`.
