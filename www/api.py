from flask import Flask, request, jsonify, abort
import os

app = Flask(__name__)
DATA_DIR = "/data"
os.makedirs(DATA_DIR, exist_ok=True)

@app.route("/save-state", methods=["POST"])
def save_state():
    filename = request.args.get("filename", "appState.json")
    filepath = os.path.join(DATA_DIR, filename)
    try:
        data = request.get_data(as_text=True)
        # or use request.json for parsed JSON: state = request.json
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data)
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
            state = f.read()
        return jsonify(request.json or json.loads(state)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)

