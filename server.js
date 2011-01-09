var	Twitter = require('/home/jdub/src/node/node-twitter'),
	Ripley = require('./lib/ripley'),
	Proxy = require('./lib/proxy'),
	conffile = null, config = null;


// Configuration
if ( process.sparkEnv && process.sparkEnv.name )
	var conffile = __dirname + '/config/' + process.sparkEnv.name + '.js';
try {
	config = require(conffile);
} catch (error) {
	console.error('Could not import ' + conffile + '!');
	process.exit(1);
}

// Twitter (client for Routes and Ripley)
var twitter = Twitter(config.twitter || null);
twitter.options.cookie_secret = config.secret || null;

// Ripley
var ripley = new Ripley(twitter, config.sitestreams || false);

// Web
var fs = require('fs');
module.exports = require('http').createServer(require('stack')(
	require('creationix/log')(),
	require('./lib/gzip-proc')(),
	twitter.login('/twauth'),
	require('creationix/static')('/static', __dirname + '/static'),
	twitter.gatekeeper(),
	require('creationix/static')('/', __dirname + '/static', 'index.html')
));

// Socket.io
require('socket.io').listen(module.exports).on('connection', function(client) {
	// Gatekeeper for Socket.io connections
	var twauth = twitter.cookie(client.request);

	// Success! Probably a valid cookie
	if ( twauth && twauth.user_id && twauth.access_token_secret ) {
		var ripper = ripley.register(twauth);
		new Proxy(client, ripper);

	// Fail! Computer says no.
	} else {
		client.send({AUTHFAIL: "Authentication failure. Disconnecting."});
		setTimeout(function() {
			client.request.connection.end();
		}, 1000);
	}
});
