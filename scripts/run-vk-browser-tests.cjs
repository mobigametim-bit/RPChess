process.env.RPCHESS_GATE_DIST = 'dist-vk';
process.env.RPCHESS_BROWSER_TEST = process.env.RPCHESS_BROWSER_TEST || 'vk-platform-browser.cjs,reboot-foundation-browser.cjs,classic-chess-browser.cjs';
require('./run-browser-tests.cjs');
