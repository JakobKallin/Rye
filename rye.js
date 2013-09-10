'use strict';

angular
.module('rye', [])
.controller('Controller', function($scope, Library, Podcast, storage) {
	var library = new Library();
	google.setOnLoadCallback(function() {
		storage.modify(function(config) {
			when.all(config.podcasts.map(Podcast.load)).then(function(podcasts) {
				podcasts.forEach(function(podcast) {
					library.podcasts.push(podcast);
					podcast.episodes.forEach(function(episode) {
						if ( episode.id in config.times ) {
							episode.currentTime = config.times[episode.id];
						}
					});
				});
				library.podcasts.sort(function(a, b) {
					return a.title.localeCompare(b.title);
				});
				
				$scope.$apply(function() {
					if ( config.selected ) {
						var episode = library.episodes[config.selected];
						$scope.selectPodcast(episode.podcast);
						$scope.selectEpisode(episode);
					} else {
						$scope.selectPodcast(library.podcasts[0]);
					}
				});
			})
			.otherwise(function(error) {
				alert('There was an error loading your podcasts:\n\n' + error.message);
			});
		});
	});
	
	window.addEventListener('beforeunload', function() {
		storage.modify(function(config) {
			library.save(config);
			if ( $scope.selected.episode ) {
				config.selected = $scope.selected.episode.id;
			}
		});
	});
	
	$scope.library = library;
	$scope.selected = {
		podcast: null,
		episode: null
	};
	
	$scope.selectPodcast = function(podcast) {
		$scope.selected.podcast = podcast;
	};
	
	$scope.selectEpisode = function(episode) {
		$scope.selected.episode = episode;
		if ( episode.currentTime === null ) {
			// `isNew` should be set to false immediately.
			episode.currentTime = 0;
		}
	};
	
	$scope.newPodcast = {
		url: ''
	};
	$scope.addPodcast = function(url) {
		$scope.newPodcast.url = '';
		
		Podcast.load(url).then(function(podcast) {
			storage.modify(function(config) {
				config.podcasts.push(url);
				
				$scope.$apply(function() {
					$scope.library.podcasts.push(podcast);
					podcast.episodes.forEach(function(episode) {
						// Newly added podcasts should not have any *new* episodes, so make it appear as if the user has started them.
						episode.currentTime = 0;
					});
					$scope.library.podcasts.sort(function(a, b) {
						return a.title.localeCompare(b.title);
					});
				});
			});
		});
	};
})
.factory('Episode', function() {
	function Episode() {
		this.id = null;
		this.title = null;
		this.url = null;
		this.podcast = null;
		this.description = null;
		this.duration = null;
		this.currentTime = null;
	}
	
	Object.defineProperty(Episode.prototype, 'progress', {
		get: function() {
			return this.currentTime / this.duration;
		}
	});
	
	Object.defineProperty(Episode.prototype, 'isNew', {
		get: function() {
			return this.currentTime === null;
		}
	});
	
	Object.defineProperty(Episode.prototype, 'isOld', {
		get: function() {
			return this.progress >= 0.99;
		}
	});
	
	return Episode;
})
.factory('storage', function() {
	function Storage() {}
	
	Storage.prototype = {
		modify: function(transaction) {
			try {
				var config = JSON.parse(localStorage.config);
			} catch(error) {
				var config = {
					times: {},
					selected: null,
					podcasts: []
				};
			}
			
			transaction(config);
			
			localStorage.config = JSON.stringify(config);
		}
	};
	
	return new Storage();
})
.directive('podcastPlayer', function($rootScope) {
	return {
		restrict: 'E',
		template: '<audio controls preload></audio>',
		replace: true,
		require: 'ngModel',
		link: function(scope, $element, attrs, ngModel) {
			var audio = $element[0];
			
			var hasStarted = false;
			audio.addEventListener('playing', function() {
				var episode = ngModel.$viewValue;
				audio.currentTime = episode.currentTime === null ? 0 :episode.currentTime;
				hasStarted = true;
			});
			
			audio.addEventListener('timeupdate', function() {
				var episode = ngModel.$viewValue;
				// This event can take place before the `playing` event, so make sure that it doesn't.
				// If this runs before the `playing` event listener, the `currentTime` in the episode is overwritten with 0.
				if ( episode && hasStarted ) {
					$rootScope.$apply(function() {
						episode.currentTime = audio.currentTime; // Save audio position.
					});
				}
			});
			
			var blobs = {};
			ngModel.$render = function() {
				audio.pause();
				
				var episode = ngModel.$viewValue;
				if ( episode ) {
					hasStarted = false;
					audio.src = episode.url;
					audio.play();
					
					var request = new XMLHttpRequest();
					request.open('GET', episode.url);
					// request.responseType = 'blob';
					
					request.addEventListener('load', function(event) {
						scope.$apply(function() {
							console.log('Loaded episode "' + episode.url + '"');
							episode.url = URL.createObjectURL(request.response);
						});
					});
					
					request.addEventListener('error', function(event) {
						console.log('Failed to load episode "' + episode.url + '"');
					});
					
					console.log('Starting to load episode "' + episode.url + '"');
					request.send();
				} else {
					if ( audio.hasAttribute('src') ) {
						// This happens the very first time the method is called.
						audio.removeAttribute('src');
						audio.currentTime = 0;
					}
				}
			};
		}
	};
})
.filter('duration', function() {
	return function(seconds) {
		var hours = Math.floor(seconds / 3600);
		var secondsLeft = seconds - 3600 * hours;
		var minutes = Math.floor(secondsLeft / 60);
		
		var strings = [];
		if ( hours === 1 ) {
			strings.push('1h');
		} else if ( hours > 1 ) {
			strings.push(hours + 'h');
		}
		
		if ( minutes === 1 ) {
			strings.push('1m');
		} else {
			strings.push(minutes + 'm');
		}
		
		return strings.join(' ');
	};
});