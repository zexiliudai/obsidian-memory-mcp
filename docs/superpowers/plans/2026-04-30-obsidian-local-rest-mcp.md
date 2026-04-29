# Obsidian Local REST MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun + TypeScript stdio MCP server that wraps the Obsidian Local REST API.

**Architecture:** Keep HTTP behavior in a small tested client, keep MCP registration as a thin adapter, and load runtime configuration from environment variables at startup. The server uses stdio transport so it can be launched by MCP clients.

**Tech Stack:** Bun 1.3.11, TypeScript, `@modelcontextprotocol/sdk`, `zod`, Bun test runner.

---

### Task 1: HTTP Client

**Files:**
- Create: `src/obsidian-client.ts`
- Test: `src/obsidian-client.test.ts`

- [ ] Write tests for URL construction, auth headers, JSON/text responses, and API error parsing.
- [ ] Implement `ObsidianClient` with injected `fetch`.
- [ ] Run `bun test src/obsidian-client.test.ts`.

### Task 2: Tool Schemas and Registration

**Files:**
- Create: `src/tools.ts`
- Test: `src/tools.test.ts`

- [ ] Write tests for tool handler outputs with a fake client.
- [ ] Register the approved first-version tools with zod input schemas.
- [ ] Run `bun test src/tools.test.ts`.

### Task 3: Server Entrypoint and Project Config

**Files:**
- Create: `src/index.ts`
- Create: `tsconfig.json`
- Modify: `package.json`

- [ ] Add stdio MCP startup.
- [ ] Add TypeScript typecheck script.
- [ ] Run `bun run typecheck` and `bun test`.
