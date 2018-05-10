'use strict';

var localStream;
var pc;
var remoteStream;
var peer;
var is_host;
var localVideo = document.querySelector('#localVideo');
/////////////////////////////////////////////

var room = 'foo';
var peer_connections =[];
var socket = io.connect("localhost:9090");
var my_own_id;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    // {'urls': 'turn:numb.viagenie.ca'},
    // {'urls': 'turn:d1.synergy.net:3478'}
  ]
};

if (room !== '') {
  socket.emit('create or join', room);
}
socket.on('join', function (peer_id, my_own_id){
  peer = peer_id;
  console.log(my_own_id);
  createPeerConnection();
});
socket.on('joined', function(peer_id) {
  console.log("joined");
  peer = peer_id;
  if (!is_host) {
    createPeerConnection();
    pc.addStream(remoteStream);
  }
  doCall()
});

socket.on('created', function(my_own_id) {
  console.log(my_own_id);
  is_host = true;
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
});

function gotStream(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  createPeerConnection();
  pc.addStream(localStream);
}
////////////////////////////////////////////////

function sendMessage(message) {
  socket.emit('message', peer, message);
}

// This client receives a message
socket.on('message', function(message) {
  if (message.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
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

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    const len = peer_connections.push(new RTCPeerConnection(null));
    pc = peer_connections[len-1];
    pc.setConfiguration(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
  } catch (e) {
    console.log(e);
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
  }
}

function handleCreateOfferError(event) {
}

function doCall() {
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function handleRemoteStreamAdded(event) {
  remoteStream = event.stream;
  localVideo.srcObject = remoteStream;
}
//
function handleRemoteStreamRemoved(event) {
}

function onCreateSessionDescriptionError(error) {
}

window.onbeforeunload = function() {
  socket.emit('remove_peer', peer);
};