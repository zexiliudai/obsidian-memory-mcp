import { describe, expect, test } from "bun:test";
import {
  MissingApiKeyError,
  ObsidianApiError,
  ObsidianClient,
  loadObsidianConfig,
} from "./obsidian-client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    headers: { "Content-Type": "text/markdown" },
    ...init,
  });
}

describe("loadObsidianConfig", () => {
  test("defaults to the local HTTPS API and disables TLS verification", () => {
    const config = loadObsidianConfig({});

    expect(config.baseUrl).toBe("https://127.0.0.1:27124");
    expect(config.apiKey).toBeUndefined();
    expect(config.verifyTls).toBe(false);
  });

  test("reads explicit environment configuration", () => {
    const config = loadObsidianConfig({
      OBSIDIAN_BASE_URL: "https://localhost:27125/",
      OBSIDIAN_API_KEY: "secret",
      OBSIDIAN_VERIFY_TLS: "true",
    });

    expect(config.baseUrl).toBe("https://localhost:27125");
    expect(config.apiKey).toBe("secret");
    expect(config.verifyTls).toBe(true);
  });
});

describe("ObsidianClient", () => {
  test("lists files at the encoded vault path with bearer auth", async () => {
    const calls: Request[] = [];
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async (request) => {
        calls.push(request);
        return jsonResponse({ files: ["Daily.md"] });
      },
    });

    const result = await client.listFiles("Folder With Space/子");

    expect(result).toEqual({ files: ["Daily.md"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://127.0.0.1:27124/vault/Folder%20With%20Space/%E5%AD%90",
    );
    expect(calls[0].headers.get("Authorization")).toBe("Bearer secret");
  });

  test("reads markdown text by default", async () => {
    const calls: Request[] = [];
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async (request) => {
        calls.push(request);
        return textResponse("# Note");
      },
    });

    const result = await client.readNote({ path: "Notes/A.md" });

    expect(result).toBe("# Note");
    expect(calls[0].headers.get("Accept")).toBe("text/markdown");
  });

  test("reads note metadata JSON when requested", async () => {
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async () =>
        jsonResponse({
          path: "Notes/A.md",
          content: "# Note",
          tags: ["test"],
          frontmatter: {},
          stat: { ctime: 1, mtime: 2, size: 3 },
        }),
    });

    const result = await client.readNote({
      path: "Notes/A.md",
      responseFormat: "note-json",
    });

    expect(result).toEqual({
      path: "Notes/A.md",
      content: "# Note",
      tags: ["test"],
      frontmatter: {},
      stat: { ctime: 1, mtime: 2, size: 3 },
    });
  });

  test("writes markdown content with PUT", async () => {
    const calls: Request[] = [];
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async (request) => {
        calls.push(request);
        return new Response(null, { status: 204 });
      },
    });

    await client.writeNote({ path: "A.md", content: "# A" });

    expect(calls[0].method).toBe("PUT");
    expect(calls[0].headers.get("Content-Type")).toBe("text/markdown");
    expect(await calls[0].text()).toBe("# A");
  });

  test("patches a targeted heading with patch headers", async () => {
    const calls: Request[] = [];
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async (request) => {
        calls.push(request);
        return textResponse("# Updated");
      },
    });

    const result = await client.patchNote({
      path: "A.md",
      content: "new line",
      operation: "append",
      targetType: "heading",
      target: "Work::Meetings",
      createTargetIfMissing: true,
    });

    expect(result).toBe("# Updated");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].headers.get("Operation")).toBe("append");
    expect(calls[0].headers.get("Target-Type")).toBe("heading");
    expect(calls[0].headers.get("Target")).toBe("Work::Meetings");
    expect(calls[0].headers.get("Create-Target-If-Missing")).toBe("true");
  });

  test("runs simple search using query params", async () => {
    const calls: Request[] = [];
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async (request) => {
        calls.push(request);
        return jsonResponse([{ filename: "A.md", score: 1 }]);
      },
    });

    const result = await client.simpleSearch("meeting notes");

    expect(result).toEqual([{ filename: "A.md", score: 1 }]);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(
      "https://127.0.0.1:27124/search/simple/?query=meeting+notes",
    );
  });

  test("throws a clear error when auth is required but missing", async () => {
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        verifyTls: false,
      },
      fetch: async () => jsonResponse({ files: [] }),
    });

    await expect(client.listFiles()).rejects.toThrow(MissingApiKeyError);
  });

  test("parses Local REST API error responses", async () => {
    const client = new ObsidianClient({
      config: {
        baseUrl: "https://127.0.0.1:27124",
        apiKey: "secret",
        verifyTls: false,
      },
      fetch: async () =>
        jsonResponse(
          { errorCode: 40401, message: "File does not exist." },
          { status: 404 },
        ),
    });

    await expect(client.readNote({ path: "missing.md" })).rejects.toThrow(
      "Obsidian API returned 404: File does not exist.",
    );

    try {
      await client.readNote({ path: "missing.md" });
    } catch (error) {
      expect(error).toBeInstanceOf(ObsidianApiError);
      expect((error as ObsidianApiError).status).toBe(404);
      expect((error as ObsidianApiError).errorCode).toBe(40401);
    }
  });
});
