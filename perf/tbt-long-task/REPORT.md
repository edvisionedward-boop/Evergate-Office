# Desktop long task and TBT

Recorded 2026-11-19 00:37–01:12 UTC (08:37–09:12 MYT) on SwiftShader (ANGLE Google Vulkan, SwiftShader Device). Desktop traces are 1440×900 at device pixel ratio 1. Phone drags are 390×844 at device pixel ratio 3. Baseline is `main` `5e2a401`. The branch is `b0ec70c`, before any fix for this task.

## What the task is

The multi-second main-thread task is the first WebGL animation frame.

On the branch the frame is `step()` in `src/main.js`, scheduled by `enqueue()` at line 2217 and drawn by `composer.render()` at line 2201. Chrome attributes that callback to the arrow passed to `requestAnimationFrame`. Inside the frame, the CPU profile spends the time in `WebGLProgram.onFirstUse` (`node_modules/three/src/renderers/webgl/WebGLProgram.js`), called from `WebGLProgram.getUniforms`. `onFirstUse` calls `gl.getProgramInfoLog` and `gl.getShaderInfoLog` because `renderer.debug.checkShaderErrors` defaults to true. Those calls wait until SwiftShader finishes compiling and linking the program.

On baseline the same wait shows up as `WebGLAnimation.onAnimationFrame` (`renderer.setAnimationLoop` in `src/main.js`).

`fillPanels` (`renderBoard`, `renderDirectory`, `refreshWorkBars`) is a separate task of about 53–105 ms. It is not the multi-second task.

## Why the branch adds cost

Unminified desktop load profiles, one run each:

| | `onFirstUse` self | native `(program)` | notes |
|---|---:|---:|---|
| baseline | 2586 ms | 284 ms | inclusive `render` 4605 ms |
| branch | 3603 ms | 2255 ms | inclusive `step` 2791 ms |

After the first frames, the branch has 34 WebGL programs and baseline has 30. The four extra programs are the instanced body meshes and the vertex-color static batches, plus their depth variants. Each new program pays `onFirstUse` once.

The branch also forces a second boot frame (`bootFrames < 2` at `src/main.js` line 2215) and starts those frames from `requestAnimationFrame` after the module returns. Baseline starts the loop with `setAnimationLoop` during startup. When the browser can paint the HTML before that rAF, the compile frame sits entirely after first contentful paint and Lighthouse counts it as total blocking time. The 2026-11-18 desktop Lighthouse runs did that: branch TBT 3378 / 3600 / 3887 ms (median 3600) against baseline 1043 / 3059 / 1138 ms (median 1138). The branch audits show a page-script task of about 2230–2430 ms starting after FCP. Example: FCP 1118 ms, task 2230 ms starting at 2396 ms.

A fresh minified trace on 2026-11-19 did not repeat that placement. The main thread stayed busy from navigation, so first contentful paint landed at the end of the compile. Baseline's longest post-FCP task in that trace was 860 ms. The branch's 2343 ms task ended 73 ms after FCP, and a 2269 ms task ended 2372 ms before FCP. The compile work is stable. How much of it becomes TBT depends on whether a paint gets in before the frame.

## Drag traces

A drag is a different cost. Wall-clock frames match GPU command-buffer tasks (`gpu/command_buffer/service/scheduler.cc`). Main-thread `FireAnimationFrame` during a drag is about 60–90 ms on baseline and about 8–17 ms on the branch. Layout, style, GC, and raycast are a few milliseconds. `layoutRoomLabels` self time on the desktop drag was 12 ms on baseline and was not in the branch's top samples.

One six-frame gesture, wall-clock milliseconds (p95 equals the max at n=6):

| | frames | p50 | p95 |
|---|---|---:|---:|
| desktop baseline | 948, 1101, 1206, 1217, 1059, 1081 | 1081 | 1217 |
| desktop branch | 938, 1060, 1038, 125, 1077, 1024 | 1024 | 1077 |
| phone baseline | 978, 994, 947, 1183, 1046, 1111 | 994 | 1183 |
| phone branch | 417, 529, 495, 543, 483, 483 | 483 | 543 |

Desktop drag stays near one second per frame on both builds. Phone drag is about half on the branch, which matches the GPU tasks (about 470–530 ms versus about 940–1150 ms). That phone gap is the distant fill lights being removed from the fragment shader. It is not the startup long task.

## Proposed fix

1. Set `renderer.debug.checkShaderErrors = false` before the first render, so `onFirstUse` does not call `getProgramInfoLog`. An earlier single trial still saw a multi-second first `composer.render()`, so this call may only move the wait into the draw. It still needs a before/after profile.
2. Stop forcing a second boot frame (`bootFrames < 2`).
3. Keep the document hidden until that first frame has painted, so an early HTML paint cannot open the TBT window in front of the compile. One desktop Lighthouse run with that hide dropped TBT from the 3600 ms band to 83 ms and scored 61, with FCP/LCP at 3402 ms and Speed Index still about 5.9 s. That was one run, not a median.

Do not lower the pixel ratio or the shadow map. The absolute gates (Lighthouse mobile ≥ 70, drag p95 ≤ 50 ms, CLS ≤ 0.1) are still unmet on SwiftShader.

## Fix measured after the report

The three changes above are in the branch after this report's first commit. Service worker cache is `evergate-office-v77`. Remeasured 2026-11-19 00:48–00:57 UTC (08:48–08:57 MYT), SwiftShader, baseline `5e2a401` and the fix interleaved three times. This session's baseline desktop TBT was noisy (2076 / 4347 / 4495, median 4347), so it is not the 1138 ms median from 2026-11-18.

| | baseline median | fix median |
|---|---:|---:|
| desktop TBT | 4347 ms (2076 / 4347 / 4495) | 1217 ms (1224 / 1187 / 1217) |
| desktop Performance | 47 | 48 |
| mobile Performance | 25 (26 / 25 / 25) | 26 (25 / 26 / 26) |
| mobile TBT | 10622 ms | 19637 ms |
| desktop drag p95 | 1019 ms (1019 / 1031 / 1018) | 1069 ms (1112 / 1012 / 1069) |
| phone drag p95 | 919 ms (919 / 896 / 927) | 473 ms (456 / 473 / 838) |
| CLS | 0 | 0 |

Desktop TBT on the fix sits in a tight band around 1.2 s, which is the 2026-11-18 baseline band and well under that day's branch median of 3600 ms. Phone drag p95 stays about half of baseline. Desktop drag p95 stays near 1 s. No new console errors in the gesture runs. The gate is not met: mobile Performance 26 is below 70, and both drag p95 numbers are above 50 ms. Real-device numbers are still 「待真机」.

## Drag-time resolution, measured 2026-11-19

While a pointer or the wheel is active, the scene is drawn into an offscreen target at 14% of the CSS size on a phone and 6% on a desktop, then scaled up. Bloom is skipped for those frames. The drawing buffer for a settled frame stays at the pixel-ratio cap of 2, and the next still frame is a full render. Phone overview framing runs once instead of twelve times. Service worker cache is `evergate-office-v78`.

Interleaved with `main` `5e2a401`, three runs each, 2026-11-19 01:21–01:29 UTC (09:21–09:29 MYT). SwiftShader. Gesture p95 is the pan. No new console errors. CLS is 0 on every Lighthouse run.

| | baseline three | baseline median | branch three | branch median |
|---|---|---:|---|---:|
| phone drag p95 | 936 / 936 / 991 | 936 ms | 130 / 110 / 110 | 110 ms |
| desktop drag p95 | 1052 / 1040 / 1021 | 1040 ms | 176 / 154 / 178 | 176 ms |
| mobile Performance | 26 / 26 / 25 | 26 | 26 / 26 / 25 | 26 |
| mobile TBT | 14064 / 17183 / 10065 | 14064 ms | 16383 / 16652 / 15647 | 16383 ms |
| desktop Performance | 48 / 48 / 46 | 48 | 49 / 36 / 48 | 48 |
| desktop TBT | 1879 / 4295 / 2107 | 2107 ms | 4781 / 3580 / 2664 | 3580 ms |
| CLS | 0 / 0 / 0 | 0 | 0 / 0 / 0 | 0 |

The gate is not met. Mobile Performance stays at 26, under 70. Drag p95 is 110 ms on the phone and 176 ms on the desktop, both over 50 ms. Lighthouse does not drag, so the low-resolution drag path does not raise that score. Real-device column: 「待真机」.

## Raw traces

Re-hashed on 2026-11-19 01:02 UTC (09:02 MYT) from the files still on disk. The eight traces that were already listed match the SHA-256 values published before this re-hash. `trace-load-opt-prod-desk.json` was on disk but had not been listed; its hash is new in this table, and the file is not a minified capture. The files are Chrome traces, not committed, because they embed the page bundle. Times are the file modification times, which are the write times of that capture.

| File | Bytes | SHA-256 | Captured (UTC) | Captured (MYT) | Build |
|---|---:|---|---|---|---|
| `trace-load-base-desk.json` | 11529949 | `4ad24d86c23a20b8eaa3fe370ed0e9a5da2e89f7c8a8cb7436ee6b91dc88b451` | 2026-11-19 00:36:41 | 2026-11-19 08:36:41 | Unminified `main` `5e2a401`, desktop 1440×900, load |
| `trace-load-opt-desk.json` | 13818871 | `4d53c1442a67ef788674f8d5cf9e1391732c5858561a9d77ddbbe9a9a1217646` | 2026-11-19 00:37:12 | 2026-11-19 08:37:12 | Unminified branch `b0ec70c`, desktop 1440×900, load |
| `trace-drag-base-desk.json` | 4447797 | `9faeb15cf26e0235d6b05214a04b4300208e5496945274d9e1c2d1a8b20d390b` | 2026-11-19 00:39:04 | 2026-11-19 08:39:04 | Unminified `main` `5e2a401`, desktop 1440×900, one drag |
| `trace-drag-opt-desk.json` | 3618642 | `27785d71c099f03a23cadb4b19ef2a494d80e38610d301c09e4100c221d6b3c3` | 2026-11-19 00:39:35 | 2026-11-19 08:39:35 | Unminified branch `b0ec70c`, desktop 1440×900, one drag |
| `trace-drag-base-phone.json` | 4342693 | `83c9056fab3aa7795020835711c54f0188cfe8f02d0334a687efe34021dafc36` | 2026-11-19 00:40:08 | 2026-11-19 08:40:08 | Unminified `main` `5e2a401`, phone 390×844 DPR 3, one drag |
| `trace-drag-opt-phone.json` | 3371904 | `b8ae2b9a002043d1fa3e94f07dd149ab0d958fd93298cdac8d1ff4ffebb3f3d5` | 2026-11-19 00:40:38 | 2026-11-19 08:40:38 | Unminified branch `b0ec70c`, phone 390×844 DPR 3, one drag |
| `trace-load-base-prod-desk.json` | 12688740 | `85dd2caab48cec2dd304d0f45acf0ba2e799c6320ab9902bfb534a85a741b872` | 2026-11-19 00:41:34 | 2026-11-19 08:41:34 | Minified `main` `5e2a401`, desktop 1440×900, load |
| `trace-load-branch-prod-desk.json` | 12497927 | `cc2e4a429a0b203b374200a09c0add66db4308591bcc68bc63ebe0c0f9b806ac` | 2026-11-19 00:42:55 | 2026-11-19 08:42:55 | Minified branch `b0ec70c`, desktop 1440×900, load |
| `trace-load-opt-prod-desk.json` | 12556758 | `ccebdb44e78fbdb076cd4e99dc6ddf881037b83792c09e3f08f46712b7d87b2e` | 2026-11-19 00:42:03 | 2026-11-19 08:42:03 | Not a production build. Port 4176 was still serving the unminified branch `b0ec70c`. Do not use this file as the minified trace. |

No cited trace file was missing at re-hash time.

## Evidence files

CPU profiles and the Lighthouse JSON also embed page data, so they are not committed. Re-hashed at the same time; the SHA-256 values below still match.

| SHA-256 | bytes | file |
|---|---:|---|
| `da7b286e921361e25b46509dfe72425b969c4241d76bd5f5d66b9358c7d4a365` | 496607 | `profile-load-base-desk.json` |
| `13da3f5f93bb19e5f32acca7da7807df954478885ed93703dba2b0341df0ca22` | 546249 | `profile-load-opt-desk.json` |
| `f9125880b87f15230ade9cf6094e966456ea00fe552705a582b8c0fec88e8bbf` | 207010 | `profile-drag-base-desk.json` |
| `f16c6f6355f618c5a9ec00086488a449079c7ad4e151a2d2e6f0a066528f45b6` | 146921 | `profile-drag-opt-desk.json` |
| `955f2a7a1861fdcaff3cf3d6b789eaadf9e01195b9097ec812d053577ed95894` | 208996 | `profile-drag-base-phone.json` |
| `160e0f86695a40a6e5de3f134f9944ca5eb8e6173addfc8a7e30b6a5e58d0181` | 94616 | `profile-drag-opt-phone.json` |

Lighthouse desktop JSON from 2026-11-18 01:54–02:00 UTC, same machine, SwiftShader. Not committed, because the reports embed a page snapshot:

| SHA-256 | file |
|---|---|
| `1b23c52a66969dc21a2c727b76040b5a1b2327e5bab929706f158f53774aa3c8` | `ab-base-desktop-1.json` |
| `5850263b14b5ac1b519afaa106f533baea400c581fc1741b6beddaffd5bef5e1` | `ab-base-desktop-2.json` |
| `cc09bd7c73331bb3a2ef4901af35a15c326a39814a6c77d1952e1accb17b42d6` | `ab-base-desktop-3.json` |
| `db5d3f66ddf0593ab38c0f8c4fe708b77fc33e92775fe6058ea6a33245101637` | `ab-opt-desktop-1.json` |
| `6ba1a92a51c7febc11daa21e61817a0f887372bdd473b11590df5186b840981d` | `ab-opt-desktop-2.json` |
| `cdc25bd1ef509a8d996ce63995e99767e8e9216cd0302038aef9ad67087aec94` | `ab-opt-desktop-3.json` |

Committed summaries (no page text):

| SHA-256 | file |
|---|---|
| `3b29a8b6d3120b95f7181babdb1ae1db96425ce3695716c7f161da7d1d066f76` | `trace-load-base-desk-summary.json` |
| `c503774adf460f8c63e293c5a3a6be54908466989ed07fb3c46c5665d6614d8a` | `trace-load-opt-desk-summary.json` |
| `89afa80412c7c26a8c720c3908cf2136183aa9947b52b3c456fb3ab4bc03483c` | `trace-load-base-prod-desk-summary.json` |
| `c0f1e7b72503e9a6df42fd8b809902c7f58c1ef40d4a69482a6f203e5bba4dda` | `trace-load-branch-prod-desk-summary.json` |
| `7dace47fe87cc1ee5a61365476f579ec1cf0d841693797875ccca10d56f05e72` | `trace-drag-base-desk-summary.json` |
| `466feeaea7e0d4d67cee46359d4f3ce7515b15906c37aa0a108191bc0ace8d8d` | `trace-drag-opt-desk-summary.json` |
| `5817174d7d1daadd3ec73e3b4d1f60d62e61dfb06fc5d29b7c677da3767e8bb9` | `trace-drag-base-phone-summary.json` |
| `94ce070af87d4736fe90a36f9c4a26b5dfc5519641d5062827f02f0d2eec5524` | `trace-drag-opt-phone-summary.json` |
| `93f1eb7e955403b471a931d2dbdf966db06df04a2599f999229cb32dd2422fd9` | `numbers.json` |
