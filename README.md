# Agent Timeline Viewer

Claude Code のエージェントチーム実行ワークフローを可視化・デバッグするためのツール。
`~/.claude/projects/` に保存されたJSONLセッションログを読み取り、エージェントの活動をインタラクティブなタイムラインで表示する。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19, TypeScript 5.6, D3.js 7.9, Tailwind CSS 3.4 |
| バックエンド | Express 4.21, TypeScript 5.6 |
| ビルド | Vite 5.4, pnpm |

## セットアップ

```bash
cd agent-timeline-viewer
pnpm install
pnpm dev
```

- フロントエンド: http://localhost:5173
- APIサーバー: http://localhost:3456（Viteが `/api/*` をプロキシ）

## ディレクトリ構成

```
agent-timeline-viewer/
├── server/                     # Express バックエンド
│   ├── index.ts                # サーバーエントリ (port 3456)
│   ├── routes/
│   │   └── sessions.ts         # セッション一覧・詳細API
│   └── parser/
│       ├── jsonl-parser.ts     # JSONLファイル読み取り・メタデータ抽出
│       ├── event-extractor.ts  # JSONLエントリ → タイムラインイベント変換
│       └── edge-builder.ts     # イベント間リレーション構築
│
├── src/                        # React フロントエンド
│   ├── main.tsx                # エントリポイント
│   ├── App.tsx                 # メインレイアウト・状態管理
│   ├── types/index.ts          # TypeScript型定義
│   ├── components/
│   │   ├── Timeline.tsx        # D3 SVGタイムライン描画
│   │   ├── DetailPanel.tsx     # イベント詳細サイドパネル
│   │   ├── EventNode.tsx       # イベントノード表示
│   │   ├── FilterBar.tsx       # エージェント/タイプ/検索フィルター
│   │   ├── SessionSelector.tsx # セッション選択ドロップダウン
│   │   └── TaskProgress.tsx    # タスク進捗バー
│   ├── hooks/
│   │   ├── useSession.ts       # セッションデータ取得（ポーリング）
│   │   └── useTimeline.ts      # D3スケール・ズーム・レスポンシブ
│   └── utils/
│       └── colors.ts           # イベントタイプ別カラーマッピング
│
├── vite.config.ts              # Vite設定（Reactプラグイン、@/エイリアス、APIプロキシ）
├── tsconfig.json               # TypeScript設定
├── tailwind.config.ts          # Tailwind CSS設定
└── package.json
```

## アーキテクチャ

### データフロー

```
~/.claude/projects/[project]/[session].jsonl
        ↓
  jsonl-parser.ts       JSONLファイル読み取り・メタデータ抽出
        ↓
  event-extractor.ts    ツールコール → タイムラインイベント変換
        ↓
  edge-builder.ts       イベント間リレーション（メッセージ/タスク/ファイル/スポーン）構築
        ↓
  Express API           /api/sessions, /api/sessions/:id
        ↓
  React Frontend        D3.jsタイムライン描画・フィルタリング・詳細表示
```

### API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/sessions` | セッション一覧（5件未満のイベントは除外、新しい順） |
| GET | `/api/sessions/:id` | セッション詳細（イベント、エージェント、エッジ、タスク） |

### イベントタイプ

JSONLのツールコールから以下のイベントタイプに変換される:

| ツール | イベントタイプ | 色 |
|--------|--------------|-----|
| TeamCreate | `team_create` | 紫 |
| Agent | `agent_spawn` | 紫 |
| SendMessage | `message_send` | 紫 |
| TaskCreate | `task_create` | 黄 |
| TaskUpdate | `task_update` | 黄 |
| TaskUpdate (completed) | `task_complete` | 緑 |
| Read / Grep / Glob | `file_read` | 水色 |
| Write / Edit | `file_write` | 青 |
| Bash | `bash` | 青 |
| テキストメッセージ（判断） | `decision` | 黄 |
| エラー | `error` | 赤 |

### エッジタイプ（イベント間リレーション）

| タイプ | 説明 | 線種 |
|--------|------|------|
| `message` | SendMessage → 受信者の最初のイベント | 紫実線 |
| `task` | TaskCreate → TaskUpdate/TaskComplete | 黄実線 |
| `file` | FileRead → 同パスのFileWrite | 青実線 |
| `spawn` | Agent → スポーンされたエージェントの最初のイベント | 紫破線 |

## UI構成

```
┌───────────────────────────────────────────────────┐
│ Header: "Agent Timeline" | セッション選択          │
├───────────────────────────────────────────────────┤
│ FilterBar: [エージェント] [タイプ] [検索]           │
├────────────────────────────────┬──────────────────┤
│                                │                  │
│  Timeline (D3 SVG)             │  DetailPanel     │
│  - エージェントごとのレーン       │  - イベント概要   │
│  - イベントノード（色分け）       │  - メタデータ    │
│  - エッジ（ベジェ曲線）          │  - 生データ      │
│  - ズーム/パン操作              │                  │
│                                │                  │
├────────────────────────────────┴──────────────────┤
│ TaskProgress: [=====>     ] 5/10完了, 2進行中      │
└───────────────────────────────────────────────────┘
```

### 操作方法

- **イベントクリック**: 詳細パネルにイベント情報を表示
- **マウスホイール/ドラッグ**: タイムラインのズーム/パン
- **Escキー**: イベント選択解除
- **フィルター**: エージェント名、イベントタイプ、テキスト検索で絞り込み

## データモデル

```typescript
// セッション一覧
interface SessionSummary {
  id: string
  projectPath: string
  startTime: string
  agentCount: number
  eventCount: number
  label: string
  gitBranch?: string
  firstMessage?: string
}

// セッション詳細
interface SessionData {
  id: string
  agents: Agent[]
  events: TimelineEvent[]
  edges: Edge[]
  tasks: TaskInfo[]
}

// エージェント
interface Agent {
  name: string
  role: string
  sessionId: string
  parentSessionId?: string
}

// タイムラインイベント
interface TimelineEvent {
  id: string
  sessionId: string
  agentName: string
  type: EventType
  timestamp: string      // ISO8601
  summary: string
  detail: string
  toolName?: string
  filePath?: string
  taskId?: string
  recipient?: string
  rawContent?: string
}

// イベント間リレーション
interface Edge {
  id: string
  sourceEventId: string
  targetEventId: string
  type: "message" | "task" | "file" | "spawn"
}

// タスク情報
interface TaskInfo {
  id: string
  subject: string
  status: "pending" | "in_progress" | "completed"
  owner?: string
}
```

## npm scripts

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | Express + Viteを同時起動（開発用） |
| `pnpm dev:server` | Expressサーバーのみ（tsx watch） |
| `pnpm dev:client` | Viteのみ |
| `pnpm build` | TypeScript型チェック + Viteビルド |
| `pnpm preview` | ビルド成果物のプレビュー |
| `pnpm typecheck` | tsc --noEmit |
