var Rx = require('rx');
/**
 * @implements Rx.Disposable
 */
function Session (options) {
	options = options || {};
	this.sender = options.sender || {};
	this.recipient = options.recipient || {};
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
	window.peerConnection = this.peerConnection;
	var trickleIce = Rx.Observable.fromEvent(this.peerConnection, 'icecandidate').filter(function (e) {
		return e.candidate;
	}).subscribe( e => {
		rxwebrtc.output.onNext({
			type: 'ice',
			session: this.id,
			candidate: e.candidate,
			sender: this.sender,
			recipient: this.recipient
		});
	});
	this.iceCandidates = this.messages.filter(function (message) {
		return message.type === 'ice';
	}).pluck('candidate');
	Rx.Observable.fromEvent(this.peerConnection, 'signalingstatechange').subscribe(e => { console.log('signalingstatechange', this.peerConnection.signalingState)})
	Rx.Observable.fromEvent(this.peerConnection, 'addstream').subscribe(function (e) { console.log('onaddstream', e)})
	Rx.Observable.fromEvent(this.peerConnection, 'iceconnectionstatechange').subscribe(e => { console.log('signalingstatechange', this.peerConnection.iceConnectionState)})
	
	var connectionState = Rx.Observable.fromEvent(this.peerConnection, 'iceconnectionstatechange')
		.map(function (e) {
			console.log('iceconnectionstatechange', e)
			if (e.target) {
				return e.target.iceConnectionState  
			}
		})
		.subscribe( connectionState => {
			if (connectionState === 'connected' || connectionState === 'completed') {
				if (this.status.value !== 'CONNECTED') {
					this.status.onNext('CONNECTED');
				}
			} else if (connectionState === 'disconnected'){
				this.status.onNext('DISCONNECTED');
				this.status.onCompleted();
			}
		}); 
	this.subscriptions = [this.status, this.localStream, trickleIce, connectionState];
};

Session.prototype.dispose = function() {
	if (this.isDisposed) {
		return;
	}
	this.isDisposed = true;
	this.peerConnection.close();
	var mediaStream = this.localStream.value;
	if (mediaStream) {
		mediaStream.getTracks().map(function (track) {
			track.stop();
		});
	}
	this.subscriptions.forEach(subscription => { subscription.dispose() });
};

Session.guid = function () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

module.exports = Session;