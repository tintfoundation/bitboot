var Bitboot = require('./');

var bb = new Bitboot('tint');
bb.debug.enabled = true;

bb.on('rejoin', function(node_id) {
	 console.log("I have a new node id:", node_id.toString('hex'));
      });

bb.on('peers', function(ips) {
	 console.log("I found peers:", ips);
      });

bb.on('error', function(err) {
	 console.error(err);
      });
