function leaveMeeting(){
    if(confirm("Are you sure?"))
        fetch("/leavemeeting")
            .then(response => response.text)
            .then(() => location.href = "/")
            .catch(() => alert("an error occured"));
}

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
    var cap;
    var shareInterval;
    var audioInterval;
    var shareIntervalScreen;
    var videoInterval;
    var mainStream = new MediaStream();
    $(document).ready(function(){
        const video = document.querySelector("#videoElement");
        const audio = document.querySelector("#audioElement");
        const screen = document.getElementById("videoElementScreen");
         video.width = 250; 
         video.height = 180;
         screen.width = 750;
         screen.height = 540;
         setTimeout(() => {
            src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
            dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
            srcScreen = new cv.Mat(screen.height, screen.width, cv.CV_8UC4);
            dstScreen = new cv.Mat(screen.height, screen.width, cv.CV_8UC1);
            cap = new cv.VideoCapture(video);
            capScreen = new cv.VideoCapture(screen);
            document.getElementById("start").disabled = false;
            document.getElementById("startScreen").disabled = false;
            document.getElementById("startVideo").disabled = false;
            alert("camera is ready");
         }, 5000);
        socket = io.connect( location.protocol + '//' + document.domain + ':' + location.port + '/',{transports: ['websocket']});
        socket.on('connect', () => socket.emit('joined'));
        socket.on('status', message => {
            alert(message);
            let img = document.createElement("img");
            img.id = message.split(" ")[0];
            document.getElementsByClassName("video")[0].appendChild(img);
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
        socket.on('unshare',user => document.getElementById(user).remove());
        socket.on('unsharescreen', () => {
            document.getElementById("screenImg").style.display = "none";
            document.getElementById("screenImg").src = "";
            isSharingScreen = false;
        });
        socket.on('unsharevideo', id => {
            document.getElementById(id+"video").remove();
        })
        socket.on('video', obj => {
            console.log("video received");
            if(!document.getElementById(obj["username"]+"video")){
                let videoShared = document.createElement("video");
                videoShared.autoplay = true;
                videoShared.id = obj["username"]+"video";
                videoShared.src = obj["data"];
                document.getElementsByClassName("video")[0].appendChild(videoShared);
                return;
            }
            document.getElementById(obj["username"]+"video").style.display = "block";
            document.getElementById(obj["username"]+"video").src = obj["data"];
        });
        socket.on('playaudio', data => {
            audio.src = data;
            audio.play();
            console.log("audio received");
        });
        socket.on('sendScreen', data => {
            console.log("screen got");
            document.getElementById("screenImg").src = data;
            document.getElementById("screenImg").style.display = "block";
            isSharingScreen = true;
        });
        socket.on('sharedData', function(obj){
            console.log("image received");
            if(!document.getElementById(obj["username"])){
                let img = document.createElement("img");
                img.id = obj["username"];
                img.src = obj["data"];
                document.getElementsByClassName("video")[0].appendChild(img);
                return;
            }
            document.getElementById(obj["username"]).style.display = "block";
            document.getElementById(obj["username"]).src = obj["data"];
        });
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
        document.getElementById("startVideo").addEventListener("change", e => {
            if(e.target.checked){
                document.getElementById("stopVideo").checked = false;
                if (navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(stream => {
                            console.log(stream);
                            var mediaRecorder = new MediaRecorder(stream);
                            mediaRecorder.onstart = () => {
                                this.chunks = [];
                            };
                            mediaRecorder.ondataavailable = e => {
                                this.chunks.push(e.data);
                            };
                            mediaRecorder.onstop = () => {
                                var blob = new Blob(this.chunks, { 'type' : 'video/mp4; codecs=opus' });
                                var reader = new FileReader();
                                reader.readAsDataURL(blob);
                                reader.onloadend = () => socket.emit('video',reader.result);
                            };
                            mediaRecorder.start();
                            videoInterval =  setInterval(()=>{
                                console.log("video send");
                                mediaRecorder.stop();
                                mediaRecorder.start();
                            }, 100);
                        })
                    }
            }
        })
        document.getElementById("stopVideo").addEventListener("change", e => {
            if(e.target.checked){
                document.getElementById("startVideo").checked = false;
            }
        })
        document.getElementById("startScreen").addEventListener("change", e => {
            if(e.target.checked){
                if(isSharingScreen){
                    e.target.checked = false;
                    alert("Only one person can share screen");
                    return;
                }
                document.getElementById("screenImg").style.display = "block";
                    navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
                        .then(stream =>  {
                            screen.srcObject = stream;
                            shareIntervalScreen = setInterval(() => {
                                capScreen.read(srcScreen);
                                cv.cvtColor(srcScreen, dstScreen, cv.COLOR_RGBA2RGB);
                                cv.imshow('canvasOutputScreen', dstScreen);
                                var type = "image/jpeg"
                                var data = document.getElementById("canvasOutputScreen").toDataURL(type,0.6);
                                socket.emit('shareScreen', data);
                            }, 1000/FPS);
                            document.getElementById("stopScreen").checked = false;
                        })
                        .catch(() => console.log("An error occured."));
            }
        });
        document.getElementById("stopScreen").addEventListener("change", e => {
            if(e.target.checked){
                socket.emit("unshareScreen");
                document.getElementById("screenImg").style.display = "none";
                document.getElementById("startScreen").checked = false;
                clearInterval(shareIntervalScreen);
            }
        });
        document.getElementById("start").addEventListener("change", e => {
            if(e.target.checked){
                document.getElementById('image').style.display = "block";
                if (navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(stream => {
                        video.srcObject = stream;
                        video.play().then(() => {
                            var mediaRecorder = new MediaRecorder(stream);
                            mediaRecorder.onstart = () => {
                                this.chunks = [];
                            };
                            mediaRecorder.ondataavailable = e => {
                                this.chunks.push(e.data);
                            };
                            mediaRecorder.onstop = () => {
                                var blob = new Blob(this.chunks, { 'type' : 'audio/ogg; codecs=opus' });
                                var reader = new FileReader();
                                reader.readAsDataURL(blob);
                                reader.onloadend = () => socket.emit('audio',reader.result);
                            };
                            mediaRecorder.start();
                            audioInterval = setInterval(() => {
                                mediaRecorder.stop();
                                mediaRecorder.start();
                            }, 1000);
                        });
                    })
                    .catch(error => {
                        console.error(error)
                        console.log("Something went wrong!");
                    });
                }
            
                shareInterval = setInterval(() => {
                    cap.read(src);
                    cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB);
                    cv.imshow('canvasOutput', dst);
                    var type = "image/jpeg"
                    var data = document.getElementById("canvasOutput").toDataURL(type,0.2);
                    socket.emit('image', data);
                }, 1000/FPS);
                document.getElementById("stop").checked = false;
            }
        });
        document.getElementById("stop").addEventListener("change", e => {
            if(e.target.checked){
                clearInterval(shareInterval);
                clearInterval(audioInterval);
                video.pause();
                document.getElementById('image').style.display = "none";
                document.getElementById('start').checked = false;
                socket.emit('unshare',username);
            }
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
