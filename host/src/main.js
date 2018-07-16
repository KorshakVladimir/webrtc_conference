'use strict';
var VideoStreamMerger = require('video-stream-merger');
let assert = require('assert');
let vad = require('voice-activity-detection');

var localStream;
var remoteStream;
let remote_video_to_show;
var peer;
let conn_to_central;
var is_host = false;
var central_peer = false;
let current_sock_id = '';

const sound_track_slots = [];
var merger = new VideoStreamMerger();
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
const main_stream = new MediaStream();
let connection_for_transmit;
const AUDIO_SLOTS = 5;

audioContext = new AudioContext();
/////////////////////////////////////////////

var room = 'foo';
var peer_connections = {};
var socket = io.connect(window.location.hostname + ":9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'turn:numb.viagenie.ca', "username":"saninosan@gmail.com","credential":"sanosano7"},
    {'urls': 'turn:d1.synergy.net:3478',"username":"synergy","credential":"q1w2e3"}
    // "turn:my_username@<turn_server_ip_address>", "credential":"my_password"
  ]
};


function sendMessage(message, peer_id, conn_id) {
  socket.emit('message', peer_id, conn_id, message);
}

// This client receives a message
socket.on('message', function(message, peer_id, conn_id) {
  if (message.type === 'offer') {
    peer_connections[conn_id].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(peer_id, conn_id);
  } else if (message.type === 'answer') {
    peer_connections[conn_id].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_connections[conn_id].addIceCandidate(candidate);
  }
});

function doAnswer(peer_id, conn_id) {
  peer_connections[conn_id].createAnswer().then(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "conn_id": conn_id}),
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function  createPeerConnection(connection_type, peer_id, conn_id) {
  try {
    const peer_con_1 = new RTCPeerConnection(null);
    peer_connections[conn_id] = peer_con_1;
    peer_con_1.peer_id = peer_id;
    peer_con_1.connection_type = connection_type;
    peer_con_1.setConfiguration(pcConfig);
    peer_con_1.onicecandidate = handleIceCandidate.bind({"peer_id": peer_id, "conn_id": conn_id});
    peer_con_1.onaddstream = handleRemoteStreamAdded;
    peer_con_1.onremovestream = handleRemoteStreamRemoved;
    peer_con_1.oniceconnectionstatechange = (event)=>{
      if (event.target.iceConnectionState == "completed") {
        socket.emit('connection_complete', peer_id, conn_id);
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
    }, this.peer_id, this.conn_id);
  }
}

function handleCreateOfferError(event) {}

function doCall(peer_id, conn_id) {
  peer_connections[conn_id].createOffer(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "conn_id":conn_id}),
    handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  peer_connections[this.conn_id].setLocalDescription(sessionDescription);
  sendMessage(sessionDescription, this.peer_id, this.conn_id);
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
  console.log("close_video_to_central");
  console.log(peer_connections);
  console.log(peer_id);
  const keys = Object.keys(peer_connections);
  for (let i=0; i<keys; i++){
    if (peer_connections[i].connection_type == "to_main_host_video"){
      console.log("close connection", keys[i])
      peer_connections[i].close();
      delete peer_connections[i];
    }
  }
});

function close_connection_for_main_peer(){
  if (central_peer){
    return;
  }
  const keys = Object.keys(peer_connections);
  for (let i in keys) {
    const con = peer_connections[keys[i]];
    if (con.connection_type  == "to_main_host_sound"){
      console.log("close connection", keys[i])
      con.close()
      delete peer_connections[keys[i]]
    }
  }
}

socket.on('peer_to_host', function (peer_id, video_slot_pos, sock_id, conn_id){
  if (!merger.started){
    merger.start();
    merger.result.removeTrack(merger.result.getAudioTracks()[0]);
    create_audio_track_slots(merger.result, AUDIO_SLOTS);
  }
  if (sock_id){
    current_sock_id = sock_id;
    Raven.setUserContext({
        sock_id: sock_id,
    })
    document.getElementById("client_id").innerText= "id - " +sock_id;
  }
  close_connection_for_main_peer();
  peer = peer_id;
  createPeerConnection('peer_to_host', peer_id, conn_id);
  peer_connections[conn_id].host_id = peer_id;
  peer_connections[conn_id].video_slot_pos = video_slot_pos;
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
    console.log("close connection", keys[i])
    con.close();
    delete peer_connections[keys[i]]
  }
});

function create_audio_track_slots(stream, stream_count) {
  if (sound_track_slots.length == stream_count) {
    return;
  }
  for (let i=0; i<stream_count; i++){
    const  track = {source:'', state:'free'};
    track.gain  = audioContext.createGain();
    track.gain.gain.value = 1;
    track.dest = audioContext.createMediaStreamDestination();
    track.gain.connect(track.dest);
    stream.addTrack(track.dest.stream.getAudioTracks()[0]);
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
  if (source_steam == undefined){
    return merge_audio(mute_slot)
  }
  const sound_dest = audioContext.createMediaStreamDestination();

  const audio_streams = source_steam.getAudioTracks();
  assert.equal(audio_streams.length, AUDIO_SLOTS, "all peers must got the same count if audio slots");
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

function synchronize_audio_tracks(remote_stream_source){
  const audio_tracks = remote_stream_source.getAudioTracks();
  assert.equal(audio_tracks.length, AUDIO_SLOTS, "AUDIO_SLOTS missing 1");
  assert.equal(audio_tracks.length, sound_track_slots.length, "audio_tracks sound_track_slots 2");
  for (let i in sound_track_slots) {
    const slot = sound_track_slots[i];
    const audio_el = document.createElement("audio"); // todo destroy element somehow
    const new_media_stream =  new MediaStream();
    new_media_stream.addTrack(audio_tracks[i])
    audio_el.srcObject = new_media_stream;
    const source = audioContext.createMediaStreamSource(new_media_stream);
    const gain = audioContext.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    slot.gain = gain;
    gain.connect(slot.dest);
  }
}

socket.on('host_to_peer', function(peer_id, to_main, sound_only, conn_id) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id, conn_id);

  if (to_main){
    if (sound_only){
        createPeerConnection("to_main_host_sound", peer_id, conn_id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getAudioTracks()[0]);
        peer_connections[conn_id].addStream(newStream);
        conn_to_central = peer_connections[conn_id];
    }else {
        createPeerConnection("to_main_host_video", peer_id, conn_id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getVideoTracks()[0]);
        peer_connections[conn_id].addStream(newStream);
    }
  } else {

    if (!central_peer) {
      createPeerConnection("peer transmit to peers", peer_id, conn_id);
      peer_connections[conn_id].addStream(merger.result);
      connection_for_transmit = peer_connections[conn_id]
    } else {
      createPeerConnection("main transmit to peers", peer_id, conn_id);
      create_audio_track_slots(main_stream, AUDIO_SLOTS);
      main_stream.addTrack(merger.result.getVideoTracks()[0]);
      // remoteVideo.srcObject = remote_video_to_show;
      remoteStream = main_stream;
      peer_connections[conn_id].addStream(main_stream);
      merge_audio();
    }
  }
  doCall(peer_id, conn_id)
});

socket.on('first', function (sock_id){
  const new_button = document.createElement("button");
  document.body.appendChild(new_button);
  new_button.innerText = "restart";
  new_button.addEventListener("click", function(e) {
    socket.emit("restart");
  });
  current_sock_id = sock_id;
  Raven.setUserContext({
      sock_id: current_sock_id,
  });
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
      return;
    }
  }
  throw "maximum count of sound track"
}

function handleRemoteStreamAdded(event) {
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
    merger.addStream(remoteStream, {mute:true});
    synchronize_audio_tracks(remoteStream);
    merge_audio();
    const video_el = document.createElement("video"); // todo destroy element somehow
    video_el.srcObject = remoteStream;
  }
}

function gotStream(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  localStream.getAudioTracks()[0].enabled = false;
  socket.emit('create or join', room);
  vad(audioContext, localStream ,
    {
      onVoiceStart: function() {
        socket.emit('show_my_video');
      },
      // onVoiceStop: function() {
      //   console.log('voice stop');
      //   stateContainer.innerHTML = 'Voice state: <strong>inactive</strong>';
      // },
      // onUpdate: function(val) {
      //   //console.log('curr val:', val);
      //   valueContainer.innerHTML = 'Current voice activity value: <strong>' + val + '</strong>';
      // }
    }
  );
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
      socket.emit('remove_stream', localStream.id );
    }
    merge_audio();
  }
});

// const restart_server = document.querySelector('#restart_server');
//  restart_server.addEventListener("click", function(e){
//   socket.emit("restart");
//  });


window.onbeforeunload = function() {
  socket.emit('remove_peer');
};
