---
title: bitboot Repository Graph Entry
type: text
description: >-
  Graph entry point for bitboot, the Record network's BitTorrent mainline-DHT rendezvous library
  consumed by record-node; holds its invariants (public DHT API only, injectable bootstrap, IP
  exposure on announce) and its pin relationship.
base_uri: user:repository/active/bitboot/ABOUT.md
created_at: '2026-10-09T01:25:33.201Z'
entity_id: 2159a087-1b44-4074-8a65-bf4fb6c8c8a9
owner_identity_uri: user:identity/trashman.md
public_read: false
tags:
  - user:tag/record-project.md
updated_at: '2026-10-09T01:25:33.201Z'
---

## Purpose

bitboot is the Record network's mainline-DHT rendezvous: a small library that announces and looks up peers on one BitTorrent mainline DHT info hash, so a new record-node finds the network with no server the project runs. The protocol it implements is spec §5.2.1, canonical in [[user:repository/active/record-docs/ABOUT.md]]; this repo never restates it.

## Invariants

- Public API only: `announce` and `lookup` on bittorrent-dht. No forged node ids, no private `_rpc` internals (BEP 5 and BEP 42 conformance).
- `dht_bootstrap` is injectable; tests run against a local DHT and never touch mainline.
- Announcing publishes the caller's public IP and port at a well-known DHT key. The README states this; callers announce only a port confirmed reachable.

## Notable Context

- Consumer: [[user:repository/active/record-node/ABOUT.md]] pins it as a git dependency by commit, the way record-node pins record-resolver. A change here reaches record-node only through a pin bump.
- Maintained at `tintfoundation/bitboot` from 1.0.0 (2026-10); 0.1.0 (2019, CommonJS, forged ids) was the legacy-v0 bootstrap.
- Tag: [[user:tag/record-project.md]]. Task: [[user:task/record/build-record-network-discovery-and-analytics.md]].
