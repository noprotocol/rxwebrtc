angular.module('webrtc').directive('webrtcPreview', function (webrtc) {
	return function link($scope, $element, attrs) {
		var video = $element[0];
		if (video.tagName !== 'VIDEO') {
			throw new Error('The webrtc-preview directive must be placed on a VideoElement');
		}
		video.muted = true;
		video.autoplay = true;
		if (webrtc.localStream) {
			console.dir(video);
			video.src = URL.createObjectURL(webrtc.localStream);
		}
		$scope.$on('webrtcLocalStream', function (e, stream) {
			if (video.src) {
				URL.revokeObjectURL(video.src);
			}
			video.src = URL.createObjectURL(webrtc.localStream);
		});
		$scope.$on('$destroy', function () {
			if (video.src) {
				URL.revokeObjectURL(video.src);
			}
		})
	};
});