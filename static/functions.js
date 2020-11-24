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