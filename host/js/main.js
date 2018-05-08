'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var peer;
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io.connect("localhost:9090");

if (room !== '') {
  socket.emit('create or join', room);
}

//
socket.on('joined', function(peer_id) {
  console.log(peer_id);
  peer = peer_id;
  doCall()
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', peer, message);
}

// This client receives a message
socket.on('message', function(message) {
  if (message === 'got user media') {
  } else if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log("answer", Date.now());
  } else if (message.type === 'candidate') {
    console.log("received ice", Date.now());
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');

navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  // console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  createPeerConnection();
  pc.addStream(localStream);
}

var constraints = {
  video: true
};

console.log('Getting user media with constraints', constraints);

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, `exception: ' + e.message);
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event, Date.now());
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}
function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  // remoteStream = event.stream;
  // remoteVideo.srcObject = remoteStream;
}
//
function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}
