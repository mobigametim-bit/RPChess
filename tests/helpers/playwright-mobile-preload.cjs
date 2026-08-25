'use strict';

const { chromium } = require('playwright');
const originalLaunch = chromium.launch.bind(chromium);
const MOBILE_VIEWPORT = Object.freeze({ width:390, height:844 });

const MOBILE_BOARD_VISIBILITY_SCRIPT = () => {
  const ensureBoardVisible = () => {
    const board = document.querySelector('[data-board]');
    if (!board || !board.getClientRects().length) return;
    const rect = board.getBoundingClientRect();
    const margin = 16;
    if (rect.top >= margin && rect.bottom <= innerHeight - margin) return;
    const available = Math.max(1, innerHeight - margin * 2);
    const visibleHeight = Math.min(rect.height, available);
    const desiredTop = margin + (available - visibleHeight) / 2;
    scrollBy({ top:rect.top - desiredTop, left:0, behavior:'auto' });
  };

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(ensureBoardVisible));
  addEventListener('load', schedule, { once:true });
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class']
  });
};

chromium.launch = async function launchWithMobileAcceptance(options = {}) {
  const browser = await originalLaunch(options);
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async function mobileContext(contextOptions = {}) {
    const context = await originalNewContext({ ...contextOptions, viewport:MOBILE_VIEWPORT });
    await context.addInitScript(MOBILE_BOARD_VISIBILITY_SCRIPT);
    return context;
  };
  const originalNewPage = browser.newPage?.bind(browser);
  if (originalNewPage) {
    browser.newPage = async function mobilePage(pageOptions = {}) {
      const page = await originalNewPage({ ...pageOptions, viewport:MOBILE_VIEWPORT });
      await page.addInitScript(MOBILE_BOARD_VISIBILITY_SCRIPT);
      return page;
    };
  }
  return browser;
};

console.log('[mobile-preload] forcing Playwright viewport 390x844 and keeping the active board visible');
