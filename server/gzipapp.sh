#!/bin/bash
find ./app -iname '*.html' -exec gzip -9 -f -k {} +
find ./app -iname '*.css' -exec gzip -9 -f -k {} +
find ./app -iname '*.js' -exec gzip -9 -f -k {} +
FILES=`find ./app -type f`
echo "$FILES" | while read file; do MD5=`openssl md5 "$file" | cut -d = -f 2 | tr -d ' '`; echo "$MD5" > "$file.md5"; done
