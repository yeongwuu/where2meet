"""로컬 미리보기 서버. 캐시를 끄기 때문에 파일을 고치고 새로고침하면 바로 반영돼요.

실행: python3 scripts/serve.py  →  http://localhost:5173
"""
import http.server
import os
import socketserver

PORT = 5173
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"http://localhost:{PORT} 에서 보고 있어요. 끄려면 Ctrl + C")
    httpd.serve_forever()
