var Bitboot = require('./')

var bb = new Bitboot('bitboot test network')

bb.on('rejoin', function (nodeId) {
  console.log('I have a new node id:', nodeId.toString('hex'))
})

bb.on('peers', function (peers) {
  console.log('I found peers:', peers)
})

bb.on('error', function (err) {
  console.error(err)
})
