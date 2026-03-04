<div align="center">
  <h1>Onyx</h1>
  <p><strong>AI-Powered High-Concurrency API Chaos Testing Platform</strong></p>
  
  [![React](https://img.shields.io/badge/React-18.x-blue?logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Redis](https://img.shields.io/badge/Redis-Job_Queue-red?logo=redis)](https://redis.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql)](https://neon.tech/)
</div>

<br />

## 📖 Overview

Onyx (formerly ChaosForge) is an **AI-driven penetration testing and vulnerability simulation engine**. It ingests API documentation (OpenAPI/Swagger specs), intelligently analyzes exposed endpoints, and utilizes **Google's Gemini 2.5 Flash** to generate schema-aware, malicious payloads.

By wrapping tests in a **distributed BullMQ/Redis worker architecture**, Onyx safely executes high-concurrency stress tests while streaming granular, real-time attack telemetry back to the client via WebSockets. It is disguised within a sleek, Apple-level master-grid architectural GUI.

---

## ✨ Core Features

- **Intelligent Payload Generation**: Utilizes Gemini AI to synthesize sophisticated, context-aware payloads (SQLi, NoSQLi, XSS, SSRF, Boundary Overflows) tailored to individual API schemas.
- **High-Concurrency Execution**: Built on a decoupled distributed architecture utilizing **Redis** and **BullMQ** to process hundreds of attack jobs asynchronously without exhausting V8's thread pool.
- **Real-time Telemetry Streaming**: Implements low-latency **WebSocket (ws)** connections to push live attack results, status codes, and latency metrics to the React dashboard instantly.
- **Resilient Fallback Protocols**: Ensures 99%+ scan completion rates via graceful degradation; if AI synthesis fails or rate limits are hit, local static heuristics automatically take over.
- **Architectural UI/UX**: Features a `min-h-screen` master grid architecture, Framer Motion terminal sequences simulating live chaotic penetration tests, and absolute strict typography mapping.

---

## 🏗️ System Architecture

### The Orchestration Flow

When a user inputs an OpenAPI specification URL, the Onyx pipeline initializes:

1.  **Ingestion & Parsing**: The Express.js backend pulls the Swagger spec and extracts endpoint metadata (methods, paths, path variables, query parameters, request schemas).
2.  **AI Synthesis**: Extracted routing context is relayed to Gemini AI. The LLM acts as a Senior Security Engineer, synthesizing 20 unique payloads traversing 10 OWASP Top 10 vulnerability categories per endpoint.
3.  **Task Queuing**: Payloads are pushed into a **Redis-backed BullMQ queue** to control request concurrency and avoid rate-limiting the target API.
4.  **Worker Execution**: Background Node.js workers consume the queue, firing HTTP requests armed with the malicious payloads against the target framework.
5.  **Telemetry & Persistence**: Validated results are simultaneously persisted to a **Serverless PostgreSQL (Neon)** database via **Prisma ORM** and pushed to the React client via WebSockets.

### Tech Stack

| Domain             | Technology                                                             |
| :----------------- | :--------------------------------------------------------------------- |
| **Frontend**       | React 18, Vite, Tailwind CSS, Framer Motion, Zustand, React Router DOM |
| **Backend**        | Express.js, Node.js, WebSockets (`ws`), REST APIs                      |
| **Database**       | Serverless PostgreSQL (Neon), Prisma ORM                               |
| **Queuing**        | Redis, BullMQ                                                          |
| **AI Integration** | Google GenAI SDK (Gemini 2.5 Flash)                                    |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Docker (for Redis container)
- A Google Cloud project with the Gemini API enabled
- A Neon PostgreSQL database

### Local Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/raghul017/Onyx.git
    cd Onyx
    ```

2. **Boot up Redis (via Docker):**

    ```bash
    docker compose up redis -d
    ```

3. **Configure Environment Variables:**
   Navigate to `/server` and configure the `.env` file with your credentials:

    ```env
    DATABASE_URL="postgresql://user:password@host/db"
    GEMINI_API_KEY="AIzaSy..."
    REDIS_HOST=localhost
    REDIS_PORT=6379
    PORT=3001
    CORS_ORIGIN=http://localhost:8080
    ```

4. **Initialize the Backend:**

    ```bash
    cd server
    npm install
    npx prisma generate
    npx prisma db push
    npm run dev
    ```

5. **Initialize the Frontend:**
    ```bash
    cd ../client
    npm install
    npm run dev
    ```

---

## 📊 Dashboard Preview

The Command Center provides real-time oversight of ongoing chaotic simulations. Sub-panels listen on WebSocket ports to instantly bind `500 Internal Server Errors` to neon-red UI highlights, providing immediate visual feedback on API vulnerabilities.

---

_Created by [Raghul AR](https://github.com/raghul017)._
