
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
		options.userMedia || rxwebrtc.defaults.userMedia
		options.peerConnection = options.peerConnection ||  rxwebrtc.defaults.peerConnection;
		var session = new Session(options);
		session.status.onNext('USER_MEDIA');
		var call = rxwebrtc.getUserMedia(options.userMedia).flatMap(function (stream) {
			session.peerConnection.addStream(stream);
			session.localStream.onNext(stream);
			session.status.onNext('LOCAL_STREAM');
			session.status.onNext('RSVP');
			rxwebrtc.output.onNext({
				type: 'rsvp', 
				sender: session.sender,
				recipient: session.recipient,
				session: session.id,
				// offer: session.offer,
				// iceCandidates: iceCandidates
			});
			
			return session.messages.filter(function (message) {
				return message.type === 'offer'
			}).first();
		}).flatMap(function (message) {
			session.status.onNext('OFFER_RECEIVED');
			if (message.sender) {
				rxwebrtc.merge(session.recipient, message.sender); 
			}
			if (message.recipient) {
				rxwebrtc.merge(session.sender, message.recipient); 
			}
			session.iceCandidates = message.iceCandidates
			session.status.onNext('SET_REMOTE');
			return rxwebrtc.setRemoteDescription(session.peerConnection, message.offer);
		}).flatMap(function (result) {
			session.status.onNext('SET_ICE');
			session.iceCandidates.forEach(function (ice) {
				rxwebrtc.addIceCandidate(session.peerConnection, ice).subscribe();
			});
			return rxwebrtc.createAnswer(session.peerConnection);
		}).flatMap(function (answer) {
			session.answer = answer;
			session.status.onNext('SET_LOCAL');
			session.peerConnection.setLocalDescription(answer); // Triggers ICE gathering
			return rxwebrtc.gatherIceCandidates(session.peerConnection);
		}).flatMap(function (iceCandidates) {
			session.status.onNext('ICE CANDIDATES: ' + iceCandidates.length);
			session.status.onNext('SEND_ANSWER');
			rxwebrtc.output.onNext({
				type: 'answer',
				sender: session.sender,
				recipient: session.recipient,
				session: session.id,
				answer: session.answer,
				iceCandidates: iceCandidates
			});
			var test = Rx.Observable.fromEvent(session.peerConnection, 'icecandidate').filter(function (e) {
				return e.candidate;
			}).subscribe(function (e) {
				console.log('more ICE?', e.candidate);
			});
			session.subscriptions.push(test);
			return session.status.skipWhile(function (status) {
				return status !== 'CONNECTED';
			}).timeout(40000, 'Unable to setup a connection in 40 seconds');
		}).subscribe(function (status) {
		}, function (error) {
			session.status.onError(error);
		});
		session.subscriptions.push(call);
		return session;
	},
	
	answer: function (options) {
		options = options || {};
		options.userMedia || rxwebrtc.defaults.userMedia;
		options.peerConnection = options.peerConnection || rxwebrtc.defaults.peerConnection;
		var session = new Session(options);
		session.status.onNext('USER_MEDIA');
		
		var answer = rxwebrtc.getUserMedia(options.userMedia).flatMap(function (stream) {
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
				sender: session.sender,
				recipient: session.recipient,
				session: session.id,
				offer: session.offer,
				iceCandidates: iceCandidates
			});
			var test = Rx.Observable.fromEvent(session.peerConnection, 'icecandidate').filter(function (e) {
				return e.candidate;
			}).subscribe(function (e) {
				console.log('more ICE?', e.candidate);
			});
			session.subscriptions.push(test);
			
			session.status.onNext('CALLING');
			return session.messages.filter(function (message) {
				return message.type === 'answer'
			}).first();
		}).flatMap(function (message) {
			if (message.sender) {
				rxwebrtc.merge(session.recipient, message.sender); 
			}
			if (message.recipient) {
				rxwebrtc.merge(session.sender, message.recipient); 
			}
			session.status.onNext('ANSWERED');
			message.iceCandidates.forEach(function (ice) {
				rxwebrtc.addIceCandidate(session.peerConnection, ice).subscribe();
			});
			return rxwebrtc.setRemoteDescription(session.peerConnection, message.answer);
		}).flatMap(function () {
			return session.remoteStream.first();
		}).flatMap(function (stream) {
			session.status.onNext('CONNECTING');
			return session.status.skipWhile(function (status) {
				return status !== 'CONNECTED';
			}).timeout(30000, 'Unable to setup a connection in 30 seconds');
		}).subscribe(function (status) {
		}, function (error) {
			session.status.onError(error);
		});
		session.subscriptions.push(answer);
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
		var RTCSessionDescription = window.RTCSessionDescription || cordova.plugins.iosrtc.RTCSessionDescription;
		return Rx.Observable.create(function (observer) {
			peerConnection.setRemoteDescription(new RTCSessionDescription(sessionDescription), function (result) {
				observer.onNext(result);
				observer.onCompleted();
			}, function (err) {
				observer.onError(err);
			});
		});
	},
	addIceCandidate: function (peerConnection, iceCandidate) {
		var RTCIceCandidate = window.RTCIceCandidate || cordova.plugins.iosrtc.RTCIceCandidate;
		return Rx.Observable.create(function (observer) {
			peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate), function (result) {
				observer.onNext(result);
				observer.onCompleted();
			}, function (err) {
				observer.onError(err);
			});
		});
	},
	getUserMedia: getUserMedia,
	merge: function (target, source) {
		source = source || {};
		for (var key in source) {
			if (source.hasOwnProperty(key)) {
				target[key] = source[key];
			}
		}
		return target;
	}
};

window.rxwebrtc = rxwebrtc;