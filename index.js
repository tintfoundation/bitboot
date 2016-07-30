module.exports = Bitboot;

var EventEmitter = require('events');
var inherits = require('util').inherits;
var crypto = require('crypto');

var DHT = require('bittorrent-dht');
var KBucket = require('k-bucket');
var debug = require('debug');
var bitwise = require('bitwise');

inherits(Bitboot, EventEmitter);


function Bitboot(rallyName, opts) {
   if(!opts)
      opts = {};

   this.rallyName = rallyName;
   this.rallyId = sha1(this.rallyName);
   this.destroyed = false;
   this.dht = null;
   this._interval = null;
   this.debug = debug('bitboot');
   self = this;

   EventEmitter.call(this);
   process.nextTick(bootstrap);
   this.debug("Using rally point " + this.rallyName + " (" + this.rallyId.toString('hex') + ")");

   function bootstrap() {
      if(self.destroyed)
	 return;

      var id = crypto.randomBytes(20);
      id[18] = self.rallyId[18];
      id[19] = self.rallyId[19];
      self.dht = self._createDHT(id);
   }
}

Bitboot.prototype.destroy = function(cb) {
   this.debug('destroying all connections');
   if(this.destroyed && cb) {
      process.nextTick(cb);
   } else if(!this.destroyed) {
      if(this._interval)
	 clearInterval(this._interval);
      this.destroyed = true;
      this.dht.destroy(cb);
   }
};

Bitboot.prototype._createDHT = function(id) {
   var dht = new DHT({id: id});
   var self = this;

   this.debug("Attempting to join network with id " + id.toString('hex'));
   dht.on('error', onerror);
   dht.on('ready', onready);

   function onerror(err) {
      self.emit('error', err);
   }
   
   function onready() {
      self.emit('rejoin', dht.nodeId);
      if(!self._interval) {
	 // first run, so search and set interval for future searches
	 self.debug("Searching, and creating interval for future searches");
	 search();
	 self._interval = setInterval(search, 1000 * 60 * 3);
      }
   }

   function search() {
      self._search();
   }

   return dht;
}

Bitboot.prototype._search = function() {
   // get all nodes close to the rally point
   this.debug('Searching for nodes near rally point');

   var self = this;
   var query = {q: 'find_node', a: {id: this.dht.nodeId, target: this.rallyId}}
   this.dht._rpc.closest(this.rallyId, query, null, finished);

   function finished(err) {
      if(err)
	 self.emit('error', err);
      else
	 self._attemptCommunication();
   }
};

Bitboot.prototype._attemptCommunication = function() {
   var closest = this.dht.nodes.closest(this.rallyId, 40);
   var peers = this._extractPeers(closest);
   var mydist = KBucket.distance(this.dht.nodeId, this.rallyId);
   var closestdist = KBucket.distance(closest[0].id, this.rallyId);
   
   // emit all peers found
   self.emit('peers', peers);

   if(mydist <= closestdist) {
      this.debug("We're already at the rally point. Keep hanging out.");
   } else if(peers.length == 0) {
      this.debug("No peers found, so it's up to us to hang out at the rally point");
      this._waddleCloser(closest);
   } else if(!peers[0].id.equals(closest[0].id) && mydist > closestdist) {
      this.debug("Peers exist but far away - it's up to us to go to the rally point");
      this._waddleCloser(closest);
   } else if(peers[0].id.equals(closest[0].id)) {
      this.debug("Another peer is already at the rally point - so we won't move.");
   }
};

Bitboot.prototype._waddleCloser = function(closest) {
   var self = this;
   this.dht.destroy(restart);
   this.debug("Waddling closer to the rally point; destroying old DHT connection");
   
   function restart() {
      self.debug("Old DHT connection destroyed");
      var id = twiddle_march(self.rallyId, closest[0].id, self.dht.nodeId);
      self.dht = self._createDHT(id);
      self.dht.on('ready', sayhi)
   }

   // make sure other close nodes know about us
   function sayhi() {
      self.debug("Saying hi to " + closest.length + " nodes so they know about us");
      for(var i=0; i<closest.length; i++)
	 self.dht.addNode(closest[i]);
   }
};

Bitboot.prototype._extractPeers = function(nodes) {
   var peers = [];
   for(var i=0; i<nodes.length; i++) {
      var validid = nodes[i].id[18] == this.rallyId[18] && nodes[i].id[19] == this.rallyId[19];
      if(validid && !nodes[i].id.equals(this.dht.nodeId))
	 peers.push(nodes[i]);
   }
   return peers;
}

function sha1(s) {
   return crypto.createHash('sha1').update(s).digest();
}

function parseNodes(buf) {
   var contacts = [];
   try {
      for(var i=0; i<buf.length; i+=26)
	 contacts.push(buf.slice(i, i + 20));
   } catch (err) {}
   return contacts;
}

function twiddle_march(target, closest, initial) {
   // this is the distance we have to beat
   var xdistance = KBucket.distance(closest, target);
   var target_bits = bitwise.readBuffer(target);
   var result_bits = bitwise.readBuffer(initial);
   var result = null, rdistance = null;
   
   for(var left_index = 0; left_index < result_bits.length; left_index++) {
      // next line - start at length-3 because -1 is last position, then move two to the left
      // since the last two bytes are already going to match the target
      for(var right_index = result_bits.length - 3; right_index >= left_index; right_index--) {
	 if(result_bits[right_index] != target_bits[right_index]) {
	    result_bits[right_index] = target_bits[right_index];
	    result = bitwise.createBuffer(result_bits);
	    rdistance = KBucket.distance(result, target);
	    if(rdistance < xdistance) break;

	    if(right_index != left_index) {
	       result_bits[right_index] = bitwise.not([result_bits[right_index]])[0]
	       result = bitwise.createBuffer(result_bits);
	    }
	 }
      }
   }
   
   return result;
}
