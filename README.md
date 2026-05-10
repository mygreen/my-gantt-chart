# README

# My ガントチャート

React + TypeScript + Spring Boot + H2 Database で構成した、ガントチャート Web アプリです。

![screenshot](docs/sample.png)

## 主な機能

* タスク、マイルストーン、関連線の編集
* 親子タスク、折りたたみ、並び替え
* 土日祝日を除外した進捗計算
* プロジェクト休日とシステム共通祝日の管理
* 保存、破棄、再読み込み、バージョン管理
* 複数プロジェクトの切り替えとコピー
* イナズマ線表示
* 期間指定付きの SVG 出力

## 技術スタック

### Frontend

| 項目 | 技術 |
| --- | --- |
| Framework | React 19 |
| Language | TypeScript |
| Build Tool | Vite |
| State | Zustand |
| Styling | Tailwind CSS |
| Icons | lucide-react |

### Backend

| 項目 | 技術 |
| --- | --- |
| Framework | Spring Boot 4.0.5 |
| Language | Java 21 |
| Build Tool | Gradle / Gradle Wrapper |
| Database | H2 Database |
| ORM | Spring Data JPA |
| Migration | Flyway |
| Utility | Lombok |

## ディレクトリ構成

```text
root/
├─ frontend/
├─ backend/
├─ docs/
├─ AGENTS.md
├─ SKILLS.md
└─ README.md
```

### Frontend

```text
frontend/src/
├─ api/
├─ app/
├─ components/
├─ core/
├─ hooks/
├─ models/
├─ stores/
└─ styles/
```

### Backend

```text
backend/src/main/java/com/gh/mygreen/mygantt/
├─ config/
├─ controller/
├─ dto/
├─ entity/
├─ repository/
└─ service/
```

## 画面構成

左ペインは 2 つのタブに分かれます。

### プロジェクト設定

* ガントチャート
* 基本設定
* メンバー設定
* プロジェクト休日
* バージョン管理

### システム設定

* プロジェクト管理
* 祝日設定

## Frontend セットアップ

```bash
cd frontend
npm install
npm run dev
```

開発 URL:

```text
http://localhost:5173
```

本番用ビルド:

```bash
cd frontend
npm run build
```

ビルド成果物の出力先:

```text
backend/src/main/resources/public
```

## Backend セットアップ

`backend/env.bat` で `JAVA_HOME_21` を取り込む前提です。

```bash
cd backend
env.bat
gradlew.bat bootRun
```

起動 URL:

```text
http://localhost:8080
```

## Database

デフォルトはメモリ H2 です。

### H2 Console

```text
http://localhost:8080/h2-console
```

### 接続情報

| 項目 | 値 |
| --- | --- |
| JDBC URL | jdbc:h2:mem:ganttdb |
| User | sa |
| Password | 空 |

## DB 初期化

Flyway migration は 2 本に整理しています。

* [backend/src/main/resources/db/migration/V1__init_schema.sql](backend/src/main/resources/db/migration/V1__init_schema.sql)
* [backend/src/main/resources/db/migration/V2__init_data.sql](backend/src/main/resources/db/migration/V2__init_data.sql)

## 保存とバージョン管理

* 画面上の編集内容は保存ボタンを押したときだけサーバーへ反映されます
* 保存ごとにバージョンが 1 つ増えます
* バージョン管理画面から、過去版の内容で新しい版を作る形で復元できます

## SVG 出力

SVG 出力ダイアログから以下を指定できます。

* 出力期間
* タスク一覧の出力列
  * 担当者
  * 開始日
  * 終了日
  * 進捗率

出力期間はプロジェクトごとに `localStorage` へ保存されます。

## 開発メモ

* frontend は backend 前提で動作します
* fallback の仮データは使いません
* UI の表示設定の一部は `localStorage` に保存します
* バックエンドの Java ソースは UTF-8、BOM なし前提です

