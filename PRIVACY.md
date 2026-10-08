# Privacy policy – Trashman Story

Last updated: 2026-10-08

Trashman Story is a browser extension that visits websites on your behalf to
distort the interest profile that advertising networks build about you.

## What the extension does with data

* It stores your settings and usage counters (number of pages visited, last
  keywords, the last five visited pages) **locally in your browser** using the
  extension storage API. Nothing is uploaded.
* It opens a pinned tab and loads search engines, shops and the pages linked
  from them. Those third-party websites see a normal page request from your
  browser, exactly as if you had opened them yourself. They may set cookies.
  That is the point of the extension.
* It reads the links on pages inside its own tab to decide where to go next.
  It never reads, modifies or transmits content of your other tabs.

## What the extension does not do

* No analytics, telemetry, crash reporting or remote configuration.
* No accounts, no sign-in, no server operated by us.
* No reading of browsing history, bookmarks, passwords or form data.
* No injection of advertising or affiliate links.

## Permissions explained

| Permission | Why |
|------------|-----|
| `storage` | save settings and counters locally |
| `tabs` | create, update, mute and remove the Trashman tab |
| `alarms` | wake the extension up to visit the next page |
| `idle` | pause while you are away from the computer |
| host permissions (`http://*/*`, `https://*/*`) | the Trashman tab can navigate anywhere; the content script only acts inside that tab |

## Contact

Open an issue in the project repository.
