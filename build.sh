#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# build.sh — Build, sign, and package SEO Page Audit extension
# ─────────────────────────────────────────────────────────────
#
# Usage:
#   ./build.sh              Build ZIP (for Chrome Web Store) and signed CRX
#   ./build.sh zip          Build only the CWS-ready ZIP
#   ./build.sh crx          Build only the signed CRX
#   ./build.sh key          Generate a new signing key (one-time)
#   ./build.sh id           Print the extension ID derived from the key
#   ./build.sh clean        Remove build artifacts
#
# The signing key (key.pem) is generated automatically on first run
# if it does not already exist. KEEP THIS FILE SECRET — add it to
# .gitignore and back it up securely. Losing it means you can never
# update the extension under the same ID.
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

KEY_FILE="key.pem"
BUILD_DIR="build"
VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | head -1 | cut -d'"' -f4)
NAME="seo-page-audit"
ZIP_NAME="${NAME}-${VERSION}.zip"
CRX_NAME="${NAME}-${VERSION}.crx"

# Files and directories to include in the package
INCLUDE_FILES=(
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  popup.css
  website-audit.js
  compare.js
  icon16.png
  icon48.png
  icon128.png
)

# ── Helpers ──────────────────────────────────────────────────

red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }
info()   { printf '  %s\n' "$*"; }

check_openssl() {
  if ! command -v openssl &>/dev/null; then
    red "Error: openssl is required but not found."
    echo "Install it with your package manager (e.g., sudo apt install openssl)."
    exit 1
  fi
}

check_icons() {
  for icon in icon16.png icon48.png icon128.png; do
    if [[ ! -f "$icon" ]]; then
      yellow "Warning: $icon not found. Run ./create-icons.sh first."
      exit 1
    fi
  done
}

# ── Key Management ───────────────────────────────────────────

generate_key() {
  check_openssl

  if [[ -f "$KEY_FILE" ]]; then
    yellow "Key already exists: $KEY_FILE"
    echo "Delete it first if you really want to regenerate (you will lose your extension ID)."
    return 0
  fi

  echo "Generating new RSA-2048 signing key..."
  openssl genrsa -out "$KEY_FILE" 2048 2>/dev/null
  chmod 600 "$KEY_FILE"
  green "Created $KEY_FILE"
  echo ""
  yellow "IMPORTANT: Back up $KEY_FILE securely. If you lose it, you cannot update"
  yellow "your extension under the same ID on the Chrome Web Store."
  echo ""
  print_extension_id
}

get_extension_id() {
  # The Chrome extension ID is derived from the first 128 bits of the
  # SHA-256 hash of the DER-encoded public key, mapped to a-p (base-16
  # with a=0 ... p=15). This matches how Chrome computes it internally.
  check_openssl

  if [[ ! -f "$KEY_FILE" ]]; then
    red "No key file found. Run: ./build.sh key"
    exit 1
  fi

  local pub_der
  pub_der=$(openssl rsa -in "$KEY_FILE" -pubout -outform DER 2>/dev/null | xxd -p | tr -d '\n')

  local hash
  hash=$(echo -n "$pub_der" | xxd -r -p | openssl dgst -sha256 -binary | xxd -p | tr -d '\n')

  # Take first 32 hex chars (128 bits) and map 0-9a-f → a-p
  local id=""
  local hex_prefix="${hash:0:32}"
  for (( i=0; i<${#hex_prefix}; i++ )); do
    local c="${hex_prefix:$i:1}"
    case "$c" in
      0) id+="a" ;; 1) id+="b" ;; 2) id+="c" ;; 3) id+="d" ;;
      4) id+="e" ;; 5) id+="f" ;; 6) id+="g" ;; 7) id+="h" ;;
      8) id+="i" ;; 9) id+="j" ;; a) id+="k" ;; b) id+="l" ;;
      c) id+="m" ;; d) id+="n" ;; e) id+="o" ;; f) id+="p" ;;
    esac
  done

  echo "$id"
}

print_extension_id() {
  local id
  id=$(get_extension_id)
  info "Extension ID: $id"
  info "Chrome URL:   chrome-extension://$id/"
}

# ── Build Functions ──────────────────────────────────────────

ensure_key() {
  if [[ ! -f "$KEY_FILE" ]]; then
    yellow "No signing key found. Generating one now..."
    echo ""
    generate_key
    echo ""
  fi
}

build_zip() {
  check_icons
  mkdir -p "$BUILD_DIR"

  local zip_path="${BUILD_DIR}/${ZIP_NAME}"
  rm -f "$zip_path"

  echo "Packaging ZIP for Chrome Web Store..."

  # Create a clean zip with only the required files
  zip -j -9 "$zip_path" "${INCLUDE_FILES[@]}" >/dev/null

  local size
  size=$(du -h "$zip_path" | cut -f1)
  green "Created $zip_path ($size)"
}

build_crx() {
  check_openssl
  check_icons
  ensure_key
  mkdir -p "$BUILD_DIR"

  local crx_path="${BUILD_DIR}/${CRX_NAME}"
  local tmp_zip
  tmp_zip="/tmp/crx-build-$$.zip"
  rm -f "$tmp_zip"

  echo "Building signed CRX package..."

  # 1. Create a temporary ZIP of extension files
  zip -j -9 "$tmp_zip" "${INCLUDE_FILES[@]}" >/dev/null

  # 2. Extract the DER-encoded public key
  local pub_key_der
  pub_key_der=$(mktemp /tmp/crx-pub-XXXXXX.der)
  openssl rsa -in "$KEY_FILE" -pubout -outform DER -out "$pub_key_der" 2>/dev/null

  # 3. Sign the ZIP with the private key (SHA-256 with RSA PKCS#1 v1.5)
  local sig_file
  sig_file=$(mktemp /tmp/crx-sig-XXXXXX.sig)
  openssl dgst -sha256 -sign "$KEY_FILE" -out "$sig_file" "$tmp_zip"

  # 4. Build the CRX3-like binary (CRX2 format — widely compatible)
  #    CRX2 header layout:
  #      - "Cr24"           (4 bytes magic)
  #      - version = 2      (4 bytes LE uint32)
  #      - public key len   (4 bytes LE uint32)
  #      - signature len    (4 bytes LE uint32)
  #      - public key bytes
  #      - signature bytes
  #      - ZIP content
  local pub_key_len sig_len
  pub_key_len=$(wc -c < "$pub_key_der")
  sig_len=$(wc -c < "$sig_file")

  {
    # Magic number
    printf 'Cr24'
    # Version 2
    printf '\x02\x00\x00\x00'
    # Public key length (little-endian uint32)
    printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
      $((pub_key_len & 0xFF)) \
      $(((pub_key_len >> 8) & 0xFF)) \
      $(((pub_key_len >> 16) & 0xFF)) \
      $(((pub_key_len >> 24) & 0xFF)))"
    # Signature length (little-endian uint32)
    printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
      $((sig_len & 0xFF)) \
      $(((sig_len >> 8) & 0xFF)) \
      $(((sig_len >> 16) & 0xFF)) \
      $(((sig_len >> 24) & 0xFF)))"
    # Public key
    cat "$pub_key_der"
    # Signature
    cat "$sig_file"
    # ZIP payload
    cat "$tmp_zip"
  } > "$crx_path"

  # Clean up temp files
  rm -f "$tmp_zip" "$pub_key_der" "$sig_file"

  local size
  size=$(du -h "$crx_path" | cut -f1)
  green "Created $crx_path ($size)"
  echo ""
  print_extension_id
}

clean() {
  echo "Cleaning build artifacts..."
  rm -rf "$BUILD_DIR"
  green "Done."
}

# ── Validation ───────────────────────────────────────────────

validate() {
  echo "Running pre-build checks..."
  local errors=0

  # Check manifest.json exists and is valid JSON
  if [[ ! -f manifest.json ]]; then
    red "  ✗ manifest.json not found"
    errors=$((errors + 1))
  elif ! python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null && \
       ! node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))" 2>/dev/null; then
    red "  ✗ manifest.json is not valid JSON"
    errors=$((errors + 1))
  else
    info "✓ manifest.json valid"
  fi

  # Check all included files exist
  for f in "${INCLUDE_FILES[@]}"; do
    if [[ ! -f "$f" ]]; then
      red "  ✗ Missing: $f"
      errors=$((errors + 1))
    fi
  done

  if [[ $errors -eq 0 ]]; then
    info "✓ All extension files present"
  fi

  # Check version
  info "✓ Version: $VERSION"

  if [[ $errors -gt 0 ]]; then
    red "Validation failed with $errors error(s)."
    exit 1
  fi

  green "All checks passed."
  echo ""
}

# ── Main ─────────────────────────────────────────────────────

main() {
  local cmd="${1:-all}"

  echo ""
  echo "╔═══════════════════════════════════════╗"
  echo "║     SEO Page Audit — Build Tool       ║"
  echo "║     Version: $VERSION                    ║"
  echo "╚═══════════════════════════════════════╝"
  echo ""

  case "$cmd" in
    all)
      validate
      build_zip
      build_crx
      echo ""
      green "Build complete!"
      info "CWS upload:      ${BUILD_DIR}/${ZIP_NAME}"
      info "Self-distribute: ${BUILD_DIR}/${CRX_NAME}"
      ;;
    zip)
      validate
      build_zip
      ;;
    crx)
      validate
      build_crx
      ;;
    key)
      generate_key
      ;;
    id)
      print_extension_id
      ;;
    clean)
      clean
      ;;
    *)
      echo "Usage: ./build.sh [all|zip|crx|key|id|clean]"
      echo ""
      echo "  all    Build ZIP + signed CRX (default)"
      echo "  zip    Build Chrome Web Store ZIP only"
      echo "  crx    Build signed CRX only"
      echo "  key    Generate signing key (one-time)"
      echo "  id     Print extension ID from key"
      echo "  clean  Remove build artifacts"
      exit 1
      ;;
  esac
}

main "$@"
