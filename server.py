#!/usr/bin/env python3
"""
Custom HTTP Server with Local Direct URL Shortener & OpenAPI Fallback
- Serves static frontend files
- /s/<alias> : Direct 302 redirection to original target URL instantly (No external domains!)
- /api/shorten : Creates short URL mappings locally or via OpenAPI
"""
import os
import sys
import json
import random
import string
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'url_mappings.json')

# URL 매핑 데이터 로드 및 저장 헬퍼
def load_mappings():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_mappings(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving mappings: {e}")

def generate_random_code(length=5):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 모든 응답에 CORS 허용 헤더 추가
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. 자체 직통 단축 URL 리다이렉션: /s/<code_or_alias>
        if path.startswith('/s/'):
            alias = path[3:].strip()
            mappings = load_mappings()
            target_url = mappings.get(alias)

            if target_url:
                # 302 직통 리디렉션: 중간 외부 사이트 전혀 없이 0.001초 만에 원본으로 이동!
                self.send_response(302)
                self.send_header('Location', target_url)
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                return
            else:
                # 등록되지 않은 단축키일 경우 안내 페이지
                self.send_response(404)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                html = f"""<!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>단축 링크 오류</title>
                <style>body{{font-family:sans-serif;text-align:center;padding:50px;line-height:1.6;background:#fff8f3;color:#18181b}}
                a{{color:#f97316;font-weight:bold;text-decoration:none}}</style></head>
                <body><h2>⚠️ 존재하지 않거나 만료된 단축 링크입니다.</h2>
                <p>단축키 '<strong>{alias}</strong>'에 매핑된 주소를 찾을 수 없습니다.</p>
                <p><a href="/urlshort/index.html">👉 URL 단축기로 새로운 링크 만들기</a></p>
                </body></html>"""
                self.wfile.write(html.encode('utf-8'))
                return

        # 2. /api/shorten 엔드포인트 처리
        if path == '/api/shorten':
            params = urllib.parse.parse_qs(parsed.query)
            target_url = params.get('url', [''])[0].strip()
            custom_alias = params.get('alias', [''])[0].strip()
            mode = params.get('mode', ['local'])[0].strip()  # 'local' 또는 'external'

            if not target_url:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'URL이 제공되지 않았습니다.'}).encode('utf-8'))
                return

            if not (target_url.startswith('http://') or target_url.startswith('https://')):
                target_url = 'https://' + target_url

            mappings = load_mappings()

            # A. 자체 직통 단축 모드 (외부 도메인 없이 우리 전용 직통 링크 생성)
            if mode != 'external':
                alias = custom_alias
                if not alias:
                    # 기존에 동일한 URL이 등록되어 있으면 기존 코드 재사용
                    for k, v in mappings.items():
                        if v == target_url:
                            alias = k
                            break
                    if not alias:
                        alias = generate_random_code(5)
                        while alias in mappings:
                            alias = generate_random_code(5)

                mappings[alias] = target_url
                save_mappings(mappings)

                host = self.headers.get('Host', f'localhost:{PORT}')
                short_url = f"http://{host}/s/{alias}"

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'shorturl': short_url,
                    'alias': alias,
                    'target': target_url,
                    'service': '자체 전용 직통 링크'
                }, ensure_ascii=False).encode('utf-8'))
                return

            # B. 외부 공개 OpenAPI 모드 (da.gd 또는 tinyurl)
            # B. 외부 공개 직통 OpenAPI 모드 (Blinkhop zou.sh: 중간 경유창 없이 0초 직통 리디렉션)
            short_url = None
            try:
                data = urllib.parse.urlencode({'url': target_url}).encode('utf-8')
                req = urllib.request.Request(
                    "https://api.blinkhop.com/v1/links",
                    data=data,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as res:
                    if res.status == 200:
                        parsed_res = json.loads(res.read().decode('utf-8'))
                        short_url = parsed_res.get('short_url')
            except Exception:
                pass

            if not short_url:
                try:
                    req = urllib.request.Request(
                        f"https://tinyurl.com/api-create.php?url={urllib.parse.quote(target_url)}",
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    with urllib.request.urlopen(req, timeout=5) as res:
                        if res.status == 200:
                            val = res.read().decode('utf-8').strip()
                            if val.startswith('http'):
                                short_url = val
                except Exception:
                    pass

            if short_url:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'shorturl': short_url, 'service': '외부 OpenAPI'}).encode('utf-8'))
            else:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': '단축 URL 생성에 실패했습니다.'}).encode('utf-8'))
            return

        # 일반 정적 파일 서빙
        super().do_GET()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), CustomHandler)
    print(f"🚀 Server started on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
