# Obsidian Local REST MCP Design

## Goal

Build a Bun + TypeScript stdio MCP server that exposes a focused set of tools for Obsidian via the Local REST API plugin.

## Scope

The first version exposes non-destructive note operations: status, list files, read note, write note, append note, targeted patch, simple search, tags, and open note. It does not expose file deletion, Obsidian command execution, Dataview search, or JsonLogic search.

## Configuration

Runtime configuration comes from environment variables:

- `OBSIDIAN_BASE_URL`: defaults to `https://127.0.0.1:27124`
- `OBSIDIAN_API_KEY`: required for authenticated Obsidian operations
- `OBSIDIAN_VERIFY_TLS`: defaults to `false` for the plugin's self-signed local HTTPS certificate

## Architecture

`src/obsidian-client.ts` owns HTTP details: URL construction, path encoding, Bearer auth, content negotiation, and API error parsing. `src/tools.ts` owns MCP tool registration and converts client results into MCP text content. `src/index.ts` creates the stdio MCP server and wires configuration into the tool layer.

## Error Handling

Missing API keys return actionable tool errors. HTTP failures include the status code and the Local REST API error message when available. Tool handlers return compact JSON or markdown strings so MCP clients can display results directly.

## Testing

Client behavior is tested with injected fetch implementations so tests do not require Obsidian to be running. Tool registration is kept thin and relies on the tested client methods.
