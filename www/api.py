from flask import Flask, request, jsonify, abort, make_response
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from email.utils import parsedate_to_datetime
import os
import json

app = Flask(__name__)
DATA_DIR = "/data"
FEED_DIR = os.path.join(DATA_DIR, "feed")
CONFIG_DIR = os.path.join(DATA_DIR, "config")
USER_STATE_DIR = os.path.join(DATA_DIR, "user_state")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(FEED_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(USER_STATE_DIR, exist_ok=True)

# ─── Feed‐sync state ───────────────────────────────────────────────────────
FEED_XML = os.path.join(FEED_DIR, "feed.xml")

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    if data.get("password") == os.environ["APP_PASSWORD"]:
        resp = make_response(jsonify({"status": "ok"}))
        resp.set_cookie(
            "auth", "valid",
            max_age=60*60*24*90,     # 90 days
            httponly=True,
            secure=True,
            samesite="Strict"
            samesite="Lax",          # allow on top-level navigations
            path="/"                 # send on every path
        )
        return resp
    return jsonify({"error": "Unauthorized"}), 401

def _load_feed_items():
    """Parse feed.xml into a dict of guid → item_data."""
    try:
        tree = ET.parse(FEED_XML)
    except (FileNotFoundError, ET.ParseError):
        # No feed or malformed XML → behave as “no items” without side-effects
        return {}
    # strip all XML namespaces so .find()/.findall() work consistently
    for elem in tree.getroot().iter():
        if "}" in elem.tag:
            elem.tag = elem.tag.split("}", 1)[1]
    root = tree.getroot()
    items = {}
    for it in root.findall(".//item"):
        guid = it.findtext("guid") or it.findtext("link")
        raw_date = it.findtext("pubDate") or ""
        try:
            dt = parsedate_to_datetime(raw_date)
            pub_iso = dt.astimezone(timezone.utc).isoformat()
        except Exception:
            pub_iso = raw_date
        data = {
            "guid": guid,
            "title": it.findtext("title"),
            "link": it.findtext("link"),
            "pubDate": pub_iso,
            "desc": it.findtext("description"),
        }
        items[guid] = data
    return items


@app.route("/load-config", methods=["GET", "POST"])
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


@app.route("/items", methods=["GET", "POST"])
def items():
    """Given ?guids=a,b,c return JSON map of guid→item_data."""
    guids = request.args.get("guids", "")
    wanted = guids.split(",") if guids else []
    # also accept POST JSON
    if request.method == "POST":
        data = request.get_json(force=True)
        wanted = data.get("guids", [])
    all_items = _load_feed_items()
    result = {g: all_items[g] for g in wanted if g in all_items}
    return jsonify(result), 200


# ─── User‐state syncing (hidden/starred/settings) ───────────────────────────
#
def _user_state_path(key):
    return os.path.join(USER_STATE_DIR, f"{key}.json")


def _load_state(key):
    path = _user_state_path(key)
    if not os.path.exists(path):
        return {"value": None, "lastModified": None}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_state(key, value):
    now = datetime.now(timezone.utc).isoformat()
    data = {"value": value, "lastModified": now}
    with open(_user_state_path(key), "w", encoding="utf-8") as f:
        json.dump(data, f)
    return now


@app.route("/user-state", methods=["GET"])
def get_user_state():
    """Delta‐fetch: only return keys changed since `since`."""
    since = request.args.get("since")
    out = {}
    newest = since
    for key in ("hidden", "starred", "settings"):
        st = _load_state(key)
        lm = st.get("lastModified")
        if lm and (not since or lm > since):
            out[key] = st["value"]
            if not newest or lm > newest:
                newest = lm
    if_none = request.headers.get("If-None-Match")
    etag = newest or ""
    if if_none == etag:
        return ("", 304)
    resp = jsonify({"changes": out, "serverTime": newest})
    resp.headers["ETag"] = etag
    return resp, 200


@app.route("/user-state", methods=["POST"])
def post_user_state():
    """Accept client‐side mutations and bump lastModified."""
    # parse JSON quietly; reject if missing or malformed
    data = request.get_json(silent=True)
    if not data or "changes" not in data or not isinstance(data["changes"], dict):
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    server_time = None
    for key, val in data["changes"].items():
        # merge arrays or overwrite settings
        current = _load_state(key)["value"] or ({} if key == "settings" else [])
        if isinstance(current, list) and isinstance(val, list):
            merged = val
        else:
            merged = val
        server_time = _save_state(key, merged)

    return jsonify({"serverTime": server_time}), 200
@app.route("/user-state/hidden/delta", methods=["POST"])
def hidden_delta():
    data    = request.get_json(force=True)
    state   = _load_state("hidden")["value"] or []
    action  = data.get("action")
    id_     = data.get("id")
    if action == "add":
        entry = {"id": id_, "hiddenAt": data.get("hiddenAt")}
        if all(h["id"] != id_ for h in state):
            state.append(entry)
    elif action == "remove":
        state = [h for h in state if h["id"] != id_]
    else:
        abort(400, description="Invalid action")
    server_time = _save_state("hidden", state)
    return jsonify({"serverTime": server_time}), 200

@app.route("/user-state/starred/delta", methods=["POST"])
def starred_delta():
    data    = request.get_json(force=True)
    state   = _load_state("starred")["value"] or []
    action  = data.get("action")
    id_     = data.get("id")
    if action == "add":
        entry = {"id": id_, "starredAt": data.get("starredAt")}
        if all(s["id"] != id_ for s in state):
            state.append(entry)
    elif action == "remove":
        state = [s for s in state if s["id"] != id_]
    else:
        abort(400, description="Invalid action")
    server_time = _save_state("starred", state)
    return jsonify({"serverTime": server_time}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
