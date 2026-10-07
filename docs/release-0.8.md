# SchoolWork 0.8.1

Desktop actions now use an explicit prepare → observe → act → observe workflow. `prepare_desktop` resolves the requested window's active owned dialog, attempts focus once and returns a fresh screenshot with its window identity and focused control. An action on this prepared view returns the next screenshot automatically, avoiding a separate model request just to capture the screen. The native helper allows a short bounded settling period for dialogs to open.

File pickers are separate windows. Only visible owned windows in the same process are selected automatically; unrelated applications are never silently adopted. A closed dialog can return to its surviving owner. Input checks still validate application identity, geometry, focus and occlusion. Prepared text input checks that the observed focused control has not changed. Password controls are excluded.

Observation failures distinguish unknown, expired, consumed, superseded, wrong-task and unfocused states. The earlier generic “expired” message for an unfocused capture is fixed. Failure tracking distinguishes focus from occlusion rather than combining them into one repeated-click failure. After a successful input with a failed follow-up capture, the result explicitly says that input was sent and must not be repeated.

The design follows the computer-use skill's fresh-observation, single-action and immediate-refresh workflow. This is SchoolWork's own Windows implementation, not the GPT-6 Astra model or OpenAI's computer-use runtime. It still uses visible screen capture and therefore does not claim occluded-window capture support.

## Updates

The update error in 0.8.0 was reproduced against the public GitHub feed: its latest published release was still 0.7.0, which lacked `latest.yml`. That server-side missing-file error was incorrectly shown as an internet connection problem. Version 0.8.1 distinguishes release configuration errors from network/rate-limit/download failures, records diagnostic details locally, and keeps automatic background failures out of the chat banner. Manual checks show the error and offer a GitHub download. The release includes its installer, blockmap and validated update manifest together.

Installed Windows builds check GitHub at startup and every six hours. A banner offers **Update now**, shows download progress, then offers **Restart and install**. Downloads and restart require the user's button actions. Quitting normally does not silently install. Restart is blocked while agent tasks are active. Settings also offers **Check for updates**; network failures can be retried. Portable/development builds link to GitHub downloads.

Updates use electron-updater's GitHub/NSIS support with the published `latest.yml`, SHA-512 validation and installer blockmap. Packages remain unsigned. Version 0.7.0 has no updater, so install 0.8.1 manually once; existing 0.8.0 installations can discover 0.8.1 once its complete release is public.

## Verification

Focused regression tests cover observation errors, dialog handoff, non-replay after a capture failure, failure classification and updater lifecycle (including offline/download errors and active-task restart blocking). A real Windows disposable fixture exercised parent window → Open File dialog → filename input → file selected. Build and automated tests passed. Live model quality and Gmail sending are not established by this test; no email was sent. End-to-end replacement of the user's running installation was not performed.
