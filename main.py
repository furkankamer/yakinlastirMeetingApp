# app.py
import eventlet
eventlet.monkey_patch()
from flask import Flask,flash, request, jsonify, render_template,Response,redirect,send_from_directory, session
import os
import time
from datetime import datetime
from passlib.hash import pbkdf2_sha256
from flask_login import LoginManager, login_user, logout_user, login_required, current_user,UserMixin
from flask_cors import CORS, cross_origin
import psycopg2
import pytz
import random
import json
from flask_socketio import SocketIO, emit, join_room, leave_room
from engineio.payload import Payload
url = "dbname='lvzhcnac' user='lvzhcnac' host='hattie.db.elephantsql.com' password='vVGET77hDS1CFyhz363vxUWX6kamZuF7'"
app = Flask(__name__)
#Talisman(app,content_security_policy = csp,content_security_policy_nonce_in = ['script-src','style-src'])
socketio = SocketIO(app,cors_allowed_origins="*",async_mode="eventlet")
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
app.secret_key = b'\xdd\xd6]j\xb0\xcc\xe3mNF{\x14\xaf\xa7\xb9\x18'
lm = LoginManager()
rooms = {}


@app.before_request
def before_request():
    if not request.is_secure:
        url = request.url.replace('http://', 'https://', 1)
        code = 301
        return redirect(url, code=code)

@socketio.on("sharingScreen")
def screenSharing():
    rooms[session["meetingId"]]["isSomeoneSharingScreen"] = True
    emit('someoneSharingScreen', room = session['meetingId'])

@socketio.on('stoppedScreenShare')
def stoppedScreenSharing():
    rooms[session["meetingId"]]["isSomeoneSharingScreen"] = False
    emit('screenShareStopped', room = session['meetingId'])

@socketio.on('messageToClient')
def messageToClient(message):
    print("message to client: %s" % message["id"])
    emit('messageToClient',message["message"],room = message["id"],include_self=False)


@socketio.on('messageToServer')
def message(message):
    print("message to server: %s" % rooms[session["meetingId"]]["host"])
    room = session["meetingId"]
    emit('messageToServer',{"message": message, "id" : request.sid},room = rooms[room]["host"],include_self = False)


@socketio.on("joined")
def joined():
    join_room(session["meetingId"])
    session["userName"] = current_user.username
    emit('status', current_user.username + ' has joined to meeting', room = session["meetingId"], include_self = False)
    session["id"] = request.sid
    room = session["meetingId"]
    if "host" not in rooms[room]:
        rooms[room]["isSomeoneSharingScreen"] = False 
        rooms[room]["host"] = request.sid
        rooms[room]["hostname"] = session["userName"]
        print(rooms)
        emit('created',{"room" :room, "id": session["id"]})
    else:
        clients = []
        for client in rooms[room]["clients"]:
            clients.append(client)
        clients.insert(0,rooms[room]["hostname"])
        print(clients)
        if rooms[room]["isSomeoneSharingScreen"]:
            emit("someoneSharingScreen")
        emit('joined',{
            "room" :room,"username":session["userName"], 
            "id": session["id"], "index": len(rooms[room]["clients"]), 
            "clients" : json.dumps(clients),
            "host": rooms[room]["hostname"]
            }) 
        if session["userName"] not in clients:
            clients.append(session["userName"])
        print(clients)
        if session["userName"] not in rooms[room]["clients"]:
            rooms[room]["clients"].append(session["userName"])
        print(rooms[room]["clients"])
        emit('clientsUpdate',json.dumps(clients),room = room,include_self = False)
        emit('ready',{"name":session["userName"],"id": request.sid},room = rooms[room]["host"],include_self = False)

@socketio.on("message")
def message(data):
    if data["type"] == "file":
        emit("filereceive", data, room = session["meetingId"])
    else:
        emit("receive", current_user.username + ":" + data["content"], room = session["meetingId"])

@socketio.on('lastparticipantid')
def lastparticipantid(id):
    emit('clientId',id,room = session["room"],include_self = False)

@socketio.on("closedroom")
def closedroom():
    session["meetingId"] = -1
    session["joined"] = False

@socketio.on("leaveMeeting")
def leavemeeting():
    room = session['meetingId']
    leave_room(session["meetingId"])
    if not rooms:
        print("cannot leave room")
        return
    if room == -1:
        print("cannot leave room")
        return
    elif rooms[room]["host"] != request.sid:
        rooms[room]["clients"].remove(current_user.username)
        session["joined"] = False
        session["meetingId"] = -1
        emit('leave',current_user.username + ": has left meeting",room = room)
        emit('removeUserVideo',session["userName"],room = room)
        clients = []
        for client in rooms[room]["clients"]:
            clients.append(client) 
        clients.insert(0,rooms[room]["hostname"])
        emit('clientsUpdate',json.dumps(clients),room = room)
        print("left room as client")
    else:
        session["joined"] = False
        session["meetingId"] = -1
        del rooms[room]
        emit('hostleft',room = room,include_self = False)
        print("left room as host")
    return redirect("/meeting")


def sql_returner(query,fetch):
    with psycopg2.connect(url) as connection:
         with connection.cursor() as cursor:
              try:
                  cursor.execute(query)
                  if fetch == 1:
                     return cursor.fetchone()[0]
                  elif fetch == 0:
                     return cursor.fetchall()
                  elif fetch == 2:
                     return 1
              except psycopg2.DatabaseError:
                  return None

@lm.user_loader
def load_user(user_id):
    return get_user(user_id)

class User(UserMixin):
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.active = True
        self.is_admin = False

    def get_id(self):
        return self.username

    @property
    def is_active(self):
        return self.active

def get_user(nick):
    query = "select password from users where username = '%s' " % nick
    user = sql_returner(query, 0)
    if user is None:
        return None
    for row in user:
        return User(nick,row[0])


@login_required
@app.route("/joinmeeting", methods = ['POST'])
def joinmeetingPost():
    id = int(request.form["Id"])
    meetingPassword = request.form["Password"]
    if id in rooms and rooms[id]["password"] != meetingPassword:
        return redirect("/joinmeeting")
    if id not in rooms:
        return redirect("/joinmeeting")
    session["meetingId"] = id
    session["joined"] = True
    rooms[id]["clients"].append(current_user.username)
    return redirect("/meeting")


@cross_origin()
@app.route("/signin", methods = ['POST'])
def signin():
    username = request.form['UserName']
    user = get_user(username)
    if user is not None:
        password = request.form['Password']
        password1 = user.password
        if pbkdf2_sha256.verify(password, password1):
            login_user(user)
            session["joined"] = False
            session["meetingId"] = -1
        else:
            flash("Invalid Credentials")
        return redirect("/")
    flash("Invalid Credentials")
    return redirect("/")

@cross_origin()
@app.route("/signup", methods = ['POST'])
def signup():
    username = request.form['UserName']
    password = pbkdf2_sha256.hash(request.form['Password'])
    print(username)
    print(password)
    query = "insert into users (username,password) values ('%s','%s')" % (username,password)
    if sql_returner(query, 2) is None:
        return redirect("/signup")
    return redirect("/")

@login_required
@app.route("/logout")
def logout():
    if current_user.is_authenticated:
        logout_user()
    return redirect("/")

@login_required
@app.route("/meeting", methods = ['POST'])
def createMeeting():
    setattr(current_user,'joined',True)
    current_user.joined = True
    meetingCount = 0
    Name = request.form["Name"]
    while meetingCount in rooms:
        meetingCount += 1
    id = int(meetingCount)
    session["meetingId"] = id
    session["meetingName"] = Name
    meetingPassword = request.form["Password"]
    rooms[id] = {}
    rooms[id]["name"] = Name
    rooms[id]["hostname"] = current_user.username
    rooms[id]["clients"] = [] 
    rooms[id]["password"] = meetingPassword
    session["joined"] = True
    meetingCount += 1
    return redirect("/meeting")

@login_required
@app.route("/meeting", methods = ['GET'])
def meeting():
    session["userName"] = current_user.username
    if session["meetingId"] in rooms:
        if session["userName"] in rooms[session["meetingId"]]["clients"] or rooms[session["meetingId"]]["hostname"] == session["userName"]:
            print("someone joined room")
            return render_template("meeting.html",meetingName = rooms[session["meetingId"]]["name"], joined = session["joined"], meetingId = session["meetingId"], user = current_user.username)
    session["joined"] = False
    session["meetingId"] = -1
    return render_template("meeting.html",joined = False)

@login_required
@app.route("/newmeeting",methods = ['GET'])
def newMeeting():
    session["joined"] = False
    session["meetingId"] = -1
    return render_template("newmeeting.html", joined = session["joined"])
    
@login_required
@app.route("/joinmeeting",methods = ['GET'])
def joinMeeting():
    session["joined"] = False
    session["meetingId"] = -1
    return render_template("joinmeeting.html")


@app.route("/signup",methods = ['GET'])
def signupPage():
    return render_template("signup.html")

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static', 'images'),
                               'favicon.ico', mimetype='image/png')

@app.route('/')
def index():
    if current_user.is_authenticated:
        session["joined"] = False
        session["meetingId"] = -1
    return render_template("index.html")

lm.init_app(app)
lm.login_view = "login"
