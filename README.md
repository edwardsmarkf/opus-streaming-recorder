# Dependencies

[https://github.com/chris-rudmin/Recorderjs](https://github.com/chris-rudmin/Recorderjs)
[https://github.com/binaryjs/binaryjs](https://github.com/binaryjs/binaryjs)

# Installation

1. Unpack files somewhere on your server
2. Enter directory with the files ex. `cd stream-recorder`
3. Run `npm install` command
4. Now you should able to run the server by `node server.js`

**NOTICE:**
Server run default on port 22810 to change it need to edit `server.js` file. To change port which it runs edit `server.listen(22810);` to `server.listen(YOUR_PORT);` where YOUR_PORT is port number;

Also need to edit `client/index.html` file:

**In `<script>` tag in `<head>` section**

```javascript
var HOST = '127.0.0.1', <- here change `127.0.0.1` to your server external IP
var PORT =  22810, <- here change port number to one you choose
```

**Later at the end of <body> tag**

```javascript
var options = {
    recorder: {
        monitorGain: 0,
        bitDepth: 16, // 8, 16, 24, 32
        numberOfChannels: 1,
        sampleRate: 48000,
        recordOpus: true
    }
};
```

# Usage

Once you run server open `127.0.0.1:22810` in your browser (browser will ask you to give permission to use your microphone). You should see *Recorder* section and *Log* section. In the *Log* section you should see `Connected to the stream server localhost on port 22810 ` message.

On the *Recorder* section you will see waveform container and some buttons:

- *Init* - initializes the recorder, it will starts to listen to audio from microphone, but not yet send it to the server.
- *Record (red dot)* - Once you push it, it starts recording audio and streaming it to the server. When you push it during recording it pauses it, then push it again to resume.
- *Stop (square)* - It stops the recording.
- *Fill color* and *Background color* - You can set the colors of waveform there **NOTICE: you have to do that before initialize.**



