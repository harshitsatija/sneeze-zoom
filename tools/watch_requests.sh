#!/bin/sh
# exits (and prints) when any file in requests/ is added or modified
cd "$(dirname "$0")/../requests"
sig() { ls -1 2>/dev/null | while read f; do stat -f '%N %m' "$f"; done | md5; }
before=$(sig)
for i in $(seq 1 720); do sleep 10; now=$(sig); if [ "$now" != "$before" ]; then ls -la; exit 0; fi; done; echo timeout
