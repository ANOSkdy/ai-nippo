#!/usr/bin/env bash
set -euo pipefail

if git diff --name-only | grep -E '^app/\(protected\)/reports/sites/|^app/reports/sites/' >/dev/null; then
  echo '[GUARD] /reports/sites への変更が含まれています。今回のPRでは対象外です。' >&2
  exit 2
fi

echo '[GUARD] OK: /reports/sites への変更はありません。'
