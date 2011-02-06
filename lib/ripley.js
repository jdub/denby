var Twitter = require('twitter'),
	EventEmitter = require('events').EventEmitter,
	util = require('util'),
	inspect = util.inspect;


function Ripley(twitter, config) {
	this.twitter = twitter;
	this.config = config;
	this.users = {};

//console.log(inspect(this));

	/*if ( config.sitestreams === true ) {
		// FIXME: bring up the sitestreams
	}*/
};
module.exports = Ripley;

Ripley.prototype.register = function(twauth) {
	// Save their details
	this.users[twauth.user_id] = twauth;
	// Give them enough info for their own Twitter API client
	twauth.consumer_key = this.twitter.options.consumer_key;
	twauth.consumer_secret = this.twitter.options.consumer_secret;
	return new RipleyClient(this, twauth);
}


function RipleyClient(ripley, twauth) {
	EventEmitter.call(this);
	this.twauth = twauth;

	this.on('newListener', function(event, listener) {
		console.log('CONNECT A STREAM for ' + twauth.screen_name);
		//listener.call(this, 'GREETINGS ' + event + ', YOU ARE CONNECTED');
	});
}
util.inherits(RipleyClient, EventEmitter);
