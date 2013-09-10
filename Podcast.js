'use strict';

angular.module('rye').factory('Podcast', function(Episode) {
	function Podcast(title, id) {
		this.title = title;
		this.id = id;
		this.episodes = [];
	}
	
	Podcast.prototype = {
		get hasNewEpisodes() {
			return this.episodes.some(function(episode) {
				return episode.isNew;
			});
		}
	};
	
	Podcast.load = function(url) {
		var deferred = when.defer();
		
		var feed = new google.feeds.Feed(url);
		feed.setResultFormat(google.feeds.Feed.XML_FORMAT);
		feed.setNumEntries(20);
		feed.load(function(result) {
			var podcast = Podcast.fromXml(result.xmlDocument.querySelector('channel'), url);
			deferred.resolve(podcast);
		});
		
		return deferred.promise;
	};
	
	Podcast.fromXml = function(xml, url) {
		var podcast = new Podcast(xml.querySelector('title').textContent, url);
		
		Array.prototype.filter.call(xml.querySelectorAll('item'), function(item) {
			// Only return entries with an audio file; other entries are regular RSS items.
			return Boolean(item.querySelector('enclosure'));
		})
		.map(function(item) {
			var episode = new Episode();
			episode.id = item.querySelector('guid').textContent;
			episode.title = item.querySelector('title').textContent;
			episode.url = item.querySelector('enclosure').getAttribute('url');
			episode.description = item.querySelector('summary, subtitle', 'description').textContent;
			if ( item.querySelector('duration') ) {
				episode.duration = durationFromString(item.querySelector('duration').textContent);
			}
			episode.podcast = podcast;
			
			return episode;
		}).forEach(function(episode) {
			// The latest episode will be first in the list.
			podcast.episodes.push(episode);
		});
		
		return podcast;
	};
	
	function durationFromString(string) {
		// "2:34:56" -> [2, 34, 56]
		var numbers = string.split(':').map(Number);
		// [2, 34, 56] -> [56 * 60^0, 34 * 60^1, 2 * 60^2]
		var seconds = numbers.reverse().map(function(number, index) {
			return number * Math.pow(60, index);
		});
		var sum = seconds.reduce(function(a, b) {
			return a + b;
		});
		return sum;
	}
	
	return Podcast;
});