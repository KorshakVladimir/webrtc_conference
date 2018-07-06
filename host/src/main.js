'use strict';
var vad = require('../node_modules/voice-activity-detection/index.js');
var VideoStreamMerger = require('video-stream-merger')

var localStream;
var peer_con;
var remoteStream;
var peer;
let conn_to_central;
var is_host = false;
var central_peer = false;
let current_sock_id = '';
let last_activity;

const sound_track_slots = [];
var merger = new VideoStreamMerger();
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var tempVideo = document.querySelector('#tempVideo');
const main_stream = new MediaStream();
let c_array_index = '';
requestMic();

function requestMic() {
  try {
    // window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();

    // navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    // navigator.getUserMedia({audio: true}, startUserMedia, handleMicConnectError);
  } catch (e) {
    // handleUserMediaError();
  }
}
/////////////////////////////////////////////

var room = 'foo';
var peer_connections =[];
// var socket = io.connect("192.168.31.238:9090");
var socket = io.connect("ec2-18-220-215-162.us-east-2.compute.amazonaws.com:9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    // {'urls': 'turn:numb.viagenie.ca'},
    {'urls': 'turn:d1.synergy.net:3478',"username":"synergy","credential":"q1w2e3"}
    // "turn:my_username@<turn_server_ip_address>", "credential":"my_password"
  ]
};


function sendMessage(message) {
  socket.emit('message', peer, message);
}

// This client receives a message
socket.on('message', function(message) {
  if (message.type === 'offer') {
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    console.log("3 answer")
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_con.addIceCandidate(candidate);
    console.log("4 candidate")
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

function doAnswer() {
  console.log('Sending answer to peer.');
  peer_con.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function  createPeerConnection(connection_type) {
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

//
function handleRemoteStreamRemoved(event) {
}

function onCreateSessionDescriptionError(error) {
}
////////////////////////////////////////////////////
socket.on('remove_stream', function (stream_id, soket_id){
  for (let i in sound_track_slots){
    const slot = sound_track_slots[i];
    if (slot.connection && slot.connection.host_id == soket_id){
      slot.state = "free";
      slot.gain.disconnect(slot.dest);
      slot.gain = '';
      slot.connection = ''
      break;
    }
  }
});

socket.on('close_video_to_central', function (){
  for (let i in peer_connections) {
    const con = peer_connections[i]
    if (con.connection_type  == "to_main_host_video"){
      console.log("c stream remove ");
      con.close()
    }
  }
  remove_connection_for_main_peer(peer_connections);
});

function remove_connection_for_main_peer(peer_connections){
  for (let i in peer_connections) {
    if (peer_connections[i].signalingState  == "closed"){
      peer_connections.splice(i, 1);
      remove_connection_for_main_peer(peer_connections)
    }
  }
}

function close_connection_for_main_peer(){
  if (central_peer){
    return;
  }
  for (let i in peer_connections) {
    const con = peer_connections[i]
    if (con.connection_type  == "to_main_host_sound"){
      console.log("delete connection");
      con.close()
    }
  }
  remove_connection_for_main_peer(peer_connections)
}

socket.on('peer_to_host', function (peer_id, video_slot_pos, sock_id){
  if (sock_id){
    current_sock_id = sock_id;
  }
  close_connection_for_main_peer();
  console.log(" 1 peer_to_host to", peer_id);
  // if (central_peer){
  //   c_sound_peer_ids.push(peer_id);
  //   if (c_video_peer_ids.length < 5) {
  //     c_video_peer_ids.push({"peer_id": peer_id, "stream": false});
  //   }
  // }
  peer = peer_id;
  createPeerConnection('peer_to_host');
  console.log(" 2 create connection , video pos", video_slot_pos, "host id",  peer_id);
  peer_con.host_id = peer_id;
  peer_con.video_slot_pos = video_slot_pos;
});


socket.on('mute_own_channel', function (array_index){
  // c_array_index = array_index;
  console.log("c_array_index", array_index);
  remoteStream.getAudioTracks()[array_index].enabled = false;
});

function create_audio_track_slots(stream_count) {
  if (sound_track_slots.length == stream_count) {
    return;
  }
  for (let i=0; i<stream_count; i++){
    const  track = {source:'', state:'free'};
    track.gain  = audioContext.createGain();
    track.gain.gain.value = 1;
    track.dest = audioContext.createMediaStreamDestination();
    track.gain.connect(track.dest);
    main_stream.addTrack(track.dest.stream.getAudioTracks()[0]);
    sound_track_slots.push(track);
  }
}

socket.on('host_to_peer', function(peer_id, to_main, sound_only) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id);

  if (to_main){
    if (sound_only){
        createPeerConnection("to_main_host_sound");
        console.log("add stream id ", localStream.id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getAudioTracks()[0]);
        peer_con.addStream(newStream);
        conn_to_central = peer_connections[peer_connections.length - 1];
    }else {
        createPeerConnection("to_main_host_video");
        console.log("add stream id ", localStream.id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getVideoTracks()[0]);
        peer_con.addStream(newStream);
    }
  } else {

    if (!central_peer) {
      createPeerConnection("peer transmit to peers");
      merger.addStream(remoteStream, {});
      merger.start();
      peer_con.addStream(merger.result);
    } else {
      createPeerConnection("main transmit to peers");
      create_audio_track_slots(10);
      main_stream.addTrack(merger.result.getVideoTracks()[0]);
      remoteVideo.srcObject = main_stream;
      remoteStream = main_stream;
      peer_con.addStream(main_stream);
    }
  }
  doCall()
});

socket.on('first', function (sock_id){
  current_sock_id = sock_id;
  is_host = false;
  central_peer = true;
  merger.addStream(localStream, {
          x:0,
          y:0,
          width: 200,
          height:150,
          mute: true // we don't want sound from the screen (if there is any)
        });
  merger.start();
  console.log(" local stream merger created")
});

function add_sound_track(event, new_stream){
  // tempVideo.srcObject = new_stream; // very important
  const video_el = document.createElement("video"); // todo destroy element somehow
  video_el.srcObject = new_stream;
  const source = audioContext.createMediaStreamSource(new_stream);
  const gain = audioContext.createGain();
  gain.gain.value = 1;
  source.connect(gain);
  for (let i in sound_track_slots){
    const free_slot = sound_track_slots[i];
    if (free_slot.state == "free"){
    // if (!free_slot.connection){
      free_slot.gain = gain;
      gain.connect(free_slot.dest);

      free_slot.connection = event.target;
      free_slot.state = "connected";
      if (central_peer && !free_slot.connection.host_id){
        free_slot.connection.host_id = current_sock_id;
      }

      if (current_sock_id != free_slot.connection.host_id){
        socket.emit("mute_own_channel", free_slot.connection.host_id, i);
      }
      break;
    }
  }
}

function handleRemoteStreamAdded(event) {
  console.log("new remote stream");

  // setInterval(function () {
  //    console.log("try run starts");
  //    peer_con.getStats(function(report){
  //      report.result().forEach(function (result) {
  //         var item = {};
  //         result.names().forEach(function (name) {
  //             item[name] = result.stat(name);
  //         });
  //         item.id = result.id;
  //         item.type = result.type;
  //         item.timestamp = result.timestamp;
  //         console.log(item);
  //     });
  //    });
  //   },5000);
  if (central_peer){
    const new_remote_stream = event.stream;
    const video_track  = new_remote_stream.getVideoTracks().length;
    console.log(" 5 new stream video", video_track);
    if (video_track) {
      const video_slot_pos = event.target.video_slot_pos;
      merger.addStream(event.stream, {
          x: (video_slot_pos == 0 || video_slot_pos == 3) ? 0 : 200, // position of the topleft corner
          y: (video_slot_pos == 0 || video_slot_pos == 1) ? 0 : 150 ,
          width: 200,
          height: 150,
          mute: true // we don't want sound from the screen (if there is any)
        });

    } else {
      // merger.addStream(event.stream);
      const new_stream = event.stream;
      // console.log('new sound track appear', new Date(), new Date().getMilliseconds());
      add_sound_track(event, new_stream);
    }
  } else if (peer_connections.length > 2) {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
    var con_before = peer_connections[peer_connections.length - 2];
    con_before.addStream(remoteStream);
  } else {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
  }
}
// setInterval(()=>{ if (!central_peer){console.log(remoteStream.getAudioTracks().length)}}, 3000);

window.onbeforeunload = function() {
  socket.emit('remove_peer', peer);
};

//////////////////////////////////////////////////
// function on_voice_start() {
//   if (is_host == false) {
//     // console.log("c voice started", new Date(), new Date().getMilliseconds());
//     if (central_peer){
//       add_sound_track({target:{host_id:current_sock_id}}, localStream);
//     } else {
//       socket.emit('voice_start', central_peer, true, true);
//     }
//     is_host = true;
//   }
// }

// function on_voice_stop() {
//   last_activity = new Date()
// }
//
// setInterval(()=>{
//   // console.log(new Date() - last_activity);
//   if (conn_to_central && ((new Date() - last_activity) > 3000)){
//     conn_to_central.close();
//     is_host = false;
//     conn_to_central = '';
//     console.log("c stream removed");
//     peer_connections[peer_connections.length-1].close();
//     peer_connections.splice(peer_connections.length-1, 1);
//     socket.emit('remove_stream', localStream.id );
//   }
//   //for central
//   if (central_peer && is_host && (new Date() - last_activity) > 3000) {
//     is_host = false;
//     console.log("m stream removed");
//     socket.emit('remove_stream', localStream.id );
//   }
//
// }, 3000);

// function add_voice_detection(stream) {
//   const options = {
//     fftSize: 1024,
//     bufferLen: 1024,
//     smoothingTimeConstant: 0.2,
//     minCaptureFreq: 85,         // in Hz
//     maxCaptureFreq: 255,        // in Hz
//     noiseCaptureDuration: 1000, // in ms
//     minNoiseLevel: 0.3,         // from 0 to 1
//     maxNoiseLevel: 0.7,         // from 0 to 1
//     avgNoiseMultiplier: 1.2,
//     onVoiceStart: on_voice_start,
//     onVoiceStop: on_voice_stop,
//     onUpdate: function(val) {
//       if (val > 0.1){
//         last_activity = new Date()
//       }
//     }
//   };
//   vad(audioContext, stream, options);
// }

function gotStream(stream) {
  // window.AudioContext = window.AudioContext || window.webkitAudioContext;
  // audioContext = new AudioContext();
  localStream = stream;
  // add_voice_detection(localStream);
  localVideo.srcObject = stream;
  // localStream.getVideoTracks()[0].enabled = false;
  localStream.getAudioTracks()[0].enabled = false;
  socket.emit('create or join', room);
  // if (!vad_was_enabled) {
  //   create_audio();
  //   vad_was_enabled = true;
  // }
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
let vad_was_enabled = false;
mute_button.addEventListener("click", function(e){
  // console.log("mute button pres", new Date(), new Date().getMilliseconds());
  const audio = localStream.getAudioTracks()[0];
  audio.enabled = !(audio.enabled);
  if (audio.enabled){
    e.target.innerText = "MUTE";
    if (central_peer){
      add_sound_track({target:{host_id:current_sock_id}}, localStream);
    } else {
      socket.emit('voice_start', central_peer, true, true);
    }
  }else{
    e.target.innerText = "UNMUTE";
      // console.log("c voice started", new Date(), new Date().getMilliseconds());
    if (conn_to_central){
      conn_to_central.close();
      is_host = false;
      conn_to_central = '';
      socket.emit('remove_stream', localStream.id );
      const remote_sound_track = remoteStream.getAudioTracks();
      for (let i in remote_sound_track){
        remote_sound_track[i].enabled = true;
      }
    }
    //for central
    if (central_peer) {
      console.log("m stream removed");
      socket.emit('remove_stream', localStream.id );
    }
  }

});

// function create_audio(){
//   add_voice_detection(localStream);
// };

// const remove_button = document.querySelector('#remove_button');
//  remove_button.addEventListener("click", function(e){
//   peer_connections[peer_connections.length-1].close();
//   console.log(sound_track_slots)
//  });

