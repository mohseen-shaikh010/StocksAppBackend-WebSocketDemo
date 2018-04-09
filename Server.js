"use strict";

// To log the process (ps command)
process.title = 'node-chat';

var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var fs = require("fs");

var history = [ ];  // latest 100 messages
var clients = [ ];  //currently connected clients

var http_files = {};
   [
       ["/jquery.min.js","application/javascript"],
       ["/Stock-WebPortal.js","application/javascript"],
       ["/frontend.html","text/html"],
       ["/backend.html","text/html"]
   ].forEach(function(fn){
       http_files[fn[0]]={
           content : fs.readFileSync('.'+fn[0]).toString(),
           contentType : fn[1]
       };
   });

   http_files["/"]=http_files["/frontend.html"];
   http_files["/index.html"]=http_files["/frontend.html"];
   http_files["/backend.html"]=http_files["/backend.html"];
   http_files["/backend"]=http_files["/backend.html"];

function handleHtmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

//Http server
var server = http.createServer(function(request, response) {
        // this doubles as a way to serve the fies, and a connection for websocket to use
        var file = http_files[request.url];
        if (file) {
            response.writeHeader(200,{"content-type" : file.contentType});
            response.write(file.content);
            return response.end();
        }
        response.writeHeader(404,{"content-type" : "text/plain"});
        response.write("not found");
        return response.end();

    });



  server.listen((process.env.PORT || webSocketServer), function() {
    console.log((new Date()) + " Server is listening on port " + process.env.PORT);
  });


//WebSocket server
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request.  http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});

//when new client tries to connect
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // We must check 'request.origin' to make sure that
    // client is connecting from our website.
    //Alternatively, we may use JWT auth later
    // (http://en.wikipedia.org/wiki/Same_origin_policy)

    var connection = request.accept(null, request.origin);

    var index = clients.push(connection) - 1; //clientIndex, to remove it on close
    var enteredPassword = false;
    let SYSTEM_PASSWORD = "admin";

    console.log((new Date()) + ' Connection accepted.');

    // send updates history to new client
    if (history.length > 0) {
        connection.sendUTF(JSON.stringify( { type: 'history', data: history} ));
    }

    // new stock update
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
            if (enteredPassword === false) { // Login.

                enteredPassword = handleHtmlEntities(message.utf8Data);
                if (enteredPassword === SYSTEM_PASSWORD)
                {
                  connection.sendUTF(JSON.stringify({ type:'login', data: 'black', status: 'success' }));
                  console.log((new Date()) + 'Admin Logged In');
                }else {
                  enteredPassword = false;
                  connection.sendUTF(JSON.stringify({ type:'login', data: 'black', status: 'failure' }));
                  console.log((new Date()) + 'Admin login failed');
                }



            } else { // log and broadcast the update
                console.log((new Date()) + ' Received Message from Admin : '+ message.utf8Data);

                // to keep all updates in history
                var obj = {
                    time: (new Date()).getTime(),
                    text: handleHtmlEntities(message.utf8Data),
                    author: 'Admin'
                };
                history.push(obj);
                history = history.slice(-100);

                // broadcast message to all connected clients
                var json = JSON.stringify({ type:'message', data: obj });
                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
            }
        }
    });

    // client disconnected
    connection.on('close', function(connection) {
        if (enteredPassword !== false ) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove client from the list of connected clients
            clients.splice(index, 1);
        }
    });

});
