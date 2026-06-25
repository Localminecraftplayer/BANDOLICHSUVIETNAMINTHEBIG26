#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import urllib.request, json, time, ssl, hashlib, os

FPT_KEY   = '9GHTAvTe8QhtNIG9a5j4Le3LT2ZArFsm'
FPT_VOICE = 'minhquang'
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.tts_cache')
os.makedirs(CACHE_DIR, exist_ok=True)

CTX = ssl._create_unverified_context()

def cache_path(text):
    key = hashlib.md5(text.encode('utf-8')).hexdigest()
    return os.path.join(CACHE_DIR, key + '.mp3')

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/tts'):
            params = parse_qs(urlparse(self.path).query)
            text = params.get('q', [''])[0]
            path = cache_path(text)

            # Serve from cache if available
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    audio = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(audio)
                return

            try:
                resp = None
                for api_try in range(3):
                    try:
                        req = urllib.request.Request(
                            'https://api.fpt.ai/hmi/tts/v5',
                            data=text.encode('utf-8'),
                            headers={
                                'api-key': FPT_KEY,
                                'voice': FPT_VOICE,
                                'speed': '',
                                'Content-Type': 'text/plain',
                            }
                        )
                        with urllib.request.urlopen(req, timeout=10, context=CTX) as r:
                            resp = json.loads(r.read())
                        break
                    except Exception as e:
                        print(f'API attempt {api_try+1} failed: {e}')
                        time.sleep(1)

                if not resp:
                    raise Exception('FPT API failed after 3 tries')

                audio_url = resp.get('async', '')
                if not audio_url:
                    raise Exception('no async url')

                audio = None
                for attempt in range(15):
                    time.sleep(0.8)
                    try:
                        with urllib.request.urlopen(audio_url, timeout=10, context=CTX) as ar:
                            if ar.status == 200:
                                audio = ar.read()
                                break
                    except:
                        pass

                if not audio:
                    raise Exception('audio never became ready')

                # Save to cache
                with open(path, 'wb') as f:
                    f.write(audio)

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(audio)

            except Exception as e:
                print('TTS ERROR:', e)
                self.send_response(500)
                self.end_headers()
        else:
            super().do_GET()

    def log_message(self, *a): pass

print('Serving at http://localhost:8080')
HTTPServer(('', 8080), Handler).serve_forever()
