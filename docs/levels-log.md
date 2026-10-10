# Weltraum-Mission – Balance-Log Level 19–100

Bot: human-like touch bot (/workspace/space-game-tools/bot.js). It sees threats 0.25 s late, aims correctly about 65 % of the time, and has 0.35–0.75 s lapses every 5–11 s. Sim speed is 4x. One run per level (3 per batch) per pass.
Ship per tier (best one available at that point, with upgrades rate,dmg,heart; dur/mag 3): L19–24 uni 3,3,1 · 25–30 rochen 3,3,1 · 31–36 hammer 4,3,1 · 37–45 zwilling 4,4,1 · 46–54 gravitron 4,4,1 · 55–60 spektral 4,4,2 · 61–69 segler 5,4,2 · 70–78 schatten 5,5,2 · 79–90 drache 5,5,2 · 91–100 omega 5,5,2.
Difficulty knob: heat(L) = (1.3 + 0.5·(L-19)/80) · TUNE[batch] · TUNE_L[L]. It scales rock speed, spawn rate, UFO rate (UFOs fire aimed shots from L19 on), feature frequency, tough-rock HP and boss HP/attack. TUNE_BOSS[L] scales the boss only.
Rule: batch 3/3 wins with avg ≥5 hearts left → harder (+10–15 %). ≤1/3 → easier. Single losses caused by black-hole instant deaths are re-run before acting.
Pass 1 = TUNE all 1.0 · pass 2 = TUNE v1 · final = TUNE v2 (in the game file).

| Levels | Ship | Pass 1 | Pass 2 | Action |
|---|---|---|---|---|
| 19-21 | uni | pass1 3/3: L19 win(6♥) L20 win(6♥) L21 win(6♥) | pass2 3/3: L19 win(6♥) L20 win(6♥) L21 win(6♥) | TUNE 1.0→1.15→1.26 |
| 22-24 | uni | pass1 3/3: L22 win(7♥) L23 win(5♥) L24 win(6♥) | pass2 3/3: L22 win(6♥) L23 win(4♥) L24 win(7♥) | TUNE 1.0→1.15→1.26 |
| 25-27 | rochen | pass1 3/3: L25 win(5♥) L26 win(6♥) L27 win(6♥) | pass2 3/3: L25 win(4♥) L26 win(5♥) L27 win(6♥) | TUNE 1.0→1.15→1.26 |
| 28-30 | rochen | pass1 3/3: L28 win(4♥) L29 win(4♥) L30 win(3♥) | pass2 3/3: L28 win(6♥) L29 win(6♥) L30 win(3♥) | TUNE 1.0→1→1.1 |
| 31-33 | hammer | pass1 2/3: L31 win(6♥) L32 win(1♥) L33 LOST(0♥) | pass2 2/3: L31 win(6♥) L32 win(3♥) L33 LOST(0♥) | keep 1.0; L33 sector-ish boss lost twice → boss ×0.9 |
| 34-36 | hammer | pass1 3/3: L34 win(5♥) L35 win(5♥) L36 win(3♥) | pass2 3/3: L34 win(5♥) L35 win(2♥) L36 win(4♥) | keep 1.0 |
| 37-39 | zwilling | pass1 3/3: L37 win(7♥) L38 win(6♥) L39 win(6♥) | pass2 3/3: L37 win(5♥) L38 win(6♥) L39 win(7♥) | TUNE 1.0→1.15→1.26 |
| 40-42 | zwilling | pass1 3/3: L40 win(6♥) L41 win(6♥) L42 win(6♥) | pass2 3/3: L40 win(6♥) L41 win(6♥) L42 win(5♥) | TUNE 1.0→1.15→1.26 |
| 43-45 | zwilling | pass1 3/3: L43 win(1♥) L44 win(6♥) L45 win(4♥) | pass2 3/3: L43 win(3♥) L44 win(6♥) L45 win(3♥) | keep 1.0 |
| 46-48 | gravitron | pass1 3/3: L46 win(6♥) L47 win(6♥) L48 win(8♥) | pass2 3/3: L46 win(6♥) L47 win(7♥) L48 win(7♥) | TUNE 1.0→1.15→1.26 |
| 49-51 | gravitron | pass1 3/3: L49 win(7♥) L50 win(7♥) L51 win(5♥) | pass2 3/3: L49 win(7♥) L50 win(5♥) L51 win(2♥) | TUNE 1.0→1.15→1.15 |
| 52-54 | gravitron | pass1 3/3: L52 win(5♥) L53 win(5♥) L54 win(5♥) | pass2 3/3: L52 win(6♥) L53 win(7♥) L54 win(3♥) | TUNE 1.0→1.15→1.26 |
| 55-57 | spektral | pass1 3/3: L55 win(7♥) L56 win(5♥) L57 win(1♥) | pass2 3/3: L55 win(7♥) L56 win(6♥) L57 win(5♥) | TUNE 1.0→1→1.1 |
| 58-60 | spektral | pass1 2/3: L58 win(5♥) L59 win(6♥) L60 LOST(0♥) | pass2 2/3: L58 win(5♥) L59 win(9♥) L60 LOST(0♥) | keep 1.0; L60 sector boss lost twice → boss ×0.9 |
| 61-63 | segler | pass1 3/3: L61 win(4♥) L62 win(9♥) L63 win(9♥) | pass2 3/3: L61 win(3♥) L62 win(5♥) L63 win(5♥) | TUNE 1.0→1.15→1.15 |
| 64-66 | segler | pass1 3/3: L64 win(6♥) L65 win(3♥) L66 win(6♥) | pass2 3/3: L64 win(2♥) L65 win(7♥) L66 win(8♥) | TUNE 1.0→1.15→1.26 |
| 67-69 | segler | pass1 3/3: L67 win(5♥) L68 win(6♥) L69 win(4♥) | pass2 3/3: L67 win(5♥) L68 win(5♥) L69 win(6♥) | TUNE 1.0→1.15→1.26 |
| 70-72 | schatten | pass1 3/3: L70 win(10♥) L71 win(6♥) L72 win(8♥) | pass2 3/3: L70 win(9♥) L71 win(5♥) L72 win(6♥) | TUNE 1.0→1.25→1.38 |
| 73-75 | schatten | pass1 3/3: L73 win(5♥) L74 win(6♥) L75 win(8♥) | pass2 3/3: L73 win(3♥) L74 win(6♥) L75 win(4♥) | TUNE 1.0→1.15→1.15 |
| 76-78 | schatten | pass1 3/3: L76 win(9♥) L77 win(9♥) L78 win(8♥) | pass2 3/3: L76 win(7♥) L77 win(7♥) L78 win(8♥) | TUNE 1.0→1.25→1.38 |
| 79-81 | drache | pass1 1/3: L79 LOST(0♥) L80 LOST(0♥) L81 win(2♥) | pass2 2/3: L79 LOST(0♥) L80 win(9♥) L81 win(3♥) | keep 1.0; L79/80 losses were black-hole instant deaths (re-run 2/2 wins) → keep |
| 82-84 | drache | pass1 3/3: L82 win(9♥) L83 win(9♥) L84 win(4♥) | pass2 3/3: L82 win(10♥) L83 win(7♥) L84 win(5♥) | TUNE 1.0→1.15→1.26 |
| 85-87 | drache | pass1 1/3: L85 LOST(0♥) L86 LOST(0♥) L87 win(8♥) | pass2 2/3: L85 win(7♥) L86 LOST(0♥) L87 win(6♥) | keep 1.0; L85/86 losses = black-hole instant deaths (re-run L86 win) → keep |
| 88-90 | drache | pass1 1/3: L88 win(7♥) L89 LOST(0♥) L90 LOST(0♥) | pass2 1/3: L88 win(10♥) L89 LOST(0♥) L90 LOST(0♥) | keep 1.0; L89 lost twice → TUNE_L 0.9; L90 sector boss lost 3× → boss ×0.85 |
| 91-93 | omega | pass1 3/3: L91 win(8♥) L92 win(10♥) L93 win(8♥) | pass2 3/3: L91 win(6♥) L92 win(8♥) L93 win(6♥) | TUNE 1.0→1.25→1.38 |
| 94-96 | omega | pass1 3/3: L94 win(8♥) L95 win(8♥) L96 win(8♥) | pass2 3/3: L94 win(6♥) L95 win(7♥) L96 win(7♥) | TUNE 1.0→1.15→1.26 |
| 97-99 | omega | pass1 3/3: L97 win(10♥) L98 win(6♥) L99 win(10♥) | pass2 3/3: L97 win(10♥) L98 win(8♥) L99 win(10♥) | TUNE 1.0→1.25→1.4 |
| 100 | omega 5,5,2 | Robo-Kaiser, TUNE_BOSS 1.25: earlier 8-run sim 2/8 (25 %); this session 1/3 | – | keep 1.25 (target 20–40 % reached). Kaiser-Brecher (L90 reward) does 1.6x damage vs the Kaiser: 1/6 |

## Pass 3 spot checks (final values)
- L20 uni win (6 hearts) · L40 zwilling win (5) · L67 segler win (2) · L97 omega win (9). The harder settings still win, with fewer hearts left.
- L33 FROST-KRAKE (hammer): 0/4 at boss x1.0/0.9 → **TUNE_BOSS 0.8** → 1/2 ✔
- L89 (Loch-Sturm + black holes + gravity, drache): 0/3 → **TUNE_L 0.8** → 1/2 ✔ (losses are black-hole instant deaths)
- L60 SONNEN-TITAN sector boss (spektral): 0/6 even at boss x0.6 (boss ends at 17–42 % HP). Boss HP is not the problem: the lives run out to mines + homing missiles over a ~100 s fight. Final value is x0.75.  Sonnen-Segler (next tier) also loses (0/1, boss at 49 %).
- L90 SCHWARZLOCH-WÄCHTER sector boss (drache): 0/6 even at x0.6. Omega-Stern wins it 1/1 (5 hearts left). Final value is x0.75.
- (v27 state; fixed in v28, see below)

## v28 – Sector bosses L60 / L90 fixed (fewer attacks, boss HP back to 90 %)
Changes (only in these two fights): TUNE_BOSS 60/90 = 0.9 (was 0.75). Boss attack timers x TUNE_ATK (60: 0.85, 90: 0.5). Boss tricks (mines/missiles/minions/wells) every 2.5x longer, max 1 missile per wave (2 alive). Half as many rocks during the fight. Sun fan 7/8 instead of 9/11 bombs. Guardian laser warning 2.0 s instead of 1.5 s.
Diagnosis (hit counter): L60 lives were lost mostly to the sun's bomb fans; L90 mostly to the guardian laser and the grid.
| Step | L60 Sonnen-Titan (spektral 4,4,2) | L90 Schwarzloch-Wächter (drache 5,5,2) |
|---|---|---|
| v27 (HP 0.75) | 0/6 | 0/6 |
| ATK 0.75, MOD 1.8, HP 0.9 | 0/2 | 0/2 |
| ATK 0.55, MOD 2.5 | 0/4 | 0/4 |
| + half rocks | 0/4 (boss 12–42 % left) | 0/4 (13–31 % left) |
| + smaller sun fan, longer laser warning | 4/4 | 1/4 |
| ATK 60: 0.7 / 90: 0.45 | 4/4 | 3/4 |
| **final ATK 60: 0.85 / 90: 0.5** | **2/4 (50 %)** | **2/2 (≈50–75 % with the neighbouring values)** |

## v29 – Pass over L1–99 (1 run per level, L60/L90/L100 not touched)
Results (L + W/L + hearts left): 1W3 2W2 3W2 4W4 5W3 6W3 7W3 8L0 9W3 10W3 11L0 12L0 13W5 14W5 15W5 16W5 17W4 18W1 19W6 20W7 21W6 22W5 23W7 24W7 25W5 26W6 27W6 28W5 29W6 30W1 31W5 32W3 33L0 34W3 35W4 36W4 37W5 38W6 39W6 40W2 41W6 42W5 43W3 44W7 45W5 46W3 47W7 48W7 49W6 50W6 51L0 52W6 53W7 54W4 55W7 56W8 57W4 58W7 59W5 61W7 62W6 63W4 64W7 65W3 66W8 67W3 68W3 69W2 70W9 71W5 72W6 73W4 74W6 75W6 76W10 77W6 78W9 79L0 80W8 81W1 82W9 83W5 84L0 85W6 86L0 87W9 88W8 89L0 91W7 92W11 93W7 94W7 95W5 96W7 97W10 98W6 99W8
Rule: batch won 3/3 with hearts left ≥ ~90 % of the ship's max (hearts + heart upgrade) → harder.
- 19–21, 22–24, 25–27, 37–39, 76–78: TUNE ×1.15 (→ 1.45 / 1.45 / 1.45 / 1.45 / 1.59)
- 91–93, 97–99: TUNE ×1.1 (→ 1.52 / 1.54)
- All other batches: keep (losses or clearly fewer hearts left). L1–18 have no heat knob; L13–16 were won with full hearts by Galaxie-König/Quanten. Left as is because the early levels should stay kid-friendly (and Uni nerf L13–17 is already there).
- Not re-verified after this change (time); next pass should re-sim the 7 changed batches.

## v30 – Heart cap (3 / top tier 4, +1 upgrade) and retune of 90/100
- L60 spektral (now 4 hearts): 1/2 → keep. L90 drache: x0.9/atk 0.5 → 0/2; **x0.8/atk 0.4 → 2/4**.
- L100 omega (now 5 hearts): x1.25 → 0/2; x0.95 → 0/4; x0.75 → 3/6; **final x0.85** (in between, ~25–35 % expected, not re-simmed).
- Spot checks: L15 koenig W, L21 uni W, L45 zwilling W(1♥), L50 gravitron W, L66 segler W, L75 schatten W, L96 omega W, L33 hammer L, L84 drache L. Most levels are noticeably harder because of the heart cap (as requested, not compensated).

## v31 – Fine-tuning after the heart cap
- L100 omega 5,5,1: TUNE_BOSS 0.85 → 5/12 (42 %); **0.9 → 3/12 (25 %)** ✔ target 25–35 %.
- L33 hammer 3,3,1: 0/3 (x0.8) → x0.7/atk 0.75 0/2 → **x0.6/atk 0.65 → 3/4**.
- L84 drache 4,4,1: 0/3 → TUNE_L 0.85 1/4 → +boss x0.85/atk 0.85 1/4 → **TUNE_L 0.8 → 1/4** (losses at boss 4–36 %; possibly ease further).

## v32 – Robot bosses and new hazards (quick sims, 1–2 runs each)
- New hazards: L34 hammer ion 2/2 W, L41 zwilling magnet mines 2/2 W, L56 spektral satellite 2/2 W, L74 schatten mines W, L79 drache satellite + hole W(1♥), L32 hammer grid W.
- Robot bosses (mechanics unchanged): L24 uni W, L36 hammer W(1♥), L48 gravitron W, L96 omega W; L72 schatten 0/2 (v31 same level: 1/2), L81 drache 0/2 (v31: 0/1), L57 spektral 0/2 → these were already this hard after the heart cap; candidates for easing.

## v33 – Easing robot bosses L57/L72/L81 (ship of that tier, upgrades 4,4,1)
| Level | Ship | 1.0 (v32) | Round 1 | Round 2 | Final |
|---|---|---|---|---|---|
| 57 | spektral | 0/2 | 0.7/0.7: 4/4 | 0.8/0.8: 4/4 | **0.9/0.9: 4/6** |
| 72 | schatten | 0/2 | 0.7/0.7: 3/4 | 0.75/0.75: 4/4 | **0.85/0.85: 3/6** |
| 81 | drache | 0/2 | 0.7/0.7: 1/4 | 0.6/0.65: 3/4 | **0.65/0.7: 4/6** |
