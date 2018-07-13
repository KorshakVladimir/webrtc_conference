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

let c_sound_peer_ids  = [];
let c_video_peer_ids  = [];
let last_speaker = '';
let connection_pool = [];

function  get_new_peer(sock_id){
  return {"value": sock_id, "sub_network":[]}
}

function print_connection_pool(){
  console.log("start --------------------------------------------");
  for (let i in connection_pool){
    console.log(connection_pool[i]);
  }
}

setInterval(print_connection_pool, 5000);

var create_id = function () {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return '_' + Math.random().toString(36).substr(2, 9);
};

function create_connection(from_peer, to_peer, to_main, sound_only, video_slot_pos){
  // const badge =  to_main ? "to_main":"" + sound_only ? "sound_only":"";
  // if (connection_pool.indexOf(from_peer +"_"+ to_peer.value + badge)!=-1){
  //   console.log("duplicate connection", from_peer +"_"+ to_peer.value + badge)
  // }


  // connection_pool.push(to_peer.value +"_"+ from_peer + badge);
  const connection_id = create_id();
  connection_pool.push(connection_id);
  console.log("connect to host_to_peer", from_peer ,"to", to_peer.value);
  io.to(from_peer).emit("host_to_peer", to_peer.value, to_main, sound_only, connection_id);
  console.log("connect to peer_to_host", to_peer.value ,"to", from_peer);
  io.to(to_peer.value).emit("peer_to_host", from_peer, video_slot_pos, to_peer.value, connection_id);
}

function get_peer(cur_el_s){
  if (!cur_el_s){
    return
  }
  let candidates =[];
  for (let i = 0; i < cur_el_s.length; i++){
    candidates = candidates.concat(cur_el_s[i].sub_network);
    if (cur_el_s[i].sub_network.length<2) {
      return cur_el_s[i]
    }
  }
  if (candidates.length == 0){
    return ;
  }
  return get_peer([...candidates])
}

setInterval(()=>{
  if ((last_speaker && c_video_peer_ids.length == 4) && (c_video_peer_ids.indexOf(last_speaker) == -1)){
    for (let i=0;i<4; i++){
      if (i < c_video_peer_ids.length){
        const current_viedo = c_video_peer_ids[i];
        if (c_sound_peer_ids.indexOf(current_viedo) ==-1) {
          console.log("video slots replacements");
          if (current_viedo != network[0].value){
            io.to(current_viedo).emit('close_video_to_central', current_viedo);
          }
          create_connection(last_speaker, network[0], true, false, i);
          c_video_peer_ids.splice(i, 1, last_speaker);
          break;
        }
      }
    }
    last_speaker = ''
  }
}, 500)

io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  socket.on('connection_complete', function(peer_id, conn_id){
    // console.log("connection_complete");
    const index = connection_pool.indexOf(conn_id)
    if (index == -1){
      console.log("something wrong with connection don`t found", conn_id)
    } else {
      connection_pool.splice(index, 1);
    }
    print_connection_pool();
  });
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
      // setTimeout(()=>{
      last_speaker = socket.id;
      // }, 1000);
      create_connection(socket.id, network[0], to_main, sound_only);
    }
  });

  socket.on('add_video_to_central', function() {
      create_connection(socket.id, network[0], true, false);
  });
  // socket.on('close_video_to_central', function(peer_id) {

  // });
  socket.on('message', function(peer, conn_id, message) {
    io.to(peer).emit('message', message, socket.id, conn_id);
  });

  socket.on('create or join', function(room) {
    // clients.push(socket.id);
    socket.join(room);
    io.clients((error, clients) => {
      if (error) throw error;
      console.log("connection length", clients.length); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
    })
    if (network.length == 0) {
      network.push(get_new_peer(socket.id));
      io.to(socket.id).emit('first', socket.id);
      c_video_peer_ids.push(socket.id);
    } else {
      // const last = clients.slice(-2)[0];
      const peer = get_peer(network);
      peer.sub_network.push(get_new_peer(socket.id));
      const last = peer.value;
      // io.to(socket.id).emit('peer_to_host', last, 0, socket.id);
      // io.to(last).emit("host_to_peer", socket.id);
      create_connection(last, {"value":socket.id}, false, false, 0);
      if (c_video_peer_ids.length < 4) {
        // setTimeout(()=>{
          const position = c_video_peer_ids.push(socket.id) - 1;
          create_connection(socket.id, network[0], true, false, position)
        // }, 200)
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
  function find_peer(el, net_el) {
    if (net_el == undefined) {

      console.log("something wrong with find peer for ", el);

    }
    if (net_el.value == el) {
      return {"parent":'', "children":net_el.sub_network}
    }
    for (let i =0; i<net_el.sub_network.length; i++) {
      const peer = net_el.sub_network[i];
      if (peer.value == el) {

        return {"parent":net_el, "children":peer.sub_network}
      }
      const peers_for_restore = find_peer(el, peer.sub_network);
      if (peers_for_restore){
        return peers_for_restore;
      }
    }
    return ''
  }
 function restore_connection(peers_for_restore, subst_peer) {
  if (!peers_for_restore){
    return;
  }
   create_connection(peers_for_restore.parent.value, subst_peer);
   const new_peer = get_new_peer(subst_peer);
   for (let i=0; i< peers_for_restore.children.length; i++ ){
     const children_peer = peers_for_restore.children[i];
     if (children_peer.value == new_peer.value ) {
       continue
     }
     create_connection(subst_peer, children_peer.value);
     new_peer.sub_network.push(children_peer)
   }
   peers_for_restore.parent.sub_network.push(new_peer);
 }
 socket.on('remove_peer', function() {
   console.log("we lost", socket.id)
    const subst_peer = get_peer(network);
    if (!subst_peer || !network || socket.id){
      return
    }
    const index_for_video = c_video_peer_ids.indexOf(socket.id);
    if (index_for_video != -1){
      c_video_peer_ids.splice(index_for_video, 1);
    }
    const peers_for_restore = find_peer(socket.id, network[0]);
    if (!peers_for_restore.parent && !peers_for_restore.children){
      return
    }
    restore_connection(peers_for_restore, subst_peer);
    io.to(subst_peer).emit('close_current_connection');
  });
  socket.on('restart', function() {
    network = [];
    io.close()
  })
});
