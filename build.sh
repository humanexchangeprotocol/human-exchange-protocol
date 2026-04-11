#!/bin/bash
# HEP Build Script
# Merges split development files into a single distributable HTML file.
# Usage: bash build.sh
# Output: dist/hep.html

set -e

DIST_DIR="dist"
OUTPUT="$DIST_DIR/hep.html"

mkdir -p "$DIST_DIR"

# Extract everything up to (but not including) the <script src> lines from index.html
# That's the HTML + CSS + body markup
sed '/<script src=/,$d' index.html > "$OUTPUT"

# Inline the three JS files as script blocks
echo '<script>' >> "$OUTPUT"
cat vendor/qrcode.js >> "$OUTPUT"
echo '</script>' >> "$OUTPUT"

echo '<script>' >> "$OUTPUT"
cat hep-core.js >> "$OUTPUT"
cat hep-app.js >> "$OUTPUT"
echo '</script>' >> "$OUTPUT"

echo '</body>' >> "$OUTPUT"
echo '</html>' >> "$OUTPUT"

LINES=$(wc -l < "$OUTPUT")
echo "Built $OUTPUT ($LINES lines)"
