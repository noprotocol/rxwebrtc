var Rx = require('rx');
/**
 * @implements Rx.Disposable
 */
function Session (options) {
	options = options || {};
	this.isDisposed = false;
	
	if (options.id) {
		this.id = options.id;
	} else {
		this.id = Session.guid();
	}
	this.status = new Rx.BehaviorSubject('NEW');
	var RTCPeerConnection = window.webkitRTCPeerConnection || cordova.plugins.iosrtc.RTCPeerConnection;
	this.peerConnection = new RTCPeerConnection(options.peerConnection);
	this.remoteStream = Rx.Observable.fromEvent(this.peerConnection, 'addstream').pluck('stream');
	this.localStream = new Rx.BehaviorSubject();
	this.messages = rxwebrtc.input.filter(message => {
		return message.session === this.id;
	});
	var connectionState = Rx.Observable.fromEvent(this.peerConnection, 'iceconnectionstatechange')
		.pluck('target', 'iceConnectionState')
		.subscribe( connectionState => {
			if (connectionState === 'completed') {
				this.status.onNext('CONNECTED');
			} else if (connectionState === 'disconnected'){
				this.status.onNext('DISCONNECTED');
				this.status.onCompleted();
			}
		}); 
	this.subscriptions = [this.status, this.localStream, connectionState];
};

Session.prototype.dispose = function() {
	if (this.isDisposed) {
		return;
	}
	this.isDisposed = true;
	this.peerConnection.close(); 
	this.subscriptions.forEach(subscription => { subscription.dispose() });
};

Session.guid = function () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

module.exports = Session;