import { afterEach, describe, expect, test } from 'bun:test'
import DHT from 'bittorrent-dht'
import { create_rendezvous, rendezvous_info_hash, type Rendezvous } from '../src/index.ts'

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
