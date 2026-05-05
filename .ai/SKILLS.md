# Skills.md

# Codex Skill: React + Spring Boot ガントチャート開発

## Purpose

このSkillは、以下の技術構成で高機能ガントチャートWebアプリを実装するための開発ガイドラインを定義する。

* Frontend: React + TypeScript
* Backend: Spring Boot 3
* Database: H2 Database
* Rendering: HTML(div) + SVG overlay
* State Management: Zustand
* Styling: Tailwind CSS

---

# Frontend Architecture

## Core Principles

* 描画層とビジネスロジックを分離する
* React Componentに業務ロジックを書かない
* SVG dependency renderingを独立レイヤー化する
* useEffect依存設計を避ける
* derived stateはstateとして持たない
* virtual scroll前提で設計する

---

# Recommended Frontend Stack

| Purpose          | Technology       |
| ---------------- | ---------------- |
| UI Framework     | React 19         |
| Language         | TypeScript       |
| Build Tool       | Vite             |
| State Management | Zustand          |
| Virtual Scroll   | TanStack Virtual |
| Drag & Drop      | dnd-kit          |
| Styling          | Tailwind CSS     |
| UI Components    | shadcn/ui        |
| SVG Rendering    | native SVG       |
| API Client       | fetch            |
| Validation       | zod              |

---

# Frontend Directory Structure

```text id="hwzc7f"
src/
├── app/
├── components/
│   ├── gantt/
│   │   ├── layers/
│   │   ├── task/
│   │   ├── dependency/
│   │   ├── timeline/
│   │   └── overlays/
├── core/
│   ├── layout/
│   ├── scheduling/
│   ├── dependency/
│   ├── viewport/
│   └── virtualization/
├── stores/
├── hooks/
├── api/
├── models/
├── utils/
└── styles/
```

---

# Gantt Rendering Layers

```text id="kmv8d2"
GanttRoot
 ├─ HeaderLayer
 ├─ SidebarLayer
 ├─ GridLayer
 ├─ TaskLayer
 ├─ DependencyLayer
 ├─ InteractionLayer
 └─ OverlayLayer
```

---

# Rendering Rules

## TaskLayer

* HTML div rendering
* absolute positioning
* React.memoを使用
* layout cacheから描画

## DependencyLayer

* SVG overlay rendering
* path要素を使用
* DOM query禁止
* layout cacheから座標計算

---

# State Management Rules

## Zustand Store Structure

```ts id="jlwm7s"
type GanttStore = {
  tasks: Task[]
  dependencies: Dependency[]
  viewport: Viewport
  selection: SelectionState
}
```

---

# useEffect Rules

## Avoid

* state同期用途
* derived state生成
* render chaining

## Allowed

* API access
* event listener
* websocket
* timer

---

# Backend Architecture

## Core Principles

* ドメインロジックをBackendへ集約
* Frontendを薄く保つ
* REST API first
* Transaction boundaryを明確化

---

# Recommended Backend Stack

| Purpose    | Technology         |
| ---------- | ------------------ |
| Framework  | Spring Boot 3      |
| Language   | Java 21            |
| ORM        | Spring Data JPA    |
| Database   | H2 Database        |
| Migration  | Flyway             |
| Validation | Jakarta Validation |
| Security   | Spring Security    |
| Build Tool | Gradle             |

---

# Backend Directory Structure

```text id="njlwm5"
src/main/java/com/example/gantt/
├── controller/
├── service/
├── domain/
├── repository/
├── dto/
├── entity/
├── config/
└── security/
```

---

# Database Configuration

## H2 Console

```text id="b17dxy"
http://localhost:8080/h2-console
```

---

# Recommended JDBC URL

```properties id="95k6kw"
jdbc:h2:mem:ganttdb
```

---

# Recommended application.yml

```yaml id="jqjlwm"
spring:
  datasource:
    url: jdbc:h2:mem:ganttdb
    driver-class-name: org.h2.Driver
    username: sa
    password:

  h2:
    console:
      enabled: true

  jpa:
    hibernate:
      ddl-auto: update

    show-sql: true
```

---

# API Design Rules

## REST Style

```text id="jlwm47"
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/{id}
DELETE /api/tasks/{id}
```

---

# Entity Rules

## Required

* DTO separation
* Service layer
* validation layer
* immutable DTO

---

# Dependency Rendering Rules

Use SVG path rendering.

```text id="3mjlwm"
Task A ─┐
        └────→ Task B
```

---

# Layout Engine Rules

## Layout Cache Required

```ts id="o2t3lg"
type TaskLayout = {
  x: number
  y: number
  width: number
  height: number
}
```

---

# Performance Rules

## Required

* virtual scroll
* memoization
* transform-based rendering

## Forbidden

* getBoundingClientRect大量使用
* unnecessary rerender

---

# Recommended Development Order

## Phase 1

* Timeline rendering
* Task rendering
* Scroll sync

## Phase 2

* Dependency lines
* Drag & Drop

## Phase 3

* Virtual scroll
* Zoom

---

# Final Guideline

最重要なのはFrameworkではない。

以下を最優先で設計すること。

* Core layout engine
* viewport synchronization
* virtualization
* dependency routing
* state architecture
