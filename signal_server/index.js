'use strict';

// var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
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
    if (clients.length == 1){
      return;
    }
    socket.broadcast.emit('remove_host');
    const pos_el = clients.indexOf(socket.id);
    on_remove_peer(socket.id);
    clients = [socket.id, ...clients];
    const peer_host = pos_el;
    const peer_client = clients[1];
    io.to(peer_host).emit("host_to_peer", peer_client);
    io.to(peer_client).emit("peer_to_host", peer_host);
  });

  socket.on('message', function(peer, message) {
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    console.log("clients",clients);
    clients.push(socket.id);
    if (clients.length == 1){
        io.to(socket.id).emit('first');
        return
    }
    socket.join(room);
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
 function on_remove_peer(socket_id) {
    const pos_el = clients.indexOf(socket_id);
    if (pos_el==0) {
      clients.splice(pos_el, 1);
      return;
    }
    const peer_host = clients[pos_el - 1];
    const peer_client = clients[pos_el + 1];
    io.to(peer_host).emit("host_to_peer", peer_client);
    io.to(peer_client).emit("peer_to_host", peer_host);
    console.log("clients for remove", clients);
    clients.splice(pos_el, 1);
 }
  socket.on('remove_peer', function(){
    on_remove_peer(socket.id);
  });

});
