var	http = require('http'),
	urlparse = require('url').parse,
	querystring = require('querystring');

module.exports.unempty =
function unempty(o, deleteKeys) {
	if ( Array.isArray(o) || typeof o == 'object' ) {
		for ( key in o ) {
			if ( deleteKeys && deleteKeys.indexOf(key) >= 0 ) {
				delete o[key];
				continue;
			}
			// only recursively unempty arrays and objects
			if ( Array.isArray(o[key]) || typeof o[key] == 'object' )
				o[key] = unempty(o[key], deleteKeys);
			// If it's falsy (but not 0), or an empty object/array, delete it
			if (
				o[key] === null || o[key] === false || o[key] === ''
				|| ( Array.isArray(o[key]) && o[key].length === 0 )
				|| ( typeof o[key] === 'object' && Object.keys(o[key]).length === 0 )
			) {
				delete o[key];
			}
		}
	}
	return o;
}

module.exports.shortUrl =
function shortUrl(longurl, shorter, params, callback) {
	if ( typeof params === 'function' ) {
		callback = params;
		params = null;
	}
	if ( typeof shorter === 'function' ) {
		callback = shorter;
		params = null;
		shorter = 'arseh.at';
	} else if ( typeof shorter === 'object' ) {
		params = shorter;
		shorter = 'arseh.at';
	}
	if ( typeof callback === 'function' && shorter in urlShorters )
		urlShorters[shorter](longurl, params, callback);
}

// FIXME: create a simple shorturl processor that takes a string
//        eg. http://is.gd/api.php?longurl=%s

var urlShorters = {
	'is.gd': function(url, params, callback) {
		if ( typeof params === 'function' ) {
			callback = params;
			params = null;
		}
		get('http://is.gd/api.php', {
			longurl: url
		}, function(data) {
			if ( data.substr(0, 13) === 'http://is.gd/' )
				callback(data);
			else
				callback();
		});
	},

	'bit.ly': function(url, params, callback) {
		if ( typeof params === 'function' ) {
			callback = params;
			params = null;
		}
		get('http://api.bit.ly/v3/shorten', {
			login: params.login || null,
			apiKey: params.apiKey || null,
			longUrl: url,
			format: 'json'
		}, function(data) {
			try {
				var json = JSON.parse(data);
				if ( json.data && json.data.url )
					callback(json.data.url, json);
			} catch(error) {
				callback();
			}
		});
	},

	'arseh.at': function(url, params, callback) {
		if ( typeof params === 'function' ) {
			callback = params;
			params = null;
		}
		get('http://arseh.at/api.php', {
			action: 'shorturl',
			format: 'simple',
			url: url
		}, function(data) {
			callback(data);
		});
	}
};

function get(uri, params, callback) {
	if ( typeof params === 'function' ) {
		callback = params;
		params = null;
	}
	var uri = urlparse(uri),
		port = (uri.protocol == 'https:') ? 443 : 80,
		host = uri.host,
		path = uri.pathname, // FIXME: ignoring uri.search
		request = http.createClient(port, host).request(
		'GET', path + '?' + querystring.stringify(params),
		{ 'Host': host, 'User-Agent': 'Denby' });
	request.end();
	request.on('response', function(response) {
		if ( response.statusCode !== 200 ) {
			callback(new Error({
				message: response.statusCode,
				data: response
			}));
			return;
		}
		response.setEncoding('utf8');
		response.on('data', function(chunk) {
			callback(chunk, response);
		});
	});
}
