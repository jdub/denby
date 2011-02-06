var	Twitter = require('twitter'),
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
twitter.options.secure = config.secure || false;
twitter.options.cookie_secret = config.secret || null;
twitter.options.cookie_options = {}; // httpOly fucks up flashsocket

// Ripley
var ripley = new Ripley(twitter, config);

// Web
module.exports = require('http').createServer(require('stack')(
	require('creationix/log')(),
	require('./lib/gzip-proc')(),
	twitter.login(),
	require('creationix/static')('/static', __dirname + '/static'),
	twitter.gatekeeper(),
	require('creationix/static')('/', __dirname + '/static', 'index.html')
));

// Socket.io
require('socket.io').listen(module.exports).on('connection', function(client) {
	// Gatekeeper for Socket.io connections
	var twauth = twitter.cookie(client.request);
//console.log('SOCKET.IO HEADERS: ' + require('util').inspect(client.request && client.request.headers));

	// Success! Probably a valid cookie
	if ( twauth && twauth.user_id && twauth.access_token_secret ) {
		// Deliberately kill off non-alphas
		if ( config.alphas && config.alphas.indexOf(twauth.screen_name.toLowerCase()) < 0 ) {
			console.log('DUMPED NON-ALPHA ' + twauth.screen_name + '!');
			client.send({AUTHFAIL: "Currently closed for alpha testing. Disconnecting."});
			setTimeout(function() {
				if ( client.request ) client.request.connection.end();
			}, 1000);
			return;
		}
		console.log('HELLO ' + twauth.screen_name + '!');
		var ripper = ripley.register(twauth);
		new Proxy(client, ripper);

	// Fail! Computer says no. Client might fall back to other socket.io transports.
	} else {
		console.log('DUMPED ' + (twauth && twauth.screen_name || 'unauthenticated user') + '!');
		client.send({AUTHFAIL: "Authentication failure. Disconnecting."});
		setTimeout(function() {
			if ( client.request ) client.request.connection.end();
		}, 1000);
	}
});
