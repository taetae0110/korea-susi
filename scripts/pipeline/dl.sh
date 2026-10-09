#!/bin/bash
# usage: dl.sh YEAR NAME URL
year="$1"; name="$2"; url="$3"
out="pdf/${year}_${name}.pdf"
[ -s "$out" ] && head -c4 "$out" | grep -q '%PDF' && exit 0
for i in 1 2 3 4 5; do
  curl -sS -o "$out" --max-time 300 -A "Mozilla/5.0" "$url" 2>/dev/null
  head -c4 "$out" 2>/dev/null | grep -q '%PDF' && exit 0
  sleep $((i*2))
done
echo "FAIL $year $name" >&2
rm -f "$out"
