# Publishing the extension

## 0. Before the first upload

1. Check the font licences (`src/fonts/README.md`). Replace the fonts if needed.
2. Replace `homepage_url` in `src/manifest.json` and the "MORE INFO" links with
   the real repository or website.
3. Decide on a support e-mail address; both stores require one.
4. Create the screenshots listed in `store/screenshots/README.md`.
5. Bump the version in `src/manifest.json` and `package.json`, update
   `CHANGELOG.md`, run `npm test && npm run build`.

## 1. Chrome Web Store (also serves Edge, Brave, Opera, Vivaldi users)

1. Register a developer account at https://chrome.google.com/webstore/devconsole
   (one-time fee of 5 USD).
2. "New item" → upload `dist/trashmanstory-chrome-<version>.zip`.
3. Store listing: copy the texts from `store/listing-en.md` / `store/listing-de.md`.
   Category: *Productivity* or *Privacy & Security*. Language: English + German.
4. Privacy practices tab: single purpose = "obfuscate advertising profiles by
   visiting websites". Justify each permission with the table in `PRIVACY.md`.
   Host permissions trigger an in-depth review; expect a few days.
   Declare: no remote code, no user data collected.
5. Privacy policy URL: publish `PRIVACY.md` (for example via GitHub Pages).
6. Submit for review. Reviews for extensions with broad host permissions take
   1 to 7 days.

Possible objection: automated browsing can be read as "deceptive behaviour".
Be explicit in the description that the extension opens its own tab, shows a
banner there and only acts in that tab. Both AdNauseam and TrackMeNot were
rejected by Google at some point; Firefox is the safe harbour.

## 2. Firefox Add-ons (AMO)

1. Account at https://addons.mozilla.org/developers/
2. Submit `dist/trashmanstory-firefox-<version>.zip` ("On this site").
3. AMO reviewers read the source. There is no build step, so the zip is the
   source. Mention that in the "Notes to reviewer".
4. Same listing texts. Firefox users are the core target group of this project.

Optional: validate locally with Mozilla's tool

    npx web-ext lint --source-dir=src

## 3. Microsoft Edge Add-ons

Same zip as Chrome. https://partner.microsoft.com/dashboard/microsoftedge – free.

## 4. GitHub release

Push a tag (`git tag v2.0.0 && git push --tags`). The release workflow builds
both zips and attaches them to a GitHub release. Users can install the zip
manually via "Load unpacked" (Chrome) or "Install Add-on From File" (Firefox,
needs signing by AMO for permanent installation).

## 5. After launch

* Watch the ad-profile pages linked in the options page to collect
  before/after screenshots for the press kit.
* Keyword lists are the thing that gets old. Schedule a yearly refresh.
