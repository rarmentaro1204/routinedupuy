# Higgsfield MCP

Higgsfield runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) server that exposes its image/video generation platform as tools any MCP-compatible AI client (Claude, Cursor, Windsurf, Cline, OpenCode, ...) can call directly.

- **Server URL:** `https://mcp.higgsfield.ai/mcp`
- **Transport:** HTTP
- **Auth:** OAuth via your Higgsfield account — no API key needed

## Setup

### Claude (web / desktop)

1. Open **Settings → Connectors**.
2. Add a custom connector with the URL `https://mcp.higgsfield.ai/mcp`.
3. Click **Add → Connect** and authenticate with your Higgsfield account when prompted.

### Claude Code

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

Claude Code opens a browser window for OAuth on first use; no manual token entry required. Once authenticated, the connection persists across sessions.

## Available tools

| Tool | Purpose |
|---|---|
| `generate_image` | Text-to-image generation across 16+ models (e.g. GPT Image 2, Soul V2, Flux 2, Nano Banana Pro), up to 4K resolution |
| `generate_video` | Text-to-video or image-to-video generation, up to ~15s clips (e.g. Veo 3.1, Kling 3.0, Sora 2, Seedance 2.0, MiniMax Hailuo) |
| `create_character` | Train a reusable character from reference images for consistent generations |
| `get_generation_status` | Poll the status/progress of an in-flight generation job |
| `list_creations` / asset lookup | Browse, search, and reuse prior generations as references for new jobs |

## Notes

- Account credits on Higgsfield are required to run generations; there is no separate MCP-specific pricing.
- This repository does not otherwise integrate with Higgsfield — this file documents the connector for reference only.

## Sources

- [Higgsfield MCP](https://higgsfield.ai/mcp)
- [How To Generate AI Videos Straight From Claude with Higgsfield's MCP](https://higgsfield.ai/blog/Generate-AI-Videos-From-Claude-with-Higgsfield-MCP)
- [How to Connect Higgsfield MCP to Claude](https://www.higgsfieldmcp.com/guides/setup-claude)
