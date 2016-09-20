var fs = require('fs');
var http = require('http');
var Stream = require('stream');
var express = require('express');
var url = require('url');
var mkdirp = require('mkdirp');
var BinaryServer = require('binaryjs');

// Contants

var PORT = process.env.PORT || 22810;
var STREAMS_FOLDER_PATH = '/streams';
var INDEX_FILE = '/client/index.html';
var ALLOWED_ORIGIN = 'http://localhost:22810';

// Check if folder path exits, if not create one.
mkdirp.sync(__dirname + STREAMS_FOLDER_PATH);

// Serve client side statically
var app = express();

app.use(express.static(__dirname + '/client'));
app.use('/streams', express.static(__dirname + '/streams', { redirect: false }));

var server = http.createServer(app);

// Start Binary.js server
var bs = BinaryServer.BinaryServer({ server: server });
var firstBuf = new Buffer(
    [
        79, 103, 103, 83, 0, 2,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        69, 79, 236, 170, 1, 19,
        79, 112, 117, 115, 72,
        101, 97, 100, 1, 1, 0,
        15, 68, 172, 0, 0, 0, 0, 0
    ]
); // First buffer with OPUS header for verification if user don't try to send something else.

// Wait for new user connections
bs.on('connection', function(client) {
    var audioStream;
    var originUrl = url.parse(client._socket.upgradeReq.headers.origin);
    var allowedOriginUrl = url.parse(ALLOWED_ORIGIN);

    // Check if allowed origin matches for security reasons
    if (originUrl.hostname !== allowedOriginUrl.hostname) {
        client.close();
        return;
    }

    // Incoming stream from browsers
    client.on('stream', function(stream, meta) {
        if (meta && meta.file) {
            var audioStream = fs.createWriteStream(__dirname + STREAMS_FOLDER_PATH + '/' + meta.file);
            var first = true;

            stream.pipe(audioStream);

            stream.on('data', function(chunk) {

                if (first && chunk.equals(firstBuf)) {
                    client.close();
                    return;
                }
                first = false;
            });

            stream.on('end', function() {
                console.log('Stream ended');
            });

            stream.on('error', function(err) {
                console.log(err);
            });
        }
    });
});

var allowedClients = [];

app.get('/', function(req, res, next) {
    var origin = req.get('origin');
    res.sendFile(__dirname + INDEX_FILE);
});

server.listen(PORT);
console.log('HTTP and BinaryJS server started on port ' + PORT);