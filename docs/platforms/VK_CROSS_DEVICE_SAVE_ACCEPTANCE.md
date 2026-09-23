# VK cross-device save acceptance

Candidate branch: `feature/cloud-save-cross-device`. Canonical host remains GitHub Pages; sync is active only when RPChess is launched in VK under the same VK account. Direct GitHub Pages play stays local to the browser.

## Two-device check in the real app

1. Open the VK app on device A, continue an existing run and note the week, Gold, Supplies, Power and current encounter. Do not create a fresh run on an account with valuable progress just for this check.
2. Close the app on A. Open it under the **same VK account** on device B. Confirm those values and the encounter match without a version-choice dialog.
3. Make a move in a Caravan, Battle or Skirmish on B; wait briefly for the bridge write to finish. Close B and open A. Continue the run and compare the exact board position and move history.
4. Finish an encounter on A, claim a reward once, then open B. Verify the reward and resource changes are present exactly once.
5. On B while offline, make a legal move. Reconnect, reopen the app, and confirm the newer progress is uploaded and restored on A. Repeat after an interrupted StorageGet/StorageSet if the container offers a way to simulate one.
6. Start different runs on two disposable test devices with the same VK account; change one last and reopen the other. The latest saved copy should load without a chooser. Check both orders.
7. Repeat the route on VK Web and VK Android/iOS. Inspect the actual StorageGet/StorageSet responses and the maximum usable save size for App ID `54754579` before calling this feature accepted.

## Remaining platform limit

The automatic choice uses save timestamps; device clocks that are substantially wrong can affect which divergent offline save wins. VK Storage does not expose a compare-and-swap transaction, so simultaneous writes from two actively playing devices require real-container testing and may still race. Avoid parallel play on one account until that check passes.
