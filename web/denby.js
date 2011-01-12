;(function() {
	var // State
		config = {},
		account = {},
		friends = [],
		// Cache
		users = {},
		// Socket.io client
		socket = new io.Socket(null, {
			secure: (document.location.protocol == 'https:'),
			port: document.location.port
		}),
		// JSON-RPC client
		jsonrpc = new JSONRPC({
			socket: socket
		});


	/*
	 * SERVER MESSAGE STREAM
	 */
	socket.on('message', function(message) {
		// Our favourite messages are objects. Filter out the rest.
		if ( typeof message !== 'object' ) {
			console.log('UFO: ' + JSON.stringify(message,null,2));

		// JSON-RPC from server
		} else if ( 'jsonrpc' in message && message.jsonrpc === '2.0' ) {
			jsonrpc.receive(message);

		// Denby protocol messages, including configuration
		} else if ( 'DENBY' in message ) {
			if ( 'CONFIG' in message.DENBY ) {
				$.publish('/config', [message.DENBY.CONFIG]);
			} else {
				console.log('DENBY: ' + JSON.stringify(message.DENBY,null,2));
			}

		// Authentication failure handling
		} else if ( 'AUTHFAIL' in message ) {
			$.publish('/authfail', message.AUTHFAIL);
			socket.disconnect();

		// Everything else, including the user stream
		// FIXME: Should web be doing caching and since_id tracking HERE?
		} else {
			if ( 'friends' in message ) {
				friends = message.friends;
				console.log('FRIENDS: ' + friends.length);
			} else {
				$.publish('/twitter', [message]);
			}
		}
	});


	/*
	 * CLIENT PUBSUB EVENTS
	 */
	$.subscribe('/twitter/account', function(update) {
		if ( update && 'screen_name' in update ) {
			if ( update.status ) delete update.status;
			account = update;
		}
	});


	var Denby = {
		account: function() {
			return account;
		},
		isFriend: function(id) {
			return (friends.indexOf(id) >= 0);
		},
		connect: function(message) {
			socket.on('connect', function connectmessage() {
				if ( message ) socket.send(message);
				socket.removeEvent('connect', connectmessage);
			});
			socket.connect();
		},
		send: function() {
			jsonrpc.send.apply(jsonrpc, arguments);
		},
		version: '0.1.0'
	};

	return (window.Denby = Denby);
})();
