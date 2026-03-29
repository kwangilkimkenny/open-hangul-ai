"""HWPX 파일 생성 서버 — Python zipfile로 한글 호환 ZIP 생성"""
import zipfile, io, json, re, sys
from http.server import HTTPServer, BaseHTTPRequestHandler

GOOD_HWPX = '/Users/k1/Documents/Project/HanView_React/hanview-react-app/docs/알림장 템플릿.hwpx'

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/generate-hwpx':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))

            section_xml = body.get('sectionXml', '')
            header_xml = body.get('headerXml', '')  # optional override

            hwpx_bytes = generate_hwpx(section_xml, header_xml)

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(hwpx_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(hwpx_bytes)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # 로그 숨김


def generate_hwpx(section_xml, header_xml=None):
    """정상 HWPX를 기반으로 section만 교체하여 새 HWPX 생성"""
    good = zipfile.ZipFile(GOOD_HWPX)

    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, 'w')

    for item in good.infolist():
        data = good.read(item.filename)

        if item.filename == 'Contents/section0.xml':
            data = section_xml.encode('utf-8')
        elif item.filename == 'Contents/header.xml' and header_xml:
            data = header_xml.encode('utf-8')

        compress = zipfile.ZIP_STORED if item.filename == 'mimetype' else zipfile.ZIP_DEFLATED
        z.writestr(item.filename, data, compress_type=compress)

    z.close()
    return buf.getvalue()


if __name__ == '__main__':
    port = 8300
    print(f'HWPX Generator server starting on port {port}...')
    server = HTTPServer(('localhost', port), Handler)
    print(f'Ready: http://localhost:{port}/api/generate-hwpx')
    server.serve_forever()
