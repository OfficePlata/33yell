#!/usr/bin/env bash
# ルートの1枚HTMLと画像をプラグインに同梱して sasayell-services.zip を作る
set -euo pipefail
cd "$(dirname "$0")/.."
P=wordpress/sasayell-services
rm -rf "$P/html" "$P/assets"
mkdir -p "$P/html" "$P/assets/images"
cp yatoeiru.html manaberu.html shiraberu.html shindan.html "$P/html/"
cp images/* "$P/assets/images/"
rm -f wordpress/sasayell-services.zip
(cd wordpress && zip -qr sasayell-services.zip sasayell-services)
echo "built wordpress/sasayell-services.zip"
