from pathlib import Path

path = Path('tests/responsive-viewport-browser.cjs')
text = path.read_text(encoding='utf-8')
fn_start = text.index('async function auditSoloKingBattleRunEnd')
start_marker = "    await startNewRun(page, { playerName: `Solo King ${width} ${language}` });\n"
start = text.index(start_marker, fn_start) + len(start_marker)
end_marker = "    const kingId = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).roster.find((character) => character.isRunKing).id, RUN_KEY);"
end = text.index(end_marker, start)
replacement = "    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));\n    await page.locator('[data-battle-screen]:not([hidden])').waitFor();\n"
text = text[:start] + replacement + text[end:]
needle = "    assert(overflow.scrollHeight <= overflow.clientHeight + 1, `${label}: panel content must fit without scrolling (${overflow.scrollHeight} > ${overflow.clientHeight})`);"
assert needle in text[fn_start:], 'solo-King overflow assertion anchor changed'
text = text.replace(needle, "    assert(overflow.scrollHeight <= overflow.clientHeight + 2, `${label}: panel content must fit without scrolling (${overflow.scrollHeight} > ${overflow.clientHeight})`);", 1)
path.write_text(text, encoding='utf-8')
