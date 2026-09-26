# 🎮 Dodge the Blocks — Enhanced Edition

A browser-based endless dodger built with **HTML, CSS Canvas and vanilla JavaScript** — no frameworks, no build step. Deploys to Vercel through a GitHub Actions CI/CD pipeline.

**Live:** https://dodge-the-blocks-phi.vercel.app

## ✨ Features

* ⬅️➡️ Keyboard, on-screen buttons, and touch/drag controls
* ❤️ 3 lives with a brief invulnerability flicker after each hit
* 📈 Levels — obstacles spawn faster and move quicker as your score climbs
* 🧱 Four obstacle types: normal, fast, wide, and zigzag blocks
* ⭐ Four power-ups: 🛡 Shield, ⏱ Slow-motion, x2 Score multiplier, ❤ Extra life
* 💥 Particle bursts and screen shake on impact
* 🌌 Parallax starfield background that shifts hue with your level
* 🔊 Retro sound effects + a procedural background music loop, generated live with the Web Audio API (no audio files needed)
* 🔇 Mute toggle, remembered across visits
* 😎 Near-miss bonus — squeeze past a block with a close call for extra points
* ⏸️ Pause anytime with **P** / **Esc**, or by tapping the canvas
* 🏆 High score saved in `localStorage`
* 📱 Auto-pauses when you switch tabs
* 🧾 Footer shows the exact commit and pipeline run behind the live page

## 🕹️ How to Play

1. Open the game and press **←** or **→** (or tap/drag on mobile) to start.
2. Move left and right to dodge falling blocks.
3. Grab power-ups for a temporary edge:
   * 🛡 **Shield** — destroys the next obstacles you touch instead of costing a life
   * ⏱ **Slow-mo** — temporarily slows everything down
   * x2 **Multiplier** — doubles the score you earn for a while
   * ❤ **Life** — adds an extra life (up to 5)
4. You have 3 lives. Losing all of them ends the run.
5. Click **Restart** to play again.

## 🛠️ Technologies

* HTML5 + Canvas
* CSS3 (gradients, animations, responsive layout)
* Vanilla JavaScript (no dependencies)
* Web Audio API for sound
* Git / GitHub / GitHub Actions
* Vercel (static hosting)

## 📁 Project Structure

```text
dodge-the-blocks/
├── .github/workflows/deploy.yml   # CI/CD pipeline (validate → deploy)
├── public/
│   ├── index.html                 # markup + build-info footer script
│   ├── style.css                  # visuals, layout, animations
│   └── game.js                    # game logic; tune gameplay in CONFIG
├── vercel.json                    # static hosting config
└── README.md
```

## 🚀 Run Locally

```bash
git clone https://github.com/sandalib26/dodge-the-blocks.git
cd dodge-the-blocks
npx serve public
# or: python3 -m http.server 8000 -d public
```

When running locally, the footer says **"Running locally"** — build info is only filled in by the CI pipeline.

## ⚙️ How the Pipeline Works

| Trigger | Result |
|---|---|
| Push to `main` | validate → **production** deploy |
| Pull request | validate → **preview** deploy |
| Manual (`workflow_dispatch`) | validate → production deploy |

**1. ✅ Validate** — lints HTML (`htmlhint`) and checks `game.js` syntax (`node --check`).

**2. 🚀 Deploy** (runs only if Validate passes) — stamps the commit SHA / build time into `index.html`, then uses the Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`) to publish.

`vercel.json` sets `git.deploymentEnabled: false` so Vercel's own Git integration never deploys — GitHub Actions is the single path to production.

### Required GitHub secrets

| Name | Value |
|---|---|
| `VERCEL_TOKEN` | Personal token from vercel.com/account/tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

## 🎯 Possible Next Steps

* 🎵 Background music toggle
* 🧑‍🤝‍🧑 Local 2-player mode
* 🗺️ Boss obstacle every 10 levels
* 🌗 Light/dark theme switch
