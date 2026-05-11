const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(projectRoot, 'chromium');
const targetDir = path.join(targetRoot, 'chrome-win');

function ensurePlaywrightChromium() {
  const executablePath = chromium.executablePath();

  if (!executablePath || !fs.existsSync(executablePath)) {
    throw new Error(
      'Playwright Chromium не найден. Выполните "playwright install chromium" перед сборкой.'
    );
  }

  return executablePath;
}

function copyBrowserBundle(sourceExecutablePath) {
  const sourceDir = path.dirname(sourceExecutablePath);

  fs.mkdirSync(targetRoot, { recursive: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function main() {
  const executablePath = ensurePlaywrightChromium();
  copyBrowserBundle(executablePath);
  console.log(`[prepare-chromium] Chromium copied to ${targetDir}`);
}

try {
  main();
} catch (error) {
  console.error('[prepare-chromium] Failed:', error.message);
  process.exit(1);
}
