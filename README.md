# bitboot [![travis][travis-image]][travis-url] [![npm][npm-image]][npm-url]

[travis-image]: https://img.shields.io/travis/8468/bitboot/master.svg
[travis-url]: https://travis-ci.org/8468/bitboot
[npm-image]: https://img.shields.io/npm/v/bitboot.svg
[npm-url]: https://npmjs.org/package/bitboot

### P2P Network Bootstrapping

Bitboot allows a new node in a [peer-to-peer](https://en.wikipedia.org/wiki/Peer-to-peer) network to find other nodes in the same network, even if the network being joined is as small as a single node.  It has no local dependencies and doesn't require that any other local services be running.

### Install

```
npm install -g bitboot
```

### Command Line Usage

```
bitboot <magic name>
```

The `magic name` should be a unique string (make sure to use quotation marks if it's more than one word) for your network.  If at least one other instance of bitboot is running somewhere else with the same magic name, then the program will print out other node's locations as they are found (one per line, in `host:port` format).  If you're just starting a new network, this may take a minute or two before other nodes are found.

### Library Example

```js
var Bitboot = require('bitboot')

// The rally point name can be any string and should be unique
// to your peer network
var bb = new Bitboot('bitboot test network')

// this is called whenever the node selects a new ID and rejoins
// the BitTorrent mainline DHT network
bb.on('rejoin', function (nodeId) {
  console.log('I have a new node id:', nodeId.toString('hex'))
})

// this is called whenever a search is made for peers
// peers will be the result of that search (and may be empty)
bb.on('peers', function (peers) {
  console.log('I found peers:', peers)
})

bb.on('error', function (err) {
  console.error(err)
})
```

### Background

Many peer-to-peer networks clients are initially bootstrapped by connecting to a handful of hard-coded, centralized nodes (yes, even [Bitcoin](https://github.com/bitcoin/bitcoin/blob/37d83bb0a980996338d9bc9dbdbf0175eeaba9a2/src/chainparams.cpp#L116) and [BitTorrent](https://github.com/qbittorrent/qBittorrent/blob/5e114c0f2ead8077061e09e8debf89dfa0d526dc/src/base/bittorrent/session.cpp#L1567)).  Every new peer-to-peer network must solve this same challenge, usually by hardcoding centralized bootstrap servers.  Bitboot allows you to avoid this step of having to run/maintain a new centralized server if you're creating a new p2p network.  Bitboot can also be used more generally to find a single peer (for instance, if you just want to be able to find your home computer and the IP is changing frequently).

When you run bitboot, you give it a [magic name](https://en.wikipedia.org/wiki/Magic_number_(programming)) to uniquely identify the network you'd like to join.  Bitboot then joins the existing [BitTorrent DHT](https://en.wikipedia.org/wiki/Mainline_DHT) (perhaps the largest and most reliable/stable DHT on the planet) and finds other nodes with the same magic name.  It does this by selecting a rally point to hang out near based on the magic name where it will meet other nodes with the same magic name value.  Also, the ID it uses is carefully selected so other nodes can pick it out as a bitboot peer based on the value of the magic name (in case other non-member nodes are hanging out around the rally point).
