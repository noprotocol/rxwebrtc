angular.module('webrtc').factory('webrtc', function ($rootScope) {
	var webrtc = {
		call: function (options) {
			var session = rxwebrtc.call(options);
			// Connect the getUserMedia steam with the <webrtc-preview> directive.
			session.subscriptions.push(session.localStream.subscribe(function (stream) {
				webrtc.localStream = stream; 
				$rootScope.$broadcast('webrtcLocalStream', stream);
			}));
			return session;
		},
		answer: function (options) {
			var session = rxwebrtc.answer(options);
			return session;
		}
		
	};
	return webrtc;
});