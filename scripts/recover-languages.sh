#!/bin/bash
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
cd /home/ppa/Documents/GemsX/Code/GemX-Backend
LOG=/tmp/recover-languages.log
exec >"$LOG" 2>&1

echo "=== start ==="
which git cat
git rev-parse --short HEAD
git status -sb

for sha in ffccefc6f2322281d2153f54a7c9facec4d2dc7d 12bced65a5f43931f11d82396427fb67f103dd90; do
  echo "=== cat-file $sha ==="
  if git cat-file -t "$sha"; then
    git show --stat --oneline "$sha" | head -80
  else
    echo "MISSING $sha"
  fi
done

# Prefer update-languages tip if present, else edit-language
RESTORE_SHA=""
if git cat-file -t 12bced65a5f43931f11d82396427fb67f103dd90 >/dev/null 2>&1; then
  RESTORE_SHA=12bced65a5f43931f11d82396427fb67f103dd90
elif git cat-file -t ffccefc6f2322281d2153f54a7c9facec4d2dc7d >/dev/null 2>&1; then
  RESTORE_SHA=ffccefc6f2322281d2153f54a7c9facec4d2dc7d
fi

if [ -z "$RESTORE_SHA" ]; then
  echo "NO_RESTORE_SHA"
  exit 1
fi

echo "RESTORE_SHA=$RESTORE_SHA"
git branch -f recovery/languages-restore "$(git rev-parse HEAD)"
git switch recovery/languages-restore

# Restore language-related paths from the old commit onto current tree
git checkout "$RESTORE_SHA" -- .

echo "=== after checkout ==="
git status -sb
git diff --cached --stat | head -100
echo "=== done ==="
