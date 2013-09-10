'use strict';

angular.module('rye').factory('Library', function(Podcast, Episode) {
	function Library() {
		this.podcasts = [];
	}
	
	Library.prototype = {
		get episodes() {
			var library = this;
			var episodes = {};
			
			library.podcasts.forEach(function(podcast) {
				podcast.episodes.forEach(function(episode) {
					episodes[episode.id] = episode;
				});
			});
			
			return episodes;
		},
		save: function(config) {
			var library = this;
			
			library.podcasts.forEach(function(podcast) {
				podcast.episodes.forEach(function(episode) {
					config.times[episode.id] = episode.currentTime;
				});
			});
		}
	};
	
	return Library;
});