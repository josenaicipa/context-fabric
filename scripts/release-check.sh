#!/usr/bin/env bash
set -euo pipefail
if [[ ! -f scripts/doctor.sh ]]; then
  echo "missing scripts/doctor.sh boundary check" >&2
  exit 1
fi
bash scripts/doctor.sh
npm ci
npm run build
npm test
npm pack --workspace @context-fabric/sdk --pack-destination /tmp >/tmp/context-fabric-npm-pack.log
