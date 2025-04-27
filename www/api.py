from flask import Flask, request, jsonify, abort
import json
import os

app = Flask(__name__)
DATA_DIR = "/data"
os.makedirs(DATA_DIR, exist_ok=True)

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

def load_state():
    filename = request.args.get("filename", "appState.json")
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({}), 200
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            state = json.load(f)
        return jsonify(state), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)

