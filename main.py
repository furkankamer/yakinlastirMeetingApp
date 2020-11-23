# app.py
from flask import Flask,flash, request, jsonify, render_template,Response,redirect,send_from_directory
import os
import time
from datetime import datetime
from passlib.hash import pbkdf2_sha256
from flask_login import LoginManager, login_user, logout_user, login_required, current_user,UserMixin
from flask_cors import CORS, cross_origin
import psycopg2
import pytz
from flask_socketio import SocketIO, emit

url = "dbname='lvzhcnac' user='lvzhcnac' host='hattie.db.elephantsql.com' password='FjnjB28yNrnKOwp_coyq7LABdtIL2iIK'"
app = Flask(__name__)
socketio = SocketIO(app,cors_allowed_origins="*")
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
app.secret_key = b'\xdd\xd6]j\xb0\xcc\xe3mNF{\x14\xaf\xa7\xb9\x18'
lm = LoginManager()


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
        self.joined = False
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

@app.route("/meeting", methods = ['GET'])
def meeting():
    return render_template("meeting.html", joined = current_user.joined)

@app.route("/newmeeting",methods = ['GET'])
def newMeeting():
    return render_template("newmeeting.html")

@app.route("/joinmeeting",methods = ['GET'])
def joinMeeting():
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
    return render_template("index.html")

lm.init_app(app)
lm.login_view = "login"