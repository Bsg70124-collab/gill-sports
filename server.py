"""Local, read-only dashboard. Refresh launches workflow with a single running job."""
import json, subprocess, sys, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
LOCK = threading.Lock()
STATUS = {'running': False, 'last_message': 'Not run from dashboard'}

class Handler(BaseHTTPRequestHandler):
    def send(self, code, data, mime='application/json'):
        payload = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/':
            return self.send(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        if path == '/api/status': return self.send(200, STATUS)
        if path == '/api/live':
            f = ROOT / 'data/live.json'
            return self.send(200, json.loads(f.read_text(encoding='utf-8')) if f.exists() else {'games': {}, 'forecasts': {}, 'errors': [], 'last_refresh': None})
        if path == '/api/history':
            return self.send(200, json.loads((ROOT / 'data/forecasts.json').read_text(encoding='utf-8')))
        if path == '/api/players':
            return self.send(200, json.loads((ROOT / 'data/players.json').read_text(encoding='utf-8')))
        if path == '/api/parlays':
            return self.send(200, json.loads((ROOT / 'data/parlays.json').read_text(encoding='utf-8')))
        return self.send(404, {'error': 'Not found'})

    def do_POST(self):
        if urlparse(self.path).path != '/api/refresh': return self.send(404, {'error': 'Not found'})
        with LOCK:
            if STATUS['running']: return self.send(409, STATUS)
            STATUS['running'] = True
            STATUS['last_message'] = 'Refreshing...'
        def run():
            try:
                p = subprocess.run([sys.executable, str(ROOT / 'workflow.py'), '--lookback', '75'],
                                   cwd=ROOT, capture_output=True, text=True, timeout=900)
                STATUS['last_message'] = (p.stdout + '\n' + p.stderr)[-3000:] or f'Exit code {p.returncode}'
            except Exception as e:
                STATUS['last_message'] = str(e)
            finally:
                STATUS['running'] = False
        threading.Thread(target=run, daemon=True).start()
        return self.send(202, STATUS)

if __name__ == '__main__':
    # Localhost only; do not expose this server to the internet without authentication.
    print('Open http://127.0.0.1:8765')
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
