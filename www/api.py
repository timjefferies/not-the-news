from flask import Flask, request, jsonify, abort
from flask_compress import Compress
import json
import os

app = Flask(__name__)
Compress(app)
DATA_DIR = "/data"
CONFIG_DIR = os.path.join(DATA_DIR, "config")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

@app.route("/save-state", methods=["POST"])
def save_state():
    filename = request.args.get("filename", "appState.json")
    filepath = os.path.join(DATA_DIR, filename)
    try:
        state = request.get_json(force=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/load-state", methods=["GET"])
def load_state():
    filename = request.args.get("filename", "appState.json")
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({}), 200
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            state = json.load(f)
        # Properly JSON-serialize the dict
        return jsonify(state), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)

@app.route("/load-config", methods=["GET"])
def load_config():
    # Read a text config file from /data/config
    filename = request.args.get("filename")
    if not filename:
        abort(400, description="filename query parameter is required")
    filepath = os.path.join(CONFIG_DIR, filename)
    if not os.path.exists(filepath):
        abort(404, description="Config file not found")
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"content": content}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/save-config", methods=["POST"])
def save_config():
    # Write back a text config file into /data/config
    filename = request.args.get("filename")
    if not filename:
        abort(400, description="filename query parameter is required")
    data = request.get_json(force=True)
    content = data.get("content", "")
    filepath = os.path.join(CONFIG_DIR, filename)
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
