AudioContext = AudioContext || webkitAudioContext || mozAudioContext;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

var Recorder = function( config ){

  if ( !Recorder.isRecordingSupported() ) {
    throw "Recording is not supported in this browser";
  }

  config = config || {};
  config.recordOpus = (config.recordOpus === false) ? false : config.recordOpus || true;
  config.bitDepth = config.recordOpus ? 16 : config.bitDepth || 16;
  config.bufferLength = config.bufferLength || 4096;
  config.monitorGain = config.monitorGain || 0;
  config.numberOfChannels = config.numberOfChannels || 1;
  config.sampleRate = config.sampleRate || (config.recordOpus ? 48000 : this.audioContext.sampleRate);
  config.workerPath = config.workerPath || 'scripts/vendor/recorderWorker.js';
  config.streamOptions = config.streamOptions || {
    optional: [],
    mandatory: {
      googEchoCancellation: false,
      googAutoGainControl: false,
      googNoiseSuppression: false,
      googHighpassFilter: false
    }
  };
  config.waveform = config.waveform || false;
  config.waveformOptions = config.waveformOptions;

  this.config = config;
  this.state = "inactive";
  this.eventTarget = document.createDocumentFragment();
  if (config.waveform) {
    this.waveform = new Waveform(config.waveformOptions);
  }
  this.createAudioNodes();
  this.initStream();
};

Recorder.isRecordingSupported = function(){
  return AudioContext && navigator.getUserMedia;
};

Recorder.prototype.addEventListener = function( type, listener, useCapture ){
  this.eventTarget.addEventListener( type, listener, useCapture );
};

Recorder.prototype.audioContext = new AudioContext();

Recorder.prototype.createAudioNodes = function(){
  var that = this;
  this.scriptProcessorNode = this.audioContext.createScriptProcessor( this.config.bufferLength, this.config.numberOfChannels, this.config.numberOfChannels );
  this.scriptProcessorNode.onaudioprocess = function( e ) { 

    var inputBuffer = e.inputBuffer;

    // The output buffer contains the samples that will be modified and played
    var outputBuffer = e.outputBuffer;

    // Loop through the output channels (in this case there is only one)
    for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {

      var inputData = inputBuffer.getChannelData(channel);
      var outputData = outputBuffer.getChannelData(channel);
      var max = 0;
      var min = 0;
      // Loop through the 4096 samples
      for (var sample = 0; sample < inputBuffer.length; sample++) {
        if (inputData[sample] > max) {
          max = inputData[sample];
        }

        if (inputData[sample] < min) {
          min = inputData[sample];
        }
      }
    }

    // console.log(max, min);
    if ( that.state === "recording" ) {
      that.recordBuffers( e.inputBuffer );
      that.waveform.drawSample( max, min );
    }
  };

  this.monitorNode = this.audioContext.createGain();
  this.setMonitorGain( this.config.monitorGain );
  this.analyserNode = this.audioContext.createAnalyser();

  // 6th order butterworth
  if ( this.config.sampleRate < this.audioContext.sampleRate ) {
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode2 = this.audioContext.createBiquadFilter();
    this.filterNode3 = this.audioContext.createBiquadFilter();
    this.filterNode.type = this.filterNode2.type = this.filterNode3.type = "lowpass";

    var nyquistFreq = this.config.sampleRate / 2;
    this.filterNode.frequency.value = this.filterNode2.frequency.value = this.filterNode3.frequency.value = nyquistFreq - ( nyquistFreq / 3.5355 );
    this.filterNode.Q.value = 0.51764;
    this.filterNode2.Q.value = 0.70711;
    this.filterNode3.Q.value = 1.93184;

    this.filterNode.connect( this.filterNode2 );
    this.filterNode2.connect( this.filterNode3 );
    this.filterNode3.connect( this.scriptProcessorNode );
  }
};

Recorder.prototype.initStream = function(){
  var that = this;
  navigator.getUserMedia(
    { audio : this.config.streamOptions },
    function ( stream ) {
      that.stream = stream;
      that.sourceNode = that.audioContext.createMediaStreamSource( stream );
      that.sourceNode.connect( that.filterNode || that.scriptProcessorNode );
      that.sourceNode.connect( that.analyserNode );
      that.analyserNode.connect( that.monitorNode );
    },
    function ( e ) { 
      that.eventTarget.dispatchEvent( new ErrorEvent( "recordingError", { error: e } ) );
    }
  );
};

Recorder.prototype.pause = function(){
  if ( this.state === "recording" ) {
    this.state = "paused";
    this.eventTarget.dispatchEvent( new Event( 'pause' ) );
  }
};

Recorder.prototype.recordBuffers = function( inputBuffer ){
  if ( this.state === "recording" ) {

    var buffers = [];
    for ( var i = 0; i < inputBuffer.numberOfChannels; i++ ) {
      buffers[i] = inputBuffer.getChannelData(i);
    }

    this.worker.postMessage({ command: "recordBuffers", buffers: buffers });
    this.recordingTime += inputBuffer.duration;
    this.eventTarget.dispatchEvent( new CustomEvent( 'recordingProgress', { "detail": this.recordingTime } ) );
  }
};

Recorder.prototype.removeEventListener = function( type, listener, useCapture ){
  this.eventTarget.removeEventListener( type, listener, useCapture );
};

Recorder.prototype.requestData = function( callback ) {
  if ( this.state !== "recording" ) {
    this.worker.postMessage({ command: "requestData" });
  }
};

Recorder.prototype.resume = function( callback ) {
  if ( this.state === "paused" ) {
    this.state = "recording";
    this.eventTarget.dispatchEvent( new Event( 'resume' ) );
  }
};

Recorder.prototype.setMonitorGain = function( gain ){
  this.monitorNode.gain.value = gain;
};

Recorder.prototype.onPageComplete = function (e) {
  if (this.state !== 'inactive') {
    console.log('Frame', e);
    this.eventTarget.dispatchEvent( new CustomEvent( 'dataAvailable', {
      "detail": { buffer: e.data, final: false }
    }));
  }
};

Recorder.prototype.onFinalFrame = function (e) {
  if (this.state === 'inactive') {
    console.log('Final Frame', e)
    this.eventTarget.dispatchEvent( new CustomEvent( 'dataAvailable', {
      "detail": { buffer: e.data, final: true }
    }));
  }
};

Recorder.prototype.start = function(){
  if ( this.state === "inactive" && this.sourceNode ) {

    this.monitorNode.connect( this.audioContext.destination );
    this.scriptProcessorNode.connect( this.audioContext.destination );
    this.waveform.clear();
    
    var that = this;
    this.worker = new Worker( this.config.workerPath );
    this.worker.addEventListener( "message", this.onPageComplete.bind(this));

    this.worker.postMessage({
      command: "start",
      bitDepth: this.config.bitDepth,
      bufferLength: this.config.bufferLength,
      inputSampleRate: this.audioContext.sampleRate,
      numberOfChannels: this.config.numberOfChannels,
      outputSampleRate: this.config.sampleRate,
      recordOpus: this.config.recordOpus
    });

    this.state = "recording";
    this.recordingTime = 0;
    this.recordBuffers = function() { delete this.recordBuffers };
    this.eventTarget.dispatchEvent( new Event( 'start' ) );
    this.eventTarget.dispatchEvent( new CustomEvent( 'recordingProgress', { "detail": this.recordingTime } ) );
  }
};

Recorder.prototype.stop = function(){
  if ( this.state !== "inactive" ) {
    this.monitorNode.disconnect();
    this.scriptProcessorNode.disconnect();
    this.state = "inactive";
    this.eventTarget.dispatchEvent( new Event( 'stop' ) );
    this.worker.postMessage({ command: "requestData" });
    this.worker.addEventListener( "message", this.onFinalFrame.bind(this));
    this.worker.postMessage({ command: "stop" });
  }
};
