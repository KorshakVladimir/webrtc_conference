/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

/* globals window */

module.exports = VideoStreamMerger

function VideoStreamMerger (opts) {
  var self = this
  if (!(self instanceof VideoStreamMerger)) return new VideoStreamMerger(opts)

  opts = opts || {}

  var AudioContext = window.AudioContext || window.webkitAudioContext
  var audioSupport = !!(AudioContext && (self._audioCtx = (opts.audioContext || new AudioContext())).createMediaStreamDestination)
  var canvasSupport = !!document.createElement('canvas').captureStream
  var supported = audioSupport && canvasSupport
  if (!supported) {
    throw new Error('Unsupported browser')
  }
  self.width = opts.width || 400
  self.height = opts.height || 300
  self.fps = opts.fps || 25
  self.clearRect = opts.clearRect === undefined ? true : opts.clearRect

  // Hidden canvas element for merging
  self._canvas = document.createElement('canvas')
  self._canvas.setAttribute('width', self.width)
  self._canvas.setAttribute('height', self.height)
  self._canvas.setAttribute('style', 'position:fixed; left: 110%; pointer-events: none') // Push off screen
  self._ctx = self._canvas.getContext('2d')

  self._streams = []

  self._audioDestination = self._audioCtx.createMediaStreamDestination()

  self._setupConstantNode() // HACK for wowza #7, #10

  self.started = false
  self.result = null

  self._backgroundAudioHack()
}

VideoStreamMerger.prototype.getAudioContext = function () {
  var self = this
  return self._audioCtx
}

VideoStreamMerger.prototype.getAudioDestination = function () {
  var self = this
  return self._audioDestination
}

VideoStreamMerger.prototype.getCanvasContext = function () {
  var self = this
  return self._ctx
}

VideoStreamMerger.prototype._backgroundAudioHack = function () {
  var self = this

  // stop browser from throttling timers by playing almost-silent audio
  var source = self._audioCtx.createConstantSource()
  var gainNode = self._audioCtx.createGain()
  gainNode.gain.value = 0.001 // required to prevent popping on start
  source.connect(gainNode)
  gainNode.connect(self._audioCtx.destination)
  source.start()
}

VideoStreamMerger.prototype._setupConstantNode = function () {
  var self = this

  var constantAudioNode = self._audioCtx.createConstantSource()
  constantAudioNode.start()

  var gain = self._audioCtx.createGain() // gain node prevents quality drop
  gain.gain.value = 0

  constantAudioNode.connect(gain)
  gain.connect(self._audioDestination)
}

VideoStreamMerger.prototype.updateIndex = function (mediaStream, index) {
  var self = this

  if (typeof mediaStream === 'string') {
    mediaStream = {
      id: mediaStream
    }
  }

  index = index == null ? self._streams.length : index

  for (var i = 0; i < self._streams.length; i++) {
    if (mediaStream.id === self._streams[i].id) {
      var stream = self._streams.splice(i, 1)[0]
      stream.index = index
      self._streams.splice(stream.index, 0, stream)
    }
  }
}

// convenience function for adding a media element
VideoStreamMerger.prototype.addMediaElement = function (id, element, opts) {
  var self = this

  opts = opts || {}

  opts.x = opts.x || 0
  opts.y = opts.y || 0
  opts.width = opts.width || self.width
  opts.height = opts.height || self.height
  opts.mute = opts.mute || opts.muted || false

  opts.oldDraw = opts.draw
  opts.oldAudioEffect = opts.audioEffect

  if (element.tagName === 'VIDEO') {
    opts.draw = function (ctx, _, done) {
      if (opts.oldDraw) {
        opts.oldDraw(ctx, element, done)
      } else {
        ctx.drawImage(element, opts.x, opts.y, opts.width, opts.height)
        done()
      }
    }
  } else {
    opts.draw = null
  }

  if (!opts.mute) {
    var audioSource = element._mediaElementSource || self.getAudioContext().createMediaElementSource(element)
    element._mediaElementSource = audioSource // can only make one source per element, so store it for later (ties the source to the element's garbage collection)
    audioSource.connect(self.getAudioContext().destination) // play audio from original element

    var gainNode = self.getAudioContext().createGain()
    audioSource.connect(gainNode)
    if (element.muted) {
      // keep the element "muted" while having audio on the merger
      element.muted = false
      element.volume = 0.001
      gainNode.gain.value = 1000
    } else {
      gainNode.gain.value = 1
    }
    opts.audioEffect = function (_, destination) {
      if (opts.oldAudioEffect) {
        opts.oldAudioEffect(gainNode, destination)
      } else {
        gainNode.connect(destination)
      }
    }
    opts.oldAudioEffect = null
  }

  self.addStream(id, opts)
}

VideoStreamMerger.prototype.addStream = function (mediaStream, opts) {
  var self = this

  if (typeof mediaStream === 'string') {
    return self._addData(mediaStream, opts)
  }

  opts = opts || {}
  var stream = {}

  stream.isData = false
  stream.x = opts.x || 0
  stream.y = opts.y || 0
  stream.width = opts.width || self.width
  stream.height = opts.height || self.height
  stream.draw = opts.draw || null
  stream.mute = opts.mute || opts.muted || false
  stream.audioEffect = opts.audioEffect || null
  stream.index = opts.index == null ? self._streams.length : opts.index

  // If it is the same MediaStream, we can reuse our video element (and ignore sound)
  var videoElement = null
  for (var i = 0; i < self._streams.length; i++) {
    if (self._streams[i].id === mediaStream.id) {
      videoElement = self._streams[i].element
    }
  }

  if (!videoElement) {
    videoElement = document.createElement('video')
    videoElement.autoplay = true
    videoElement.muted = true
    videoElement.srcObject = mediaStream

    if (!stream.mute) {
      stream.audioSource = self._audioCtx.createMediaStreamSource(mediaStream)
      stream.audioOutput = self._audioCtx.createGain() // Intermediate gain node
      stream.audioOutput.gain.value = 1
      if (stream.audioEffect) {
        stream.audioEffect(stream.audioSource, stream.audioOutput)
      } else {
        stream.audioSource.connect(stream.audioOutput) // Default is direct connect
      }
      stream.audioOutput.connect(self._audioDestination)
    }
  }

  stream.element = videoElement
  stream.id = mediaStream.id || null
  self._streams.splice(stream.index, 0, stream)
}

VideoStreamMerger.prototype.removeStream = function (mediaStream) {
  var self = this

  if (typeof mediaStream === 'string') {
    mediaStream = {
      id: mediaStream
    }
  }

  for (var i = 0; i < self._streams.length; i++) {
    if (mediaStream.id === self._streams[i].id) {
      if (self._streams[i].audioSource) {
        self._streams[i].audioSource = null
      }
      if (self._streams[i].audioOutput) {
        self._streams[i].audioOutput.disconnect(self._audioDestination)
        self._streams[i].audioOutput = null
      }

      self._streams[i] = null
      self._streams.splice(i, 1)
      i--
    }
  }
}

VideoStreamMerger.prototype._addData = function (key, opts) {
  var self = this

  opts = opts || {}
  var stream = {}

  stream.isData = true
  stream.draw = opts.draw || null
  stream.audioEffect = opts.audioEffect || null
  stream.id = key
  stream.element = null
  stream.index = opts.index == null ? self._streams.length : opts.index

  if (stream.audioEffect) {
    stream.audioOutput = self._audioCtx.createGain() // Intermediate gain node
    stream.audioOutput.gain.value = 1
    stream.audioEffect(null, stream.audioOutput)
    stream.audioOutput.connect(self._audioDestination)
  }

  self._streams.splice(stream.index, 0, stream)
}

VideoStreamMerger.prototype.start = function () {
  var self = this

  self.started = true
  window.requestAnimationFrame(self._draw.bind(self))

  // Add video
  self.result = self._canvas.captureStream(self.fps)

  // Remove "dead" audio track
  var deadTrack = self.result.getAudioTracks()[0]
  if (deadTrack) self.result.removeTrack(deadTrack)

  // Add audio
  var audioTracks = self._audioDestination.stream.getAudioTracks()
  self.result.addTrack(audioTracks[0])
}

VideoStreamMerger.prototype._draw = function () {
  var self = this
  if (!self.started) return

  var awaiting = self._streams.length
  function done () {
    awaiting--
    if (awaiting <= 0) window.requestAnimationFrame(self._draw.bind(self))
  }

  if (self.clearRect) {
    self._ctx.clearRect(0, 0, self.width, self.height)
  }
  self._streams.forEach(function (video) {
    if (video.draw) { // custom frame transform
      video.draw(self._ctx, video.element, done)
    } else if (!video.isData) {
      self._ctx.drawImage(video.element, video.x, video.y, video.width, video.height)
      done()
    } else {
      done()
    }
  })

  if (self._streams.length === 0) done()
}

VideoStreamMerger.prototype.destroy = function () {
  var self = this

  self.started = false

  self._canvas = null
  self._ctx = null
  self._streams = []
  self._audioCtx.close()
  self._audioCtx = null
  self._audioDestination = null

  self.result.getTracks().forEach(function (t) {
    t.stop()
  })
  self.result = null
}

module.exports = VideoStreamMerger


/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = clamp

function clamp(value, min, max) {
  return min < max
    ? (value < min ? min : value > max ? max : value)
    : (value < max ? max : value > min ? min : value)
}


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

var clamp = __webpack_require__(1)

module.exports = frequencyToIndex
function frequencyToIndex (frequency, sampleRate, frequencyBinCount) {
  var nyquist = sampleRate / 2
  var index = Math.round(frequency / nyquist * frequencyBinCount)
  return clamp(index, 0, frequencyBinCount)
}


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

var frequencyToIndex = __webpack_require__(2)

module.exports = analyserFrequencyAverage.bind(null, 255)
module.exports.floatData = analyserFrequencyAverage.bind(null, 1)

function analyserFrequencyAverage (div, analyser, frequencies, minHz, maxHz) {
  var sampleRate = analyser.context.sampleRate
  var binCount = analyser.frequencyBinCount
  var start = frequencyToIndex(minHz, sampleRate, binCount)
  var end = frequencyToIndex(maxHz, sampleRate, binCount)
  var count = end - start
  var sum = 0
  for (; start < end; start++) {
    sum += frequencies[start] / div
  }
  return count === 0 ? 0 : (sum / count)
}


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var analyserFrequency = __webpack_require__(3);

module.exports = function(audioContext, stream, opts) {

  opts = opts || {};

  var defaults = {
    fftSize: 1024,
    bufferLen: 1024,
    smoothingTimeConstant: 0.2,
    minCaptureFreq: 85,         // in Hz
    maxCaptureFreq: 255,        // in Hz
    noiseCaptureDuration: 1000, // in ms
    minNoiseLevel: 0.3,         // from 0 to 1
    maxNoiseLevel: 0.7,         // from 0 to 1
    avgNoiseMultiplier: 1.2,
    onVoiceStart: function() {
    },
    onVoiceStop: function() {
    },
    onUpdate: function(val) {
    }
  };

  var options = {};
  for (var key in defaults) {
    options[key] = opts.hasOwnProperty(key) ? opts[key] : defaults[key];
  }

  var baseLevel = 0;
  var voiceScale = 1;
  var activityCounter = 0;
  var activityCounterMin = 0;
  var activityCounterMax = 60;
  var activityCounterThresh = 5;

  var envFreqRange = [];
  var isNoiseCapturing = true;
  var prevVadState = undefined;
  var vadState = false;
  var captureTimeout = null;

  var source = audioContext.createMediaStreamSource(stream);
  var analyser = audioContext.createAnalyser();
  analyser.smoothingTimeConstant = options.smoothingTimeConstant;
  analyser.fftSize = options.fftSize;

  var scriptProcessorNode = audioContext.createScriptProcessor(options.bufferLen, 1, 1);
  connect();
  scriptProcessorNode.onaudioprocess = monitor;

  if (isNoiseCapturing) {
    //console.log('VAD: start noise capturing');
    captureTimeout = setTimeout(init, options.noiseCaptureDuration);
  }

  function init() {
    //console.log('VAD: stop noise capturing');
    isNoiseCapturing = false;

    envFreqRange = envFreqRange.filter(function(val) {
      return val;
    }).sort();
    var averageEnvFreq = envFreqRange.length ? envFreqRange.reduce(function (p, c) { return Math.min(p, c) }, 1) : (options.minNoiseLevel || 0.1);

    baseLevel = averageEnvFreq * options.avgNoiseMultiplier;
    if (options.minNoiseLevel && baseLevel < options.minNoiseLevel) baseLevel = options.minNoiseLevel;
    if (options.maxNoiseLevel && baseLevel > options.maxNoiseLevel) baseLevel = options.maxNoiseLevel;

    voiceScale = 1 - baseLevel;

    //console.log('VAD: base level:', baseLevel);
  }

  function connect() {
    source.connect(analyser);
    analyser.connect(scriptProcessorNode);
    scriptProcessorNode.connect(audioContext.destination);
  }

  function disconnect() {
    scriptProcessorNode.disconnect();
    analyser.disconnect();
    source.disconnect();
  }

  function destroy() {
    captureTimeout && clearTimeout(captureTimeout);
    disconnect();
    scriptProcessorNode.onaudioprocess = null;
  }

  function monitor() {
    var frequencies = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencies);

    var average = analyserFrequency(analyser, frequencies, options.minCaptureFreq, options.maxCaptureFreq);
    if (isNoiseCapturing) {
      envFreqRange.push(average);
      return;
    }

    if (average >= baseLevel && activityCounter < activityCounterMax) {
      activityCounter++;
    } else if (average < baseLevel && activityCounter > activityCounterMin) {
      activityCounter--;
    }
    vadState = activityCounter > activityCounterThresh;

    if (prevVadState !== vadState) {
      vadState ? onVoiceStart() : onVoiceStop();
      prevVadState = vadState;
    }

    options.onUpdate(Math.max(0, average - baseLevel) / voiceScale);
  }

  function onVoiceStart() {
    options.onVoiceStart();
  }

  function onVoiceStop() {
    options.onVoiceStop();
  }

  return {connect: connect, disconnect: disconnect, destroy: destroy};
};

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var vad = __webpack_require__(4);
var VideoStreamMerger = __webpack_require__(0)

var localStream;
var peer_con;
var remoteStream;
var peer;
var is_host = false;
var central_peer = false;

var merger;
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
/////////////////////////////////////////////

var room = 'foo';
var peer_connections =[];
// var socket = io.connect("192.168.31.238:9090");
var socket = io.connect("ec2-18-220-215-162.us-east-2.compute.amazonaws.com:9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    // {'urls': 'turn:numb.viagenie.ca'},
    // {'urls': 'turn:d1.synergy.net:3478'}
  ]
};

socket.on('remove_host', function (){
  console.log("host was removing");
  if (is_host){
    console.log("peer_connections", peer_connections.length);
    // const con = peer_connections[0];
    // con.close();
    // peer_connections = []
  }
  is_host = false;
});

socket.on('peer_to_host', function (peer_id, my_id){
  console.log("my socket id", my_id);
  console.log("peer_to_host to", peer_id);
  peer = peer_id;
  createPeerConnection('peer_to_host');
});

socket.on('host_to_peer', function(peer_id) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id);
  createPeerConnection("host_to_peer");

  if (!central_peer) {
    if (!is_host){
      peer_con.addStream(remoteStream);
    }else{
       peer_con.addStream(localStream);
    }
  } else{
    merger = new VideoStreamMerger();
    merger.addStream(localStream, {});
    merger.start();
    // localVideo.srcObject = merger.result;
    peer_con.addStream(merger.result);
  }
  doCall()
});

socket.on('first', function (){
  is_host = true;
  central_peer = true;
});



// socket.on('created', function(my_own_id) {
//   console.log(my_own_id);
//   is_host = true;
//   createPeerConnection();
//   pc.addStream(localStream);
// });

function sendMessage(message) {
  socket.emit('message', peer, message);
}

// This client receives a message
socket.on('message', function(message) {
  if (message.type === 'offer') {
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    peer_con.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_con.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

function doAnswer() {
  console.log('Sending answer to peer.');
  peer_con.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function createPeerConnection(connection_type) {
  try {
    const len = peer_connections.push(new RTCPeerConnection(null));
    peer_con = peer_connections[len-1];
    peer_con.connection_type = connection_type;
    peer_con.setConfiguration(pcConfig);
    peer_con.onicecandidate = handleIceCandidate;
    peer_con.onaddstream = handleRemoteStreamAdded;
    peer_con.onremovestream = handleRemoteStreamRemoved;
  } catch (e) {
    console.log(e);
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
  }
}

function handleCreateOfferError(event) {
}

function doCall() {
  peer_con.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  peer_con.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function handleRemoteStreamAdded(event) {
  console.log("new remote stream");


  if (central_peer){
    if (remoteStream){
      merger.removeStream(remoteStream);
    }else {
      merger.removeStream(localStream);
    }
    merger.addStream(event.stream);
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
    return;
  }else if (peer_connections.length > 2) {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
    console.log("add to old connection");
    console.log(" connection length", peer_connections.length);
    var con_before = peer_connections[peer_connections.length - 2];
    con_before.addStream(remoteStream);
  } else {
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
  }
}
//
function handleRemoteStreamRemoved(event) {
}

function onCreateSessionDescriptionError(error) {
}

window.onbeforeunload = function() {
  socket.emit('remove_peer', peer);
};

//////////////////////////////////////////////////
function on_voice_start() {
  console.log("voice started", is_host);
  if (is_host == false){
    socket.emit('voice_start', central_peer);
    if (central_peer){
      merger.removeStream(merger._streams[0]);
      merger.addStream(localStream);
      // remoteStream = null;
    }
  }
  is_host = true;
  console.log("host");
}

function add_voice_detection(stream) {
  const options = {
    fftSize: 1024,
    bufferLen: 1024,
    smoothingTimeConstant: 0.2,
    minCaptureFreq: 85,         // in Hz
    maxCaptureFreq: 255,        // in Hz
    noiseCaptureDuration: 1000, // in ms
    minNoiseLevel: 0.3,         // from 0 to 1
    maxNoiseLevel: 0.7,         // from 0 to 1
    avgNoiseMultiplier: 1.2,
    onVoiceStart: on_voice_start,
    // onVoiceStop: function() {console.log("stop")},
  };
  vad(audioContext, stream, options);
}

function gotStream(stream) {
  // window.AudioContext = window.AudioContext || window.webkitAudioContext;
  // audioContext = new AudioContext();
  localStream = stream;
  // add_voice_detection(localStream);
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
  }else{
    e.target.innerText = "UNMUTE";
  }
  if (!audioContext) {
    create_audio();
  }
});
 function create_audio(){
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();
  add_voice_detection(localStream);
};

// var network = new ActiveXObject('WScript.Network');
// console.log(network.UserName);

/***/ })
/******/ ]);
//# sourceMappingURL=index.bundle.js.map