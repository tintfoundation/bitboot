# bitboot [![travis][travis-image]][travis-url] [![npm][npm-image]][npm-url]

[travis-image]: https://img.shields.io/travis/8468/bitboot/master.svg
[travis-url]: https://travis-ci.org/8468/bitboot
[npm-image]: https://img.shields.io/npm/v/bitboot.svg
[npm-url]: https://npmjs.org/package/bitboot-dht

### P2P Network Bootstrapping

More text soon!

### Features

### Install

```
npm install bitboot
```

### Example

```js
var Bitboot = require('./')

var bb = new Bitboot('tint')

bb.on('rejoin', function (nodeId) {
  console.log('I have a new node id:', nodeId.toString('hex'))
})

bb.on('peers', function (ips) {
  console.log('I found peers:', ips)
})

bb.on('error', function (err) {
  console.error(err)
})
```