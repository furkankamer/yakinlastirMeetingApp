function leaveMeeting(){
    if(confirm("Are you sure?"))
        fetch("/leavemeeting")
            .then(response => response.text)
            .then(() => location.href = "/")
            .catch(() => alert("an error occured"));
}

var peerConnections = {};
var peerConnectionsStreams = {};
function connectToRoom(){
    const FPS = 25;
    var src;
    var dst;
    var displayMediaOptions = {
        video: {
            cursor: "always"
        },
        audio: false
    };
    var configuration = {
        'iceServers': [{
            'urls': 'stun:stun.l.google.com:19302'
        }],
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    };
    var peerConnectionClient;
    var receivedStreams = [];
    var isInitiator;
    $(document).ready(function(){
        grabWebCamVideo();
        const video = document.querySelector("#videoElement");
        const screen = document.getElementById("videoElementScreen");
        const videoShareButton = document.getElementById("VideoShare");
        const audioShareButton = document.getElementById("MicrophoneShare")
        const screenShareButton = document.getElementById("ScreenShare");
        socket = io.connect( location.protocol + '//' + document.domain + ':' + location.port + '/',{transports: ['websocket']});
        socket.on('connect', () => socket.emit('joined'));
        socket.on('status', () => {
        });
        socket.on('leave', message => alert(message));
        socket.on('receive', message => {
            document.getElementById("chat").insertAdjacentHTML("beforeend",
                    `<p>${message}</p>`);
        });
        socket.on('filereceive', file => {
            document.getElementById("chat").insertAdjacentHTML("beforeend",
                    `<p><a style="color: orange;" href ="${file["content"]}" download = "${file["target"].split(".")[0]}">File: ${file["target"]}</a></p>`);
                    document.getElementById("chat").insertAdjacentHTML("beforeend",`
                    <embed src="${file["content"]}" 
                    type="${file["innertype"]}"   height="50" width="220">`);
        });
        socket.on('hostleft', () => {
            alert("host has closed this meeting");
            socket.emit('closedroom');
        })
        socket.on('created', function(data) {
            isInitiator = true;
            console.log('Created room', data["room"], '- my client ID is', data["id"]);
        });
        socket.on('joined', function(data) {
            clientId = data["id"];
            isInitiator = false;
            console.log('This peer has joined room', data["room"], 'with client ID', data["id"]);
            createPeerConnection(isInitiator, configuration);
        });
        socket.on('ready', clientId => createPeerConnection(isInitiator, configuration, clientId));
        
        socket.on('messageToServer', message => {
            if(!isInitiator) console.log("miss messaging detected");
            console.log('Server received message:', message);
            signalingMessageCallback(message["message"],peerConnections[message["id"]],message["id"]);
        });
        socket.on('messageToClient', message => {
            if(isInitiator) console.log("miss messaging detected");
            console.log('Client received message:', message);
            signalingMessageCallback(message,peerConnectionClient);
        })
        
        function grabWebCamVideo() {
            console.log('Getting user media (video) ...');
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            })
            .then(gotStream)
            .catch(function(e) {
                alert('getUserMedia() error: ' + e);
            });
        }

        function gotStream(stream) {
            console.log('getUserMedia video stream URL:', stream);
            stream.getTracks().forEach(track => track.enabled = false);
            window.stream = stream; // stream available to console
            video.srcObject = stream;
            video.onloadedmetadata = () =>console.log('gotStream with width and height:',  video.videoWidth, video.videoHeight);
        }

        videoShareButton.addEventListener('click',() => {
            if(videoShareButton.innerText.includes("Share")){
                try
                {
                    stream.getVideoTracks().forEach(t => t.enabled = true);
                    videoShareButton.innerText = "Stop Video";
                    video.style.display = "block";
                }
                catch{
                    alert("An error occured.");
                }
            }
            else{
                try
                {
                    stream.getVideoTracks().forEach(t => t.enabled = false);
                    videoShareButton.innerText = "Share Video";
                    video.style.display = "none";
                }
                catch{
                    alert("An error occured.");
                }

            }
        })
        audioShareButton.addEventListener('click',() => {
            if(audioShareButton.innerText.includes("Share")){
                try
                {
                    stream.getAudioTracks().forEach(t => t.enabled = true);
                    audioShareButton.innerText = "Stop Sharing";
                }
                catch{
                    alert("An error occured");
                }

            }
            else{
                try
                {
                    stream.getAudioTracks().forEach(t => t.enabled = false);
                    audioShareButton.innerText = "Share Microphone";
                }
                catch{
                    alert("An error occured");
                }
                
            }
            
        })
        screenShareButton.addEventListener('click',() => {
            
        })

        function createPeerConnection(isInitiator, config, clientId = null) {
            var peerConn = new RTCPeerConnection(config);
            if(clientId){
                var clientVideo = document.createElement("video");
                clientVideo.id = String(clientId);
                clientVideo.autoplay = true;
                clientVideo.className = "webcam";
                document.getElementById("container").appendChild(clientVideo);
                peerConnections[clientId] = peerConn
            }
            else{
                peerConnectionClient = peerConn;
            }
            console.log('Creating Peer connection as initiator?', isInitiator, 'config:', config);
            peerConn.addEventListener('connectionstatechange', e => {
                console.log(e.target.connectionState);
            });
    
            // send any ice candidates to the other peer
            peerConn.onicecandidate = e => {
                if (e.candidate) {
                    sendMessage({
                        type: 'candidate',
                        label: e.candidate.sdpMLineIndex,
                        id: e.candidate.sdpMid,
                        candidate: e.candidate.candidate
                    },clientId);
                } else console.log('End of candidates.');
            };
    
            peerConn.onnegotiationneeded = () => peerConn.createOffer()
                .then(offer => peerConn.setLocalDescription(offer))
                .then(() => sendMessage(peerConn.localDescription,clientId));
    
            if (isInitiator) {
                stream.getTracks().forEach(track => peerConn.addTrack(track, stream));
                peerConn.ontrack = e => {
                    console.warn(e);
                    peerConnectionsStreams[clientId] = e.streams[0];
                    document.getElementById(String(clientId)).srcObject = e.streams[0];
                    for(const[key,value] of Object.entries(peerConnections))
                        if(key != clientId){
                            console.log(key," ",clientId);
                            e.streams[0].getTracks().forEach(track => value.addTrack(track,e.streams[0]));
                        }
                    for(const[key,value] of Object.entries(peerConnectionsStreams)){
                        if(key != clientId){
                            console.log(key," ",clientId);
                            value.getTracks().forEach(track => peerConn.addTrack(track,value));
                        }
                    }
                }
                console.log('Creating an offer');
            } else {
                console.warn("client webcam added");
                setTimeout(() => stream.getTracks().forEach(track => peerConn.addTrack(track, stream)), 1000);
                peerConn.ontrack = e => {
                    if(!receivedStreams.includes(e.streams[0])){
                        var clientVideo = document.createElement("video");
                        clientVideo.autoplay = true;
                        clientVideo.className = "webcam";
                        document.getElementById("container").appendChild(clientVideo);
                        clientVideo.srcObject = e.streams[0];
                        receivedStreams.push(e.streams[0]);
                    }
                }
                
            }
        
        }
        function logError(err) {
            if (!err) return;
            if (typeof err === 'string') {
                console.warn(err);
            } else {
                console.warn(err.toString(), err);
            }
        }
        function onLocalSessionCreated(desc,peerConn,clientId = null) {
            console.log('local session created:', desc);
            peerConn.setLocalDescription(desc).then(() => {
                console.log('sending local desc:', peerConn.localDescription);
                sendMessage(peerConn.localDescription,clientId);
            }).catch(logError);
        }
        
        function signalingMessageCallback(message,peerConn,clientId = null) {
            console.log("callback: " + peerConn);
            if (typeof message !== 'object')
                return;
            if (message.type === 'offer') {
                console.log('Got offer. Sending answer to peer.');
                peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                    logError);
                peerConn.createAnswer().then(answer => onLocalSessionCreated(answer,peerConn,clientId))
                        .catch(err => logError(err));
    
            } else if (message.type === 'answer') {
                console.log('Got answer.');
                peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                    logError);
    
            } else if (message.type === 'candidate') {
                peerConn.addIceCandidate(new RTCIceCandidate({
                    candidate: message.candidate,
                    sdpMLineIndex: message.label,
                    sdpMid: message.id
                }));
    
            }
        }
        function sendMessage(message,id = null) {
            console.log('Client sending message: ', message);
            if(isInitiator)
                socket.emit('messageToClient', {"message": message,"id": id});
            else
                socket.emit('messageToServer', message);
        }
        
        document.getElementById("sendBtn").addEventListener('click', async e => {
            let messageElement = document.getElementById("message");
            if(messageElement.value){
                socket.emit('message',{type: "text", content:messageElement.value});
            }
            if($("#inputGroupFile01").get(0).value != ""){
                [...getFiles()].forEach(async file => {
                    let b64f = await toBase64(file);
                    socket.emit('message',{type: "file", content: b64f, innertype: file.type, target: file.name})
                });
            }
            messageElement.value = "";
            $("#inputGroupFile01").get(0).value = "";
            document.querySelector('.custom-file-label').innerText = "Dosya Seç";
        });
        document.getElementById("leaveBtn").addEventListener('click', () => {
            if(confirm("Are you sure?")){
                socket.emit("leaveMeeting");
                location.href = "/";
            }
        });
        document.querySelector('.custom-file-input').addEventListener('change', e => {
            var fileName = document.getElementById("inputGroupFile01").files[0].name;
            var nextSibling = e.target.nextElementSibling
            nextSibling.innerText = fileName
        });
    });
}
function toggleChat(){
    let chatbutton = document.getElementById("chatBtn");
    let chatdiv = document.getElementById("chatdiv");
    if(chatbutton.innerText.includes(">")){
        chatdiv.style.display = "block";
        chatbutton.innerText = "Hide Chat v";
    }
    else{
        chatdiv.style.display = "none";
        chatbutton.innerText = "Show Chat >";
    }
}
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});
function openForm() {
    document.getElementById("myForm").style.display = "block";
}
  
function closeForm() {
    document.getElementById("myForm").style.display = "none";
}
var getFiles = () => $("#inputGroupFile01").get(0).files;
