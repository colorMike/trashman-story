# Contributing

* The engine (`src/lib/engine.js`) is pure JavaScript without browser APIs.
  Every change there needs a test in `test/`.
* Run `npm test` and `npm run lint` before opening a pull request.
* Keyword lists live in `src/data/avatars.js`. Add phrases a real shopper would
  type, in the language of the target market. Avoid brand names where a trade
  mark could be an issue.
* New outfits need `sprites.png` (200 x 400 px, two frames) for slots 0, 1 and 2
  under `src/images/avatars/<Id>/<slot>/`.
* Do not add tracking, analytics or remote code. That is the one rule.
