import { EventEmitter } from 'node:events';
export interface RendezvousPeer {
    readonly host: string;
    readonly port: number;
}
export interface RendezvousOptions {
    readonly name: string;
    readonly dht_bootstrap?: readonly string[];
    readonly dht_port?: number;
    readonly announce_interval_ms?: number;
}
export interface RendezvousEvents {
    peer: [RendezvousPeer];
    error: [Error];
    warning: [Error];
}
export interface Rendezvous extends EventEmitter<RendezvousEvents> {
    readonly info_hash: Buffer;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    announce: (port: number | null) => Promise<void>;
    lookup: () => Promise<RendezvousPeer[]>;
}
export declare const DEFAULT_ANNOUNCE_INTERVAL_MS: number;
export declare function rendezvous_info_hash(name: string): Buffer;
export declare function create_rendezvous({ name, dht_bootstrap, dht_port, announce_interval_ms }: RendezvousOptions): Rendezvous;
