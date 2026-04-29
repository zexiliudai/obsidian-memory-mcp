# obsidian-memory-mcp

Bun + TypeScript MCP server for the Obsidian Local REST API plugin.

I currently use this as a lightweight long-term memory bridge between AI coding agents and an Obsidian vault. The MCP server lets an agent read and update structured project memory notes, session summaries, decisions, and reusable technical context through Obsidian.

## What This Is For

This server exposes safe, focused Obsidian note operations to MCP clients. It is useful when you want an agent to keep durable project context outside the chat window, while still storing that context in normal Markdown files you can inspect and edit in Obsidian.

My current workflow is:

- Keep project memory in Obsidian under `10-Projects/<project-slug>/`.
- Use fixed files for each project: `Memory.md`, `Decisions.md`, `Tasks.md`, and `Sessions.md`.
- Store vault-wide conventions and templates under `90-System/`.
- Let agents append durable updates instead of saving raw chat transcripts.
- Keep secrets out of the vault and out of this repository.

The memory structure I am using looks like this:

```text
90-System/
  Memory-Vault-Structure.md
  Project-Template.md

10-Projects/
  obsidian-memory-mcp/
    Memory.md
    Decisions.md
    Tasks.md
    Sessions.md
```

## Requirements

- Bun 1.3+
- Obsidian desktop
- Obsidian Local REST API plugin enabled
- API key from Obsidian Settings -> Local REST API

The Obsidian Local REST API serves the currently opened vault. If you want a dedicated memory vault, open that vault in Obsidian and configure the plugin/API key there.

## MCP Client Configuration

Set these environment variables in your MCP client config:

- `OBSIDIAN_API_KEY`: required, your Local REST API key
- `OBSIDIAN_BASE_URL`: optional, defaults to `https://127.0.0.1:27124`
- `OBSIDIAN_VERIFY_TLS`: optional, defaults to `false` for the plugin's self-signed certificate

Example MCP server config:

```json
{
  "command": "bun",
  "args": [
    "run",
    "/Users/lee/Documents/Projects/Personal/obsidian-memory-mcp/src/index.ts"
  ],
  "env": {
    "OBSIDIAN_API_KEY": "your-api-key",
    "OBSIDIAN_BASE_URL": "https://127.0.0.1:27124",
    "OBSIDIAN_VERIFY_TLS": "false"
  }
}
```

Do not commit a real `OBSIDIAN_API_KEY`. Put it only in your local MCP client configuration or a local ignored environment file.

## Available Tools

### `obsidian_status`

Checks whether the Obsidian Local REST API is reachable and authenticated.

### `obsidian_list_files`

Lists files and folders below a vault-relative path.

Example path:

```text
10-Projects/obsidian-memory-mcp
```

### `obsidian_read_note`

Reads a vault note as Markdown, metadata JSON, or a document map.

Useful for loading project memory before an agent starts work.

### `obsidian_write_note`

Creates or replaces a note. This can also create nested note paths such as:

```text
10-Projects/my-project/Memory.md
```

Use this carefully because it replaces the target note content.

### `obsidian_append_note`

Appends content to a note or a targeted section.

This is the preferred operation for session summaries and incremental memory updates.

### `obsidian_patch_note`

Appends, prepends, or replaces a targeted heading, block, or frontmatter field.

Useful for updating a specific section like `## Active` in `Tasks.md`.

### `obsidian_search`

Runs Obsidian Local REST API simple full-text search.

### `obsidian_get_tags`

Lists tags and usage counts across the active vault.

### `obsidian_open_note`

Opens a vault note in the Obsidian UI.

## Suggested Agent Memory Rules

When using this MCP server for long-term project memory:

1. Read `90-System/Memory-Vault-Structure.md` before creating new memory locations.
2. For a project, read `10-Projects/<project-slug>/Memory.md` before updating memory.
3. Append session summaries to `Sessions.md` instead of rewriting history.
4. Add architecture and product decisions to `Decisions.md` with date, context, decision, rationale, and consequences.
5. Keep memory compact and durable. Do not store raw transcripts.
6. If a note may contain secrets, do not write it through this server.

## Development

Install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```

Run type checking:

```bash
bun run typecheck
```

Start the stdio MCP server:

```bash
bun run src/index.ts
```
