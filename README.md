# obsidian-memory-mcp

Bun + TypeScript MCP server for the Obsidian Local REST API plugin.

## Requirements

- Bun 1.3+
- Obsidian with the Local REST API plugin enabled
- API key from Obsidian Settings -> Local REST API

## Configuration

Set these environment variables in your MCP client config:

- `OBSIDIAN_API_KEY`: your Local REST API key
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

## Tools

- `obsidian_status`
- `obsidian_list_files`
- `obsidian_read_note`
- `obsidian_write_note`
- `obsidian_append_note`
- `obsidian_patch_note`
- `obsidian_search`
- `obsidian_get_tags`
- `obsidian_open_note`

## Development

```bash
bun install
bun test
bun run typecheck
```
