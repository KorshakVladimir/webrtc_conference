'use strict';
var vad = require('../node_modules/voice-activity-detection/index.js');
var VideoStreamMerger = require('video-stream-merger')

var localStream;
var peer_con;
var remoteStream;
var peer;
var is_host = false;
var central_peer = false;

var merger;
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
/////////////////////////////////////////////

var room = 'foo';
var peer_connections =[];
var socket = io.connect("192.168.31.238:9090");
// var socket = io.c  onnect("ec2-18-220-215-162.us-east-2.compute.amazonaws.com:9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    // {'urls': 'turn:numb.viagenie.ca'},
    // {'urls': 'turn:d1.synergy.net:3478'}
  ]
};

socket.on('remove_host', function (){
  console.log("host was removing");
  if (is_host){
    console.log("peer_connections", peer_connections.length);
    // const con = peer_connections[0];
    // con.close();
    // peer_connections = []
  }
  is_host = false;
});

socket.on('peer_to_host', function (peer_id, my_id){
  console.log("my socket id", my_id);
  console.log("peer_to_host to", peer_id);
  peer = peer_id;
  createPeerConnection('peer_to_host');
});

socket.on('host_to_peer', function(peer_id) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id);
  createPeerConnection("host_to_peer");

  if (!central_peer) {
    if (!is_host){
      peer_con.addStream(remoteStream);
    }else{
       peer_con.addStream(localStream);
    }
  } else{
    merger = new VideoStreamMerger();
    merger.addStream(localStream, {});
    merger.start();
    // localVideo.srcObject = merger.result;
    peer_con.addStream(merger.result);
  }
  doCall()
});

socket.on('first', function (){
  is_host = true;
  central_peer = true;
});



// socket.on('created', function(my_own_id) {
//   console.log(my_own_id);
//   is_host = true;
//   createPeerConnection();
//   pc.addStream(localStream);
// });

function sendMessage(message) {
  socket.emit('message', peer, message);
}

// This client receives a message
socket.on('message', function(message) {
  if (message.type === 'offer') {
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_con.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

function doAnswer() {
  console.log('Sending answer to peer.');
  peer_con.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function createPeerConnection(connection_type) {
  try {
    const len = peer_connections.push(new RTCPeerConnection(null));
    peer_con = peer_connections[len-1];
    peer_con.connection_type = connection_type;
    peer_con.setConfiguration(pcConfig);
    peer_con.onicecandidate = handleIceCandidate;
    peer_con.onaddstream = handleRemoteStreamAdded;
    peer_con.onremovestream = handleRemoteStreamRemoved;
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
  peer_con.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  peer_con.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function handleRemoteStreamAdded(event) {
  console.log("new remote stream");

  setInterval(function () {
     console.log("try run starts");
     peer_con.getStats(function(report){
       report.result().forEach(function (result) {
          var item = {};
          result.names().forEach(function (name) {
              item[name] = result.stat(name);
          });
          item.id = result.id;
          item.type = result.type;
          item.timestamp = result.timestamp;
          console.log(item);
      });
     });
     // peer_con.getStats(peer_con.getRemoteStreams()[0],function(report){
     //   console.log(report);
     // })
    },5000);
  if (central_peer){
    if (remoteStream){
      merger.removeStream(remoteStream);
    }else {
      merger.removeStream(localStream);
    }
    merger.addStream(event.stream);
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
    return;
  }else if (peer_connections.length > 2) {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
    console.log("add to old connection");
    console.log(" connection length", peer_connections.length);
    var con_before = peer_connections[peer_connections.length - 2];
    con_before.addStream(remoteStream);
  } else {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
  }
}
//
function handleRemoteStreamRemoved(event) {
}

function onCreateSessionDescriptionError(error) {
}

window.onbeforeunload = function() {
  socket.emit('remove_peer', peer);
};

//////////////////////////////////////////////////
function on_voice_start() {
  console.log("voice started", is_host);
  if (is_host == false){
    socket.emit('voice_start', central_peer);
    if (central_peer){
      merger.removeStream(merger._streams[0]);
      merger.addStream(localStream);
      // remoteStream = null;
    }
  }
  is_host = true;
  console.log("host");
}

function add_voice_detection(stream) {
  const options = {
    fftSize: 1024,
    bufferLen: 1024,
    smoothingTimeConstant: 0.2,
    minCaptureFreq: 85,         // in Hz
    maxCaptureFreq: 255,        // in Hz
    noiseCaptureDuration: 1000, // in ms
    minNoiseLevel: 0.3,         // from 0 to 1
    maxNoiseLevel: 0.7,         // from 0 to 1
    avgNoiseMultiplier: 1.2,
    onVoiceStart: on_voice_start,
    // onVoiceStop: function() {console.log("stop")},
  };
  vad(audioContext, stream, options);
}

function gotStream(stream) {
  // window.AudioContext = window.AudioContext || window.webkitAudioContext;
  // audioContext = new AudioContext();
  localStream = stream;
  // add_voice_detection(localStream);
  localVideo.srcObject = stream;
  localStream.getAudioTracks()[0].enabled = false;
  socket.emit('create or join', room);
}

navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e);
  });
//////////////////////////////////////////////////
const mute_button = document.querySelector('#mute_button');
mute_button.addEventListener("click", function(e){
  const audio = localStream.getAudioTracks()[0];
  audio.enabled = !(audio.enabled);
  if (audio.enabled){
    e.target.innerText = "MUTE";
  }else{
    e.target.innerText = "UNMUTE";
  }
  if (!audioContext) {
    create_audio();
  }
});
 function create_audio(){
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();
  add_voice_detection(localStream);
};

// var network = new ActiveXObject('WScript.Network');
// console.log(network.UserName);