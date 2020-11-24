function leaveMeeting(){
    if(confirm("Are you sure?"))
        fetch("/leavemeeting")
            .then(response => response.text)
            .then(() => location.href = "/")
            .catch(error => alert("an error occured"));
}

function connectToRoom(){
    $(document).ready(function(){
        socket = io.connect('http://' + document.domain + ':' + location.port + '/');
        socket.on('connect', () => socket.emit('joined'));
        socket.on('status', message => alert(message));
        socket.on('leave', message => alert(message));
        socket.on('receive', message => {
            document.getElementById("chat").insertAdjacentHTML("beforeend",
                    `<p>${message}</p>`);
        })
        document.getElementById("sendBtn").addEventListener('click', e => {
            let message = document.getElementById("message");
            if(message.value)
                socket.emit('message',message.value);
            message.value = "";
        });
        document.getElementById("leaveBtn").addEventListener('click', () => {
            if(confirm("Are you sure?")){
                socket.emit("leaveMeeting");
                location.href = "/";
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
function openForm() {
    document.getElementById("myForm").style.display = "block";
  }
  
  function closeForm() {
    document.getElementById("myForm").style.display = "none";
  }