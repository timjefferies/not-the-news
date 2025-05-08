from flask import Flask, request, jsonify, abort
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from email.utils import parsedate_to_datetime
import os

app = Flask(__name__)
DATA_DIR = "/data"
FEED_DIR     = os.path.join(DATA_DIR, "feed")
CONFIG_DIR = os.path.join(DATA_DIR, "config")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

# ─── Feed‐sync state ───────────────────────────────────────────────────────
FEED_XML    = os.path.join(FEED_DIR, "feed.xml")
def _load_feed_items():
    """Parse feed.xml into a dict of guid → item_data."""
    try:
        tree = ET.parse(FEED_XML)
    except (FileNotFoundError, ET.ParseError):
        # No feed or malformed XML → behave as “no items” without side-effects
        return {}
    root = tree.getroot()
    items = {}
    for it in root.findall(".//item"):
        guid     = it.findtext("guid") or it.findtext("link")
        raw_date = it.findtext("pubDate") or ""
        try:
            dt = parsedate_to_datetime(raw_date)
            pub_iso = dt.astimezone(timezone.utc).isoformat()
        except Exception:
            pub_iso = raw_date
        data = {
            "guid":    guid,
            "title":   it.findtext("title"),
            "link":    it.findtext("link"),
            "pubDate": pub_iso,
            "desc":    it.findtext("description"),
        }
        items[guid] = data
    return items

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

@app.route("/time", methods=["GET"])
def time():
    """Return the server UTC time as ISO8601."""
    now = datetime.now(timezone.utc).isoformat()
    return jsonify({"time": now}), 200

@app.route("/guids", methods=["GET"])
def guids():
    """Return the list of GUIDs in feed.xml."""
    items = _load_feed_items()
    return jsonify(list(items.keys())), 200

@app.route("/items", methods=["GET"])
def items():
    """Given ?guids=a,b,c return JSON map of guid→item_data."""
    guids = request.args.get("guids", "")
    wanted = guids.split(",") if guids else []
    # also accept POST JSON
    if request.method == 'POST':
        data = request.get_json(force=True)
        wanted = data.get('guids', [])
    all_items = _load_feed_items()
    result = {g: all_items[g] for g in wanted if g in all_items}
    return jsonify(result), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
