// The subset of bittorrent-dht 11 this package calls. The package ships no
// types of its own.
declare module 'bittorrent-dht' {
  import { EventEmitter } from 'node:events'

  interface DHTOptions {
    bootstrap?: string[] | false
    host?: string | false
  }

  interface DHTPeer {
    host: string
    port: number
  }

  export default class DHT extends EventEmitter {
    constructor (options?: DHTOptions)
    listen (port: number, onlistening?: () => void): void
    address (): { address: string, family: string, port: number }
    announce (info_hash: Buffer, port: number, callback?: (error: Error | null) => void): void
    lookup (info_hash: Buffer, callback?: (error: Error | null, node_count: number) => void): () => void
    destroy (callback?: () => void): void
    on (event: 'peer', listener: (peer: DHTPeer, info_hash: Buffer) => void): this
    on (event: 'ready', listener: () => void): this
    on (event: 'error' | 'warning', listener: (error: Error) => void): this
  }
}
