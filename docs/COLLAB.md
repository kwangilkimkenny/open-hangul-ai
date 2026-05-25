# 실시간 협업 (CRDT / Yjs) — Phase 1

> 한컴 한글이 못 하는 진짜 차별화 영역.
> 두 사람이 같은 HWPX 단락을 동시에 편집해도 충돌 없이 자동 머지된다.

## 1. 개요

| 항목 | 결정 |
| --- | --- |
| CRDT 코어 | [Yjs](https://yjs.dev) (`yjs@^13`) |
| 네트워크 | [y-websocket](https://github.com/yjs/y-websocket) (`y-websocket@^3`) |
| Phase 1 범위 | 단락 텍스트 + 단락 정렬(left/center/right/justify) |
| Phase 2 (예정) | 표 셀, 도형, 이미지, 메모, 영속화, 권한 |

## 2. 아키텍처

```
┌─────────────────────┐         WebSocket (Yjs sync)      ┌─────────────────────┐
│  Client A           │  ───────────────────────────────► │  Client B           │
│                     │  ◄─────────────────────────────── │                     │
│  ┌───────────────┐  │                                   │  ┌───────────────┐  │
│  │ HWPXDocument  │──┼──┐                             ┌──┼──│ HWPXDocument  │  │
│  └───────────────┘  │  │   ┌────────────────────┐    │  │  └───────────────┘  │
│  ┌───────────────┐  │  ├──►│  yjs-doc-mapper.js │◄───┤  │  ┌───────────────┐  │
│  │ Editor / UI   │◄─┼──┘   └────────┬───────────┘    └──┼─►│ Editor / UI   │  │
│  └───────────────┘  │               ▼                   │  └───────────────┘  │
│  ┌───────────────┐  │      ┌─────────────────┐          │  ┌───────────────┐  │
│  │ CollabManager │◄─┼──────│   Y.Doc (CRDT)  │──────────┼─►│ CollabManager │  │
│  └───────┬───────┘  │      └────────┬────────┘          │  └───────┬───────┘  │
│          │          │               ▼                   │          │          │
│  ┌───────▼───────┐  │      ┌─────────────────┐          │  ┌───────▼───────┐  │
│  │   Presence    │◄─┼──────│    Awareness    │──────────┼─►│   Presence    │  │
│  └───────────────┘  │      └─────────────────┘          │  └───────────────┘  │
└─────────────────────┘                                   └─────────────────────┘
                                     ▲
                                     │ ws://
                                     ▼
                       ┌─────────────────────────────┐
                       │   server/collab-server.js   │
                       │   (y-websocket echo + auth) │
                       └─────────────────────────────┘
```

### 2.1 Y.Doc 데이터 모델

```
ydoc.getMap('hwpx')
  ├─ meta        : Y.Map  { version: 'phase1' }
  ├─ paragraphs  : Y.Map<paragraphId, Y.Map>
  │     each value: Y.Map {
  │       text  : Y.Text,        // 문단의 plain text — 문자 단위 머지
  │       align : 'left'|'center'|'right'|'justify'   // LWW 스칼라
  │     }
  └─ order       : Y.Array<paragraphId>   // 문단 순서
```

**ID 전략** — 원본 HWPX run/단락에 명시적 `id` 가 없으면 매퍼가
`s{sectionIndex}-p{paragraphIndex}` 형태로 결정론적 ID 를 부여한다.
두 클라이언트가 동일 파일을 파싱하면 같은 ID 가 나오므로 초기 sync 가 안전하다.

**비-텍스트 run 보존** — 도형/표/필드/이미지 run 은 `applyYDocToHwpx` 단계에서
원본 객체를 그대로 보존한다. 텍스트 run 은 첫 번째 텍스트 run 에 통합되며,
이후 텍스트 run 들은 흡수된다.

## 3. 클라이언트 API

```js
import { CollabManager } from 'open-hangul-ai/src/lib/vanilla/collab/collab-manager.js';

const collab = new CollabManager({
  roomId: 'doc-abc',                // 서버에서 룸 식별
  wsUrl: 'ws://localhost:1234',     // 비워두면 standalone
  userInfo: { id: 'u-001', name: 'Alice', color: '#4dd0e1' },
});

collab.attachDocument(hwpxDoc);

const offChange   = collab.on('change',   ({ changedParagraphIds, patchedDoc, origin }) => {
  renderer.update(patchedDoc); // origin: 'local' | 'remote'
});
const offPresence = collab.on('presence', users => {
  cursors.draw(users.filter(u => u.id !== collab.getUsers()[0].id));
});

// 로컬 편집 broadcast
collab.applyLocalChange('s0-p3', '새 텍스트 내용');
collab.applyLocalAlignChange('s0-p3', 'center');

// 커서 위치 broadcast (선택)
collab.setLocalCursor('s0-p3', 12);

// 정리
offChange();
offPresence();
collab.disconnect();
collab.destroy();
```

### 3.1 Presence

```js
collab.getUsers();
/* =>
   [
     { id: 'u-001', name: 'Alice', color: '#4dd0e1', cursor: { paragraphId: 's0-p3', offset: 12 } },
     { id: 'u-014', name: 'Bob',   color: '#ba68c8', cursor: null },
   ]
*/
```

사용자 색상은 `pickColorForId()` 로 결정론적 매핑된다 — 같은 ID 는 어느 클라이언트에서나
같은 색을 본다.

## 4. WebSocket 서버

### 4.1 실행

```sh
COLLAB_PORT=1234 \
COLLAB_HOST=0.0.0.0 \
COLLAB_AUTH_TOKEN=changeme \
node server/collab-server.js
```

### 4.2 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `COLLAB_PORT` | `1234` | WebSocket 포트 |
| `COLLAB_HOST` | `0.0.0.0` | 바인드 호스트 |
| `COLLAB_AUTH_TOKEN` | (없음) | 비어있지 않으면 `?token=` 쿼리스트링 검증 |

### 4.3 룸 URL 규약

```
ws://<host>:<port>/<roomId>?token=<COLLAB_AUTH_TOKEN>
```

`roomId` 는 path 의 첫 segment 다 (`/doc-abc` → `doc-abc`).

### 4.4 동작

내장 서버는 in-memory echo 서버이다:

1. 클라이언트가 접속하면 현재 룸의 Y.Doc state 와 awareness state 를 송신.
2. 클라이언트 메시지를 받으면 sync 프로토콜에 따라 응답 + 다른 클라이언트에게 broadcast.
3. 모든 클라이언트가 떠나면 룸을 메모리에서 제거 (영속화 없음).

영속화/스케일링이 필요하면 `@y/websocket-server`, `y-redis`, `hocuspocus` 같은
대체 백엔드로 교체하라.

## 5. 보안

### 5.1 인증 (auth)

| 레이어 | 책임 |
| --- | --- |
| 외부 (예: Supabase) | 사용자 로그인 + 룸 권한 검사 → short-lived 토큰 발급 |
| 내장 서버 | `COLLAB_AUTH_TOKEN` 쿼리 비교 (단순) — 운영에서는 JWT 검증으로 교체 권장 |

```js
// 권장: 토큰을 wsOpts.params 로 넘긴다 (URL 에 자동 부착)
new WebsocketProvider('wss://collab.example.com', roomId, ydoc, {
  params: { token: jwt },
});
```

### 5.2 전송 보안

- 운영은 반드시 **wss://** (TLS). nginx/Caddy 의 reverse-proxy 뒤에 둔다.
- 룸 ID 는 추측 불가능한 random ID 사용 (UUID v4).

### 5.3 RLS / 룸 권한

- 룸 진입 전 별도 API 가 `roomId` 에 대한 read/write 권한을 확인하고 토큰을 발급한다.
- 읽기 전용 사용자에게는 Yjs 의 `awareness` 만 허용하는 read-only proxy 를 고려.

## 6. 충돌 해결 동작

| 시나리오 | 결과 |
| --- | --- |
| 동일 단락의 다른 위치에 동시 insert | 두 insert 모두 보존 (위치 기준 머지) |
| 같은 위치에 동시 insert | 결정론적 tiebreak (clientId) → 두 사이드 동일 |
| 텍스트 vs 정렬 동시 변경 | 둘 다 적용 (서로 다른 필드) |
| 정렬 동시 변경 (충돌) | last-writer-wins — 두 사이드는 동일한 값으로 수렴 |

테스트: `src/lib/vanilla/collab/collab-manager.test.js > CollabManager :: concurrent edits`.

## 7. 알려진 한계 (Phase 2 로 이전)

- 표 셀 / 도형 / 이미지 / OLE / 메모 / 필드 같은 복합 객체 — 변경 broadcast 안 됨
  (1차에서는 원본 그대로 보존하지만 동기화되진 않는다).
- 단락 추가/삭제는 broadcast 되지만, 단락 순서 변경(drag-drop)은 1차에서 미검증.
- 영속화 없음 — 서버 재시작 시 모든 룸 state 가 사라진다.
- 권한 정책은 단일 토큰 비교만 — RLS/룸별 권한은 외부 게이트웨이에서 처리해야 한다.
- WebsocketProvider 의 자동 재연결은 사용하지만, 큐잉/오프라인 머지 UX 보강 필요.

## 8. 디렉터리 구조

```
src/lib/vanilla/collab/
  ├─ collab-manager.js         # 외부 API (이벤트 / attach / applyLocalChange)
  ├─ yjs-doc-mapper.js         # HWPX ↔ Y.Doc 변환
  ├─ presence.js               # awareness 래퍼
  ├─ collab-manager.test.js    # 단위 + 2-client + 충돌 머지
  ├─ yjs-doc-mapper.test.js    # 라운드트립 / patch
  └─ presence.test.js          # 로컬-only 사용자 추가/제거/cursor

server/
  └─ collab-server.js          # in-memory echo 서버 (ws + y-protocols)
```

## 9. 다음 단계 체크리스트

- [ ] 표 셀 (Y.Map per cell) + 도형 위치 (Y.Map) Phase 2
- [ ] 단락 순서 변경 (Y.Array.move) UX 통합
- [ ] LevelDB / Postgres 영속화 (`@y/websocket-server` 도입 검토)
- [ ] Supabase JWT 검증을 collab-server 에 통합
- [ ] Editor binding (canvas-editor / vanilla renderer) → Y.Text observer 와 직접 연결
- [ ] Snapshot/history API 노출 (Yjs 의 `undo-manager`)
