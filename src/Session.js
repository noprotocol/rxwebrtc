var Rx = require('rx');
/**
 * @extends IDisposable
 */
function Session (options) {
	options = options || {};
	
	if (options.id) {
		this.id = options.id;
	} else {
		this.id = Session.guid();
	}
	this.status = new Rx.BehaviorSubject('NEW');
	var RTCPeerConnection = window.webkitRTCPeerConnection || cordova.plugins.iosrtc.RTCPeerConnection;
	this.peerConnection = new RTCPeerConnection(options.peerConnection);
	this.remoteStream = Rx.Observable.fromEvent(this.peerConnection, 'addstream');
	this.localStream = new Rx.BehaviorSubject();
	this.messages = rxwebrtc.input.filter(message => {
		return message.id === this.id;
	});
	var remoteStreamSubscription = this.remoteStream.subscribe( stream => {
		this.status.onNext('REMOTE_STREAM');
	});
	this.subscriptions = [this.status, this.localStream, remoteStreamSubscription];
};

Session.prototype.dispose = function() {
	// if (this.status.value === 'CALLING') 
	this.subscriptions.forEach(subscription => { subscription.dispose() });
};

Session.guid = function () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

module.exports = Session;