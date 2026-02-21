# AI Unix Log Agent - Dual API Edition

Node.js project supporting **both OpenAI and Google Gemini** with function calling to orchestrate Unix commands as AI tools in a ReAct loop.

## 🎯 Features

- **Dual API Support**: Switch between OpenAI (`gpt-4.1-mini`) and Gemini (`gemini-2.0-flash-exp`) with one env var
- **ReAct Agent Loop**: Reason → Act (Unix tools) → Observe → Repeat
- **7 Unix Tools**: `find`, `tail`, `grep`, `sort|uniq`, `wc`, `df`, `ps`
- **Security**: `child_process.spawn()` + input sanitization + timeouts
- **CLI**: Natural language goals + dry-run mode + token tracking

## 🚀 Quick Start

```bash# 
1. Configure
cd ai-unix-log-agent-dual
cp .env.example .env

# 2. Edit .env - add ONE of these:
# API_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OR
# API_PROVIDER=gemini  
# GOOGLE_API_KEY=AIzaSy...

# 3. Run with sample logs
npm start
```

## 🔧 Configuration

**.env file:**
```bash
# REQUIRED: Choose provider
API_PROVIDER=openai    # or "gemini"

# OpenAI (if API_PROVIDER=openai)
OPENAI_API_KEY=sk-your-openai-key

# Gemini (if API_PROVIDER=gemini) 
GOOGLE_API_KEY=AIzaSy-your-gemini-key

# Optional model overrides
OPENAI_MODEL=gpt-4.1-mini
GEMINI_MODEL=gemini-2.0-flash-exp
```

**API Keys:**
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Gemini**: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

## 📋 Usage Examples

```bash
# Default: Analyze sample logs
npm start

# Custom goal with real logs
npm start -- "Find database connection errors and check if disk is full" --logDir=/var/log

# Dry-run (safe - shows planned commands only)
npm start -- --dry-run

# OpenAI specifically
npm start:openai

# Gemini specifically  
npm start:gemini

# Limit iterations
npm start -- --max-iterations=5
```

## 🛠️ Architecture

```
High-Level Goal ──> [ Reason (LLM) ] ──> [ Act (Unix Tool) ] ──> [ Observe ]
                      ↑                                                    │
                      └──────────── Loop until goal complete ─────────────┘
```

**Files:**
```
src/
├── index.js         # CLI entry + arg parsing
├── agent.js         # ReAct loop + dual API routing  
├── tools.js         # Unix tool definitions + sanitization
├── commandExecutor.js # Safe spawn() wrapper
└── logger.js        # Step logging + token tracking
```

## 🧪 Sample Output

```
🚀 Starting dual-API log analysis agent (OpenAI)...

[agent#0] [reason] Goal: Review recent logs... (logDir=./logs)
[agent#1] [act] Calling list_logs {"directory":"./logs"}
[agent#1] [observe] Tool list_logs finished (code=0)
data: {"stderr":""}
[agent#2] [act] Calling tail_file {"file":"./logs/app.log","lines":200}
[agent#2] [observe] Tool tail_file finished (code=0)
[agent#3] [reason] Model signaled stop

=== FINAL SUMMARY ===
DB_CONN_TIMEOUT errors (3x) suggest database latency issues.
AUTH_INVALID_TOKEN (1x) from user 123 - check token expiry.
Disk space OK, no critical alerts.

=== RUN STATS ===
Approx tokens used: 2847
```

## 🛡️ Security Features

- ✅ `child_process.spawn()` with **array args** (no shell injection)
- ✅ Path/pattern **whitelisting** (`^[a-zA-Z0-9_./-]+$`)
- ✅ **10s command timeouts**
- ✅ **Dry-run mode** for testing
- ✅ **Max 8 iterations** prevents infinite loops

## 📁 Sample Logs Included

`logs/app.log` contains realistic entries:
```
2026-02-22T10:05:12Z ERROR DB_CONN_TIMEOUT: database did not respond within 5s
2026-02-22T10:07:45Z ERROR AUTH_INVALID_TOKEN: token expired for user 123
```

## 🔄 Switching Providers

| Command | Provider | Env Var |
|---------|----------|---------|
| `npm start` | Uses `API_PROVIDER` from `.env` | `API_PROVIDER=openai` |
| `npm start:openai` | OpenAI | Forces OpenAI |
| `npm start:gemini` | Gemini | Forces Gemini |

## 🐛 Troubleshooting

```
❌ "Missing API key" → Check .env has correct key for your API_PROVIDER
❌ "Command not found" → Ensure Unix tools exist (macOS/Linux only)
❌ "Permission denied" → Use --dry-run or check log dir permissions
❌ "Rate limited" → Wait or use cheaper model (gpt-4.1-mini)
```

## ♻️ Extending

1. **Add tools**: New functions in `tools.js` + schema entries
2. **New LLMs**: Add provider in `agent.js` 
3. **Web UI**: Wrap `runLogAnalysisAgent()` in Express
4. **Persistent memory**: Store `history` between runs

## 📄 License

MIT - Free to use/modify. Built for learning agentic patterns with Unix tools.

***

**Ready in ~2 minutes!** Just run the installer and add your API key. 🚀