var Rx = require('rx');
/**
 * getUserMedia as an Observable
 *
 * @return Rx.Observable 
 */
function getUserMedia(options) {
	var getUserMedia = navigator.webkitGetUserMedia ? navigator.webkitGetUserMedia.bind(navigator) : cordova.plugins.iosrtc.getUserMedia.bind(cordova.plugins.iosrtc);
	return Rx.Observable.create(function (observer) {
		getUserMedia(options, function (stream) {
			observer.onNext(stream);
			observer.onCompleted();
		}, function (err) {
			observer.onError(err);
		});
	});
}
		
module.exports = getUserMedia;