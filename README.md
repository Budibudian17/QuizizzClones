# Quiz Nusantara Arena

Create a comprehensive, production-ready real-time multiplayer quiz web application (core mechanics similar to Kahoot/Quizizz) designed for a fresh project rebuild. The application must feature a highly aesthetic, modern minimalist dark-mode theme with subtle, sophisticated 3D elements and smooth professional animations.

CRITICAL TYPOGRAPHY & FONT DIRECTION:

- Strictly avoid generic "AI-style" fonts, overused robotic/futuristic tech typography, or stock geometric block fonts.
- Use a professional, clean, and highly readable modern font pair available via standard Google Fonts.
- Headings & Game PIN: Use a sophisticated sans-serif with subtle character like "Plus Jakarta Sans" or "Syne" (weighted heavily for headers/large numbers to look custom and polished).
- Body Text, Options, & Interface Elements: Use a clean, highly legible, professional neo-grotesque font like "Inter" or "Instrument Sans".
- Ensure clean line-heights, meticulous tracking (letter-spacing), and prominent typographic hierarchy so the platform looks like a high-end, bespoke digital product.

VISUAL DIRECTION & DESIGN SYSTEM:

- Strictly avoid overly bright, multi-colored neon, or generic "AI-generated" space/cyberpunk styles.
- Use a refined, premium dark palette: warm charcoal backgrounds, crisp ivory typography, and golden yellow accents complemented by muted earth tones.
- Visual elements should look clean, spacious, and flat, but enhanced with subtle 3D depth (e.g., precise glassmorphism, smooth CSS 3D transforms, or lightweight Three.js canvas layer).
- Use direct SVG icons (Lucide) natively. Ensure everything is mobile-responsive and feels like a premium modern SaaS product.

CORE ARCHITECTURE & INTERFACES (Single Page Application State):

1. HOST VIEW (Dashboard & Creator):

- A clean, minimalist creator dashboard displaying only quizzes saved by the signed-in host.
- Quiz Editor interface allowing the host to add/edit multiple-choice questions (up to 4 options), select the correct answer, and configure a custom countdown timer (10s, 20s, 30s) per question.
- "Launch Game" button that instantly generates a unique 6-digit Game PIN and opens the game lobby.

2. REAL-TIME SYNCHRONIZED LOBBY:

- Host Lobby Interface: Displays the 6-digit Game PIN in large, crisp typography, a "Start Game" action button, and a dynamic grid showing joined players.
- Player Join Screen: A centered, clean minimalist input card prompting users for a "Game PIN" and "Nickname".
- Player Waiting Lobby: Once joined, players see a beautiful waiting screen where other active players' nameplates animate into view smoothly with a subtle 3D hover-scale transition.
- Sync State: Clicking "Start Game" on the Host screen must automatically and simultaneously transition all connected players' screens into the active quiz countdown without manual refresh.

3. ELEVATED ANIMATIONS & SUBTLE 3D EFFECTS:

- Background: A minimalist ambient layer featuring subtle, low-intensity 3D geometric grids or abstract floating cards that gently shift in response to cursor movement.
- Holographic Circular Timer: A crisp, minimalist 3D-like circular progress ring countdown that shrinks smoothly and pulses gently when time drops below 5 seconds.
- Scoreboard Celebrations: Correct answers trigger an elegant, confined 3D confetti burst that respects the clean UI layout without cluttering the user interface.

4. CORE GAMEPLAY MECHANICS:

- Host Active Screen: Displays the ongoing Indonesian university question, the ticking countdown ring, and the real-time count of submitted answers. Once time expires, it reveals a clean, minimalist bar chart of answer distribution alongside the correct choice.
- Player Active Screen: Displays 4 large, clean, geometric flat choice buttons with distinct, satisfying 3D press states. Fast responses earn a decaying speed-multiplier bonus score.
- Leaderboard & Final Podium: Displays a top-5 ranking transition between questions. Conclude the entire game with a premium 3D Podium layout (1st, 2nd, and 3rd place) featuring clean rising animations for the winners' cards and a subtle spotlight effect.

IMPLEMENTATION DETAIL:
The multiplayer flow uses Supabase Auth, Postgres RPCs, Row Level Security, and
Supabase Realtime so hosts and players can join from separate devices.

This project was built with [Lovable](https://lovable.dev).

## Supabase setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` for
local development and in the deployment environment for production. See
`.env.example` for the expected variable names. Vite uses the `VITE_` prefix
instead of Next.js's `NEXT_PUBLIC_` prefix.

The browser and server clients are configured for cookie-backed Supabase Auth.
TanStack Start request middleware refreshes an existing session. Host accounts
use email/password auth; players join with temporary anonymous auth sessions.
Quizzes, rooms, player answers, scoring, and phase transitions are stored in
Supabase, with room updates delivered through Supabase Realtime.

The theme picker offers Emas, Samudra, and Hutan color palettes. The selected
theme is saved in browser localStorage and applies across the app on that browser.

Before running the app:

1. Apply `supabase/migrations/20261101000000_kampusquiz_backend.sql` to the project.
2. Enable **Anonymous Sign-Ins** in Supabase Authentication settings for players.
3. Ensure the Email provider is enabled for host accounts.
4. Restart the Vite dev server after changing `.env.local`.

For Vercel deployments, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` under **Project Settings → Environment Variables**
for each environment you deploy (Production, Preview, and/or Development), then
redeploy so Vite can include them in the client build. Also apply the database
migration above and enable **Anonymous Sign-Ins** in the same Supabase project;
players need anonymous auth before they can join with a PIN.

The migration adds Row Level Security and RPCs for joining rooms, starting games,
submitting answers, scoring, and advancing phases. Correct answers are withheld
from players until their question is revealed. The dashboard loads quizzes only
from the signed-in host's database records. New accounts start with an empty quiz
list; no sample quizzes or localStorage quiz data are seeded into the database.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8e83ac3b-1df3-4039-bf6c-7df64c4c25ec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Coba permainan

1. Buka `http://localhost:8080/`, masuk ke dashboard host, lalu luncurkan kuis.
2. Buat akun host atau masuk, lalu gabungkan minimal 4 pemain asli melalui halaman Join.
3. Mulai permainan dari tab host. Setelah menjawab, pemain masuk ke layar timer saja; ronde berlanjut saat semua pemain menjawab atau waktu habis.

PIN dapat disalin dari lobby host. Pada layar soal, host dapat memantau pemain yang sudah menjawab dan yang masih menunggu. Sesi pemain disimpan di Supabase Auth agar bisa dipulihkan setelah refresh.

# QuizizzClones
