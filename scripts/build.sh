#!/bin/sh
# Builds distributable zips: dist/trashmanstory-chrome-<v>.zip and dist/trashmanstory-firefox-<v>.zip
set -e
cd "$(dirname "$0")/.."
TARGET="${1:-all}"
VERSION=$(jq -r .version src/manifest.json)
mkdir -p dist
rm -rf dist/stage

build_chrome() {
  rm -rf dist/stage && mkdir -p dist/stage
  cp -R src/. dist/stage/
  (cd dist/stage && zip -qr "../trashmanstory-chrome-$VERSION.zip" . -x '.DS_Store' '*/.DS_Store')
  echo "built dist/trashmanstory-chrome-$VERSION.zip"
}

build_firefox() {
  rm -rf dist/stage && mkdir -p dist/stage
  cp -R src/. dist/stage/
  # Firefox MV3 runs the background as an event page, not a service worker, and needs an add-on id.
  jq '.background = {"scripts": ["background.js"], "type": "module"}
      | .browser_specific_settings = {"gecko": {"id": "trashmanstory@trashmanstory.org", "strict_min_version": "121.0"}}' \
      src/manifest.json > dist/stage/manifest.json
  (cd dist/stage && zip -qr "../trashmanstory-firefox-$VERSION.zip" . -x '.DS_Store' '*/.DS_Store')
  echo "built dist/trashmanstory-firefox-$VERSION.zip"
}

case "$TARGET" in
  chrome) build_chrome ;;
  firefox) build_firefox ;;
  all) build_chrome; build_firefox ;;
  *) echo "usage: build.sh [chrome|firefox|all]"; exit 1 ;;
esac
rm -rf dist/stage
