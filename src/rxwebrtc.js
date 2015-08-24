
var Rx = require('rx');
var getUserMedia = require('./getUserMedia');
var Session = require('./Session');;

var rxwebrtc = {
	
	defaults: {
		peerConnection: {
			iceServers:  [ 
				{ urls: ['stun:stun.l.google.com:19302'] }
			]
		},
		userMedia: { 
			video: true, 
			audio: true
		}
	},
	/**
	 * Send message from sigaling server to this Rx.Subject 
	 */
	input: new Rx.Subject(),

	/**
	 * Emit messages from this Rx.Subject to the sigaling server
	 */
	output: new Rx.Subject(),
	
	/**
	 * @return Session
	 */
	call: function (options) {
		options = options || {};
		options.target = options.target || 'UNKNOWN'; 
		options.userMedia || rxwebrtc.defaults.userMedia
		options.peerConnection = options.peerConnection ||  rxwebrtc.defaults.peerConnection;
		var session = new Session(options);
		session.status.onNext('USER_MEDIA');
		var subscription = rxwebrtc.getUserMedia(options.userMedia || rxwebrtc.defaults.userMedia).flatMap(function (stream) {
			session.peerConnection.addStream(stream);
			session.localStream.onNext(stream);
			session.status.onNext('LOCAL_STREAM');
			return rxwebrtc.createOffer(session.peerConnection)
		}).flatMap(function (offer) {
			session.offer = offer;
			session.status.onNext('OFFER');
			session.peerConnection.setLocalDescription(offer); // Triggers ICE gathering
			return rxwebrtc.gatherIceCandidates(session.peerConnection)
		}).flatMap(function (iceCandidates) {
			session.status.onNext('ICE CANDIDATES: ' + iceCandidates.length);
			rxwebrtc.output.onNext({
				type: 'offer', 
				target: options.target,
				session: session.id,
				offer: session.offer,
				iceCandidates: iceCandidates
			});
			session.status.onNext('CALLING');
			return session.messages.filter(function (message) {
				return message.type === 'answer'
			}).first();
				
			// var test = Rx.Observable.fromEvent(session.peerConnection, 'icecandidate').filter(function (e) {
			// 	return e.candidate;
			// }).subscribe(function (e) {
			// 	console.log('more ICE?', e.candidate);
			// });
			// session.subscriptions.push(test);
		}).flatMap(function (message) {
			session.status.onNext('ANSWERED');
			console.log(message);
			return rxwebrtc.setRemoteDescription(session.peerConnection, message.answer);
			
		}).subscribe(function (result) {
			console.log(result);
		});
		session.subscriptions.push(subscription);
		return session;
	},
	
	answer: function (options) {
		options = options || {};
		options.target = options.target || 'UNKNOWN';
		options.userMedia || rxwebrtc.defaults.userMedia
		options.peerConnection = options.peerConnection ||  rxwebrtc.defaults.peerConnection;
		var session = new Session(options);
		session.status.onNext('USER_MEDIA');
		
		var subscription = rxwebrtc.getUserMedia(options.userMedia || rxwebrtc.defaults.userMedia).flatMap(function (stream) {
			session.peerConnection.addStream(stream);
			session.localStream.onNext(stream);
			session.status.onNext('LOCAL_STREAM');
			return rxwebrtc.setRemoteDescription(session.peerConnection, options.offer);
		}).flatMap(function () {
			session.status.onNext('REMOTE');
			if (options.iceCandidates) {
				options.iceCandidates.forEach(function (ice) {
					rxwebrtc.addIceCandidate(session.peerConnection, ice);
				});
			}
			return rxwebrtc.createAnswer(session.peerConnection);
		}).subscribe(function (answer) {
			rxwebrtc.output.onNext({
				type: 'answer', 
				target: options.target,
				session: session.id,
				answer: answer,
			});
		});
		session.subscriptions.push(subscription);
		return session;
	},
	gatherIceCandidates: function (peerConnection) {
		return Rx.Observable.fromEvent(peerConnection, 'icecandidate').takeWhile(function (e) {
			return e.candidate;
		}).map(function (e) {
			return e.candidate;
		}).toArray()
	},
	createOffer: function (peerConnection) {
		return Rx.Observable.create(function (observer) {
			peerConnection.createOffer(function (sessionDescription) {
				observer.onNext(sessionDescription);
				observer.onCompleted();
			}, function (err) {
				observer.onError(err);
			});
		});
	},
	createAnswer: function (peerConnection) {
		return Rx.Observable.create(function (observer) {
			peerConnection.createAnswer(function (sessionDescription) {
				observer.onNext(sessionDescription);
				observer.onCompleted();
			}, function (err) {
				observer.onError(err);
			});
		});
	},
	setRemoteDescription: function (peerConnection, sessionDescription) {
		console.log(sessionDescription);
		var RTCSessionDescription = window.RTCSessionDescription || cordova.plugins.iosrtc.RTCSessionDescription;
		return Rx.Observable.create(function (observer) {
			peerConnection.setRemoteDescription(new RTCSessionDescription(sessionDescription), function (result) {
				console.log(result)
				observer.onNext(result);
				observer.onCompleted();
			}, function (err) {
				observer.onError(err);
			});
		});
	},
	addIceCandidate: function (peerConnection, iceCandidate) {
		var RTCIceCandidate = window.RTCIceCandidate || cordova.plugins.iosrtc.RTCIceCandidate;
		peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
	},
	getUserMedia: getUserMedia
};

window.rxwebrtc = rxwebrtc;