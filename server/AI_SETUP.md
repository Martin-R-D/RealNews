# AI provider setup

Set these values in `server/.env`, or configure them as server environment secrets:

```dotenv
CLAUDE_API_KEY=your_anthropic_api_key
GROQ_API_KEY=your_existing_groq_api_key
```

Keep real keys out of chat, commits, and the client. The repository ignores `.env`.
Copy `.env.example` only when creating a new file; preserve your existing news API
keys. Restart the backend after changing `.env`. The AI client reads `server/.env`
even if Node is started from the repository root; existing environment variables
keep precedence over file values.

All five AI operations use the same server-side `generateJSON` client:

- Search queries and source selection (`orchestrate`).
- Bias assessment and neutral summary (`judge`).
- Coverage differences (`compareCoverage`).
- Selected-text analysis (`analyzeHighlight`).
- Homepage event grouping (`inferGroups`).

Each operation first calls Anthropic's Messages API with `claude-haiku-5-5` and
`output_config: { effort: 'low' }`. Sampling parameters used by Groq are not sent
to Haiku 5.5. Only text response blocks are parsed; thinking blocks are ignored.
Claude gets a larger output cap because its token limit includes thinking.

On a missing Claude key, HTTP/network error, timeout, incomplete response,
invalid JSON, or failed feature validation, the client calls the existing Groq
`openai/gpt-oss-20b` model with that operation's prompts and Groq settings.
The judge retains one validation-repair retry for Groq. A valid response ends the
operation without calling the other provider. Caller cancellation stops the work
without starting fallback. Both providers share the operation's original time
limit: Claude may use up to 60%, leaving the remainder for Groq. If both fail,
existing feature error handling remains in effect (including local homepage
grouping and an unavailable coverage panel).

Provider transitions are logged without keys, prompts, headers, or response bodies.

## Testing in the managed cloud workspace

Add `CLAUDE_API_KEY` through the environment's secret configuration and allow the
hostname `api.anthropic.com` in its network configuration. Keep `api.groq.com`
allowed for fallback. A key in your computer's local `.env` does not configure
this separate cloud workspace. No need to send a key in chat.

After configuring the secret and hostname, restart the backend and run
`npm --prefix server run ai:check` from the repository root. The check reports
success only if Claude answers; a successful Groq fallback is reported separately. The homepage feed
is cached for five minutes; restart the server or wait for cache expiry to verify
new provider calls. A successful Claude call should not log a Groq fallback.

Run deterministic provider and feature tests without live credentials:

```bash
node --test server/ai/*.test.js server/agents/*.test.js server/services/*.test.js server/*.integration.test.js
```

## API references

- [Haiku 5.5 model](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
- [Effort parameter](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Haiku 5.5 migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide)
