#!/bin/sh
# Builds distributable zips: dist/trashmanstory-chrome-<v>.zip and dist/trashmanstory-firefox-<v>.zip
set -e
cd "$(dirname "$0")/.."
TARGET="${1:-firefox}"
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
      | .browser_specific_settings = {"gecko": {"id": "trashmanstory@trashmanstory.org", "strict_min_version": "142.0",
                                              "data_collection_permissions": {"required": ["none"]}}}' \
      src/manifest.json > dist/stage/manifest.json
  (cd dist/stage && zip -qr "../trashmanstory-firefox-$VERSION.zip" . -x '.DS_Store' '*/.DS_Store')
  rm -rf dist/firefox-src && cp -R dist/stage dist/firefox-src   # unzipped copy for web-ext lint / run
  echo "built dist/trashmanstory-firefox-$VERSION.zip (source copy in dist/firefox-src)"
}

case "$TARGET" in
  chrome) build_chrome ;;
  firefox) build_firefox ;;
  all) build_chrome; build_firefox ;;
  *) echo "usage: build.sh [firefox|chrome|all]"; exit 1 ;;
esac
rm -rf dist/stage
