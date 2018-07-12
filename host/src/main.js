'use strict';
var vad = require('../node_modules/voice-activity-detection/index.js');
var VideoStreamMerger = require('video-stream-merger')

var localStream;
var peer_con;
var remoteStream;
let remote_video_to_show;
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
var peer_connections = {};
var socket = io.connect(window.location.hostname+":9090");
// var socket = io.connect("ec2-18-220-215-162.us-east-2.compute.amazonaws.com:9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'turn:numb.viagenie.ca', "username":"saninosan@gmail.com","credential":"sanosano7"},
    {'urls': 'turn:d1.synergy.net:3478',"username":"synergy","credential":"q1w2e3"}
    // "turn:my_username@<turn_server_ip_address>", "credential":"my_password"
  ]
};


function sendMessage(message, peer_id, badge) {
  console.log("Meesage to",peer_id, "badge", badge);
  socket.emit('message', peer_id, badge, message);
}

// This client receives a message
socket.on('message', function(message, peer_id, badge) {
  console.log("Meesage from ",peer_id, "badge", badge);
  if (message.type === 'offer') {
    peer_connections[peer_id+badge].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(peer_id, badge);
  } else if (message.type === 'answer') {
    console.log("3 answer")
    peer_connections[peer_id+badge].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_connections[peer_id+badge].addIceCandidate(candidate);
    console.log("4 candidate");
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

function doAnswer(peer_id, badge) {
  console.log('Sending answer to peer.');
  peer_connections[peer_id+badge].createAnswer().then(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "badge": badge}),
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function  createPeerConnection(connection_type, peer_id, badge) {
  try {
    peer_connections[peer_id+badge] = new RTCPeerConnection(null);
    const peer_con = peer_connections[peer_id+badge];
    peer_con.peer_id = peer_id;
    peer_con.connection_type = connection_type;
    peer_con.setConfiguration(pcConfig);
    peer_con.onicecandidate = handleIceCandidate.bind({"peer_id": peer_id, "badge": badge});
    peer_con.onaddstream = handleRemoteStreamAdded;
    peer_con.onremovestream = handleRemoteStreamRemoved;
    peer_con.oniceconnectionstatechange = (event)=>{
      console.log("iceConnectionState", event.target.iceConnectionState);
      if (event.target.iceConnectionState == "completed"){
        socket.emit('connection_complete', peer_id, badge);
      }
    }
  } catch (e) {
    console.log(e);
    return;
  }
}

// function handleOnsignalingstatechange(event){
//   console.log("signal state",event.target.signalingState );
//   if (event.target.signalingState == "stable" && event.target.connection_type != 'peer_to_host'){
//     socket.emit('connection_complete');
//   }
// }
function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, this.peer_id, this.badge);
  }
}

function handleCreateOfferError(event) {}

function doCall(peer_id, badge) {
  peer_connections[peer_id+badge].createOffer(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "badge":badge}),
    handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  peer_connections[this.peer_id + this.badge].setLocalDescription(sessionDescription);
  sendMessage(sessionDescription, this.peer_id, this.badge);
}

function handleRemoteStreamRemoved(event) {}

function onCreateSessionDescriptionError(error) {}

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

socket.on('close_video_to_central', function (peer_id){
  peer_connections[peer_id+"to_main"].close();
  delete peer_connections[peer_id+"to_main"];
});

function close_connection_for_main_peer(){
  if (central_peer){
    return;
  }
  const keys = Object.keys(peer_connections);
  for (let i in keys) {
    const con = peer_connections[keys[i]];
    if (con.connection_type  == "to_main_host_sound"){
      console.log("delete connection");
      con.close()
      delete peer_connections[keys[i]]
    }
  }
}

socket.on('peer_to_host', function (peer_id, video_slot_pos, sock_id, badge){
  if (sock_id){
    current_sock_id = sock_id;
    Raven.setUserContext({
        sock_id: sock_id,
    })
    document.getElementById("client_id").innerText= "id - " +sock_id;
  }
  close_connection_for_main_peer();
  console.log(" 1 peer_to_host to", peer_id, badge);
  peer = peer_id;
  createPeerConnection('peer_to_host', peer_id, badge);
  console.log(" 2 create connection , video pos", video_slot_pos, "host id",  peer_id);
  peer_connections[peer_id+badge].host_id = peer_id;
  peer_connections[peer_id+badge].video_slot_pos = video_slot_pos;
});


socket.on('mute_own_channel', function (array_index) {
  merge_audio(array_index);
});

socket.on("close_current_connection", function () {
  if (central_peer){
    return;
  }
  const keys = Object.keys(peer_connections);
  for (let i in keys) {
    const con = peer_connections[keys[i]];
    con.close();
    delete peer_connections[keys[i]]
  }
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
var local_audio = document.querySelector('#audio_control');
function merge_audio(mute_slot=null){
  let source_steam = '';
  if (central_peer){
    source_steam = main_stream;
  }else{
    source_steam = remoteStream;
  }
  const sound_dest = audioContext.createMediaStreamDestination();

  const audio_streams = source_steam.getAudioTracks();
  for (let i in audio_streams){
    if (i == mute_slot){
      console.log("mute own chanel", i);
      continue;
    };
    const temp_sound_stream = new MediaStream();
    temp_sound_stream.addTrack(audio_streams[i]);
    const sound_source = audioContext.createMediaStreamSource(temp_sound_stream);
    const gain = audioContext.createGain() ;// Intermediate gain node
    gain.gain.value = 1;
    sound_source.connect(sound_dest);
  }
  remote_video_to_show = new MediaStream();
  remote_video_to_show.addTrack(source_steam.getVideoTracks()[0]);
  remote_video_to_show.addTrack(sound_dest.stream.getAudioTracks()[0]);
  remoteVideo.srcObject = remote_video_to_show;
}

socket.on('host_to_peer', function(peer_id, to_main, sound_only, badge) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id, badge);

  if (to_main){
    if (sound_only){
        createPeerConnection("to_main_host_sound", peer_id, badge);
        console.log("add stream id ", localStream.id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getAudioTracks()[0]);
        peer_connections[peer_id+badge].addStream(newStream);
        conn_to_central = peer_connections[peer_id + badge];
    }else {
        createPeerConnection("to_main_host_video", peer_id, badge);
        console.log("add stream id ", localStream.id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getVideoTracks()[0]);
        peer_connections[peer_id + badge].addStream(newStream);
    }
  } else {

    if (!central_peer) {
      createPeerConnection("peer transmit to peers", peer_id, badge);
      merger.addStream(remoteStream, {});
      merger.start();
      peer_connections[peer_id+badge].addStream(merger.result);
    } else {
      createPeerConnection("main transmit to peers", peer_id, badge);
      create_audio_track_slots(6);
      main_stream.addTrack(merger.result.getVideoTracks()[0]);
      // remoteVideo.srcObject = remote_video_to_show;
      remoteStream = main_stream;
      peer_connections[peer_id+badge].addStream(main_stream);
      merge_audio();
    }
  }
  doCall(peer_id, badge)
});

socket.on('first', function (sock_id){
  const new_button = document.createElement("button");
  document.body.appendChild(new_button);
  new_button.innerText = "restart";
  new_button.addEventListener("click", function(e) {
    socket.emit("restart");
  })
  current_sock_id = sock_id;
  Raven.setUserContext({
      sock_id: current_sock_id,
  })
  document.getElementById("client_id").innerText= "id - " + sock_id;
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
      socket.emit("mute_own_channel", free_slot.connection.host_id, i);
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
      const new_stream = event.stream;
      add_sound_track(event, new_stream);
    }

  } else {
    remoteStream = event.stream;
    merge_audio();
    const video_el = document.createElement("video"); // todo destroy element somehow
    video_el.srcObject = remoteStream;
  }
}

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
  localStream = stream;
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
    if (central_peer){
      add_sound_track({target:{host_id:current_sock_id}}, localStream);
    } else {
      socket.emit('voice_start', central_peer, true, true);
    }
  }else{
    e.target.innerText = "UNMUTE";
    if (conn_to_central){
      conn_to_central.close();
      is_host = false;
      conn_to_central = '';
      socket.emit('remove_stream', localStream.id );
    }
    if (central_peer) {
      console.log("m stream removed");
      socket.emit('remove_stream', localStream.id );
    }
    merge_audio();
  }

});

// function create_audio(){
//   add_voice_detection(localStream);
// };

// const restart_server = document.querySelector('#restart_server');
//  restart_server.addEventListener("click", function(e){
//   socket.emit("restart");
//  });


window.onbeforeunload = function() {
  socket.emit('remove_peer');
};
