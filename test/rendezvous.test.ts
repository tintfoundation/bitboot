import { afterEach, describe, expect, test } from 'bun:test'
import DHT from 'bittorrent-dht'
import { create_rendezvous, DEFAULT_DHT_BOOTSTRAP, rendezvous_info_hash, resolve_ipv4_bootstrap, type Rendezvous } from '../src/index.ts'

// Every test runs on a loopback DHT and never touches mainline.

const started: Rendezvous[] = []
let bootstrap_node: DHT | null = null

async function start_bootstrap_node (): Promise<string> {
  const node = new DHT({ bootstrap: false })
  bootstrap_node = node
  await new Promise<void>((resolve) => node.listen(0, () => resolve()))
  return `127.0.0.1:${node.address().port}`
}

async function start_member (dht_bootstrap: string, name = 'bitboot-test'): Promise<Rendezvous> {
  const member = create_rendezvous({ name, dht_bootstrap: [dht_bootstrap] })
  started.push(member)
  await member.start()
  return member
}

afterEach(async () => {
  await Promise.all(started.splice(0).map((member) => member.stop()))
  if (bootstrap_node) await new Promise<void>((resolve) => bootstrap_node!.destroy(() => resolve()))
  bootstrap_node = null
})

describe('create_rendezvous', () => {
  test('info hash is the SHA-1 of the name', () => {
    expect(rendezvous_info_hash('record-network-v1').toString('hex'))
      .toBe('2cad0137affa3f21818be869ca2728ab2f8d76fe')
    expect(create_rendezvous({ name: 'record-network-v1' }).info_hash.toString('hex'))
      .toBe('2cad0137affa3f21818be869ca2728ab2f8d76fe')
  })

  test('a lookup finds the port another member announced', async () => {
    const dht_bootstrap = await start_bootstrap_node()
    const announcer = await start_member(dht_bootstrap)
    const seeker = await start_member(dht_bootstrap)
    await announcer.announce(4100)

    const events: Array<{ host: string, port: number }> = []
    seeker.on('peer', (peer) => events.push(peer))
    const found = await seeker.lookup()

    expect(found).toContainEqual({ host: '127.0.0.1', port: 4100 })
    expect(events).toContainEqual({ host: '127.0.0.1', port: 4100 })
  })

  test('a lookup under another name finds nothing', async () => {
    const dht_bootstrap = await start_bootstrap_node()
    const announcer = await start_member(dht_bootstrap)
    const seeker = await start_member(dht_bootstrap, 'another-network')
    await announcer.announce(4100)
    expect(await seeker.lookup()).toEqual([])
  })

  test('a member that never announces is never found', async () => {
    const dht_bootstrap = await start_bootstrap_node()
    await start_member(dht_bootstrap)
    const seeker = await start_member(dht_bootstrap)
    expect(await seeker.lookup()).toEqual([])
  })

  test('announce rejects a port outside 1-65535 and lookup needs start', async () => {
    const dht_bootstrap = await start_bootstrap_node()
    const member = await start_member(dht_bootstrap)
    await expect(member.announce(0)).rejects.toThrow(RangeError)
    await expect(create_rendezvous({ name: 'x' }).lookup()).rejects.toThrow('not started')
  })
})

describe('resolve_ipv4_bootstrap', () => {
  test('resolves names to IPv4, keeps literals, and drops names that do not resolve', async () => {
    expect(await resolve_ipv4_bootstrap(['localhost:6881', '192.0.2.7:25401', 'router.invalid:6881'])).toEqual(['127.0.0.1:6881', '192.0.2.7:25401'])
  })

  test('passes a list that resolves to nothing on as it was', async () => {
    expect(await resolve_ipv4_bootstrap(['router.invalid:6881'])).toEqual(['router.invalid:6881'])
  })

  test('the default routers are host:port entries', () => {
    for (const entry of DEFAULT_DHT_BOOTSTRAP) expect(entry).toMatch(/^[a-z0-9.-]+:\d+$/)
  })
})

// Opt-in: the real mainline DHT. BITBOOT_MAINLINE=1 bun test
describe.skipIf(process.env.BITBOOT_MAINLINE !== '1')('mainline', () => {
  test('the default routers fill the routing table', async () => {
    const member = create_rendezvous({ name: 'bitboot-mainline-check' })
    started.push(member)
    await member.start()
    expect(await member.lookup()).toBeArray()
  }, 30_000)
})
