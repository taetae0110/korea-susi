#!/bin/bash
# usage: probe.sh NAME YEAR -> prints "YEAR\tNAME\tHTTPCODE\tSIZE"
name="$1"; year="$2"
enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$name")
f=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "${name}_${year}학년도_선행학습영향평가.pdf")
url="https://cdn013.negagea.net/dgsmidc/omr/seoul/web/univ_info${year}/${enc}/${f}"
for i in 1 2 3; do
  out=$(curl -sS -I --max-time 30 -A "Mozilla/5.0" "$url" 2>/dev/null)
  code=$(echo "$out" | head -1 | awk '{print $2}')
  [ -n "$code" ] && break
  sleep $i
done
size=$(echo "$out" | grep -i '^content-length' | awk '{print $2}' | tr -d '\r')
printf "%s\t%s\t%s\t%s\t%s\n" "$year" "$name" "${code:-ERR}" "${size:-0}" "$url"
