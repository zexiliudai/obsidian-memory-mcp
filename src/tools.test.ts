import { describe, expect, test } from "bun:test";
import { getObsidianToolDefinitions } from "./tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

class FakeClient {
  calls: Array<{ method: string; args: unknown }> = [];

  async status() {
    this.calls.push({ method: "status", args: undefined });
    return { ok: "OK", authenticated: true };
  }

  async listFiles(path?: string) {
    this.calls.push({ method: "listFiles", args: path });
    return { files: ["A.md"] };
  }

  async readNote(args: unknown) {
    this.calls.push({ method: "readNote", args });
    return "# A";
  }

  async writeNote(args: unknown) {
    this.calls.push({ method: "writeNote", args });
    return null;
  }

  async appendNote(args: unknown) {
    this.calls.push({ method: "appendNote", args });
    return "# A\nmore";
  }

  async patchNote(args: unknown) {
    this.calls.push({ method: "patchNote", args });
    return "# Updated";
  }

  async simpleSearch(query: string) {
    this.calls.push({ method: "simpleSearch", args: query });
    return [{ filename: "A.md", score: 1 }];
  }

  async getTags() {
    this.calls.push({ method: "getTags", args: undefined });
    return { tags: { project: 2 } };
  }

  async openNote(args: unknown) {
    this.calls.push({ method: "openNote", args });
    return null;
  }
}

function firstText(result: CallToolResult) {
  const item = result.content[0];
  if (item.type !== "text") {
    throw new Error(`Expected text content, got ${item.type}`);
  }
  return item.text;
}

describe("getObsidianToolDefinitions", () => {
  test("exposes the approved first-version tool names", () => {
    const tools = getObsidianToolDefinitions(new FakeClient());

    expect(Object.keys(tools)).toEqual([
      "obsidian_status",
      "obsidian_list_files",
      "obsidian_read_note",
      "obsidian_write_note",
      "obsidian_append_note",
      "obsidian_patch_note",
      "obsidian_search",
      "obsidian_get_tags",
      "obsidian_open_note",
    ]);
  });

  test("formats object responses as JSON text", async () => {
    const client = new FakeClient();
    const tools = getObsidianToolDefinitions(client);

    const result = await tools.obsidian_status.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: "OK", authenticated: true }, null, 2),
        },
      ],
    });
  });

  test("passes read note arguments through to the client", async () => {
    const client = new FakeClient();
    const tools = getObsidianToolDefinitions(client);

    const result = await tools.obsidian_read_note.handler({
      path: "A.md",
      responseFormat: "note-json",
      targetType: "heading",
      target: "Meeting",
    });

    expect(firstText(result)).toBe("# A");
    expect(client.calls[0]).toEqual({
      method: "readNote",
      args: {
        path: "A.md",
        responseFormat: "note-json",
        target: {
          targetType: "heading",
          target: "Meeting",
          targetDelimiter: undefined,
        },
      },
    });
  });

  test("passes patch note arguments through to the client", async () => {
    const client = new FakeClient();
    const tools = getObsidianToolDefinitions(client);

    const result = await tools.obsidian_patch_note.handler({
      path: "A.md",
      content: "done",
      operation: "replace",
      targetType: "frontmatter",
      target: "status",
      contentType: "application/json",
      createTargetIfMissing: true,
    });

    expect(firstText(result)).toBe("# Updated");
    expect(client.calls[0]).toEqual({
      method: "patchNote",
      args: {
        path: "A.md",
        content: "done",
        operation: "replace",
        targetType: "frontmatter",
        target: "status",
        contentType: "application/json",
        createTargetIfMissing: true,
        applyIfContentPreexists: undefined,
        trimTargetWhitespace: undefined,
        targetDelimiter: undefined,
      },
    });
  });

  test("formats empty successful responses as OK", async () => {
    const client = new FakeClient();
    const tools = getObsidianToolDefinitions(client);

    const result = await tools.obsidian_write_note.handler({
      path: "A.md",
      content: "# A",
    });

    expect(firstText(result)).toBe("OK");
  });
});
