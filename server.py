# server.py
from flask import Flask, send_file

app = Flask(__name__)

@app.route('/')
def get_output_html():
    return send_file('output.html', mimetype='text/html')

@app.route('/rss/')
def get_rss_feed():
    return send_file('rss_feed.xml', mimetype='application/xml')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)

