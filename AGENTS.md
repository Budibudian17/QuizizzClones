<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

<!-- LOVABLE:BEGIN:manual -->
## Project rules

- Quiz "real-time" is a mock layer, by design: `src/game/room.ts` keeps one authoritative
  room snapshot in localStorage and mirrors it across tabs with a BroadcastChannel
  (`kampusquiz-room`). The Host tab is the only writer of phase transitions (`hostTick`);
  players only write their own answers. Do not introduce a backend, Supabase tables, or a
  second sync mechanism without a user request — this layer is the product's simulation core.
- All game routes (`/`, `/editor`, `/host`, `/join`) render with `ssr: false` because they
  read localStorage/BroadcastChannel. Keep browser-only access inside effects/handlers.
- Pure game rules (scoring, room transitions) live in `src/game/scoring.ts` and
  `src/game/room.ts`, free of React/three imports; they are covered by
  `src/test/scoring.test.ts` and `src/test/room.test.ts` — extend those tests when
  changing rules.
