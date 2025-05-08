from flask import Flask, request, jsonify, abort
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
import json
import os

app = Flask(__name__)
DATA_DIR = "/data"
CONFIG_DIR = os.path.join(DATA_DIR, "config")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

# ─── Feed‐sync state ───────────────────────────────────────────────────────
FEED_XML    = os.path.join(DATA_DIR, "feed/feed.xml")
# tombstones: guid → deletion timestamp
_TOMBSTONES = {}

def _load_feed_items():
    """Parse feed.xml into a dict of guid → item_data."""
    tree = ET.parse(FEED_XML)
    root = tree.getroot()
    items = {}
    for it in root.findall(".//item"):
        guid = it.findtext("guid") or it.findtext("link")
        data = {
            "guid":    guid,
            "title":   it.findtext("title"),
            "link":    it.findtext("link"),
            "pubDate": it.findtext("pubDate"),
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
    all_items = _load_feed_items()
    result = {g: all_items[g] for g in wanted if g in all_items}
    return jsonify(result), 200

@app.route("/changes", methods=["GET"])
def changes():
    """
    Diff‐based sync:
      since=<ISO> → {added, removed, updated, serverTime}
    """
    since = request.args.get("since")
    if not since:
        abort(400, "'since' parameter required")
    try:
        since_dt = datetime.fromisoformat(since)
    except Exception:
        abort(400, "invalid 'since' timestamp")

    now     = datetime.now(timezone.utc)
    items   = _load_feed_items()
    added   = []
    updated = []
    # detect added/updated
    for guid, data in items.items():
        # creation time = pubDate; treat any newer pubDate as 'added'
        created = datetime.fromisoformat(data["pubDate"])
        if created > since_dt:
            added.append(guid)
        # if you have an <updated> tag, compare here instead:
        # elif updated_ts > since_dt: updated.append(guid)

    # tombstones: any GUID deleted since 'since_dt'
    removed = [g for g, t in _TOMBSTONES.items() if t > since_dt]

    return jsonify({
        "added":      added,
        "removed":    removed,
        "updated":    updated,
        "serverTime": now.isoformat()
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
