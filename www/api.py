# api.py
from flask import Flask, request, jsonify, abort
import os
import json

app = Flask(__name__)
DATA_DIR = '/data'

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/save-state', methods=['POST'])
def save_state():
    filename = request.args.get('filename', 'appState.json')
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(request.data.decode('utf-8'))
        return 'OK', 200
    except Exception as e:
        return f'Error saving state: {e}', 500

@app.route('/load-state', methods=['GET'])
def load_state():
    filename = request.args.get('filename', 'appState.json')
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        # No saved state yet
        return jsonify({}), 200
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return f'Error loading state: {e}', 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
