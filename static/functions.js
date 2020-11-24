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
    $(document).ready(function(){
        const video = document.querySelector("#videoElement");
         video.width = 250; 
         video.height = 180;
         setTimeout(() => {
            src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
            dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
            cap = new cv.VideoCapture(video);
            alert("camera is ready");
         }, 10000);
        socket = io.connect('http://' + document.domain + ':' + location.port + '/');
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
        socket.on('sharedData', function(obj){
            console.log("image received");
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
        document.querySelector('.custom-file-input').addEventListener('change', function (e) {
            var fileName = document.getElementById("inputGroupFile01").files[0].name;
            var nextSibling = e.target.nextElementSibling
            nextSibling.innerText = fileName
        })

        document.getElementById("start").addEventListener("change", e => {
            if(e.target.checked){
                document.getElementById('image').style.display = "block";
                if (navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true })
                    .then(function (stream) {
                        video.srcObject = stream;
                        video.play();
                    })
                    .catch(function (err0r) {
                        console.log(err0r)
                        console.log("Something went wrong!");
                    });
                }
            
                shareInterval = setInterval(() => {
                    cap.read(src);
                    cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB);
                    cv.imshow('canvasOutput', dst);
                    var type = "image/png"
                    var data = document.getElementById("canvasOutput").toDataURL(type);
                    data = data.replace('data:' + type + ';base64,', ''); 
                    socket.emit('image', data);
                }, 1000/FPS);
                document.getElementById("stop").checked = false;
            }
        });
        document.getElementById("stop").addEventListener("change", e => {
            if(checkbox.checked){
                clearInterval(shareInterval);
                video.pause();
                document.getElementById('image').style.display = "none";
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
