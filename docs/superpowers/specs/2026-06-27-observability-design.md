# Observability — Design

> **Status:** future design (not yet built). Converted 2026-06-27 from an archived LaTeX doc; preserved as the canonical observability design. Pairs with HANDBOOK F10 (business audit) and ADR-0006 (event-tracking vs operational logging).

The observability plan for Polaris has two endpoints. In development, Pino is the logger and pretty-printed stdout is the destination. In production, the same Pino call-sites route through OpenTelemetry to a self-hosted LGTM stack (the `grafana/otel-lgtm` bundle) running alongside the app, giving logs, traces, and metrics in one UI without a cloud bill. Application code writes against one API — `log.info(...)` — that never changes between environments.

## The Three Signals

- **Logs** — discrete events with context. *"Order 1000042 created."* Answer *what happened?*
- **Traces** — causal chains across layers. *"UI → Action → Service → Repo → DB spent 340 ms on the DB."* Answer *why was it slow?*
- **Metrics** — numeric time series. *"P99 `createOrder` latency."* Answer *is the system healthy?*

In development only the first matters; in production all three do.

## The Layering Contract

Observability has three decoupled layers: the developer API, the transport, and the destination. Decoupling them is what makes a single logger (Pino) compose with different destinations across environments.

```
┌───────────────────────────────────────────────────────────────────────┐
│  Application code  —  log.info({ orderId }, 'order created')           │
│  the only layer developers touch; its API never changes between envs   │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Pino                                                                  │
│  serializes to JSON, attaches timestamp, pid, level;                   │
│  supports child loggers for request-scoped context                     │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Transport                                                             │
│  dev: pino-pretty        prod: pino-opentelemetry-transport            │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Destination                                                          │
│  dev: terminal stdout    prod: self-hosted grafana/otel-lgtm container │
└───────────────────────────────────────────────────────────────────────┘
```

## Pino Setup

The logger is installed once and imported everywhere. Transport is chosen at runtime from the environment, so development and production share the same module and the same call-sites.

`lib/log.ts` — the logger, installed once:

```ts
import pino from 'pino'

const dev = process.env.NODE_ENV === 'development'

export const log = pino({
  level: process.env.LOG_LEVEL ?? (dev ? 'debug' : 'info'),
  transport: dev
    ? { target: 'pino-pretty' }
    : {
        target: 'pino-opentelemetry-transport',
        options: {
          resourceAttributes: {
            'service.name': 'polaris',
          },
        },
      },
})
```

The call-site — same code in dev and prod:

```ts
import { log } from '@/lib/log'

export async function createOrder() {
  const order = await insertOrder({ id: randomUUID() })
  log.info({ orderId: order.id, orderNumber: order.orderNumber },
           'order created')
  return order
}
```

Child loggers carry request-scoped context through the layers without threading parameters:

```ts
const reqLog = log.child({ requestId, userId })
reqLog.info('received createOrder')       // inherits requestId, userId
```

## Production: Self-Hosted LGTM

The destination in production is the `grafana/otel-lgtm` Docker image — a single container that bundles Grafana, Loki (logs), Tempo (traces), Mimir (metrics), and an OpenTelemetry Collector. The Polaris app and the LGTM container run side by side on the same host, reachable over the local network.

```
┌──────────────────────────┐   OTLP    ┌────────────────────────────────────┐
│  Polaris (Next.js)       │ ────────► │  grafana/otel-lgtm                 │
│  Pino + @vercel/otel     │           │  Grafana + Loki + Tempo + Mimir    │
└──────────────────────────┘           │  UI :3000     OTLP :4318           │
             │                         └────────────────────────────────────┘
             │ SQL
             ▼
┌──────────────────────────┐
│  Postgres (Supabase)     │
└──────────────────────────┘
```

## The Transition in Code

Going from the Pino-only setup to Pino + OpenTelemetry + LGTM touches exactly one existing file, adds two new files, installs three dependencies, and starts one container. Every `log.info(...)` and `log.error(...)` call already in the codebase compiles and behaves unchanged.

### The one edited file

The production branch of `lib/log.ts` flips from `undefined` (stdout) to the OpenTelemetry transport:

```diff
 export const log = pino({
   level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
   transport: isDev
     ? { target: 'pino-pretty' }
-    : undefined,
+    : {
+        target: 'pino-opentelemetry-transport',
+        options: {
+          resourceAttributes: { 'service.name': 'polaris' },
+        },
+      },
 })
```

Six added lines, one removed. This is the only edit to any file that existed before.

### The new files

`instrumentation.ts` at the project root — picked up automatically by Next.js on boot, registers OpenTelemetry's auto-instrumentation for server actions, Server Components, HTTP calls, and database queries:

```ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'polaris' })
}
```

`.env.local` gains two variables pointing at the local LGTM container:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=polaris
```

### Install and run

```bash
npm install @vercel/otel @opentelemetry/api \
            pino-opentelemetry-transport

docker run -d --name lgtm \
  -p 3000:3000 -p 4317:4317 -p 4318:4318 \
  grafana/otel-lgtm
```

### Total change, at a glance

| Item | Type | Size |
|---|---|---|
| `lib/log.ts` | edit existing file | +6 / −1 lines |
| `instrumentation.ts` | new file | 5 lines |
| `.env.local` | edit existing file | +2 lines |
| `package.json` | install 3 deps | +3 lines |
| `grafana/otel-lgtm` container | infra | 1 `docker run` |

Fifteen lines of code and config, no business-code edits, one container.

### What stays identical

Every `log.info(...)` and `log.error(...)` call in services, server actions, repositories, and anywhere else is unchanged. The same line that previously wrote JSON to stdout now:

- carries the current `traceId` automatically (injected by `pino-opentelemetry-transport`)
- flows to Loki inside the LGTM container
- is clickable from the trace view in Grafana to jump between log line and corresponding trace

No migration, no rewrite, no grep-and-replace — the upgrade is purely outside of the code that does business work.

## Dev vs Prod at a Glance

| | **Development** | **Production** |
|---|---|---|
| Logger API | Pino | Pino (same module, same calls) |
| Transport | `pino-pretty` | `pino-opentelemetry-transport` |
| Traces | — | `@vercel/otel` automatic spans |
| Metrics | — | OpenTelemetry metrics SDK |
| Destination | terminal stdout | self-hosted `grafana/otel-lgtm` container |
| UI | terminal scrollback | Grafana at `:3000` |

Everything above the `Transport` line is identical in both environments. Moving between them is purely a transport swap at startup.

## What Never Changes

The single architectural commitment that makes future migrations cheap is instrumenting with OpenTelemetry rather than any vendor-specific SDK. OTLP is the protocol spoken by `otel-lgtm`, by distributed LGTM Helm charts, by Grafana Cloud, and by every other major observability backend. If the `otel-lgtm` container is ever replaced — by a Kubernetes-hosted distributed LGTM deployment, by Grafana Cloud, by SigNoz, or by a commercial vendor — the change is a new endpoint URL, not new code. Dashboards and alert rules port between backends; `log.info(...)` calls don't need to know any of this happened.

## Triggers

No calendar dates, just conditions:

- **Add Pino:** now, before the next feature commit.
- **Stand up `otel-lgtm`:** on the first production deploy, or the first time a bug is reported that cannot be reproduced locally — whichever comes first.
- **Revisit:** when the `otel-lgtm` container runs out of headroom (disk, memory, query concurrency), or when a second service joins the deployment. The next step is either distributed LGTM Helm charts on Kubernetes, or Grafana Cloud — both OTLP, both zero application-code change.
