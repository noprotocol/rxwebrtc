
# RxWebRTC, simplify WebRTC

RxWebRTC.call(...) emits -> "CALLING" -> "CONNECTING" -> "CONNECTED" -> complete
 
Under the hood:
```
  create offer \                               -> answer \ -> receive ice -> receive ice         -> connection establised
                -> collect ice -> collect ice /           -> send collected ice -> send new ice /
 ## Usage
 
 ```js
var session = RxWebRTC.call({
  media: {video: true, audio: true}, 
  peerConnection: {
      iceServers: [ {urls: ['stun:stun.l.google.com:19302']} ]
  }
});
session.offers.forEach(function (session) {
  socket.emit('signal', )
});

session.dismiss(); // Hang up
```
  
 ## Testing tip
 
 ```sh
 open /Applications/Google\ Chrome.app --args --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
 ``