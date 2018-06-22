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
var clients = {};

var current_host = '';

function  new_peer(sock_id){
  return {"value": sock_id, "sub_network":[]}
}

function create_connection(from_peer, to_peer){
  const peer_host = from_peer;
  const peer_client = to_peer;
  console.log("connect to host_to_peer", peer_host ,"to", peer_client.value);
  io.to(peer_host).emit("host_to_peer", peer_client.value);
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

  socket.on('voice_start', function(is_central) {
    console.log("voice_start  for central ", is_central);
    if (clients.value == ''){
      return;
    }
    socket.broadcast.emit('remove_host');
    if (!is_central){
      create_connection(socket.id, clients);
    }
  });

  socket.on('message', function(peer, message) {
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    // clients.push(socket.id);
    socket.join(room);
    io.clients((error, clients) =>{
      console.log(clients.length);
    })
    if (Object.keys(clients).length == 0){
        clients = new_peer(socket.id);
        io.to(socket.id).emit('first');
        return
    }
    // const last = clients.slice(-2)[0];
    const peer = get_peer([clients]);
    peer.sub_network.push(new_peer(socket.id));
    const last = peer.value;
    io.to(socket.id).emit('peer_to_host', last, socket.id);
    io.to(last).emit("host_to_peer", socket.id);
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
