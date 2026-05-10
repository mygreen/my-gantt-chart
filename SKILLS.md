# SKILLS

# React + Spring Boot ガントチャート開発ガイド

このファイルは、このリポジトリで実装判断をそろえるための技術ガイドです。

## 技術前提

### Frontend

* React 19
* TypeScript
* Zustand
* Vite
* Tailwind CSS
* native SVG

### Backend

* Spring Boot 4
* Java 21
* Spring Data JPA
* H2 Database
* Flyway
* Lombok

## Frontend の考え方

### ディレクトリ責務

* `app/`
  * 画面構成
  * メニュー
  * ダイアログ
* `components/`
  * 見た目を持つ UI
* `core/`
  * レイアウト計算
  * 日付計算
  * SVG 出力
  * ガント描画補助
* `stores/`
  * Zustand state
* `api/`
  * backend 通信

### 状態管理

次のものは store に置く前提で考える。

* タスク
* マイルストーン
* 関連線
* 休日
* メンバー
* プロジェクト設定
* 版情報
* 画面表示設定

### UI 実装ルール

* 既存の表示順、用語、操作感を優先
* 表示列の ON/OFF がある場合は SVG 出力との整合も見る
* マイルストーンは通常タスクと別物として扱う
* 文字列は UTF-8 の通常日本語で持つ
* 文字化けした値を仮ラベルとして使わない

### SVG 出力ルール

* 画面と同じ期間・同じ表示列を基本にする
* タスク一覧の No. は Web 画面と同じ規則にする
* カレンダー背景、休日背景、基準日、イナズマ線、関連線を可能な限りそろえる
* SVG は XML として妥当であること

## Backend の考え方

### パッケージ

```text
com.gh.mygreen.mygantt
```

### レイヤ責務

* `controller/`
  * ルーティング
  * 入出力の受け渡し
* `service/`
  * 業務処理
  * 保存と復元
* `repository/`
  * DB アクセス
* `entity/`
  * 永続化モデル
* `dto/`
  * API 入出力

### DB ルール

* migration は `backend/src/main/resources/db/migration`
* 初期化は以下 2 本を基準にする
  * `V1__init_schema.sql`
  * `V2__init_data.sql`
* 文字列は UTF-8 日本語を通常記述で扱う

### 保存仕様

* frontend の編集内容は、保存ボタンを押したときだけ backend に反映
* 保存時にプロジェクト版を増やす
* 復元は新しい版として保存する
* プロジェクト共通の設定とシステム共通の設定を分ける

## よくある判断基準

### frontend だけで閉じてよいもの

* ダイアログの開閉
* 一時的な入力状態
* SVG 出力ダイアログのプロジェクトごとの前回値
* 一部の表示設定

### backend まで触るべきもの

* 保存データの追加
* 版管理に関わる仕様
* プロジェクトコピーに関わる仕様
* システム共通設定
* DB に残る休日やメンバー

## ビルドと実行

### Frontend

```bash
cd frontend
npm run build
```

### Backend

`env.bat` で `JAVA_HOME_21` を読み込む前提。

```bash
cd backend
env.bat
gradlew.bat bootRun
```

## docs 更新の目安

次の変更では README / AGENTS / SKILLS の更新を検討する。

* 画面の大きな増減
* 保存、復元、版管理の仕様変更
* DB 初期化方式の変更
* build / run 手順の変更
* SVG 出力の仕様変更

