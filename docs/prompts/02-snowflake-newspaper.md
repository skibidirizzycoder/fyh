# Prompt 2: Snowflake newspaper

The second prompt, which added the AI-written newspaper. Copied word for word,
followed by a correction that was sent while it was being built.

---

Add Snowflake LLM text to the game, following AGENTS.md.
- Add a tiny server endpoint (Netlify Function or a small Node server) that reads SNOWFLAKE_ACCOUNT and SNOWFLAKE_TOKEN from .env and calls Snowflake's Cortex REST API to complete text. The browser never sees the key. Add .env to .gitignore and document the variables in README.
- Feature: after each era switch to the present, generate a newspaper headline and a 2-3 sentence article from the current timeline flags. Story logic stays in timeline.ts; the LLM only writes text.
- Cache replies by flag set. On error or timeout (3 s), show the pre-written text from content.json and a small "offline edition" label.
- Tests: mock the endpoint in vitest and in the smoke test, so "npm run gate" never calls the network. Add one manual script, "npm run snowflake:ping", that checks the real API works.
Done when gate passes and snowflake:ping returns a headline.

**Follow-up sent during the work:**

Create .env.example with SNOWFLAKE_ACCOUNT= and SNOWFLAKE_TOKEN= (empty values), copy it to .env, make sure .env is in .gitignore, and read both values only from process.env in the server code. Never print or log them.

---

**Status:** the code is done and `npm run gate` passes. Snowflake **trial** accounts can't
use Cortex AI ("not available for trial accounts"), so `snowflake:ping` fails on a trial
account and the game shows the offline edition. See `STATUS.md`.
