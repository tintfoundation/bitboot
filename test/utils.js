var test = require('tape')
var Bitboot = require('../')
var crypto = require('crypto')

var KBucket = require('k-bucket')

function newId (rallyId) {
  var id = crypto.randomBytes(20)
  id[0] = rallyId[0]
  id[1] = rallyId[1]
  id[18] = rallyId[18]
  id[19] = rallyId[19]
  return id
}

test('twiddle march with equal target/closest', function (t) {
  t.plan(1)

  var bb = new Bitboot('test', { bootstrap: false })
  bb.on('rejoin', function () {
    var closeId = newId(bb.rallyId)
    var toBeat = KBucket.distance(closeId, bb.rallyId)
    var distance = KBucket.distance(bb._twiddleMarch(closeId), bb.rallyId)
    t.ok(distance < toBeat, 'Result of twiddle march should be closer')
    bb.destroy()
  })
})
