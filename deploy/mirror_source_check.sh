#!/usr/bin/env bash
# Prod from the mirror (decision 43): the mirror builds nothing, it deploys the image the primary's
# Dev Deploy built for the primary commit of the release tag. This binds that commit to the tag:
# MIRROR_SOURCE.json (written by publish-mirror.sh) must record exactly one entry for the tag, and
# its primary_sha must be the given source sha. That the tag is annotated and on the mirror's main
# is deploy/tag_check.sh's and deploy/main_commit_check.sh's job.
# Usage: deploy/mirror_source_check.sh vX.Y.Z <40-hex primary commit>
# Env: MIRROR_SOURCE_FILE (default MIRROR_SOURCE.json at the repository root).
# Prints version=sha-<source sha> and source_sha=<source sha>, ready for GITHUB_OUTPUT.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

tag=${1:-} source_sha=${2:-}
file=${MIRROR_SOURCE_FILE:-MIRROR_SOURCE.json}
[[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "expected a release tag vX.Y.Z (got '$tag'). Nothing was deployed."
[[ $source_sha =~ ^[0-9a-f]{40}$ ]] ||
  die "source_sha must be the 40-hex primary commit of $tag: a deploy from the mirror needs it. Nothing was deployed."

entries=$(mirror_source_tags 2>/dev/null <"$file") ||
  die "$file is missing or not a MIRROR_SOURCE.json with a tags list. Nothing was deployed."
read -r count recorded < <(awk -F '\t' -v tag="$tag" '$1 == tag { n++; sha = $2 } END { print n + 0, sha }' <<<"$entries")
case $count in
  0) die "$tag is not in $file: publish-mirror has not synced it to the mirror. Nothing was deployed." ;;
  1) ;;
  *) die "$tag is recorded more than once in $file. Nothing was deployed." ;;
esac
[ "$recorded" = "$source_sha" ] ||
  die "$tag on the mirror is primary commit ${recorded:0:7} in $file, not the given source_sha ${source_sha:0:7}. Nothing was deployed."

echo "$tag on the mirror is primary commit ${source_sha:0:7}; deploying image sha-${source_sha:0:7}…" >&2
echo "version=sha-$source_sha"
echo "source_sha=$source_sha"
