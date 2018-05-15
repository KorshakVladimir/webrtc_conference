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
var clients = [];

var current_host = '';
io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('voice_start', function() {
    console.log("voice_start");
    if (clients.length == 1){
      return;
    }
    socket.broadcast.emit('remove_host');

    if (clients.length > 2){
      restore_connection(socket.id);
    } else {
      const pos_el = clients.indexOf(socket.id);
      clients.splice(pos_el, 1);
    }
    clients = [socket.id, ...clients];
    const peer_host = socket.id;
    const peer_client = clients[1];
    console.log("connect to host_to_peer", peer_host ,"to", peer_client);
    io.to(peer_host).emit("host_to_peer", peer_client);
    console.log("connect to peer_to_host", peer_client ,"to", peer_host);
    io.to(peer_client).emit("peer_to_host", peer_host);
  });

  socket.on('message', function(peer, message) {
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    console.log("clients",clients);
    clients.push(socket.id);
    socket.join(room);

    if (clients.length == 1){
        io.to(socket.id).emit('first');
        return
    }
    const last = clients.slice(-2)[0];
    console.log("last", last);
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
    const pos_el = clients.indexOf(socket_id);
    if (pos_el == -1) {
      return;
    }
    clients.splice(pos_el, 1);
    console.log("clients left", clients);
    const peer_host = clients[pos_el - 1];
    const peer_client = clients[pos_el];
    io.to(peer_host).emit("host_to_peer", peer_client);
    io.to(peer_client).emit("peer_to_host", peer_host);
 }
  socket.on('remove_peer', function() {
    restore_connection(socket.id);
  });

});
