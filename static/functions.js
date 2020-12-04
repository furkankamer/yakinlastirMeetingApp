function leaveMeeting(){
    if(confirm("Are you sure?"))
        fetch("/leavemeeting")
            .then(response => response.text)
            .then(() => location.href = "/")
            .catch(() => alert("an error occured"));
}
var currentClients;
var peerConnections = {};
var peerConnectionsStreams = {};
var numberOfCurrentClients = 2;
var username;
var hostname;
var senders = [];
var connectionsgetscreensenders = {};
var getscreensenders = [];
var screenStream;
var isSomeoneSharesScreen = false;
var screenSharingPeers = {};
function connectToRoom(){
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
        $("#table").dataTable({
            dom: "<'row'<'col-sm-3'l><'col-sm-3'f><'col-sm-6'p>>" +
                "<'row'<'col-sm-12'tr>>" +
                "<'row'<'col-sm-5'i><'col-sm-7'p>>",
            "columnDefs": [
                {
                    "orderable": false,
                    "targets": [0,1,2,3]
                },
            ],
            responsive:true,
            "fixedColumns": true,
            "bProcessing": true,
            "deferRender": true,
            "iDisplayLength": 2,
            "aLengthMenu": [[2,5,10, 25, 50, 100, -1], [2,5,10, 25, 50, 100, "All"]]
        });
        const video = document.querySelector("#videoElement");
        const screen = document.getElementById("videoElementScreen");
        const videoShareButton = document.getElementById("VideoShare");
        const audioShareButton = document.getElementById("MicrophoneShare")
        const screenShareButton = document.getElementById("ScreenShare");
        const persons = document.getElementById("persons");
        socket = io.connect( location.protocol + '//' + document.domain + ':' + location.port + '/',{transports: ['websocket']});
        socket.on('connect', () => socket.emit('joined'));
        socket.on('status', () => {
        });
        socket.on('leave', message => alert(message));
        socket.on('receive', message => {
            var chat = document.getElementById("chat");
            document.getElementById("chat").insertAdjacentHTML("beforeend",
                    `<p>${message}</p>`);
            chat.scrollTop = chat.scrollHeight - chat.clientHeight;
        });
        socket.on('filereceive', file => {
            var chat = document.getElementById("chat");
            document.getElementById("chat").insertAdjacentHTML("beforeend",
                    `<p><a style="color: orange;" href ="${file["content"]}" download = "${file["target"].split(".")[0]}">File: ${file["target"]}</a></p>`);
                    document.getElementById("chat").insertAdjacentHTML("beforeend",`
                    <embed src="${file["content"]}" 
                    type="${file["innertype"]}"   height="50" width="220">`);
            chat.scrollTop = chat.scrollHeight - chat.clientHeight;
        });
        socket.on('hostleft', () => {
            alert("host has closed this meeting");
            location.href = "/";
            socket.emit('closedroom');
        })
        socket.on('created', function(data) {
            isInitiator = true;
            console.log('Created room', data["room"], '- my client ID is', data["id"]);
        });
        socket.on('clientsUpdate',clients => {
            currentClients = JSON.parse(clients)
            const index = currentClients.indexOf(username);
                if (index > -1) {
                    currentClients.splice(index, 1);
            }
        });
        socket.on('joined', function(data) {
            username = data["username"];
            hostname = data["host"];
            currentClients = JSON.parse(data["clients"])
            clientId = data["id"];
            isInitiator = false;
            console.log('This peer has joined room', data["room"], 'with client ID', data["id"]);
            createPeerConnection(isInitiator, configuration);
        });
        socket.on('removeUserVideo',user => document.getElementById(user).remove());
        socket.on('ready', clientData => createPeerConnection(isInitiator, configuration, clientData["id"],clientData["name"]));
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
        socket.on('someoneSharingScreen', () => isSomeoneSharesScreen = true);
        socket.on('screenShareStopped', () => {
            isSomeoneSharesScreen = false;
            screen.style.display = "none";
        });
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
        video.ondblclick = () => toggleFullscreen(video); 
        function gotStream(stream) {
            console.log('getUserMedia video stream URL:', stream);
            stream.getTracks().forEach(track => track.enabled = false);
            window.stream = stream; // stream available to console
            video.srcObject = stream;
            video.play();
            video.onloadedmetadata = () =>console.log('gotStream with width and height:',  video.videoWidth, video.videoHeight);
        }

        screen.onclick = () => {
            if(screen.className == "webcam"){
                screen.className = "screen";
                screen.nextElementSibling.className = "webcam";
            }
        }
        screen.nextElementSibling.onclick = () => {
            if(screen.nextElementSibling.className == "webcam"){
                screen.nextElementSibling.className = "screen";
                screen.className = "webcam";
            }
        }
        screen.ondblclick = e => toggleFullscreen(e.target);
        screen.nextElementSibling.ondblclick = e => toggleFullscreen(e.target);

        videoShareButton.addEventListener('click',() => {
            if(videoShareButton.innerText.includes("Share")){
                try
                {
                    stream.getVideoTracks().forEach(t => t.enabled = true);
                    videoShareButton.innerText = "Stop Video";
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
                }
                catch{
                    alert("An error occured.");
                }

            }
        })
        
        function toggleFullscreen(player) {
            if (!document.webkitFullscreenElement) {
                if (player.requestFullScreen) {
                    player.requestFullScreen();
            } else if (player.webkitRequestFullScreen) {
                player.webkitRequestFullScreen();
            } else if (player.mozRequestFullScreen) {
                player.mozRequestFullScreen();
            }
            } else {
                document.webkitExitFullscreen();
            }
        }
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
            if(!screenShareButton.innerText.includes("Stop")){
                if(isSomeoneSharesScreen){
                    alert("Someone already shares screen. You cannot share yours.")
                }else{
                    navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
                            .then(screenstream =>  {
                                socket.emit('sharingScreen');
                                screenStream = screenstream;
                                screenStream.getTracks()[0]["type"] = "screen";
                                screen.srcObject = screenstream;
                                screen.play();
                                screen.style.display = "block";
                                screenShareButton.innerText = "Stop Screen Share";
                                screenStream.oninactive = () => screenShareButton.click();
                                if(isInitiator){
                                    for(const[key,value] of Object.entries(peerConnections)){
                                        connectionsgetscreensenders[key] = [];
                                        screenStream.getTracks().forEach(
                                            track => connectionsgetscreensenders[key].push(value.addTrack(track,screenStream))
                                        );
                                    }
                                }
                                else{
                                    screenStream.getTracks().forEach(
                                        track => getscreensenders.push(peerConnectionClient.addTrack(track,screenStream))
                                    )
                                }
                            })
                            .catch(error => console.warn(error));
                }
            }
            else{
                if(isInitiator){
                    for(const[key,value] of Object.entries(peerConnections))
                        connectionsgetscreensenders[key].forEach(t => value.removeTrack(t));
                }
                else{
                    getscreensenders.forEach(t => peerConnectionClient.removeTrack(t));
                }
                screen.style.display = "none";
                socket.emit('stoppedScreenShare');
                screenShareButton.innerText = "Share Screen";
            }
        })

        function createPeerConnection(isInitiator, config, clientId = null,clientName = null) {
            var peerConn = new RTCPeerConnection(config);
            if(clientId){
                var videodiv = document.createElement("div");
                var personName = document.createElement("p");
                personName.innerText = clientName;
                videodiv.appendChild(personName);
                var clientVideo = document.createElement("video");
                clientVideo.onclick = () =>{
                    screen.className = "webcam";
                    if(screen.nextElementSibling.style.display == "none")
                        screen.nextElementSibling.style.display = "block";
                    screen.nextElementSibling.srcObject = clientVideo.srcObject;
                    screen.nextElementSibling.play();
                }
                clientVideo.ondblclick = e => toggleFullscreen(e.target);
                videodiv.appendChild(clientVideo);
                videodiv.id = String(clientName);
                clientVideo.autoplay = true;
                clientVideo.className = "webcam";
                var emptycell = [...persons.rows[persons.rows.length-1]
                    .cells].find(cell => !cell.children.length);
                if(emptycell)
                    emptycell.appendChild(videodiv)
                else{
                    var emptyrow = persons.insertRow();
                    for(let i = 0;i<4;i++){
                        if(i == 0) emptyrow.insertCell().appendChild(videodiv);
                        else emptyrow.insertCell();
                    }
                }
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
                    console.warn(e.streams[0].getTracks()[0]);
                    if(!e.streams[0].getAudioTracks().length){
                        console.warn("screen got");
                        screen.srcObject = e.streams[0];
                        screen.play();
                        screen.style.display = "block";
                        console.warn("screen shared");
                        for(const[key,value] of Object.entries(peerConnections))
                            e.streams[0].getTracks().forEach(track => value.addTrack(track,e.streams[0]));
                        return;
                    }
                    peerConnectionsStreams[clientId] = e.streams[0];
                    document.getElementById(String(clientName)).lastElementChild.srcObject = e.streams[0];
                    document.getElementById(String(clientName)).lastElementChild.play();
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
                setTimeout(() => stream.getTracks().forEach(track => senders.push(peerConn.addTrack(track, stream))), 1000);
                peerConn.ontrack = e => {
                    console.warn(e.streams[0]);
                    if(!e.streams[0].getAudioTracks().length){
                        screen.srcObject = e.streams[0];
                        screen.play();
                        screen.style.display = "block";
                        console.warn("screen shared");
                        return;
                    }
                    if(!receivedStreams.includes(e.streams[0])){
                        var videodiv = document.createElement("div");
                        var personName = document.createElement("p");
                        videodiv.appendChild(personName);
                        var clientVideo = document.createElement("video");
                        videodiv.appendChild(clientVideo);
                        clientVideo.autoplay = true;
                        clientVideo.className = "webcam";
                        clientVideo.onclick = () =>{
                            screen.className = "webcam";
                            if(screen.nextElementSibling.style.display == "none")
                                screen.nextElementSibling.style.display = "block";
                            screen.nextElementSibling.srcObject = clientVideo.srcObject;
                            screen.nextElementSibling.play();
                        }
                        clientVideo.ondblclick = e => toggleFullscreen(e.target);
                        var emptycell = [...persons.rows[persons.rows.length-1]
                            .cells].find(cell => !cell.children.length);
                        if(emptycell)
                            emptycell.appendChild(videodiv)
                        else{
                            var emptyrow = persons.insertRow();
                            for(let i = 0;i<4;i++){
                                if(i == 0) emptyrow.insertCell().appendChild(videodiv);
                                else emptyrow.insertCell();
                            }
                        }
                        clientVideo.srcObject = e.streams[0];
                        clientVideo.play();
                        receivedStreams.push(e.streams[0]);
                        [...persons.getElementsByTagName("video")]
                            .forEach((vid,ind) => {
                                if(ind > 0){ 
                                    vid.parentElement.firstElementChild.innerText = currentClients[ind-1];
                                    if(currentClients[ind-1] == hostname)
                                        vid.parentElement.firstElementChild.innerText += " (host)";
                                    vid.parentElement.id = currentClients[ind-1];
                                }
                            })
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
        window.onbeforeunload = () => {
            if(!isInitiator){
                senders.forEach(sender => peerConnectionClient.removeTrack(sender));
            }
            socket.emit("leaveMeeting");
        }
        document.getElementById("leaveBtn").addEventListener('click', () => {
            if(confirm("Are you sure?")){
                if(!isInitiator){
                    senders.forEach(sender => peerConnectionClient.removeTrack(sender));
                }
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
