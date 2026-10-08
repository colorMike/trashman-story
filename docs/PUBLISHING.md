# Publishing the extension

Firefox first. Chrome is secondary and optional.

## 0. Before the first upload

1. Bump the version in `src/manifest.json` and `package.json`, update `CHANGELOG.md`.
2. `npm test && npm run build && npm run lint:amo` must be clean.
3. Screenshots are in `store/screenshots/` (regenerate after UI changes, see
   `store/screenshots/README.md`).
4. Have a support e-mail address ready; AMO requires one.

## 1. Firefox Add-ons (addons.mozilla.org, "AMO")

1. Developer account: https://addons.mozilla.org/developers/ (free).
2. *Submit a New Add-on* → *On this site* → upload
   `dist/trashmanstory-firefox-<version>.zip`.
3. The zip is the source (no build step, no minification), so no separate
   source upload is needed. Say so in *Notes to Reviewer*:
   "Plain ES modules, no bundler. Automated browsing happens only in a pinned
   tab the extension opens itself and marks with a banner. No data leaves the
   browser."
4. Listing: texts from `store/listing-de.md` and `store/listing-en.md`,
   category *Privacy & Security*, licence MIT, privacy policy = contents of
   `PRIVACY.md`, screenshots from `store/screenshots/`.
5. Data collection: the manifest already declares
   `data_collection_permissions: required: ["none"]`; pick "none" in the form too.
6. Submit. Listed add-ons with broad host permissions get a human review,
   typically a few days. Once approved, users install with one click and
   updates are automatic.

Self-distribution alternative: choose *On your own* instead, download the
signed `.xpi` and attach it to a GitHub release. Users can install it from the
file without AMO listing.

Local checks before upload:

    npm run lint:amo
    npx web-ext run --source-dir=dist/firefox-src --firefox=/Applications/Firefox.app/Contents/MacOS/firefox

## 2. GitHub release

    git tag v2.0.0 && git push --tags

The release workflow runs the tests and attaches both zips to a GitHub release.

## 3. Chrome Web Store (optional)

Developer account at https://chrome.google.com/webstore/devconsole (one-time
5 USD). Upload `dist/trashmanstory-chrome-<version>.zip`, same listing texts,
justify each permission with the table in `PRIVACY.md`, publish `PRIVACY.md`
at a public URL. Expect a longer review; Google has removed comparable
extensions (AdNauseam) in the past. Edge Add-ons accept the same zip for free.

## 4. After launch

* Collect before/after screenshots of ad-profile pages for the press kit.
* Keyword lists are the thing that gets old. Schedule a yearly refresh.
