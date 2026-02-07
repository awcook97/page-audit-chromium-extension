#!/bin/bash
# Script to generate PNG icons from SVG
# Requires ImageMagick or another SVG converter

if command -v convert &> /dev/null; then
    # Using ImageMagick
    convert -background none icon.svg -resize 16x16 icon16.png
    convert -background none icon.svg -resize 48x48 icon48.png
    convert -background none icon.svg -resize 128x128 icon128.png
    echo "Icons created successfully!"
elif command -v inkscape &> /dev/null; then
    # Using Inkscape
    inkscape icon.svg -w 16 -h 16 -o icon16.png
    inkscape icon.svg -w 48 -h 48 -o icon48.png
    inkscape icon.svg -w 128 -h 128 -o icon128.png
    echo "Icons created successfully!"
else
    echo "Please install ImageMagick (convert) or Inkscape to generate icons"
    echo "Alternatively, use an online converter to convert icon.svg to:"
    echo "  - icon16.png (16x16)"
    echo "  - icon48.png (48x48)"
    echo "  - icon128.png (128x128)"
fi
