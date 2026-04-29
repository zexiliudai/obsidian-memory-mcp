import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ObsidianClient } from "./obsidian-client.js";

type ObsidianClientLike = Pick<
  ObsidianClient,
  | "status"
  | "listFiles"
  | "readNote"
  | "writeNote"
  | "appendNote"
  | "patchNote"
  | "simpleSearch"
  | "getTags"
  | "openNote"
>;

export type ToolDefinition = {
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
};

const responseFormatSchema = z.enum(["markdown", "note-json", "document-map"]);
const targetTypeSchema = z.enum(["heading", "block", "frontmatter"]);
const operationSchema = z.enum(["append", "prepend", "replace"]);

export function getObsidianToolDefinitions(
  client: ObsidianClientLike,
): Record<string, ToolDefinition> {
  return {
    obsidian_status: {
      title: "Obsidian status",
      description: "Check whether the Obsidian Local REST API is reachable.",
      inputSchema: {},
      handler: async () => toToolResult(await client.status()),
    },

    obsidian_list_files: {
      title: "List Obsidian files",
      description: "List files below a vault path. Use an empty path for the vault root.",
      inputSchema: {
        path: z.string().default("").describe("Vault-relative folder path."),
      },
      handler: async (args) => toToolResult(await client.listFiles(args.path as string | undefined)),
    },

    obsidian_read_note: {
      title: "Read Obsidian note",
      description: "Read a vault note as markdown, metadata JSON, or a document map.",
      inputSchema: {
        path: z.string().min(1).describe("Vault-relative note path."),
        responseFormat: responseFormatSchema
          .default("markdown")
          .describe("Response format to request from the Local REST API."),
        targetType: targetTypeSchema.optional().describe("Optional section target type."),
        target: z.string().optional().describe("Optional heading, block id, or frontmatter field."),
        targetDelimiter: z.string().optional().describe("Delimiter for nested heading targets."),
      },
      handler: async (args) =>
        toToolResult(
          await client.readNote({
            path: args.path as string,
            responseFormat: args.responseFormat as "markdown" | "note-json" | "document-map",
            target: pickTarget(args),
          }),
        ),
    },

    obsidian_write_note: {
      title: "Write Obsidian note",
      description: "Create or replace a note, or replace a targeted section.",
      inputSchema: {
        path: z.string().min(1).describe("Vault-relative note path."),
        content: z.string().describe("Content to write."),
        contentType: z.string().default("text/markdown").describe("HTTP content type."),
        targetType: targetTypeSchema.optional().describe("Optional section target type."),
        target: z.string().optional().describe("Optional heading, block id, or frontmatter field."),
        targetDelimiter: z.string().optional().describe("Delimiter for nested heading targets."),
      },
      handler: async (args) =>
        toToolResult(
          await client.writeNote({
            path: args.path as string,
            content: args.content as string,
            contentType: args.contentType as string | undefined,
            target: pickTarget(args),
          }),
        ),
    },

    obsidian_append_note: {
      title: "Append Obsidian note",
      description: "Append content to a note or targeted section.",
      inputSchema: {
        path: z.string().min(1).describe("Vault-relative note path."),
        content: z.string().describe("Content to append."),
        contentType: z.string().default("text/markdown").describe("HTTP content type."),
        targetType: targetTypeSchema.optional().describe("Optional section target type."),
        target: z.string().optional().describe("Optional heading, block id, or frontmatter field."),
        targetDelimiter: z.string().optional().describe("Delimiter for nested heading targets."),
        createTargetIfMissing: z.boolean().optional(),
        applyIfContentPreexists: z.boolean().optional(),
        trimTargetWhitespace: z.boolean().optional(),
      },
      handler: async (args) =>
        toToolResult(
          await client.appendNote({
            path: args.path as string,
            content: args.content as string,
            contentType: args.contentType as string | undefined,
            target: pickTarget(args),
            createTargetIfMissing: args.createTargetIfMissing as boolean | undefined,
            applyIfContentPreexists: args.applyIfContentPreexists as boolean | undefined,
            trimTargetWhitespace: args.trimTargetWhitespace as boolean | undefined,
          }),
        ),
    },

    obsidian_patch_note: {
      title: "Patch Obsidian note",
      description: "Append, prepend, or replace a heading, block, or frontmatter field.",
      inputSchema: {
        path: z.string().min(1).describe("Vault-relative note path."),
        content: z.string().describe("Patch content."),
        operation: operationSchema.describe("Patch operation."),
        targetType: targetTypeSchema.describe("Target type."),
        target: z.string().min(1).describe("Heading, block id, or frontmatter field."),
        targetDelimiter: z.string().optional().describe("Delimiter for nested heading targets."),
        contentType: z.string().default("text/markdown").describe("HTTP content type."),
        createTargetIfMissing: z.boolean().optional(),
        applyIfContentPreexists: z.boolean().optional(),
        trimTargetWhitespace: z.boolean().optional(),
      },
      handler: async (args) =>
        toToolResult(
          await client.patchNote({
            path: args.path as string,
            content: args.content as string,
            operation: args.operation as "append" | "prepend" | "replace",
            targetType: args.targetType as "heading" | "block" | "frontmatter",
            target: args.target as string,
            contentType: args.contentType as string | undefined,
            createTargetIfMissing: args.createTargetIfMissing as boolean | undefined,
            applyIfContentPreexists: args.applyIfContentPreexists as boolean | undefined,
            trimTargetWhitespace: args.trimTargetWhitespace as boolean | undefined,
            targetDelimiter: args.targetDelimiter as string | undefined,
          }),
        ),
    },

    obsidian_search: {
      title: "Search Obsidian notes",
      description: "Run Obsidian Local REST API simple full-text search.",
      inputSchema: {
        query: z.string().min(1).describe("Search query."),
      },
      handler: async (args) => toToolResult(await client.simpleSearch(args.query as string)),
    },

    obsidian_get_tags: {
      title: "Get Obsidian tags",
      description: "List tags and usage counts across the vault.",
      inputSchema: {},
      handler: async () => toToolResult(await client.getTags()),
    },

    obsidian_open_note: {
      title: "Open Obsidian note",
      description: "Open a vault file in the Obsidian UI.",
      inputSchema: {
        path: z.string().min(1).describe("Vault-relative note path."),
        newLeaf: z.boolean().optional().describe("Open in a new leaf."),
      },
      handler: async (args) =>
        toToolResult(
          await client.openNote({
            path: args.path as string,
            newLeaf: args.newLeaf as boolean | undefined,
          }),
        ),
    },
  };
}

export function registerObsidianTools(server: McpServer, client: ObsidianClientLike) {
  const tools = getObsidianToolDefinitions(client);

  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(
      name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler,
    );
  }
}

function pickTarget(args: Record<string, unknown>) {
  if (!args.targetType && !args.target && !args.targetDelimiter) {
    return undefined;
  }

  return {
    targetType: args.targetType as "heading" | "block" | "frontmatter" | undefined,
    target: args.target as string | undefined,
    targetDelimiter: args.targetDelimiter as string | undefined,
  };
}

function toToolResult(value: unknown): CallToolResult {
  if (typeof value === "string") {
    return { content: [{ type: "text", text: value }] };
  }

  if (value === null || value === undefined) {
    return { content: [{ type: "text", text: "OK" }] };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
