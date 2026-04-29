#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ObsidianClient, loadObsidianConfig } from "./obsidian-client.js";
import { registerObsidianTools } from "./tools.js";

export function createServer() {
  const server = new McpServer({
    name: "obsidian-memory-mcp",
    version: "1.0.0",
  });

  const client = new ObsidianClient({
    config: loadObsidianConfig(),
  });

  registerObsidianTools(server, client);
  return server;
}

export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  await main();
}
