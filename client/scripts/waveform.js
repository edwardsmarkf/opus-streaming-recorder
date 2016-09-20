function Waveform(config) {
    this.config = config || {
        canvas: document.getElementById('waveform'),
        backgroundColor: '#fff',
        fillColor: '#000'
    };
    this.canvas = this.config.canvas;
    this.canvasContext = this.canvas.getContext('2d');
    this.samples = 0;
    
    this.width = this.canvas.getAttribute('width') || this.canvas.parentElement.offsetWidth;
    this.height = this.canvas.getAttribute('height') || this.canvas.parentElement.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    console.log(this.width, this.height);
    this.clear();
}

Waveform.prototype.clear = function() {
    this.samples = 0;
    this.canvasContext.clearRect(0, 0, this.width, this.height);
    this.canvasContext.fillStyle = this.config.backgroundColor;
    this.canvasContext.fillRect(0, 0, this.width, this.height);
};

Waveform.prototype.drawSample = function(max, min) {
    var amp = this.height / 2;

    this.canvasContext.fillStyle = this.config.fillColor;
    this.canvasContext.fillRect(this.samples, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));

    this.samples++;
};