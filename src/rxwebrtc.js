
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
		session.gatherIce = session.iceCandidates.replay();
		console.log(session.gatherIce);
		
		session.subscriptions.push(session.gatherIce);
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
			session.status.onNext('SET_REMOTE');
			session.iceCandidates.replay()
			return rxwebrtc.setRemoteDescription(session.peerConnection, message.offer);
		}).flatMap(function (result) {
			session.status.onNext('SET_ICE');
			session.gatherIce.subscribe( candidate => {
				rxwebrtc.addIceCandidate(session.peerConnection, candidate).catch(function (error) {
					console.warn(error)
				});
			});
			return rxwebrtc.createAnswer(session.peerConnection);
		}).flatMap(function (answer) {
			session.status.onNext('SET_LOCAL');
			session.peerConnection.setLocalDescription(answer); // Triggers ICE gathering
			session.status.onNext('SEND_ANSWER');
			rxwebrtc.output.onNext({
				type: 'answer',
				sender: session.sender,
				recipient: session.recipient,
				session: session.id,
				answer: answer,
			});
			session.status.onNext('WAITING_FOR_ICE');
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
		var gatherIce = session.iceCandidates.subscribe( candidate => {
			rxwebrtc.addIceCandidate(session.peerConnection, candidate).catch(function (error) {
				console.warn(error)
			});
		});
		session.subscriptions.push(gatherIce);
		
		var answer = rxwebrtc.getUserMedia(options.userMedia).flatMap(function (stream) {
			session.peerConnection.addStream(stream);
			session.localStream.onNext(stream);
			session.status.onNext('LOCAL_STREAM');
			session.status.onNext('OFFER');
			return rxwebrtc.createOffer(session.peerConnection)
		}).flatMap(function (offer) {
			session.offer = offer;
			session.status.onNext('SET_LOCAL');
			session.peerConnection.setLocalDescription(offer); // Triggers ICE gathering
			rxwebrtc.output.onNext({
				type: 'offer', 
				sender: session.sender,
				recipient: session.recipient,
				session: session.id,
				offer: session.offer,
			});
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
			session.status.onNext('SET_REMOTE');
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
				console.log(sessionDescription);
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
		console.log('addIceCandidate', peerConnection);
		return new Promise(function (resolve, reject) {
			var candidate = new RTCIceCandidate(iceCandidate);
			peerConnection.addIceCandidate(candidate, resolve, reject);	
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