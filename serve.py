"""Run Kairo locally: python3 serve.py  (or npm start)

Serves only the files the scene needs (index.html, kairo.json, the model and src/*.js), never folder listings or hidden files,
and opens the browser at Kairo.
"""
import http.server
import re
import os
import socketserver
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
ALLOWED = {'/index.html', '/kairo.json', '/model/kairo.vrm'}
SRC = re.compile(r'^/src/(?:[a-z]+/)?[a-z-]+\.js$')   # the scene's modules, nothing else
TYPES = {'.js': 'text/javascript', '.json': 'application/json', '.vrm': 'model/gltf-binary'}


class KairoHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        if path == '/':
            path = '/index.html'
        if path not in ALLOWED and not SRC.match(path):
            self.send_error(404, 'Not found')
            return
        self.path = path
        super().do_GET()

    def do_HEAD(self):
        self.do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')   # edits show up on a normal refresh
        super().end_headers()

    def guess_type(self, path):
        return TYPES.get(os.path.splitext(path)[1], super().guess_type(path))

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    url = f'http://127.0.0.1:{PORT}/'
    try:
        httpd = Server(('127.0.0.1', PORT), KairoHandler)
    except OSError:
        sys.exit(f'Port {PORT} is busy. Try: python3 serve.py {PORT + 1}')
    print(f'Kairo is running at {url}  (Ctrl+C to stop)')
    if not os.environ.get('KAIRO_NO_OPEN'):
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
