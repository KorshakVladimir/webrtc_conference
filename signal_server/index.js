'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(9090);


var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(peer, message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    // socket.broadcast.emit('message', message);
    io.to(peer).emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      // log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', socket.id);

    } else {
      io.in('foo').clients((error, clients) => {
        socket.join(room);
        var last = clients.slice(-1)[0];
        // console.log('host', last);
        socket.emit('join', last, socket.id);
        io.to(last).emit("joined", socket.id);
        // console.log('peer ', socket.id);
      });
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('remove_peer', function(){
    io.in('foo').clients((error, clients) => {
        console.log("yahoo");
        const pos_el = clients.indexOf(socket.id);
        // console.log('pos_el', pos_el);
        if (pos_el==0) {
            return;
        }
        const peer_host = clients[pos_el - 1];
        const peer_client = clients[pos_el + 1];
        // console.log('peer_host', peer_host);
        // console.log('peer_client', peer_client);
        io.to(peer_host).emit("joined", peer_client);
        io.to(peer_client).emit("join", peer_host);
        clients.splice(pos_el, 1);
    });
  });

});
