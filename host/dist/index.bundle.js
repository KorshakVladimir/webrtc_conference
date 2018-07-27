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
/******/ 	return __webpack_require__(__webpack_require__.s = 11);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1, eval)("this");
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


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
/***/ (function(module, exports) {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}


/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}

/***/ }),
/* 7 */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global, process) {// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = __webpack_require__(6);

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = __webpack_require__(5);

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(0), __webpack_require__(7)))

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = __webpack_require__(8);
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(0)))

/***/ }),
/* 10 */
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
    videoElement.setAttribute('style', 'position:fixed; left: 0px; top:0px; pointer-events: none; opacity:0')
    document.body.appendChild(videoElement)

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
  setInterval(() =>{ self._draw.bind(self)()}, 200)
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
    // if (awaiting <= 0) window.requestAnimationFrame(self._draw.bind(self))
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
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var VideoStreamMerger = __webpack_require__(10);
let assert = __webpack_require__(9);
let vad = __webpack_require__(4);

var localStream;
var remoteStream;
let remote_video_to_show;
var peer;
let conn_to_central;
var is_host = false;
var central_peer = false;
let current_sock_id = '';
var session_id = '';
const sound_track_slots = [];
var merger = new VideoStreamMerger();
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
const main_stream = new MediaStream();
let connection_for_transmit;
const AUDIO_SLOTS = 4;

audioContext = new AudioContext();
/////////////////////////////////////////////

var room = 'foo';
var peer_connections = {};
var socket = io.connect(window.location.hostname + ":9090");

var audioContext;
var pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    // {'urls': 'turn:numb.viagenie.ca', "username":"saninosan@gmail.com","credential":"sanosano7"},
    // {'urls': 'turn:d1.synergy.net:3478',"username":"synergy","credential":"q1w2e3"}
    // "turn:my_username@<turn_server_ip_address>", "credential":"my_password"
  ]
};


function sendMessage(message, peer_id, conn_id) {
  socket.emit('message', peer_id, conn_id, message);
}

// This client receives a message
socket.on('message', function(message, peer_id, conn_id) {
  if (message.type === 'offer') {
    peer_connections[conn_id].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(peer_id, conn_id);
  } else if (message.type === 'answer') {
    peer_connections[conn_id].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_connections[conn_id].addIceCandidate(candidate);
  }
});

function doAnswer(peer_id, conn_id) {
  peer_connections[conn_id].createAnswer().then(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "conn_id": conn_id}),
    onCreateSessionDescriptionError
  );
}

/////////////////////////////////////////////////////////

function  createPeerConnection(connection_type, peer_id, conn_id) {
  try {
    const peer_con_1 = new RTCPeerConnection(null);
    peer_connections[conn_id] = peer_con_1;
    peer_con_1.peer_id = peer_id;
    peer_con_1.conn_id = conn_id;
    peer_con_1.connection_type = connection_type;
    peer_con_1.setConfiguration(pcConfig);
    peer_con_1.onicecandidate = handleIceCandidate.bind({"peer_id": peer_id, "conn_id": conn_id});
    peer_con_1.onaddstream = handleRemoteStreamAdded;
    peer_con_1.onremovestream = handleRemoteStreamRemoved;
    peer_con_1.onsignalingstatechange = (event)=>{
      if (event.target.signalingState == "closed") {
        console.log("close connection");
        socket.emit('connection_complete', peer_id, conn_id, event.target.signalingState);
        delete peer_connections[event.target.conn_id]
      }
    }
  } catch (e) {
    console.log(e);
    return;
  }
  // console.log(Object.keys(peer_connections));
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, this.peer_id, this.conn_id);
  }
}

function handleCreateOfferError(event) {}

function doCall(peer_id, conn_id) {
  peer_connections[conn_id].createOffer(
    setLocalAndSendMessage.bind({"peer_id": peer_id, "conn_id":conn_id}),
    handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  peer_connections[this.conn_id].setLocalDescription(sessionDescription);
  sendMessage(sessionDescription, this.peer_id, this.conn_id);
}

function handleRemoteStreamRemoved(event) {}

function onCreateSessionDescriptionError(error) {}

////////////////////////////////////////////////////
socket.on('remove_stream', function (stream_id, soket_id){
  for (let i in sound_track_slots){
    const slot = sound_track_slots[i];
    if (slot.connection && slot.connection.host_id == soket_id){
      slot.state = "free";
      slot.gain.disconnect(slot.dest);
      slot.gain = '';
      slot.connection = ''
      break;
    }
  }
});

socket.on('session_id', function (id){
  session_id  = id;
});

socket.on('all_slots_are_in_use', function (){
  document.getElementById("slots_in_use").hidden = false;
  mute_button.click();
  setTimeout(()=>{document.getElementById("slots_in_use").hidden=true}, 10000)
});

socket.on('close_video_to_central', function (peer_id){
  console.log("close_video_to_central");
  close_connection_by_type("to_main_host_video")
});

socket.on('peer_count', function (peer_count){
  document.getElementById("peer_count").innerText = "my name is " + peer_count;
});

function close_connection_for_main_peer(){
  if (central_peer){
    return;
  }
  const keys = Object.keys(peer_connections);
  for (let i in keys) {
    const con = peer_connections[keys[i]];
    if (con.connection_type  == "to_main_host_sound"){
      console.log("close connection 1", keys[i])
      con.close();
      delete peer_connections[keys[i]]
    }
  }
}

socket.on('peer_to_host', function (peer_id, video_slot_pos, sock_id, conn_id){
  if (!merger.started){
    merger.start();
    merger.result.removeTrack(merger.result.getAudioTracks()[0]);
    create_audio_track_slots(merger.result, AUDIO_SLOTS);
  }
  if (sock_id){
    current_sock_id = sock_id;
    Raven.setUserContext({
        sock_id: sock_id,
    })
    document.getElementById("client_id").innerText= "id - " + sock_id + " parent id- " + peer_id;
  }
  close_connection_for_main_peer();
  peer = peer_id;
  createPeerConnection('peer_to_host', peer_id, conn_id);
  peer_connections[conn_id].host_id = peer_id;
  peer_connections[conn_id].video_slot_pos = video_slot_pos;
});


socket.on('mute_own_channel', function (array_index) {
  merge_audio(array_index);
});

socket.on("close_specific_connection", function (conn_id) {
  peer_connections[conn_id].close();
  delete peer_connections[conn_id];
});

socket.on("close_current_connection", function () {
  if (central_peer) {
    return;
  }
  const keys = Object.keys(peer_connections);
  for (let i in keys) {
    const con = peer_connections[keys[i]];
    if (con.connection_type != "peer transmit to peers"){
      continue;
    }
    console.log("close connection", keys[i])
    con.close();
    delete peer_connections[keys[i]]
  }
  socket.emit("close_current_connection_done");
});

function create_audio_track_slots(stream, pool_size) {
  if (sound_track_slots.length == pool_size) {
    return;
  }
  for (let i=0; i<pool_size; i++){
    const  track = {source:'', state:'free'};
    track.gain  = audioContext.createGain();
    track.gain.gain.value = 1;
    track.dest = audioContext.createMediaStreamDestination();
    track.gain.connect(track.dest);
    stream.addTrack(track.dest.stream.getAudioTracks()[0]);
    sound_track_slots.push(track);
  }
}

var local_audio = document.querySelector('#audio_control');
function merge_audio(mute_slot=null){
  let source_steam = '';
  if (central_peer){
    source_steam = main_stream;
  }else{
    source_steam = remoteStream;
  }
  if (source_steam == undefined){
    return merge_audio(mute_slot)
  }
  const sound_dest = audioContext.createMediaStreamDestination();

  const audio_streams = source_steam.getAudioTracks();
  assert.equal(audio_streams.length, AUDIO_SLOTS, "all peers must got the same count if audio slots");
  for (let i in audio_streams){
    if (i == mute_slot){
      console.log("mute own chanel", i);
      continue;
    };
    const temp_sound_stream = new MediaStream();
    temp_sound_stream.addTrack(audio_streams[i]);
    const sound_source = audioContext.createMediaStreamSource(temp_sound_stream);
    const gain = audioContext.createGain() ;// Intermediate gain node
    gain.gain.value = 1;
    sound_source.connect(sound_dest);
  }
  remote_video_to_show = new MediaStream();
  remote_video_to_show.addTrack(source_steam.getVideoTracks()[0]);
  remote_video_to_show.addTrack(sound_dest.stream.getAudioTracks()[0]);
  remoteVideo.srcObject = remote_video_to_show;
}

function synchronize_audio_tracks(remote_stream_source){
  const audio_tracks = remote_stream_source.getAudioTracks();
  assert.equal(audio_tracks.length, AUDIO_SLOTS, "AUDIO_SLOTS missing 1");
  assert.equal(audio_tracks.length, sound_track_slots.length, "audio_tracks sound_track_slots 2");
  for (let i in sound_track_slots) {
    const slot = sound_track_slots[i];
    slot.gain.disconnect(slot.dest);
    const audio_el = document.createElement("audio"); // todo destroy element somehow
    const new_media_stream =  new MediaStream();
    new_media_stream.addTrack(audio_tracks[i])
    audio_el.srcObject = new_media_stream;
    const source = audioContext.createMediaStreamSource(new_media_stream);
    const gain = audioContext.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    slot.gain = gain;
    gain.connect(slot.dest);
  }
}

socket.on('show_central_peer_video', function(i) {
  merge_video_stream(localStream, i)

});
socket.on('host_to_peer', function(peer_id, to_main, sound_only, conn_id) {
  peer = peer_id;
  console.log("host_to_peer to", peer_id, conn_id);

  if (to_main){
    if (sound_only){
        createPeerConnection("to_main_host_sound", peer_id, conn_id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getAudioTracks()[0]);
        peer_connections[conn_id].addStream(newStream);
    }else {
        createPeerConnection("to_main_host_video", peer_id, conn_id);
        const newStream = new MediaStream();
        newStream.addTrack(localStream.getVideoTracks()[0]);
        peer_connections[conn_id].addStream(newStream);
    }
  } else {

    if (!central_peer) {
      createPeerConnection("peer transmit to peers", peer_id, conn_id);
      peer_connections[conn_id].addStream(merger.result);
      connection_for_transmit = peer_connections[conn_id];
    } else {
      createPeerConnection("main transmit to peers", peer_id, conn_id);
      peer_connections[conn_id].addStream(main_stream);
    }
  }
  doCall(peer_id, conn_id)
});

socket.on('first', function (sock_id){
  const new_button = document.createElement("button");
  document.body.appendChild(new_button);
  new_button.innerText = "restart";
  new_button.addEventListener("click", function(e) {
    socket.emit("restart");
  });
  current_sock_id = sock_id;
  Raven.setUserContext({
      sock_id: current_sock_id,
  });
  document.getElementById("client_id").innerText= "id - " + sock_id;
  is_host = false;
  central_peer = true;
  merger.addStream(localStream, {
          x:0,
          y:0,
          width: 200,
          height:150,
          mute: true // we don't want sound from the screen (if there is any)
        });
  merger.start();
  create_audio_track_slots(main_stream, AUDIO_SLOTS);
  main_stream.addTrack(merger.result.getVideoTracks()[0]);
  // remoteVideo.srcObject = remote_video_to_show;
  remoteStream = main_stream;
  merge_audio();
});

function add_sound_track(event, new_stream){
  // tempVideo.srcObject = new_stream; // very important
  const video_el = document.createElement("video"); // todo destroy element somehow
  video_el.srcObject = new_stream;
  const source = audioContext.createMediaStreamSource(new_stream);
  const gain = audioContext.createGain();
  gain.gain.value = 1;
  source.connect(gain);
  for (let i in sound_track_slots){
    const free_slot = sound_track_slots[i];
    if (free_slot.state == "free"){
    // if (!free_slot.connection){
      free_slot.gain = gain;
      gain.connect(free_slot.dest);

      free_slot.connection = event.target;
      free_slot.state = "connected";
      if (central_peer && !free_slot.connection.host_id){
        free_slot.connection.host_id = current_sock_id;
      }
      socket.emit("mute_own_channel", free_slot.connection.host_id, i);
      return;
    }
  }
  throw "maximum count of sound track"
}

function merge_video_stream(stream, video_slot_pos){
  merger.addStream(stream, {
      x: (video_slot_pos == 0 || video_slot_pos == 3) ? 0 : 200, // position of the topleft corner
      y: (video_slot_pos == 0 || video_slot_pos == 1) ? 0 : 150 ,
      width: 200,
      height: 150,
      mute: true // we don't want sound from the screen (if there is any)
    });
}

function handleRemoteStreamAdded(event) {
  if (central_peer){
    const new_remote_stream = event.stream;
    const video_track  = new_remote_stream.getVideoTracks().length;
    if (video_track) {
      const video_slot_pos = event.target.video_slot_pos;
      merge_video_stream(event.stream, video_slot_pos);
      // merger.addStream(event.stream, {
      //     x: (video_slot_pos == 0 || video_slot_pos == 3) ? 0 : 200, // position of the topleft corner
      //     y: (video_slot_pos == 0 || video_slot_pos == 1) ? 0 : 150 ,
      //     width: 200,
      //     height: 150,
      //     mute: true // we don't want sound from the screen (if there is any)
      //   });
    } else {
      const new_stream = event.stream;
      add_sound_track(event, new_stream);
    }

  } else {
    merger.removeStream(remoteStream);
    remoteStream = event.stream;
    merger.addStream(remoteStream, {mute:true});
    synchronize_audio_tracks(remoteStream);

    const video_el = document.createElement("video"); // todo destroy element somehow
    video_el.srcObject = remoteStream;
    merge_audio();
  }
}

function gotStream(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  localStream.getAudioTracks()[0].enabled = false;
  socket.emit('create or join', room);
  vad(audioContext, localStream ,
    {
      onVoiceStart: function() {
        socket.emit('show_my_video');
      },
      // onVoiceStop: function() {
      //   console.log('voice stop');
      //   stateContainer.innerHTML = 'Voice state: <strong>inactive</strong>';
      // },
      // onUpdate: function(val) {
      //   //console.log('curr val:', val);
      //   valueContainer.innerHTML = 'Current voice activity value: <strong>' + val + '</strong>';
      // }
    }
  );
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
function close_connection_by_type(type){
  const peer_connections_keys = Object.keys(peer_connections);
  for (let i=0; i< peer_connections_keys.length; i++){
    const conn = peer_connections[peer_connections_keys[i]];
    if (conn.connection_type == type) {
      conn.close();
      delete peer_connections[peer_connections_keys[i]];
      socket.emit("close_specific_connection", conn.peer_id, conn.conn_id);
    }
    // console.log("connection_type",peer_connections[peer_connections_keys[i]].connection_type);
  }
}
const mute_button = document.querySelector('#mute_button');
mute_button.addEventListener("click", function(e){
  const audio = localStream.getAudioTracks()[0];
  audio.enabled = !(audio.enabled);
  if (audio.enabled){
    e.target.innerText = "MUTE";
    if (central_peer){
      add_sound_track({target:{host_id:current_sock_id}}, localStream);
    }
    socket.emit('voice_start', central_peer, true, true);
  } else {
    e.target.innerText = "UNMUTE";
    socket.emit('remove_stream', localStream.id);
    close_connection_by_type("to_main_host_sound")
    merge_audio();
  }
});

// const restart_server = document.querySelector('#restart_server');
//  restart_server.addEventListener("click", function(e){
//   socket.emit("restart");
//  });


window.onbeforeunload = function() {
  socket.emit('remove_peer', session_id);
};


setInterval(function () {
   const peer_connections_keys = Object.keys(peer_connections);
   for (let i=0; i< peer_connections_keys.length; i++) {
     peer_connections[peer_connections_keys[i]].getStats(function(report){
        report.result().forEach(function (result) {
            var item = {};
            let show = false;
            if (result.id.search("recv") > -1 ){
              if(result.stat("mediaType") != "video"){
                return
              }
              // console.log("find");
              // console.log("googInterframeDelayMax", result.stat("googInterframeDelayMax"));
              if (result.stat("googInterframeDelayMax") > 1000){

                // throw 'broken'
                socket.emit("weak_parent", peer_connections[peer_connections_keys[i]].peer_id, peer_connections_keys[i])
              }
            }
            // item = {};
            // result.names().forEach(function (name) {
            //     item[name] = result.stat(name);
            // });
            // item.id = result.id;
            // item.type = result.type;
            // item.timestamp = result.timestamp;
            // console.log(item);
            // item.id = result.id;
            // item.type = result.type;
            // item.timestamp = result.timestamp;

            // if (show){
            //   console.log(item);
            //   throw 'broken'
            // }
        });
     });
  }
},1000);

document.getElementById("remove_button").addEventListener("click",function(){
  const peer_connections_keys = Object.keys(peer_connections);
  for (let i=0; i< peer_connections_keys.length; i++) {
    // console.log(peer_connections[peer_connections_keys[i]].connection_type);
    if (peer_connections[peer_connections_keys[i]].connection_type == "peer_to_host") {
      socket.emit("weak_parent", peer_connections[peer_connections_keys[i]].peer_id, peer_connections_keys[i]);
    }
  }
  // socket.emit("weak_parent", ;
})

setInterval(()=>{console.log("peer_connections lenth",Object.keys(peer_connections).length, peer_connections)},1000);

/***/ })
/******/ ]);
//# sourceMappingURL=index.bundle.js.map