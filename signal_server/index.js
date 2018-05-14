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
    clients = [pos_el, ...clients];
    const peer_host = pos_el;
    const peer_client = clients[1];
    io.to(peer_host).emit("joined", peer_client);
    io.to(peer_client).emit("join", peer_host);
  });

  socket.on('message', function(peer, message) {
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    clients.push(socket.id);
    // const numClients = clients.length;

    // if (numClients === 0) {
    //   socket.join(room);
    //   socket.emit('created', socket.id);
    //   current_host = socket.id;
    //
    // } else {
    socket.join(room);
    const last = clients.slice(-1)[0];
    io.to(socket.id).emit('join', last, socket.id);
    io.to(last).emit("host_to_peer", socket.id);
    // }
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
        return;
    }
    const peer_host = clients[pos_el - 1];
    const peer_client = clients[pos_el + 1];
    io.to(peer_host).emit("joined", peer_client);
    io.to(peer_client).emit("join", peer_host);
    clients.splice(pos_el, 1);
 }
  socket.on('remove_peer', function(){
    on_remove_peer(socket.id);
  });

});
