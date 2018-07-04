'use strict';

// var os = require('os');
var nodeStatic = require('node-static');
var http = require('https');
const fs = require('fs');
var socketIO = require('socket.io');

const options = {
  key: fs.readFileSync('../ssl/nginx.key'),
  cert: fs.readFileSync('../ssl/nginx.crt')
};
var fileServer = new(nodeStatic.Server)();
var app = http.createServer(options, function(req, res) {
  fileServer.serve(req, res);
}).listen(9090);

var io = socketIO.listen(app);
var network = [];
var central_peer_id = '';

let c_sound_peer_ids  = [];
let c_video_peer_ids  = [];

function  get_new_peer(sock_id){
  return {"value": sock_id, "sub_network":[]}
}

function create_connection(from_peer, to_peer, to_main, sound_only){
  const peer_host = from_peer;
  const peer_client = to_peer;
  console.log("connect to host_to_peer", peer_host ,"to", peer_client.value);
  io.to(peer_host).emit("host_to_peer", peer_client.value, to_main, sound_only);
  console.log("connect to peer_to_host", peer_client.value ,"to", peer_host);
  io.to(peer_client.value).emit("peer_to_host", peer_host);
}

function get_peer(cur_el_s){
  let candidates =[];
  for (let i = 0; i < cur_el_s.length; i++){
    candidates = candidates.concat(cur_el_s[i].sub_network);
    if (cur_el_s[i].sub_network.length<3) {
      return cur_el_s[i]
    }
  }
  if (candidates.length == 0){
    return ;
  }
  return get_peer([...candidates])
}

io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('remove_stream', function(stream_id) {
    io.to(network[0].value).emit('remove_stream', stream_id, socket.id);
    const pos = c_sound_peer_ids.indexOf(socket.id);
    c_sound_peer_ids.splice(pos, 1);
  });
  socket.on('voice_start', function(is_central, to_main, sound_only) {
    console.log("voice_start  for central ", is_central);
    if (network.value == ''){
      return;
    }
    if (!is_central){
      c_sound_peer_ids.push(socket.id);
      create_connection(socket.id, network[0], to_main, sound_only);
    }
  });

  socket.on('add_video_to_central', function() {
      create_connection(socket.id, network[0], true, false);
  });
  socket.on('close_video_to_central', function(peer_id) {
      io.to(peer_id).emit('close_video_to_central');
  });
  socket.on('message', function(peer, message) {
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    // clients.push(socket.id);
    socket.join(room);
    if (network.length == 0) {
      network.push(get_new_peer(socket.id));
      io.to(socket.id).emit('first');
    } else {
      // const last = clients.slice(-2)[0];
      const peer = get_peer(network);
      peer.sub_network.push(get_new_peer(socket.id));
      const last = peer.value;
      io.to(socket.id).emit('peer_to_host', last, socket.id);
      io.to(last).emit("host_to_peer", socket.id);
      if (c_video_peer_ids.length < 3) {
        setTimeout(()=>{
          c_video_peer_ids.push(socket.id);
          create_connection(socket.id, network[0], true, false)
        }, 2000)
      }
    }

  });
  socket.on('mute_own_channel', function(peer_id, array_index) {
      io.to(peer_id).emit('mute_own_channel', array_index);
  });

  // socket.on('ipaddr', function() {
  //   var ifaces = os.networkInterfaces();
  //   for (var dev in ifaces) {
  //     ifaces[dev].forEach(function(details) {
  //       if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
  //         socket.emit('ipaddr', details.address);
  //       }
  //     });
  //   }
  // });
 function restore_connection(socket_id) {
   // restore connection for peer if peer between was droped
   //  const pos_el = clients.indexOf(socket_id);
   //  if (pos_el == -1) {
   //    return;
   //  }
   //  clients.splice(pos_el, 1);
   //  console.log("clients left", clients);
   //  const peer_host = clients[pos_el - 1];
   //  const peer_client = clients[pos_el];
   //  io.to(peer_host).emit("host_to_peer", peer_client);
   //  io.to(peer_client).emit("peer_to_host", peer_host);
 }
  socket.on('remove_peer', function() {
    // restore_connection(socket.id);
  });

});
