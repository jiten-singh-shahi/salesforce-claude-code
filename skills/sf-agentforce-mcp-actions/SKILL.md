---
name: sf-agentforce-mcp-actions
description: "MCP Server actions for Agentforce — registry, auth, prebuilt servers, Apex integration. Use when configuring MCP as an Agentforce action type. Do NOT use for building MCP servers."
origin: SCC
user-invocable: false
---

# Agentforce MCP Server Actions

How to use Model Context Protocol (MCP) servers as Agentforce action types. For building MCP servers, see `mcp-server-patterns`.

## When to Use

- Registering an MCP server for use in Agentforce topics
- Configuring auth, rate limits, or tool discovery for MCP actions
- Using prebuilt Salesforce MCP servers (DX, Heroku, MuleSoft)
- Setting up Hosted MCP (Pilot) for zero-infrastructure endpoints
- Debugging MCP action resolution in Agent Script

---

## Overview

MCP exposes external tools to Agentforce via JSON-RPC 2.0 over HTTP/SSE. An MCP server declares tools (with names, descriptions, parameters, return types), and Agentforce discovers them at connection time. Each tool becomes an available agent action.

---

## Setup

### 1. Register in MCP Server Registry

Setup > MCP Servers > New MCP Server

| Field | Value |
|---|---|
| **Name** | Descriptive name (e.g., "Weather API") |
| **Endpoint URL** | Server URL (HTTPS required for production) |
| **Auth** | OAuth 2.0 with Integration User |
| **Transport** | HTTP/SSE (standard) |

After registration, tools appear in Agentforce Asset Library and can be added to topics.

### 2. Add to Agent Script

In Agent Script, MCP tools are referenced like any other action. The `target:` field is not needed — MCP tools are auto-discovered from the server's tool manifest.

```
topic weather:
   actions:
      get_weather:
         description: "Get current weather for a city"
         inputs:
            city: string
               description: "City name"
               is_required: True
         outputs:
            temperature: number
               description: "Temperature in Fahrenheit"
               is_displayable: True

   reasoning:
      actions:
         weather: @actions.get_weather
            with city = ...
```

### 3. Classic Setup (Agent Builder UI)

Setup > Agentforce > Agent Assets > Add Action > select MCP tool from Asset Library.

---

## Auth

- **OAuth 2.0** with Integration User (least privilege)
- FLS and sharing rules enforced on the Integration User
- External credentials managed via Named Credentials
- Token refresh handled automatically by the platform

---

## Rate Limits

| Limit | Value |
|---|---|
| Requests per minute per server | ~50 |
| Timeout per tool call | 120 seconds (matches agent timeout) |
| Max payload size | Platform-dependent |

---

## Tool Discovery

On connection, the MCP server returns its tool manifest:

```json
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather conditions",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name" }
        },
        "required": ["city"]
      }
    }
  ]
}
```

Agentforce uses tool names and descriptions for LLM routing — keep them clear and specific.

---

## Prebuilt MCP Servers

| Server | Purpose | Setup |
|---|---|---|
| **Salesforce DX MCP Server** | Deploy, test, manage scratch orgs from AI assistants | `@salesforce/mcp` npm package |
| **Heroku Platform** | Manage Heroku apps, dynos, add-ons | Built-in connector |
| **MuleSoft** | API orchestration, integration flows | MuleSoft Anypoint connector |

---

## Hosted MCP (Pilot)

Fully managed cloud endpoints — zero infrastructure. Pre-built for core CRM and B2C Commerce APIs.

- **No server to deploy** — Salesforce hosts the MCP endpoint
- **Admin setup only** — enable in Setup, configure permissions
- **Pre-built tools** for standard CRM operations (account lookup, case creation, etc.)
- **B2C Commerce** tools for product catalog, order management

---

## Debugging

If an MCP action fails in Agent Script:

1. **Check server connectivity**: Verify endpoint URL is reachable from Salesforce
2. **Check auth**: Ensure Named Credential + External Credential are configured
3. **Check tool name**: The action name in Agent Script must match the tool name in the server manifest
4. **Check rate limits**: Monitor for 429 responses in MCP Server logs
5. **Test standalone**: Use `sf mcp test` or direct HTTP to verify the server responds

---

## Related

- Skill: `mcp-server-patterns` — building MCP servers (Node SDK)
- Skill: `sf-agentforce-development` — Agent Script patterns
- Reference: @../_reference/AGENTFORCE_PATTERNS.md
