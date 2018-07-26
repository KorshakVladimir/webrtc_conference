'use strict';

// var os = require('os');
var nodeStatic = require('node-static');
var http = require('https');
const fs = require('fs');
var socketIO = require('socket.io');
var argv = require('minimist')(process.argv.slice(2));
var session_id = ""
var sub_network_size = 3;
const argv_keys =  Object.keys(argv);
var peer_count = 0;
const close_current_connection_data = {};
let weak_peer_id = '';
const weak_peer_list = [];

if (argv_keys.indexOf("n")!=-1){
  sub_network_size = argv["n"]
}
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
let video_slot_position = 0;

function  get_new_peer(sock_id){
  return {"value": sock_id, "sub_network":[]}
}

function print_connection_pool(){
  // console.log("start --------------------------------------------");
  for (let i in connection_pool){
    // console.log(connection_pool[i]);
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
  if (from_peer == to_peer){
    return;
  }
  if (!from_peer){
    console.error("create_connection from_peer is", from_peer);
  }
  if (!to_peer){
    console.error("create_connection to_peer is", to_peer);
  }
  // const badge =  to_main ? "to_main":"" + sound_only ? "sound_only":"";
  // if (connection_pool.indexOf(from_peer +"_"+ to_peer.value + badge)!=-1){
  //   console.log("duplicate connection", from_peer +"_"+ to_peer.value + badge)
  // }


  // connection_pool.push(to_peer.value +"_"+ from_peer + badge);
  const connection_id = create_id();
  connection_pool.push(connection_id);
  // console.log("connect to host_to_peer", from_peer ,"to", to_peer.value);
  io.to(from_peer).emit("host_to_peer", to_peer, to_main, sound_only, connection_id);
  // console.log("connect to peer_to_host", to_peer.value ,"to", from_peer);
  io.to(to_peer).emit("peer_to_host", from_peer, video_slot_pos, to_peer, connection_id);
}

function get_peer(cur_el_s, single = false){
  let candidates =[];
  // if (network[0].sub_network.length == 1 && cur_el_s.length == 1 && cur_el_s[0].value == network[0].value){
  //   candidates = candidates.concat(network[0].sub_network)
  //   return get_peer([...candidates], single)
  // }
  if (!cur_el_s){
    return
  }

  for (let i = 0; i < cur_el_s.length; i++){
    candidates = candidates.concat(cur_el_s[i].sub_network);
    if (cur_el_s[i].sub_network.length < sub_network_size) {
      if (!single){
        return cur_el_s[i]
      } else if (cur_el_s[i].sub_network.length == 0) {
        return cur_el_s[i]
      }
    }
  }
  if (candidates.length == 0){
    return ;
  }
  return get_peer([...candidates], single)
}

setInterval(()=>{
  if ((last_speaker && c_video_peer_ids.length == 4) && (c_video_peer_ids.indexOf(last_speaker) == -1)){
    for (let i=0;i<4; i++){
      if (i < c_video_peer_ids.length){
        const current_viedo = c_video_peer_ids[i];
        if (c_sound_peer_ids.indexOf(current_viedo) == -1) {
          console.log("video slots replacements");
          if (current_viedo != network[0].value){
            io.to(current_viedo).emit('close_video_to_central', current_viedo);
          }
          create_connection(last_speaker, network[0].value, true, false, i);
          if (last_speaker == network[0].value){
            io.to(network[0].value).emit("show_central_peer_video", i)
          }
          c_video_peer_ids[i] = last_speaker;
          video_slot_position = i;
          return;
        }
      }
    }
    if (video_slot_position == 3) {
      video_slot_position = 0;
    } else {
      video_slot_position = video_slot_position + 1;
    }
    console.log("video_slot_position", video_slot_position);
    io.to(c_video_peer_ids[video_slot_position]).emit('close_video_to_central', c_video_peer_ids[video_slot_position]);
    create_connection(last_speaker, network[0].value, true, false, video_slot_position);
    c_video_peer_ids[video_slot_position] = last_speaker;
    last_speaker = ''
  }
}, 500);

io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  socket.on('connection_complete', function(peer_id, conn_id, state){
    // console.log("connection_complete");
    const index = connection_pool.indexOf(conn_id)
    if (index == -1){
      console.log("something wrong with connection don`t found", conn_id, state)
    } else {
      console.log("colose connection", conn_id, state)
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
    console.log("voice_start  for central is_central ", is_central);
    if (network[0].value == ''){
      return;
    }
    if (c_sound_peer_ids.length == 4){
      io.to(socket.id).emit('all_slots_are_in_use');
      return;
    }
    c_sound_peer_ids.push(socket.id);

    if (!is_central){
      create_connection(socket.id, network[0].value, true, true);
    }
  });
  socket.on("show_my_video", function () {
    last_speaker = socket.id;
  });

  // socket.on('add_video_to_central', function() {
  //     create_connection(socket.id, network[0], true, false);
  // });
  // socket.on('close_video_to_central', function(peer_id) {

  // });
  socket.on('message', function(peer, conn_id, message) {
    io.to(peer).emit('message', message, socket.id, conn_id);
  });

  function add_peer_to_network(socket_id) {
    const peer = get_peer(network);
    // console.log(peer);
    peer.sub_network.push(get_new_peer(socket_id));
    const last = peer.value;
    create_connection(last, socket_id, false, false, 0);
    if (c_video_peer_ids.length < 4) {
      // setTimeout(()=>{
        const position = c_video_peer_ids.push(socket_id) - 1;
        create_connection(socket_id, network[0].value, true, false, position)
      // }, 200)
    }
  }

  socket.on('create or join', function(room) {
    socket.join(room);
    peer_count = peer_count + 1;
    console.log("name ", peer_count);
    io.to(socket.id).emit('peer_count', peer_count);
    io.clients((error, clients) => {
      if (error) throw error;
      console.log("connection length", clients.length); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
    })
    if (network.length == 0) {
      network.push(get_new_peer(socket.id));
      io.to(socket.id).emit('first', socket.id);
      c_video_peer_ids.push(socket.id);
      session_id =  create_id();
    } else {
      // const last = clients.slice(-2)[0];
      add_peer_to_network(socket.id);
    }
    io.to(socket.id).emit('session_id', session_id);
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
      return;
    }
    if (net_el.value == el) {
      return {"parent":'', "children":net_el.sub_network}
    }
    for (let i =0; i < net_el.sub_network.length; i++) {
      const peer = net_el.sub_network[i];
      if (peer.value == el) {

        return {"parent":net_el, "children":peer.sub_network, index_of_el: i}
      }
      const peers_for_restore = find_peer(el, peer);
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
  create_connection(peers_for_restore.parent.value, subst_peer.value);
  console.log("restore connection 0", peers_for_restore.parent.value, subst_peer.value);
   // const new_peer = get_new_peer(subst_peer.value);
   for (let i=0; i< peers_for_restore.children.length; i++ ){
     const children_peer = peers_for_restore.children[i];
     if (children_peer.value == subst_peer.value ) {
       continue;
     }
     console.log("restore connection 1", subst_peer.value, children_peer.value);
     create_connection(subst_peer.value, children_peer.value);
     // new_peer.sub_network.push(children_peer)
   }
   // peers_for_restore.parent.sub_network.push(new_peer);
 }

 function remove_peer(socket_id){
    console.log("we lost", socket_id)
    const sound_id_pos = c_sound_peer_ids.indexOf(socket_id)
    if (sound_id_pos != -1){
      c_sound_peer_ids.splice(sound_id_pos, 1);
    }
    const index_for_video = c_video_peer_ids.indexOf(socket_id);
    if (index_for_video != -1){
      c_video_peer_ids.splice(index_for_video, 1);
    }
    if (!network || !socket_id){
      return
    }
    const peers_for_restore = find_peer(socket_id, network[0]);
    // console.log("peers_for_restore",peers_for_restore);
    if (!peers_for_restore){
      return
    }
    if (peers_for_restore.children.length == 0){
      return
    }

    const subst_peer = get_peer(network, true);

    const subst_peer_parent_network = peers_for_restore.parent.sub_network;
    if (subst_peer_parent_network == undefined) {
      return;
    }
    // for (let i=0; i < subst_peer_parent_network.length; i++) {
    //   if(subst_peer_parent_network[i].value == socket_id){
    //     subst_peer_parent_network.splice(i,1);
    //     break;
    //   }
    // }
    const subst_peer_pos = find_peer(subst_peer.value, network[0]);
    peers_for_restore.parent.sub_network.splice(peers_for_restore.index_of_el, 1);

    subst_peer_pos.parent.sub_network.splice(subst_peer_pos.index_of_el, 1);
    peers_for_restore.parent.sub_network.push(subst_peer);
    for (let i=0; i < peers_for_restore.children.length; i++) {
      subst_peer.sub_network.push(peers_for_restore.children[i]);
    }
    // console.log("peers_for_restore", peers_for_restore);
    // console.log("subst_peer", subst_peer);
    io.to(subst_peer.value).emit('close_current_connection');
    close_current_connection_data[subst_peer.value] = {peers_for_restore:peers_for_restore, subst_peer:subst_peer};

    // setTimeout(()=>restore_connection(peers_for_restore, subst_peer), 1000);
 }
 socket.on('close_current_connection_done', function() {
    const data = close_current_connection_data[socket.id];
    const peers_for_restore = data.peers_for_restore;
    const subst_peer = data.subst_peer;
    restore_connection(peers_for_restore, subst_peer);
    delete  close_current_connection_data[socket.id];
 });

 socket.on('remove_peer', function(id) {
   if (session_id != id) {
     return;
   }
   remove_peer(socket.id);
  });
  socket.on('restart', function() {
    network = [];
    io.close()
  });
  socket.on('weak_parent', function(peer_id, conn_id) {

    if (weak_peer_id == '' && weak_peer_list.indexOf(peer_id) == -1){
      weak_peer_list.push(peer_id);
      console.log("weak_parent");
      weak_peer_id = peer_id;
      remove_peer(weak_peer_id);
      console.log(network)
      add_peer_to_network(weak_peer_id);
      setTimeout(()=>{weak_peer_id =''}, 25000);
    }
  })

  socket.on('close_specific_connection', function(peer_id,conn_id) {
    io.to(peer_id).emit("close_specific_connection", conn_id);

  })
});
