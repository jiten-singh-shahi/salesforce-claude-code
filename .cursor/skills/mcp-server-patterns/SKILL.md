---
name: mcp-server-patterns
description: >-
  Use when building MCP servers for Salesforce Apex or org integration. Node/TypeScript SDK patterns — tools, resources, prompts, Zod validation, stdio vs Streamable HTTP. Do NOT use for Apex class writing or deployment.
---

# MCP Server Patterns

The Model Context Protocol (MCP) lets AI assistants call tools, read resources, and use prompts from your server. Use this skill when building or maintaining MCP servers, or integrating with the official Salesforce MCP server. The SDK API evolves; check Context7 (query-docs for "MCP") or the official MCP documentation for current method names and signatures.

## When to Use

Use when: implementing a new MCP server, adding tools or resources, choosing stdio vs HTTP, integrating with `@salesforce/mcp`, upgrading the SDK, or debugging MCP registration and transport issues.

## How It Works

### Core Concepts

- **Tools**: Actions the model can invoke (e.g. search, run a command). Register with `registerTool()` or `tool()` depending on SDK version.
- **Resources**: Read-only data the model can fetch (e.g. file contents, API responses). Register with `registerResource()` or `resource()`. Handlers typically receive a `uri` argument.
- **Prompts**: Reusable, parameterised prompt templates the client can surface (e.g. in Claude Desktop). Register with `registerPrompt()` or equivalent.
- **Transport**: stdio for local clients (e.g. Claude Desktop); Streamable HTTP is preferred for remote (Cursor, cloud). Legacy HTTP/SSE is for backward compatibility.

The Node/TypeScript SDK may expose `tool()` / `resource()` or `registerTool()` / `registerResource()`; the official SDK has changed over time. Always verify against the current [MCP docs](https://modelcontextprotocol.io) or Context7.

### Transport Decision Guide

| Transport | Use When | Examples |
|-----------|----------|---------|
| **stdio** | Local client, same machine, Claude Desktop/Code | Development, local testing |
| **Streamable HTTP** | Remote clients, cloud deployment, multi-user | Cursor, production APIs |
| **Legacy HTTP/SSE** | Backward compatibility only | Older clients |

Keep server logic (tools + resources) independent of transport so you can plug in stdio or HTTP in the entrypoint.

## Examples

### Install and Server Setup

```bash
npm install @modelcontextprotocol/sdk zod
```

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// Register a tool
server.tool(
  "search-records",
  "Search Salesforce records by keyword",
  { query: z.string(), objectType: z.string().default("Account") },
  async ({ query, objectType }) => {
    // Your implementation here
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

> **Note:** Registration API varies by SDK version — some versions use positional args `server.tool(name, description, schema, handler)`, others use object syntax. Check the official MCP docs or Context7 for current `@modelcontextprotocol/sdk` signatures.

Use **Zod** (or the SDK's preferred schema format) for input validation.

## Salesforce MCP Integration

### Official @salesforce/mcp Server

MCP config is auto-installed by `npx scc install` (`.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor). The official `@salesforce/mcp` server provides these toolsets:

| Toolset | What It Does |
|---------|-------------|
| `orgs` | Org management, auth, user info |
| `metadata` | Deploy, retrieve, list metadata types |
| `data` | SOQL queries, record CRUD, bulk operations |
| `users` | User management, permission sets |
| `testing` | Run Apex tests, get coverage results |
| `code-analysis` | PMD/scanner, code quality checks |
| `lwc-experts` | LWC development guidance |
| `devops` | Source tracking, scratch org operations |

### Using @salesforce/mcp in Claude Code

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp@latest"],
      "env": {
        "SF_ORG_ALIAS": "my-org"
      }
    }
  }
}
```

### Building Custom Salesforce MCP Tools

When `@salesforce/mcp` doesn't cover your use case (org-specific business logic, custom validation rules, internal APIs), build a custom MCP server:

```typescript
import { execFileSync } from "child_process";

server.tool(
  "validate-account-hierarchy",
  "Check account hierarchy depth and circular references",
  { accountId: z.string().regex(/^[a-zA-Z0-9]{15,18}$/, "Must be a valid 15- or 18-char Salesforce ID") },
  async ({ accountId }) => {
    const result = execFileSync("sf", [
      "data", "query",
      "--sobject", "Account",
      "--where", `Id='${accountId}'`,
      "--fields", "Id,ParentId",
      "--json"
    ], { timeout: 30000, encoding: "utf-8" });
    return { content: [{ type: "text", text: result }] };
  }
);
```

## Best Practices

- **Schema first**: Define input schemas with Zod for every tool; document parameters and return shape.
- **Input validation**: Validate and sanitize all inputs before passing to SF CLI or SOQL. Never interpolate raw user input into shell commands or queries.
- **Errors**: Return structured errors or messages the model can interpret; avoid raw stack traces.
- **Idempotency**: Prefer idempotent tools where possible so retries are safe.
- **Timeouts**: Set explicit timeouts on `execSync`/`exec` calls (e.g., `{ timeout: 30000 }`) and on HTTP requests.
- **Security**: Never pass raw user input to SOQL queries — use bind variables or parameterized queries. Use Named Credentials for external callouts. Validate Salesforce IDs with Zod regex (`/^[a-zA-Z0-9]{15,18}$/`) before passing to SF CLI.

## Official SDKs and Docs

- **JavaScript/TypeScript**: `@modelcontextprotocol/sdk` (npm). Use Context7 with library name "MCP" for current registration and transport patterns.
- **Go**: Official Go SDK on GitHub (`modelcontextprotocol/go-sdk`).
- **C#**: Official C# SDK for .NET.
- **Salesforce MCP**: `@salesforce/mcp` (npm) — official Salesforce MCP server.
