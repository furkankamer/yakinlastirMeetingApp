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

app = Flask(__name__)
socketio = SocketIO(app,cors_allowed_origins="*")
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
app.secret_key = b'\xdd\xd6]j\xb0\xcc\xe3mNF{\x14\xaf\xa7\xb9\x18'
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static', 'images'),
                               'favicon.ico', mimetype='image/png')

@app.route('/')
def index():
    return render_template("index.html")
