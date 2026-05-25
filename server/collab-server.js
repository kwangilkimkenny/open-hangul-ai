/**
 * Collab WebSocket Server (Phase 1)
 *
 * y-websocket 호환 echo 서버 — 클라이언트들이 동일 roomId 로 접속하면
 * Yjs sync 프로토콜 + awareness 프로토콜 메시지를 그대로 broadcast 한다.
 *
 * 실행:
 *   COLLAB_PORT=1234 node server/collab-server.js
 *
 * 환경변수:
 *   COLLAB_PORT       (default: 1234)
 *   COLLAB_HOST       (default: 0.0.0.0)
 *   COLLAB_AUTH_TOKEN (default: '')  — 비어있지 않으면 query ?token=... 검증.
 *
 * 영속화는 본 stub 범위 밖이다. 필요시 docs/ 에 따라 추가 백엔드(@y/websocket-server,
 * y-redis, hocuspocus 등) 와 교체할 수 있다.
 *
 * 의존성:
 *   - ws         (y-websocket 의 transitive — 별도 install 불필요)
 *   - yjs        (이미 추가됨)
 *   - y-protocols(y-websocket 의 transitive)
 *
 * 보안 권고:
 *   - 운영에서는 nginx/Caddy 의 TLS termination 뒤에 두고 wss:// 로만 노출.
 *   - 룸 권한은 별도 서비스(예: Supabase RLS) 에서 토큰 발급 후 query string 으로 전달.
 */

import http from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const PORT = parseInt(process.env.COLLAB_PORT || '1234', 10);
const HOST = process.env.COLLAB_HOST || '0.0.0.0';
const AUTH_TOKEN = process.env.COLLAB_AUTH_TOKEN || '';
const PING_INTERVAL_MS = 30 * 1000;

/**
 * Room — 한 문서의 Y.Doc, awareness, 접속 클라이언트.
 */
class Room {
  constructor(name) {
    this.name = name;
    this.doc = new Y.Doc();
    this.doc.gc = true;
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    this.conns = new Map(); // ws -> Set<clientId>
    this.doc.on('update', (update, origin) => this._broadcastUpdate(update, origin));
    this.awareness.on('update', this._onAwarenessUpdate.bind(this));
  }

  _broadcastUpdate(update, origin) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    for (const ws of this.conns.keys()) {
      if (ws === origin) continue;
      sendBin(ws, msg);
    }
  }

  _onAwarenessUpdate({ added, updated, removed }, origin) {
    const changed = added.concat(updated, removed);
    if (origin && this.conns.has(origin)) {
      const cur = this.conns.get(origin);
      added.forEach(c => cur.add(c));
      removed.forEach(c => cur.delete(c));
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)
    );
    const buf = encoding.toUint8Array(encoder);
    for (const ws of this.conns.keys()) {
      sendBin(ws, buf);
    }
  }

  attach(ws) {
    this.conns.set(ws, new Set());
    // 새 클라에게 현재 doc state 송신 (sync step 1).
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    sendBin(ws, encoding.toUint8Array(encoder));

    // 현재 awareness state 도 송신.
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        enc,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      sendBin(ws, encoding.toUint8Array(enc));
    }
  }

  detach(ws) {
    const controlled = this.conns.get(ws);
    if (controlled) {
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlled), null);
    }
    this.conns.delete(ws);
  }

  handleMessage(ws, data) {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case MESSAGE_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);
        if (encoding.length(encoder) > 1) {
          sendBin(ws, encoding.toUint8Array(encoder));
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          ws
        );
        break;
      }
      default:
        // 알 수 없는 메시지 — 무시
        break;
    }
  }
}

const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Room(name));
  return rooms.get(name);
}

function sendBin(ws, buf) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(buf, { binary: true });
    } catch {
      ws.close();
    }
  }
}

/**
 * 토큰 검증 (간단).
 */
function authorize(req) {
  if (!AUTH_TOKEN) return true;
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return url.searchParams.get('token') === AUTH_TOKEN;
  } catch {
    return false;
  }
}

/**
 * 룸 이름 추출 — pathname (예: /my-room) 첫 segment.
 */
function extractRoomName(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const seg = url.pathname.split('/').filter(Boolean);
    return seg[0] || 'default-room';
  } catch {
    return 'default-room';
  }
}

export function startServer({ port = PORT, host = HOST } = {}) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('open-hangul-ai collab server\n');
  });
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!authorize(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const roomName = extractRoomName(req);
      const room = getRoom(roomName);
      room.attach(ws);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', data => {
        try {
          room.handleMessage(ws, data);
        } catch (err) {
          // 메시지 처리 에러는 해당 ws 만 닫는다.
          console.error('[collab-server] message error:', err.message);
          ws.close();
        }
      });
      ws.on('close', () => {
        room.detach(ws);
        if (room.conns.size === 0) {
          rooms.delete(roomName);
        }
      });
    });
  });

  const pingTimer = setInterval(() => {
    for (const room of rooms.values()) {
      for (const ws of room.conns.keys()) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch { /* noop */ }
      }
    }
  }, PING_INTERVAL_MS);

  server.listen(port, host, () => {
    console.log(`[collab-server] listening on ws://${host}:${port}/`);
  });

  function stop() {
    clearInterval(pingTimer);
    wss.close();
    server.close();
  }

  return { server, wss, stop, rooms };
}

// CLI 진입점 — 직접 실행될 때만 listen 한다.
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
  } catch { return false; }
})();
if (isMain) {
  startServer();
}
