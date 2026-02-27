"""
Channel Analytics Pro — Dev Server
Serves static files with CORS headers.
Run: python server.py
Then open: http://localhost:8081
"""
import http.server
import socketserver
import sys

PORT = 8081


class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        msg = format % args
        if not any(ext in msg for ext in ['.css', '.js', '.ico', '.png', '.jpg', '.woff']):
            sys.stderr.write(f"[FILE] {msg}\n")


class ReuseAddrServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with ReuseAddrServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"[OK] Channel Analytics Pro: http://localhost:{PORT}")
        print(f"     AI: Groq API (direct from browser, no proxy)")
        print(f"     Press Ctrl+C to stop.")
        sys.stdout.flush()
        httpd.serve_forever()
