// A rendezvous on the BitTorrent mainline DHT: members announce a port under
// one info hash, sha1(name), and look the info hash up to find each other.
// Only the DHT's public announce and lookup are used, so a member is an
// ordinary BEP 5 node. Announcing publishes the announcer's public IP address.

import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import DHT from 'bittorrent-dht'

export interface RendezvousPeer {
  readonly host: string
  readonly port: number
}

export interface RendezvousOptions {
  // The rendezvous name; the info hash is its SHA-1.
  readonly name: string
  // DHT bootstrap nodes as host:port. Omit for the mainline defaults.
  readonly dht_bootstrap?: readonly string[]
  // UDP port the DHT listens on; 0 picks a free one.
  readonly dht_port?: number
  // How often an announced port is re-announced. Mainline nodes drop an
  // announcement after about 30 minutes.
  readonly announce_interval_ms?: number
}

export interface RendezvousEvents {
  peer: [RendezvousPeer]
  error: [Error]
  warning: [Error]
}

export interface Rendezvous extends EventEmitter<RendezvousEvents> {
  readonly info_hash: Buffer
  // Joins the DHT; resolves once the routing table is bootstrapped.
  start: () => Promise<void>
  stop: () => Promise<void>
  // Announces the port now and every announce_interval_ms. A later call
  // replaces the port; null stops announcing.
  announce: (port: number | null) => Promise<void>
  // Looks the info hash up once, emitting `peer` for each address found,
  // and resolves with the distinct addresses.
  lookup: () => Promise<RendezvousPeer[]>
}

export const DEFAULT_ANNOUNCE_INTERVAL_MS = 15 * 60 * 1000

export function rendezvous_info_hash (name: string): Buffer {
  return createHash('sha1').update(name).digest()
}

export function create_rendezvous ({
  name,
  dht_bootstrap,
  dht_port = 0,
  announce_interval_ms = DEFAULT_ANNOUNCE_INTERVAL_MS
}: RendezvousOptions): Rendezvous {
  const info_hash = rendezvous_info_hash(name)
  const emitter = new EventEmitter<RendezvousEvents>()
  let dht: DHT | null = null
  let announce_timer: NodeJS.Timeout | null = null
  let announced_port: number | null = null
  let stopped = false

  const require_dht = (): DHT => {
    if (!dht) throw new Error('rendezvous is not started')
    return dht
  }

  const announce_once = (port: number): Promise<void> =>
    new Promise((resolve, reject) => {
      require_dht().announce(info_hash, port, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })

  const start = (): Promise<void> => {
    if (dht) return Promise.resolve()
    stopped = false
    const created = new DHT(dht_bootstrap ? { bootstrap: [...dht_bootstrap] } : {})
    dht = created
    created.on('peer', (peer, peer_info_hash) => {
      if (peer_info_hash.equals(info_hash)) {
        emitter.emit('peer', { host: peer.host, port: peer.port })
      }
    })
    created.on('error', (error) => emitter.emit('error', error))
    created.on('warning', (error) => emitter.emit('warning', error))
    return new Promise((resolve) => {
      created.once('ready', () => resolve())
      created.listen(dht_port)
    })
  }

  const stop = (): Promise<void> => {
    stopped = true
    if (announce_timer) clearInterval(announce_timer)
    announce_timer = null
    announced_port = null
    const current = dht
    dht = null
    if (!current) return Promise.resolve()
    return new Promise((resolve) => current.destroy(() => resolve()))
  }

  const announce = async (port: number | null): Promise<void> => {
    if (announce_timer) clearInterval(announce_timer)
    announce_timer = null
    announced_port = port
    if (port === null) return
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new RangeError(`announce port must be 1-65535, got ${port}`)
    }
    announce_timer = setInterval(() => {
      if (stopped || announced_port === null) return
      announce_once(announced_port).catch((error: Error) => emitter.emit('warning', error))
    }, announce_interval_ms)
    announce_timer.unref()
    await announce_once(port)
  }

  const lookup = (): Promise<RendezvousPeer[]> =>
    new Promise((resolve, reject) => {
      const current = require_dht()
      const found = new Map<string, RendezvousPeer>()
      const on_peer = (peer: RendezvousPeer): void => {
        found.set(`${peer.host}:${peer.port}`, peer)
      }
      emitter.on('peer', on_peer)
      current.lookup(info_hash, (error) => {
        // Peers already stored locally are emitted on the next tick, so
        // detach after the callback's own tick.
        setImmediate(() => {
          emitter.off('peer', on_peer)
          if (error) reject(error)
          else resolve([...found.values()])
        })
      })
    })

  return Object.assign(emitter, { info_hash, start, stop, announce, lookup })
}
