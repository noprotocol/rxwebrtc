angular.module('webrtc').directive('webrtcRemoteStream', function (webrtc) {
	return function link($scope, $element, attrs) {
		var video = $element[0];
		if (video.tagName !== 'VIDEO') {
			throw new Error('The webrtc-remote-stream directive must be placed on a VideoElement');
		}
		video.autoplay = true;
		if (webrtc.remoteStream) {
			video.src = URL.createObjectURL(webrtc.remoteStream);
		}
		$scope.$on('webrtcRemoteStream', function (e, stream) {
			if (video.src) {
				URL.revokeObjectURL(video.src);
			}
			video.src = URL.createObjectURL(webrtc.remoteStream);
		});
		$scope.$on('$destroy', function () {
			if (video.src) {
				URL.revokeObjectURL(video.src);
			}
		})
	};
});