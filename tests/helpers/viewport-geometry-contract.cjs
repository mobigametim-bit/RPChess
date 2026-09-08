const assert = require('assert');

const DEFAULT_TOLERANCE = 1;

function formatGeometry(value) {
  return JSON.stringify(value);
}

async function readPageGeometry(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      vw: innerWidth,
      vh: innerHeight,
      scrollX,
      scrollY,
      root: {
        clientWidth: root.clientWidth,
        clientHeight: root.clientHeight,
        scrollWidth: root.scrollWidth,
        scrollHeight: root.scrollHeight
      },
      body: body ? {
        clientWidth: body.clientWidth,
        clientHeight: body.clientHeight,
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight
      } : null
    };
  });
}

async function assertPageFitsViewport(page, label, { tolerance = DEFAULT_TOLERANCE } = {}) {
  const geometry = await readPageGeometry(page);
  const maxWidth = Math.max(geometry.root.scrollWidth, geometry.body?.scrollWidth || 0);
  const maxHeight = Math.max(geometry.root.scrollHeight, geometry.body?.scrollHeight || 0);
  assert(maxWidth <= geometry.vw + tolerance, `${label}: page-level horizontal overflow ${formatGeometry(geometry)}`);
  assert(maxHeight <= geometry.vh + tolerance, `${label}: page-level vertical overflow ${formatGeometry(geometry)}`);
  assert(Math.abs(geometry.scrollX) <= tolerance && Math.abs(geometry.scrollY) <= tolerance, `${label}: page was scrolled while proving one-screen geometry ${formatGeometry(geometry)}`);
  return geometry;
}

async function readElementGeometry(page, selector) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  return target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      vw: innerWidth,
      vh: innerHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight
    };
  });
}

async function assertViewportContained(page, selector, label, { tolerance = DEFAULT_TOLERANCE } = {}) {
  const geometry = await readElementGeometry(page, selector);
  assert(geometry.width > 0 && geometry.height > 0, `${label}: target has no rendered area ${formatGeometry(geometry)}`);
  assert(geometry.left >= -tolerance && geometry.right <= geometry.vw + tolerance, `${label}: target escapes viewport horizontally ${formatGeometry(geometry)}`);
  assert(geometry.top >= -tolerance && geometry.bottom <= geometry.vh + tolerance, `${label}: target escapes viewport vertically ${formatGeometry(geometry)}`);
  return geometry;
}

async function assertFrameContains(page, frameSelector, targetSelectors, label, { tolerance = DEFAULT_TOLERANCE } = {}) {
  const frame = page.locator(frameSelector).first();
  await frame.waitFor({ state: 'visible' });
  const targets = Array.isArray(targetSelectors) ? targetSelectors : [targetSelectors];
  const geometry = await frame.evaluate((element, args) => {
    const frameRect = element.getBoundingClientRect();
    const children = args.selectors.flatMap((selector) => [...element.querySelectorAll(selector)]).map((child) => {
      const rect = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      return {
        selectorHint: child.getAttribute('data-testid') || child.getAttribute('data-i18n') || child.className || child.tagName,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    }).filter((child) => child.visible);
    return {
      frame: { left: frameRect.left, right: frameRect.right, top: frameRect.top, bottom: frameRect.bottom },
      children
    };
  }, { selectors: targets });
  for (const child of geometry.children) {
    assert(child.left >= geometry.frame.left - tolerance && child.right <= geometry.frame.right + tolerance, `${label}: child escapes owning frame horizontally ${formatGeometry({ frame: geometry.frame, child })}`);
    assert(child.top >= geometry.frame.top - tolerance && child.bottom <= geometry.frame.bottom + tolerance, `${label}: child escapes owning frame vertically ${formatGeometry({ frame: geometry.frame, child })}`);
  }
  return geometry;
}

module.exports = {
  assertFrameContains,
  assertPageFitsViewport,
  assertViewportContained,
  readElementGeometry,
  readPageGeometry
};
