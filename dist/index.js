// A rendezvous on the BitTorrent mainline DHT: members announce a port under
// one info hash, sha1(name), and look the info hash up to find each other.
// Only the DHT's public announce and lookup are used, so a member is an
// ordinary BEP 5 node. Announcing publishes the announcer's public IP address.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import { isIP } from 'node:net';
import DHT from 'bittorrent-dht';
export const DEFAULT_ANNOUNCE_INTERVAL_MS = 15 * 60 * 1000;
// Mainline routers that answered as of 2026-10. bittorrent-dht's own list
// holds two that no longer do.
export const DEFAULT_DHT_BOOTSTRAP = Object.freeze([
    'dht.libtorrent.org:25401',
    'dht.transmissionbt.com:6881',
    'router.bittorrent.com:6881',
    'router.utorrent.com:6881'
]);
// The DHT's socket is IPv4, but bittorrent-dht resolves a host name with
// whichever family the system prefers, so a router with an AAAA record first
// is never reached. Names resolve to IPv4 here; one that does not resolve is
// dropped, and a list that resolves to nothing is passed on as it was.
export const resolve_ipv4_bootstrap = async (entries) => {
    const resolved = await Promise.all(entries.map(async (entry) => {
        const separator = entry.lastIndexOf(':');
        const host = entry.slice(0, separator);
        const port = entry.slice(separator + 1);
        if (isIP(host) !== 0)
            return entry;
        try {
            const { address } = await lookup(host, { family: 4 });
            return `${address}:${port}`;
        }
        catch {
            return null;
        }
    }));
    const usable = resolved.filter((entry) => entry !== null);
    return usable.length > 0 ? usable : [...entries];
};
export function rendezvous_info_hash(name) {
    return createHash('sha1').update(name).digest();
}
export function create_rendezvous({ name, dht_bootstrap, dht_port = 0, announce_interval_ms = DEFAULT_ANNOUNCE_INTERVAL_MS }) {
    const info_hash = rendezvous_info_hash(name);
    const emitter = new EventEmitter();
    let dht = null;
    let starting = null;
    let announce_timer = null;
    let announced_port = null;
    let stopped = false;
    const require_dht = () => {
        if (!dht)
            throw new Error('rendezvous is not started');
        return dht;
    };
    const announce_once = (port) => new Promise((resolve, reject) => {
        require_dht().announce(info_hash, port, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    const join = async () => {
        stopped = false;
        const bootstrap = await resolve_ipv4_bootstrap(dht_bootstrap ?? DEFAULT_DHT_BOOTSTRAP);
        if (stopped)
            return;
        const created = new DHT({ bootstrap });
        dht = created;
        created.on('peer', (peer, peer_info_hash) => {
            if (peer_info_hash.equals(info_hash)) {
                emitter.emit('peer', { host: peer.host, port: peer.port });
            }
        });
        created.on('error', (error) => emitter.emit('error', error));
        created.on('warning', (error) => emitter.emit('warning', error));
        await new Promise((resolve) => {
            created.once('ready', () => resolve());
            created.listen(dht_port);
        });
    };
    const start = async () => {
        if (dht)
            return;
        starting ??= join().finally(() => { starting = null; });
        await starting;
    };
    const stop = () => {
        stopped = true;
        if (announce_timer)
            clearInterval(announce_timer);
        announce_timer = null;
        announced_port = null;
        const current = dht;
        dht = null;
        if (!current)
            return Promise.resolve();
        return new Promise((resolve) => current.destroy(() => resolve()));
    };
    const announce = async (port) => {
        if (announce_timer)
            clearInterval(announce_timer);
        announce_timer = null;
        announced_port = port;
        if (port === null)
            return;
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new RangeError(`announce port must be 1-65535, got ${port}`);
        }
        announce_timer = setInterval(() => {
            if (stopped || announced_port === null)
                return;
            announce_once(announced_port).catch((error) => emitter.emit('warning', error));
        }, announce_interval_ms);
        announce_timer.unref();
        await announce_once(port);
    };
    const lookup = () => new Promise((resolve, reject) => {
        const current = require_dht();
        const found = new Map();
        const on_peer = (peer) => {
            found.set(`${peer.host}:${peer.port}`, peer);
        };
        emitter.on('peer', on_peer);
        current.lookup(info_hash, (error) => {
            // Peers already stored locally are emitted on the next tick, so
            // detach after the callback's own tick.
            setImmediate(() => {
                emitter.off('peer', on_peer);
                if (error)
                    reject(error);
                else
                    resolve([...found.values()]);
            });
        });
    });
    return Object.assign(emitter, { info_hash, start, stop, announce, lookup });
}
