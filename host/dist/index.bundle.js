!function(e){var n={};function t(o){if(n[o])return n[o].exports;var i=n[o]={i:o,l:!1,exports:{}};return e[o].call(i.exports,i,i.exports,t),i.l=!0,i.exports}t.m=e,t.c=n,t.d=function(e,n,o){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:o})},t.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,n){return Object.prototype.hasOwnProperty.call(e,n)},t.p="",t(t.s=4)}([function(e,n){e.exports=function(e,n,t){return n<t?e<n?n:e>t?t:e:e<t?t:e>n?n:e}},function(e,n,t){var o=t(0);e.exports=function(e,n,t){var i=n/2,r=Math.round(e/i*t);return o(r,0,t)}},function(e,n,t){var o=t(1);function i(e,n,t,i,r){for(var a=n.context.sampleRate,c=n.frequencyBinCount,u=o(i,a,c),s=o(r,a,c),d=s-u,f=0;u<s;u++)f+=t[u]/e;return 0===d?0:f/d}e.exports=i.bind(null,255),e.exports.floatData=i.bind(null,1)},function(e,n,t){"use strict";var o=t(2);e.exports=function(e,n,t){t=t||{};var i={fftSize:1024,bufferLen:1024,smoothingTimeConstant:.2,minCaptureFreq:85,maxCaptureFreq:255,noiseCaptureDuration:1e3,minNoiseLevel:.3,maxNoiseLevel:.7,avgNoiseMultiplier:1.2,onVoiceStart:function(){},onVoiceStop:function(){},onUpdate:function(e){}},r={};for(var a in i)r[a]=t.hasOwnProperty(a)?t[a]:i[a];var c=0,u=1,s=0,d=0,f=60,l=5,m=[],p=!0,v=void 0,C=!1,x=null,g=e.createMediaStreamSource(n),w=e.createAnalyser();w.smoothingTimeConstant=r.smoothingTimeConstant,w.fftSize=r.fftSize;var h=e.createScriptProcessor(r.bufferLen,1,1);function y(){g.connect(w),w.connect(h),h.connect(e.destination)}function S(){h.disconnect(),w.disconnect(),g.disconnect()}return y(),h.onaudioprocess=function(){var e=new Uint8Array(w.frequencyBinCount);w.getByteFrequencyData(e);var n=o(w,e,r.minCaptureFreq,r.maxCaptureFreq);if(p)return void m.push(n);n>=c&&s<f?s++:n<c&&s>d&&s--;v!==(C=s>l)&&(C?r.onVoiceStart():r.onVoiceStop(),v=C);r.onUpdate(Math.max(0,n-c)/u)},p&&(x=setTimeout(function(){p=!1;var e=(m=m.filter(function(e){return e}).sort()).length?m.reduce(function(e,n){return Math.min(e,n)},1):r.minNoiseLevel||.1;c=e*r.avgNoiseMultiplier,r.minNoiseLevel&&c<r.minNoiseLevel&&(c=r.minNoiseLevel);r.maxNoiseLevel&&c>r.maxNoiseLevel&&(c=r.maxNoiseLevel);u=1-c},r.noiseCaptureDuration)),{connect:y,disconnect:S,destroy:function(){x&&clearTimeout(x),S(),h.onaudioprocess=null}}}},function(e,n,t){"use strict";var o,i,r,a,c,u,s=t(3),d=document.querySelector("#localVideo"),f=document.querySelector("#remoteVideo"),l="foo",m=[],p=io.connect("ec2-18-220-215-162.us-east-2.compute.amazonaws.com:9090"),v={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};function C(e){p.emit("message",a,e)}function x(){try{const e=m.push(new RTCPeerConnection(null));(i=m[e-1]).setConfiguration(v),i.onicecandidate=g,i.onaddstream=y,i.onremovestream=S}catch(e){return void console.log(e)}}function g(e){e.candidate&&C({type:"candidate",label:e.candidate.sdpMLineIndex,id:e.candidate.sdpMid,candidate:e.candidate.candidate})}function w(e){}function h(e){i.setLocalDescription(e),C(e)}function y(e){r=e.stream,f.srcObject=r}function S(e){}function b(e){}function L(){p.emit("voice_start"),c=!0}p.on("remove_host",function(){c=!1}),p.on("peer_to_host",function(e,n){a=e,console.log(n),x()}),p.on("host_to_peer",function(e){a=e,x(),c?i.addStream(o):i.addStream(r),i.createOffer(h,w)}),p.on("first",function(){c=!0}),p.on("message",function(e){if("offer"===e.type)i.setRemoteDescription(new RTCSessionDescription(e)),console.log("Sending answer to peer."),i.createAnswer().then(h,b);else if("answer"===e.type)i.setRemoteDescription(new RTCSessionDescription(e));else if("candidate"===e.type){var n=new RTCIceCandidate({sdpMLineIndex:e.label,candidate:e.candidate});i.addIceCandidate(n)}else"bye"===e&&handleRemoteHangup()}),window.onbeforeunload=function(){p.emit("remove_peer",a)},navigator.mediaDevices.getUserMedia({audio:!0,video:!0}).then(function(e){window.AudioContext=window.AudioContext||window.webkitAudioContext,u=new AudioContext,o=e,d.srcObject=e,function(e){s(u,e,{fftSize:1024,bufferLen:1024,smoothingTimeConstant:.2,minCaptureFreq:85,maxCaptureFreq:255,noiseCaptureDuration:1e3,minNoiseLevel:.3,maxNoiseLevel:.7,avgNoiseMultiplier:1.2,onVoiceStart:L})}(e),p.emit("create or join",l)}).catch(function(e){alert("getUserMedia() error: "+e)})}]);
//# sourceMappingURL=index.bundle.js.map