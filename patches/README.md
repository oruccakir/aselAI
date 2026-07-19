# Hermes patches

Patches that must be applied to the Hermes agent checkout (`~/.hermes/hermes-agent`)
for aselAI features to work. `hermes update` auto-stashes and restores local
changes, but if a restore is skipped or conflicts, re-apply from here.

## hermes-acp-session-delete.patch

Adds the ACP extension methods `_session/delete` and `_session/delete_all`
(`HermesACPAgent.ext_method` in `acp_adapter/server.py`, plus
`SessionManager.remove_all_sessions` in `acp_adapter/session.py`). Backs the
chat delete / delete-all buttons and the `/delete`, `/purge` slash commands.
Only rows with `source='acp'` are ever deleted — the agent's CLI/Telegram/cron
history is untouched.

Apply:

```bash
cd ~/.hermes/hermes-agent
git apply /path/to/aselAI/patches/hermes-acp-session-delete.patch
```

Check whether it is already applied (exits cleanly if so):

```bash
git apply --check --reverse /path/to/aselAI/patches/hermes-acp-session-delete.patch
```

Restart the aselAI dev server after applying — the ACP child processes are
spawned once per agent and keep running with the old code otherwise.
