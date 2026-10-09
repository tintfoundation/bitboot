# bitboot

A rendezvous for a peer-to-peer network on the BitTorrent mainline DHT. Members announce a port under one info hash, the SHA-1 of the network's name, and look the info hash up to find each other. Nobody runs a server: the rendezvous is the public mainline DHT.

bitboot is the shared bootstrap service of the [Record](https://github.com/mistakia/record-docs) network (spec §5.2.1, name `record-network-v1`).

## Use

```js
import { create_rendezvous } from 'bitboot'

const rendezvous = create_rendezvous({ name: 'record-network-v1' })
rendezvous.on('peer', ({ host, port }) => dial(host, port))

await rendezvous.start()
await rendezvous.lookup() // resolves with the distinct { host, port } found

// Only once the port is confirmed reachable from outside:
await rendezvous.announce(4100)
```

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `name` | required | The rendezvous name; the info hash is its SHA-1. |
| `dht_bootstrap` | mainline routers | DHT bootstrap nodes as `host:port`. Tests pass a local node. |
| `dht_port` | `0` | UDP port the DHT listens on. |
| `announce_interval_ms` | 15 minutes | Re-announce interval; mainline drops an announcement after about 30 minutes. |

`announce(null)` stops announcing. `stop()` leaves the DHT.

## What announcing exposes

- **Your public IP address.** A DHT node stores the UDP source address of the announce, which is your router's public address, together with the announced port. Anyone who looks up the info hash learns it.
- **Announce only a reachable port.** Behind NAT, an internal port with no mapping publishes an address nobody can dial. Announce a port that a UPnP mapping opened or that a reachability check confirmed, and otherwise only look up.
- **Looking up is visible too.** The DHT nodes a lookup reaches see your address and the info hash you asked for.

bitboot uses only the DHT's public `announce` and `lookup`. It does not forge node ids near the info hash, as bitboot 0.1 did, so a member is an ordinary BEP 5 node.

## Develop

```sh
bun install
bun run verify   # lint, typecheck, committed dist/ is current
bun test         # loopback DHT only; never touches mainline
bun run build    # rebuild dist/, which is committed
```

`dist/` is committed because consumers install bitboot as a git dependency with install scripts disabled.

## License

MIT
