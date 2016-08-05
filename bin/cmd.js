#!/usr/bin/env node

var Bitboot = require('../')
var args = process.argv.slice(2)

if (args.length !== 1) {
  console.error('Usage: bitboot <rally name>')
  process.exit(1)
}

var bb = new Bitboot(args[0])

bb.on('peers', function (peers) {
  for (var i = 0; i < peers.length; i++) {
    process.stdout.write(peers[i].host + ':' + peers[i].port + '\n')
  }
})

bb.on('error', function (err) {
  console.error(err)
})
