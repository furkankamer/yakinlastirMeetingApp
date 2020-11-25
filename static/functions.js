function leaveMeeting(){
    if(confirm("Are you sure?"))
        fetch("/leavemeeting")
            .then(response => response.text)
            .then(() => location.href = "/")
            .catch(error => alert("an error occured"));
}

function connectToRoom(){
    const FPS = 22;
    var src;
    var dst;
    var cap;
    var shareInterval;
    var audioInterval;
    $(document).ready(function(){
        const video = document.querySelector("#videoElement");
        const audio = document.querySelector("#audioElement");
         video.width = 250; 
         video.height = 180;
         setTimeout(() => {
            src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
            dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
            cap = new cv.VideoCapture(video);
            document.getElementById("start").disabled = false;
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
        socket.on('unshare',user => document.getElementById(user).style.display = 'none');
        socket.on('playaudio', data => {
            audio.src = data;
            audio.play();
            console.log("audio received");
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
