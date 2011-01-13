// dirty-fucking-global due to template use below
function simpleTime(d) {
	var	s = new Date(d),
		h = s.getHours(),
		m = s.getMinutes();
	if ( h < 10 ) h = '0' + h;
	if ( m < 10 ) m = '0' + m;
	return h + ':' + m;
}

;(function(){

/*
 * TEMPLATES
 */

$.extend(jQuery.tmpl.tag, {
	time: {
		open: 'if($notnull_1){_.push(simpleTime($1a));}'
	},
	timestamp: {
		open: 'if($notnull_1){_.push(Date.parse($1a));}'
	},
	linkify: {
		open: 'if($notnull_1){_.push(twttr.txt.autoLink($1a));}'
	}
});

$('script[type=text/x-jquery-tmpl]').each(function(i, obj) {
	$(obj).template(obj.id.replace(/^tmpl-/, ''));
});


/*
 * CACHED COMMON DOM QUERIES
 */

var	$window = $(window),
	$dbybody = $('#dbybody'),
	$dbycols = $('#dbycols'),
	$dbyinfo = $('#dbyinfo'),
	$twitbox = $('#status-update'),
	$status = $('#status'),
	$chars = $('#chars'),
	$tweet = $('#tweet'),
	$replyto = $('#replyto'),
	$dbytbar = $('#dbytbar');

var regex = {
	dm: /^\s*dm?\s+@?(\S*)\s+(.*)/i,
	twimg: /^http:\/\/a(\d+.twimg.com\/.*)/i,
	longurl: /^https?:\/\/(?!t.co|is.gd|tinyurl.com|goo.gl|bit.ly|j.mp|ow.ly|youtu.be|awe.sm|arseh.at)/
};


/*
 * INITIALISATION
 */
$tweet.button().button('disable');

$dbytbar.find('span').buttonset();
$dbytbar.find('.reply').button({icons:{primary:'ui-icon-arrowreturnthick-1-w'}}); // scrawny
$dbytbar.find('.retweet').button({icons:{primary:'ui-icon-transferthick-e-w'}}); // refresh=thin
//$dbytbar.find('.quote').button({icons:{primary:'ui-icon-comment'}}); // no icon or RT: icon?
$dbytbar.find('.favorite').button({icons:{primary:'ui-icon-heart'}});
$dbytbar.find('.unfavorite').button({icons:{primary:'ui-icon-heart'}}); // heart outline?
$dbytbar.find('.delete').button({icons:{primary:'ui-icon-close'}});
$dbytbar.find('.follow').button({icons:{primary:'ui-icon-circle-plus'}});
$dbytbar.find('.unfollow').button({icons:{primary:'ui-icon-circle-minus'}});
$dbytbar.find('.block').button({icons:{primary:'ui-icon-circle-close'}});
$dbytbar.find('.spam').button({icons:{primary:'ui-icon-flag'}}); // or ui-icon-alert?


/*
 * DENBY/TWITTER PUBSUB HANDLERS
 */

$.subscribe('/authfail', function(error) {
	// FIXME: show a more useful error, with actions
	$dbybody
		.css({background:'#fff'});
	$dbycols
		.empty()
		.css({
			width: '100%',
			'text-align': 'center'
		})
		.append($('<h1/>', {text: error}));
});

$.subscribe('/config', function(config) {
	console.log('CONFIG: ' + JSON.stringify(config, null, 2));

	// Create columns from scratch
	var current = $dbycols.find('.denby-column');
	if ( current.length === 0 ) {
		$dbycols.empty().sortable({
			axis: 'x',
			cursor: 'move',
			distance: 30,
			handle: 'h3',
			items: '.denby-column',
			opacity: 0.6,
			tolerance: 'pointer'
		});
		for ( var i = 0, l = config.columns.length; i < l; i++ ) {
			$.tmpl('column', config.columns[i])
				.hide().appendTo($dbycols);
		}
		$dbycols.find('.ui-widget-header').disableSelection();
		$dbycols.find('.denby-column').fadeIn('fast');
		$.publish('/denby/columns/change');
	}
	$twitbox.fadeIn('fast');
});

$.subscribe('/twitter', function(message) {
	var column = false,
		template = 'tweet',
		mine = false;

	// Tweet or Retweet
	if ( 'text' in message ) {
		if ( 'retweeted_status' in message ) {
			template = 'retweet';
		}
		// If it's me, update my account details
		// FIXME: update Denby variable, or handle this there?
		if ( message.user.id === Denby.account().id ) {
			mine = true;
			$.publish('/twitter/account', [message.user]);
		}
		// FIXME: crazy-basic routing
		if ( !mine && message.text.search('@' + Denby.account().screen_name) >= 0 ) {
			column = '#me';
		} else if ( mine || Denby.isFriend(message.user.id) ) {
			column = '#home';
		} else {
			column = '#search';
		}
		$.publish('/twitter/display', [message, column, template]);

	// Direct Message
	} else if ( 'direct_message' in message ) {
		$.publish('/twitter/display', [message, '#me', 'direct', message.direct_message]);

	// Delete
	} else if ( 'delete' in message ) {
		var delmsg = message['delete'],
			delobj = null;
		if ( 'status' in delmsg ) {
			delobj = $('.id' + delmsg.status.id_str);
		} else if ( 'direct_message' in delmsg ) {
			delobj = $('.dm' + delmsg.direct_message.id); // no id_str for DMs yet
		} else {
			console.log('UNHANDLED DELETE: ' + JSON.stringify(delmsg, null, 2));
		}
		delobj && delobj.fadeOut('fast', function(){$(this).remove()});

	// Event
	} else if ( 'event' in message ) {
		switch ( message.event ) {
			case 'follow':
				if ( message.source.id !== Denby.account().id )
					console.log('FOLLOWED BY: ' + message.source.screen_name);
				else
					console.log('FOLLOWING: ' + message.target.screen_name);
				break;

			case 'unfollow':
				if ( message.source.id !== Denby.account().id )
					console.log('UNFOLLOWED BY: ' + message.source.screen_name);
				else
					console.log('UNFOLLOWING: ' + message.target.screen_name);
				break;

			case 'favorite':
				if ( message.target.id === Denby.account().id || message.source.id === Denby.account().id )
					column = '#me';
				else
					column = '#home';
				$.publish('/twitter/display', [message, column, 'favorite']);
				break;

			case 'unfavorite':
				// Only act when my own tweets are unfavorited
				$('.favorite.me.id' + message.target_object.id_str)
					.fadeOut('fast', function(){$(this).remove()});
				break;

			case 'block':
				$('.uid' + message.target.id_str)
					.fadeOut('fast', function(){$(this).remove()});
				break;

			case 'unblock':
				// Is there anything to do here?
				break;

			case 'user_update':
				var dash = $.tmpl('dashstats', message.source).hide(),
					photo = dash.find('img.photo'),
					imgsrc = photo.attr('src');

				photo.attr('src', imgsrc.replace(regex.twimg, 'https://si$1'));
				dash.find('a').attr('target', '_blank');

				$dbyinfo.empty().append(dash.fadeIn('fast'));
				$.publish('/twitter/account', [message.source]);
				break;

			default:
				console.log('UNHANDLED EVENT: ' + JSON.stringify(message, null, 2));
		}

	// No handler for this strange beast... debug spew time
	} else {
		console.log('UNHANDLED: ' + JSON.stringify(message, null, 2));
	}
});

$.subscribe('/twitter/display', function(message, column, template, content) {
	template = template || 'tweet';
	column = column || '#home';
	content = content || message;

	var $column = $(column),
		scrollTop = $column.scrollTop(),
		tweet = $.tmpl(template, content),
		uid = (message.retweeted_status && message.retweeted_status.user.id)
			|| (message.target_object && message.target_object.user.id)
			|| (message.direct_message && message.direct_message.sender_id)
			|| (message.user && message.user.id) || null,
		classes = [];
	
	if ( uid === Denby.account().id )
		classes.push('me');
	else if ( Denby.isFriend(uid) )
		classes.push('friend');

	if ( (message.in_reply_to_status_id)
		|| (message.retweeted_status && message.retweeted_status.in_reply_to_status_id)
		|| (message.target_object && message.target_object.in_reply_to_status_id)
	) classes.push('reply');

	if ( (message.user && 'protected' in message.user)
		|| (message.retweeted_status && 'protected' in message.retweeted_status.user)
		|| (message.target_object && 'protected' in message.target_object.user)
	) classes.push('protected');

	tweet.hide()
		.addClass(classes.join(' '))
		.data('json', message)
		.find('a').attr('target', '_blank');

	// fix twitter image scheme when we're on https
	if ( document.location.protocol === 'https:' ) {
		tweet.find('img').each(function(i, o) {
			var src = $(o).attr('src'),
				newsrc = src.replace(regex.twimg, 'https://si$1');
			if ( src !== newsrc )
				$(o).attr('src', newsrc);
		});
	}

	$column.prepend(tweet.fadeIn('slow'));

	if ( scrollTop !== 0 || $column.find('.hover').length > 0 ) {
		$column.scrollTop(scrollTop + tweet.outerHeight());
		if ( uid !== Denby.account().id )
			tweet.toggleClass('unseen', true);
	}
});


/*
 * USER INTERFACE EVENTS
 */

$window
	.resize(function(event) {
		var height = $dbybody.height()
			- $dbycols.find('.ui-widget-header').height()
			- 16; // FIXME: magic number for scrollbar height
		$dbycols.find('.ui-widget-content').each(function() {
			$(this).height(height);
		});
	})
	.mousedown(function(event) {
		$.publish('/denby/twitbox/contract');
	});

// Twitbox and friends
$twitbox
	.live('click', function(event) {
		$.publish('/denby/twitbox/expand');
		return false;
	});

$.subscribe('/denby/twitbox/expand', function() {
	$twitbox.toggleClass('expanded', true);
	$status.change().focus();
});

$.subscribe('/denby/twitbox/contract', function() {
	$twitbox.toggleClass('expanded', false);
	$tweet.button('disable');
	$status.blur();
});

$.subscribe('/denby/twitbox/clear', function() {
	$tweet.button('disable');
	$status.val('').removeAttr('disabled');
	$replyto.val('');
	$chars.text(140).toggleClass('warning toomany', false)
});

$status
	.live('focusin', function(event) {
		$.publish('/denby/twitbox/expand');
		//return false;
	})
	.live('paste', function(event) {
		var orig = $status.val(),
			start = $status[0].selectionStart,
			end = $status[0].selectionEnd;

		// We could use clipboardData, but this should work everywhere...
		setTimeout(function() {
			var text = $status.val(), // post-paste content
				ahead = orig.substr(0, start), // ahead of the selection
				behind = orig.substr(end), // behind the selection
				// pasted content, start to difference of ends, plus selection length
				pasted = text.substr(start, text.length - orig.length + (end - start));

			// DEBUG below
			/*console.log(['PASTE!',
				'WAS: "' + orig + '"', 'NOW: "' + text + '"',
				'PASTED: "' + pasted + '"',
				'SELECTION: ' + start + ', ' + end,
				'REPLACED: "' + ahead + 'replace' + behind + '"'
			].join('\n'));*/
			// DEBUG above

			// Skip short pastes or non-URLs (plus avoid common shorturls)
			if ( pasted.length < 20 || pasted.match(regex.longurl) === null ) return;

			// Prepare for safe replacement
			$status.attr('disabled', 'disabled');
			$status[0].selectionStart = start;
			$status[0].selectionEnd = start + pasted.length;

			Denby.send('shortUrl', pasted, function(replace) {
				var length = pasted.length;
				if ( typeof replace === 'string' && replace.length > 0 ) {
					$status.val(ahead + replace + behind);
					length = replace.length;
				}
				$status[0].selectionStart = $status[0].selectionEnd = start + length;
				$status.removeAttr('disabled');
			});
		}, 0);
	})
	.live('keyup change', function(event) {
		var text = $status.val();

		// Esc to clear
		if ( event.keyCode === 27 ) { // FIXME: use event.which?
			$.publish('/denby/twitbox/clear');
			if ( text.length === 0 ) {
				$.publish('/denby/twitbox/contract');
			}
			return;
		}

		// Manually cleared
		if ( text.length === 0 ) {
			$.publish('/denby/twitbox/clear');
			return;
		}

		// Ctrl+Enter to tweet
		if ( event.ctrlKey && event.keyCode == 13 ) {
			//$status.blur(); // FIXME: do we really need this and below?
			$tweet.click();
			return;

		// Ctrl's keyup, which we want to ignore (see status blur above, too)
		} else if ( event.ctrlKey && event.keyCode == 17 ) {
			return;
		}

		// We're not empty or doing other things, so let the counting begin!
		$tweet.button('enable');

		// if the first character is not an @, we're not replying anymore
		// FIXME: this means we're emptying replyto on almost every keyup!
		// FIXME: this is cheap. we actually care about ANY damage to the
		//        first @mention... check @->SPC or store the nick?
		if ( text[0] !== '@' ) $replyto.val('');

		// Is this a DM? What's our limit, if not 140?
		// 140 plus length of full match, minus length of text is
		// equivalent to 140 + 'd nick ' or 140 + 'dm @nick ' :-)
		var dm = text.match(regex.dm),
			limit = dm ? (140 + dm[0].length - dm[2].length) : 140;

		// Character counter
		$chars.text(limit - text.length);
		// FIXME: Denby.account().screen_name.length should be cached somewhere
		// FIXME: choose better colours or better yet, use classes
		if ( text.length <= (limit - 6 - Denby.account().screen_name.length) ) {
			$chars.toggleClass('warning toomany', false);
		} else if ( text.length <= limit ) {
			$chars.addClass('warning').removeClass('toomany');
		} else {
			$chars.addClass('toomany').removeClass('warning');
		}
	});

// FIXME: should this be a pubsub event which Denby watches?
$tweet.live('click', function(event) {
	var text = $status.val(),
		dm = text.match(regex.dm),
		replyto = $replyto.val() || null,
		method = 'updateStatus',
		params = null;
	
	if ( dm && dm.length === 3 ) {
		method = 'sendDirectMessage';
		text = dm[1]; // matched DM recipient
		params = dm[2]; // matched DM text
	} else if ( replyto ) {
		params = {
			in_reply_to_status_id: replyto
		};
	}

	$status.attr('disabled', 'disabled');
	$tweet.button('disable');

	// FIXME: add timeout in case there's no response, feedback, etc.
	Denby.send(method, text, params, function(result) {
		// FIXME: do something useful on failure
		if ( !('text' in result) ) {
			alert('FAILED ' + method + ': ' + JSON.stringify(result, null, 2));
			return; // don't reset the twitbox
		}

		$.publish('/denby/twitbox/clear');
		$.publish('/denby/twitbox/contract');
	});
	return false;
});

// Columns
$.subscribe('/denby/columns/change', function() {
	var columns = $dbycols.find('.denby-column');
	$dbycols.width(columns.outerWidth(true) * columns.size());
	$window.resize();
});

// Column buttons
$dbycols.find('.denby-column-read').live('click', function(event) {
	$(this).closest('.denby-column').find('.status')
		.toggleClass('read', true)
		.toggleClass('unseen', false);
	return false;
});

$dbycols.find('.denby-column-clear').live('click', function(event) {
	$dbytbar.hide().appendTo($dbybody);
	$(this).closest('.denby-column').find('.read')
		.fadeOut(100, function(){$(this).remove()});
	return false;
});

$dbycols.find('.denby-column-close').live('click', function(event) {
	$dbytbar.hide().appendTo($dbybody);
	$(this).closest('.denby-column').remove();
	$.publish('/denby/columns/change');
	return false;
});

// Tweet lists and statuses
$('.tweetlist').live('scroll', function(event) {
	console.log(event);
});

$('.status')
	.live('click', function(event) {
		$(this).toggleClass('read', true).toggleClass('unseen', false);
		$dbytbar.prependTo($(this)).slideDown(100);
	})
	.live('mouseenter', function(event) {
		$(this).toggleClass('hover', true).toggleClass('unseen', false);
	})
	.live('mouseleave', function(event) {
		$(this).toggleClass('hover', false);
		$dbytbar.hide().appendTo($dbybody);
	})

// Click on permalink (published)
$('.status').find('.published').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json');

	// replyto, open a conversation column
	if ( tweet.in_reply_to_status_id_str && tweet.id_str ) {
		column = $.tmpl('column', {
			id: 'related' + tweet.id_str,
			header: 'Conversation',
			remove: true
		}).hide().insertAfter($(this).closest('.denby-column'));
		$.publish('/denby/columns/change');
		column.fadeIn('slow');
		// FIXME: if not visible, #dbybody.scrollLeft so it is visible at far right

		// FIXME: insert info box first, based on local or remote info
		Denby.send('get', '/related_results/show/' + escape(tweet.id_str) + '.json',
		function(result) {
			// munge returned data to get a list of tweets
			result = result.filter(function(e, i, a) {
				return e.groupName && e.groupName === 'TweetsWithConversation';
			});
			if ( result.length === 0 ) return;
			result = result[0].results.map(function(o) {
				return o.value;
			});
			if ( result.length === 0 ) return;
			// insert in reverse
			for ( var i = result.length - 1; i >= 0; i-- ) {
				var message = result[i],
					column = '#related' + tweet.id_str,
					template = ('retweeted_status' in message) ? 'retweet' : 'tweet';
				$.publish('/twitter/display', [message, column, template]);
			}
		});
		return false; // don't bubble my click if we showed column

	// not a reply, just show an individual tweet info box
	} else if ( tweet.id_str ) {
		return;
	}
});

// Click on a user name: @jdub
$('.status').find('.username').live('click', function(event) {
	var screen_name = $(this).attr('data-screen-name'),
		column = null;

	if ( screen_name ) {
		column = $.tmpl('column', {
			id: screen_name,
			header: screen_name, // FIXME: update with real name
			remove: true
		}).hide().insertAfter($(this).closest('.denby-column'));
		$.publish('/denby/columns/change');
		column.fadeIn('slow');
		// FIXME: if not visible, #dbybody.scrollLeft so it is visible at far right

		// FIXME: insert profile box first, based on local or remote info
		Denby.send('getUserTimeline', {
			screen_name: screen_name,
			count: 10,
			include_rts: 1
		}, function(result) {
			// insert in reverse
			for ( var i = result.length - 1; i >= 0; i-- ) {
				var message = result[i],
					column = '#' + screen_name,
					template = ('retweeted_status' in message) ? 'retweet' : 'tweet';
				$.publish('/twitter/display', [message, column, template]);
			}
		});
		return false; // don't bubble my click if we showed profile
	}
});

// Click on a list name: @hellodenby/alphas
$('.status').find('.list-slug').live('click', function(event) {
	var list_name = $(this).text(),
		list_name_id = list_name.replace('/', '_'),
		list_bits = list_name.split('/'),
		screen_name = list_bits[0],
		list_id = list_bits[1],
		column = null;

	if ( list_name ) {
		column = $.tmpl('column', {
			id: list_name_id,
			header: 'List: @' + list_name,
			remove: true
		}).hide().insertAfter($(this).closest('.denby-column'));
		$.publish('/denby/columns/change');
		column.fadeIn('slow');
		// FIXME: if not visible, #dbybody.scrollLeft so it is visible at far right

		// FIXME: insert info box first, based on local or remote info
		Denby.send('getListTimeline', screen_name, list_id, {
			include_rts: 1,
			per_page: 10
		}, function(result) {
			// insert in reverse
			for ( var i = result.length - 1; i >= 0; i-- ) {
				var message = result[i],
					column = '#' + list_name_id,
					template = ('retweeted_status' in message) ? 'retweet' : 'tweet';
				$.publish('/twitter/display', [message, column, template]);
			}
		});
		return false; // don't bubble my click if we showed profile
	}
});

// Per-tweet action buttons
// FIXME: instead of getting data-json all the time, should we add some
//        other data entries for, say, tweet id, etc? faster? though if
//        we do that in the template, it's yet more DOM muck...
// FIXME: all of these need better feedback, in-place changes where it
//        makes sense (retweet/favorite for instance)

$dbytbar.find('.reply').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json'),
		reply = null, select = null, replyto = null;
	
	// Direct message?
	if ( 'direct_message' in tweet ) {
		reply = 'd ' + tweet.direct_message.sender_screen_name + ' ';

	// Otherwise...
	} else {
		var retweet = tweet.retweeted_status || null,
			text = (retweet && retweet.text) || tweet.text,
			replyto = (retweet && retweet.id_str) || tweet.id_str,
			mentions = twttr.txt.extractMentions(text) || [],
			hashtags = twttr.txt.extractHashtags(text) || [];

		// if the originator isn't mentioned, put them at front
		if ( mentions.indexOf(tweet.user.screen_name) < 0 )
			mentions.unshift(tweet.user.screen_name);

		// if the retweet originator isn't mentioned, put them at front
		if ( retweet && mentions.indexOf(retweet.user.screen_name) < 0 )
			mentions.unshift(retweet.user.screen_name);

		// Don't mention myself, unless I'm first (0)
		var myself = mentions.indexOf(Denby.account().screen_name);
		if ( myself > 0 ) mentions.splice(myself, 1);

		// Remove duplicate mentions, algorithm: http://goo.gl/Co2vi
		var o = {}, r = [];
		for ( var i = 0, l = mentions.length; i < l; i++ )
			o[mentions[i]] = mentions[i];
		for ( i in o )
			r.push(o[i]);
		mentions = r;

		reply = '@' + mentions.join(' @') + ' ';
		// first nick length + '@ '.length (do we -1 for 0 based selection?)
		select = [mentions[0].length + 2, reply.length];

		// Add hashtags to the reply, too!
		if ( hashtags.length > 0 )
			reply += ' #' + hashtags.join(' #');
	}

	$dbytbar.hide().appendTo($dbybody);
	li.toggleClass('hover', false);

	$status.val(reply);
	$replyto.val(replyto);

	if ( select !== null ) {
		$status[0].selectionStart = select[0];
		$status[0].selectionEnd = select[1];
	} else {
		$status[0].selectionStart = $status[0].selectionEnd = reply.length;
	}

	$.publish('/denby/twitbox/expand');

	return false; // don't bubble my click
});

$dbytbar.find('.retweet').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json');

	$dbytbar.hide().appendTo($dbybody);
	li.toggleClass('hover', false);

	Denby.send('retweetStatus', tweet.id_str, function(result) {
		if ( !('text' in result) )
			alert('FAILED retweetStatus: ' + JSON.stringify(result, null, 2));
	});

	return false; // don't bubble my click
});

$dbytbar.find('.quote').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json'),
		// FIXME: simpler API for fetching most relevant uid/name/text/etc?
		retweet = tweet.retweeted_status || null,
		text = (retweet && retweet.text) || tweet.text,
		quoting = (retweet && retweet.user.screen_name) || tweet.user.screen_name,
		quote = 'RT @' + quoting + ': ' + text;

	$dbytbar.hide().appendTo($dbybody);
	li.toggleClass('hover', false);

	$status.val(quote);
	$status[0].selectionStart = $status[0].selectionEnd = 0;
	$.publish('/denby/twitbox/expand');

	return false; // don't bubble my click
});

$dbytbar.find('.favorite').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json');

	$dbytbar.hide().appendTo($dbybody);
	li.toggleClass('hover', false);

	if ( 'id_str' in tweet ) Denby.send('favoriteStatus', tweet.id_str, function(result) {
		if ( !('text' in result) )
			alert('FAILED favoriteStatus: ' + JSON.stringify(result, null, 2));
	});

	return false; // don't bubble my click
});

$dbytbar.find('.unfavorite').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json');

	$dbytbar.hide().appendTo($dbybody);
	li.toggleClass('hover', false);

	if ( 'id_str' in tweet ) Denby.send('destroyFavorite', tweet.id_str, function(result) {
		if ( !('text' in result) )
			alert('FAILED destroyFavorite: ' + JSON.stringify(result, null, 2));
	});

	return false; // don't bubble my click
});

$dbytbar.find('.delete').live('click', function(event) {
	var li = $(this).closest('.status'), tweet = li.data('json'),
		method = null, id = null;
	
	if ( 'direct_message' in tweet ) {
		method = 'destroyDirectMessage';
		id = tweet.direct_message.id_str;
	} else if ( 'id_str' in tweet ) {
		method = 'destroyStatus';
		id = tweet.id_str;
	}

	if ( method ) Denby.send(method, id, function(result) {
		if ( !('text' in result) )
			alert('FAILED ' + method + ': ' + JSON.stringify(result, null, 2));
	});

	return false; // don't bubble my click
});

})();
