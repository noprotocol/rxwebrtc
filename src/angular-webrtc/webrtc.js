angular.module('webrtc').factory('webrtc', function ($rootScope) {
	var webrtc = {
		call: function (options) {
			return this.angularify(rxwebrtc.call(options));
		},
		answer: function (options) {
			return this.angularify(rxwebrtc.answer(options));
		},
		angularify: function (session) {
			// Connect the getUserMedia steam with the <webrtc-preview> directive.
			session.subscriptions.push(session.localStream.subscribe(function (stream) {
				webrtc.localStream = stream; 
				$rootScope.$broadcast('webrtcLocalStream', stream);
			}));
			session.subscriptions.push(session.remoteStream.subscribe(function (stream) {
				webrtc.remoteStream = stream; 
				$rootScope.$broadcast('webrtcRemoteStream', stream);
			}));
			return session;
		}
		
	};
	return webrtc;
});