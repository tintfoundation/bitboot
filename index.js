module.exports = Bitboot

var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var crypto = require('crypto')

var DHT = require('bittorrent-dht')
var KBucket = require('k-bucket')
var debug = require('debug')
var bitwise = require('bitwise')

inherits(Bitboot, EventEmitter)

function Bitboot (rallyName, opts) {
  if (!opts) opts = {}

  var self = this
  this.rallyName = rallyName
  this.rallyId = crypto.createHash('sha1').update(this.rallyName).digest()
  this.destroyed = false
  this.dht = null
  this._interval = null
  this.debug = debug('bitboot')

  EventEmitter.call(this)
  process.nextTick(bootstrap)
  this.debug('Using rally point ' + this.rallyName + ' (' + this.rallyId.toString('hex') + ')')

  function bootstrap () {
    if (self.destroyed) return

    var id = crypto.randomBytes(20)
    id[0] = self.rallyId[0]
    id[1] = self.rallyId[1]
    id[18] = self.rallyId[18]
    id[19] = self.rallyId[19]
    self.dht = self._createDHT(id, opts.bootstrap !== false)
  }
}

Bitboot.prototype.destroy = function (cb) {
  this.debug('destroying all connections')
  if (this.destroyed && cb) {
    process.nextTick(cb)
  } else if (!this.destroyed) {
    if (this._interval) clearInterval(this._interval)
    this.destroyed = true
    this.dht.destroy(cb)
  }
}

Bitboot.prototype._createDHT = function (id, bootstrap) {
  var dht = new DHT({id: id, bootstrap: bootstrap})
  var self = this
  var dmsg = 'Joining network with id ' + id.toString('hex') +
	' (distance to rally ' + KBucket.distance(id, this.rallyId) + ')'
  this.debug(dmsg)

  dht.on('error', onerror)
  dht.on('ready', onready)

  function onerror (err) {
    self.emit('error', err)
  }

  function onready () {
    self.emit('rejoin', dht.nodeId)
    if (!self._interval && bootstrap) {
      // first run, so search and set interval for future searches
      self.debug('Searching, and creating interval for future searches')
      search()
      self._interval = setInterval(search, 1000 * 60)
    }
  }

  function search () {
    self._search()
  }

  return dht
}

Bitboot.prototype._search = function () {
  // get all nodes close to the rally point
  this.debug('Searching for nodes near rally point')

  var self = this
  var query = {q: 'find_node', a: {id: this.dht.nodeId, target: this.rallyId}}
  this.dht._rpc.closest(this.rallyId, query, null, finished)

  function finished (err) {
    if (err) self.emit('error', err)
    else self._attemptCommunication()
  }
}

Bitboot.prototype._attemptCommunication = function () {
  if (this.dht.nodes.count() === 0) {
    this.emit('error', 'Could not connect to any nodes on the DHT.  Are you connected to the internet?')
    return
  }
  var closest = this.dht.nodes.closest(this.rallyId, 40)
  var peers = this._extractPeers(closest)
  var mydist = KBucket.distance(this.dht.nodeId, this.rallyId)
  var closestdist = KBucket.distance(closest[0].id, this.rallyId)

  // emit all peers found
  this.emit('peers', peers)

  if (mydist <= closestdist) {
    this.debug('We are already at the rally point. Keep hanging out.')
  } else if (peers.length === 0) {
    this.debug('No peers found, so it\'s up to us to hang out at the rally point')
    this.debug('The closest other node is ' + closest[0].id.toString('hex'))
    this._waddleCloser(closest)
  } else if (!peers[0].id.equals(closest[0].id) && mydist > closestdist) {
    this.debug('Peers exist but far away - it\'s up to us to go to the rally point')
    this._waddleCloser(closest)
  } else if (peers[0].id.equals(closest[0].id)) {
    this.debug('Another peer is already at the rally point - so we won\'t move.')
  }
}

Bitboot.prototype._waddleCloser = function (closest) {
  var self = this
  this.dht.destroy(restart)
  this.debug('Waddling closer to the rally point destroying old DHT connection')

  function restart () {
    self.debug('Old DHT connection destroyed')
    var id = self._twiddleMarch(closest[0].id)
    self.dht = self._createDHT(id, true)
    self.dht.on('ready', sayhi)
  }

  // make sure other close nodes know about us
  function sayhi () {
    self.debug('Saying hi to ' + closest.length + ' nodes so they know about us')
    for (var i = 0; i < closest.length; i++) {
      self.dht.addNode(closest[i])
    }
  }
}

Bitboot.prototype._extractPeers = function (nodes) {
  var peers = []
  for (var i = 0; i < nodes.length; i++) {
    var validid = nodes[i].id[18] === this.rallyId[18] && nodes[i].id[19] === this.rallyId[19]
    if (validid && !nodes[i].id.equals(this.dht.nodeId)) {
      peers.push(nodes[i])
    }
  }
  return peers
}

// This function moves an initial node id closer to the target node id
// until it beats the closest id.  It returns the new id as a buffer.
Bitboot.prototype._twiddleMarch = function (closest) {
  var xdistance = KBucket.distance(closest, this.rallyId)
  var targetBits = bitwise.readBuffer(this.rallyId)
  var resultBits = bitwise.readBuffer(this.dht.nodeId)
  var result = null
  var rdistance = null

  for (var leftIndex = 0; leftIndex < resultBits.length; leftIndex++) {
    // next line - start at length-17 because -1 is last position, then move two bytes (16 bits)
    // to the left since the last two bytes are already going to match the target
    for (var rightIndex = resultBits.length - 17; rightIndex >= leftIndex; rightIndex--) {
      if (resultBits[rightIndex] !== targetBits[rightIndex]) {
        resultBits[rightIndex] = targetBits[rightIndex]
        result = bitwise.createBuffer(resultBits)
        rdistance = KBucket.distance(result, this.rallyId)
        if (rdistance < xdistance) return result

        if (rightIndex !== leftIndex) {
          resultBits[rightIndex] = bitwise.not([resultBits[rightIndex]])[0]
          result = bitwise.createBuffer(resultBits)
        }
      }
    }
  }

  return result
}
