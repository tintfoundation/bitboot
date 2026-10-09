// A rendezvous on the BitTorrent mainline DHT: members announce a port under
// one info hash, sha1(name), and look the info hash up to find each other.
// Only the DHT's public announce and lookup are used, so a member is an
// ordinary BEP 5 node. Announcing publishes the announcer's public IP address.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import DHT from 'bittorrent-dht';
export const DEFAULT_ANNOUNCE_INTERVAL_MS = 15 * 60 * 1000;
export function rendezvous_info_hash(name) {
    return createHash('sha1').update(name).digest();
}
export function create_rendezvous({ name, dht_bootstrap, dht_port = 0, announce_interval_ms = DEFAULT_ANNOUNCE_INTERVAL_MS }) {
    const info_hash = rendezvous_info_hash(name);
    const emitter = new EventEmitter();
    let dht = null;
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
    const start = () => {
        if (dht)
            return Promise.resolve();
        stopped = false;
        const created = new DHT(dht_bootstrap ? { bootstrap: [...dht_bootstrap] } : {});
        dht = created;
        created.on('peer', (peer, peer_info_hash) => {
            if (peer_info_hash.equals(info_hash)) {
                emitter.emit('peer', { host: peer.host, port: peer.port });
            }
        });
        created.on('error', (error) => emitter.emit('error', error));
        created.on('warning', (error) => emitter.emit('warning', error));
        return new Promise((resolve) => {
            created.once('ready', () => resolve());
            created.listen(dht_port);
        });
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
