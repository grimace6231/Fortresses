# Fortresses

Two-player online adaptation of *Citadels* (2016 edition). React/Vite client, Node/Express/Socket.io server, plain-JS shared module. No TypeScript, no build for the server, no database — games live in memory on the `LobbyManager`.

## Stack

- **Client:** React 19 + Vite, Socket.io-client. One component tree under `client/src/components/` and a thin `useSocket` hook.
- **Server:** Node 18+ ESM, Express, Socket.io. Run via `node --watch` — no transpile step.
- **Shared:** `shared/constants.js` is imported directly by both sides via relative path. Keep it pure-data + small pure helpers; no Node or browser APIs.

## Dev workflow

- `npm run dev` at the repo root runs server (`:3001`) and client (`:5173`) concurrently via `concurrently`.
- Server restarts on file change via `node --watch`; Vite HMR handles the client.
- No test runner is set up. Verify gameplay either via Node smoke scripts (require the engine directly, script a 2-player sequence) or by opening two browser tabs.
- For UI changes, always open the preview and exercise the feature end-to-end before claiming done — type-checking doesn't exist and socket flow bugs won't show up statically.

## Repo layout

```
shared/constants.js             # roles, configs, districts, events — source of truth
server/src/
  index.js                      # express + socket.io bootstrap
  lobby/LobbyManager.js         # game registry, player auth tokens, reconnect
  socket/handlers.js            # thin per-event wrappers around the engine
  game/
    GameEngine.js               # all gameplay state + rules (large — read in slices)
    roles.js                    # per-role metadata (needsTarget, etc.)
    districts.js                # deck construction from DISTRICT_CARDS
client/src/
  App.jsx, main.jsx             # socket wiring + top-level routing between phases
  hooks/useSocket.js            # socket singleton, auth token persistence
  components/
    Lobby.jsx                   # home + setup screens (config + rank-9 toggle)
    RoleDraft.jsx               # draft UI
    Game.jsx                    # wraps board + action panel + log
    ActionPanel.jsx             # turn controls, ability flows
    PlayerBoard.jsx             # hand, city, resources
    GameLog.jsx
```

## Role configs

The setup screen offers named scenarios. Each config in `ROLE_CONFIGS` has:

- `baseRoleIds: number[]` — exactly 8 role IDs, one per rank 1–8.
- `rank9?: { id, label, description, defaultInclude }` — optional rank-9 role the player can toggle on/off in the lobby (per rulebook p.8: rank 9 is optional with 4–7 players; we apply the same principle to 2P).

`resolveRoleIds(configKey, includeRank9)` gives the final role list. The lobby keeps per-config toggle state so switching presets preserves each scenario's choice.

Current configs: `classic` (no rank 9), `brave` (+ Queen), `scholarly` (Scholar instead of Architect), `vicious_nobles` (noble-aggression roster, optional Tax Collector).

## Adding a role

1. Add an entry to `ROLES` in `shared/constants.js` with `id`, `rank`, `name`, `color`, and (if passive color bonus) `bonus: { color, resource: 'gold' | 'card' }`.
2. Add a role description in `client/src/components/RoleDraft.jsx` `ROLE_DESCRIPTIONS` and in `ActionPanel.jsx` if it has an active ability.
3. Add engine behavior in `server/src/game/GameEngine.js`:
   - Passive color-bonus roles need no branch — `collectBonus` reads the `bonus` metadata.
   - Active abilities branch in `_advanceToNextRole` (turn-start effects) and `useAbility` (player-triggered).
4. If the role has target metadata or a turn-start hook needed by the UI, expose it in `getStateForPlayer`.

## Adding a scenario

Append a new entry to `ROLE_CONFIGS` in `shared/constants.js` and add its key to `CONFIG_ORDER` in `Lobby.jsx`. The engine picks it up through `resolveRoleIds` — no further wiring.

## Turn order & crown

- Turn order sorts `activeRoles` by `rank` ascending: `[...activeRoles].sort((a, b) => a.rank - b.rank).map(r => r.id)`.
- Crown-holders: roles 4 (King) and 11 (Patrician) both take the crown at turn start.
- Scholar (10) auto-draws 7 cards on turn start into the `drawnCards` flow; no gold, no extra builds.
- Tax Collector (14): every non-TC build donates 1 gold to `taxGold`; TC collects it all on turn start.

## Socket events

All event names are in `EVENTS` in `shared/constants.js`. Handlers in `server/src/socket/handlers.js` are intentionally thin — each one calls a named engine method and re-broadcasts state via `broadcastState`. State is personalized per player (opponent's hand is redacted) by `getStateForPlayer`.

## Authentication / reconnect

`LobbyManager.authenticatePlayer` issues a `{ playerId, token }` pair on first connect; the client persists it in `localStorage` via `useSocket`. Returning sockets present the pair in `handshake.auth` and get the same `playerId` back, letting them rejoin the game in progress. Games survive disconnects for 10 minutes before cleanup.

## Conventions

- Ports: server `3001`, client `5173`. The server's CORS list includes both and honors `CLIENT_URL` for deployed environments.
- No comments explaining the *what* — identifiers and structure should do that. Reserve comments for non-obvious *why*: rule citations, rulebook page refs, subtle invariants.
- Keep the engine authoritative: the client never decides legality. UI controls may hide invalid actions, but every `socket.on` handler revalidates via the engine.
- The 2016 rulebook PDF is the source of truth for any rules question. The PDF and an extracted text copy (`rulebook.txt`) are gitignored — keep them locally at the repo root for reference.
