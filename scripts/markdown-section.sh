#!/usr/bin/env bash
# Prints the lines of the markdown on stdin under one "## " heading, up to the next "## " heading.
# The heading matches exactly or followed by a space and a suffix ("## [1.2.0] - 2026-10-22",
# "## Changelog (v1.2.0)"); only the first such section is printed.
# Usage: scripts/markdown-section.sh '<## heading>' < file.md
set -euo pipefail

awk -v heading="${1:?usage: markdown-section.sh '<## heading>'}" '
  index($0, "## ") == 1 { if (inside) exit; inside = ($0 == heading || index($0, heading " ") == 1); next }
  inside { print }
'
