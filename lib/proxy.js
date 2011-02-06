var	Twitter = require('twitter'),
	utility = require('./utility'),
	shortUrl = require('shorturl'),
	unempty = utility.unempty;

var tweetbloat = [
	// strip thus-far unused geolocation data
	'geo',
	'place',
	'coordinates',
	// user-related, but delete these everywhere anyway
	'profile_link_color',
	'profile_sidebar_fill_color',
	'profile_sidebar_border_color',
	'profile_background_color',
	'profile_background_image_url',
	'profile_background_tile',
	'profile_text_color',
	'profile_use_background_image'
];

DenbyProxy = function(client, ripley) {
	if (!(this instanceof DenbyProxy)) return new DenbyProxy(client);

	// Send well-packed messages
	var send = function(message) {
		unempty(message, tweetbloat);
		client.send(message);
	};

	// CONFIGURATION, FIXME: hard coded, need to share with client
	var clientconfig = {DENBY: {CONFIG: {
		columns: [
			{
				id: 'home',
				header: 'Home'
			},
			{
				id: 'me',
				header: 'Me'
			},
			{	id: 'search',
				header: 'Search: nodejs, node.js, #denby, hellodenby, lca2011, linux.conf.au',
				search: 'nodejs,node.js,#denby,hellodenby,lca2011,linux.conf.au'
			}
		]
	}}};
	client.send(clientconfig); // yes, I wanted to client.send here

	// My Twitter REST client and related variables
	var twauth = ripley.twauth,
		user_id = twauth.user_id,
		screen_name = twauth.screen_name;

	var twitter = new Twitter({
			consumer_key: twauth.consumer_key,
			consumer_secret: twauth.consumer_secret,
			// access_token fallback for node-twitter cookies prior to v0.1.11
			access_token_key: twauth.access_token_key || twauth.access_token,
			access_token_secret: twauth.access_token_secret
		});
	twitter.shortUrl = shortUrl; // so jsonrpc can get to it...

	// Send account info with a fake user_update packet
	twitter.verifyCredentials(function(data) {
		send({
			event: 'user_update',
			source: data,
			target: data
		});
	});

	// Connect to the stream
	// FIXME: q'n'd user streams solution, without ripley for now
	//ripley.on('data', send);
	twitter.stream('user', {track:'nodejs,node.js,#denby,hellodenby,lca2011,linux.conf.au'},
		function(stream) {
console.log('USER STREAMING FOR ' + screen_name + ' (' + client.sessionId + ')!');
			stream.on('data', send);
		});

	// Messages from Denby
	// FIXME: at some point, factor this out into a "socket.rpc" project
	client.on('message', clientMessage);

	// Denby disco(nnected)!
	client.on('disconnect', function() {
		ripley.removeListener('message', clientMessage);
	});

	var banned = [ 'stream', 'cookie', 'login', 'gatekeeper', '_getUsingCursor' ];
	function clientMessage(message) {
		if ( message && message.jsonrpc && message.jsonrpc === '2.0' && message.method ) {
			var	rpc = {jsonrpc: '2.0', id: message.id || null};
//console.log('JSON-RPC packet received from ' + screen_name + ' ' + JSON.stringify(message, null, 2));
			if ( !(banned.indexOf(message.method) < 0 && twitter && message.method in twitter && typeof twitter[message.method] === 'function') ) {
				rpc.error = {
					code: -32601,
					message: "Procedure not found."
				};
			} else try {
				// ensure args is an array
				var args = message.params || [];
				if ( !Array.isArray(args) ) args = [args];
				// append callback to the arguments
				args.push(function(data) {
					if ( data instanceof Error ) {
						if ( 'stack' in data )
							delete data.stack;
						rpc.error = {
							code: -32000,
							message: data.message || "Server error.",
							data: data
						};
					} else {
						rpc.result = data;
					}
					send(rpc);
				});
				// call node-twitter api
				twitter[message.method].apply(twitter, args);
				return;
	
			} catch (error) {
				if ( 'stack' in error )
					delete error.stack;
				rpc.error = {
					code: -32000,
					message: error.message || "Server error.",
					data: error
				};
			}
			send(rpc);
	
		// Not JSON-RPC
		} else {
			console.log('PROXY: received ' + JSON.stringify(message, null, 2));
		}
	}
};
module.exports = DenbyProxy;
