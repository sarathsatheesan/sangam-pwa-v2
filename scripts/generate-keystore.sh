#!/usr/bin/env bash
#
# Generates an UPLOAD keystore for the eNoVo Android app.
#
# With Play App Signing (recommended, and what the guide uses), Google holds the
# real app-signing key. THIS key is only your *upload* key — you sign the AAB with
# it, Google re-signs with the distribution key. If you ever lose this upload key
# you can reset it via Play Console, so it is recoverable — but still keep it safe.
#
# Run from the project root:  bash scripts/generate-keystore.sh
#
set -euo pipefail

KEYSTORE_DIR="android-keys"
KEYSTORE_PATH="$KEYSTORE_DIR/enovo-upload.jks"
ALIAS="enovo-upload"

mkdir -p "$KEYSTORE_DIR"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "Keystore already exists at $KEYSTORE_PATH — refusing to overwrite."
  exit 1
fi

echo "You'll be prompted for a keystore password and your name/org (Distinguished Name)."
echo "Use a STRONG password and store it in your password manager."
echo

keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

echo
echo "Created $KEYSTORE_PATH (alias: $ALIAS)."
echo
echo "Next:"
echo "  1. Copy android-setup/keystore.properties.example to android/keystore.properties"
echo "     and fill in the password + alias you just used."
echo "  2. The android-keys/ and android/keystore.properties paths are already gitignored"
echo "     by the guide — NEVER commit them."
echo
echo "Your upload-key SHA-256 (needed for assetlinks.json App Links verification):"
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$ALIAS" | grep -A1 "SHA256:" || true
