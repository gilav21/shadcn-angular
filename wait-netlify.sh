#!/usr/bin/env bash
# Exits when the Netlify deploy-preview check settles, printing its result.
for _ in $(seq 1 40); do
  line=$(gh pr checks 116 2>/dev/null | grep "^netlify/")
  case "$line" in
    *pending*) sleep 30 ;;
    "") sleep 30 ;;
    *) echo "netlify settled: $line"; exit 0 ;;
  esac
done
echo "netlify still pending after 20m"
