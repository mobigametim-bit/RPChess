process.env.RPCHESS_GATE_DIST = 'dist-vk';
delete process.env.RPCHESS_BROWSER_TEST;
require('./run-browser-tests.cjs');
