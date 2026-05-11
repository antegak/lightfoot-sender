const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const DIST_DIR_PATTERN = /^dist(?:$|[\s._-].*)/i;

function isSafeProjectChild(targetPath) {
  const relativePath = path.relative(projectRoot, targetPath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function removeLegacyDistDirs() {
  const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !DIST_DIR_PATTERN.test(entry.name)) continue;

    const targetPath = path.join(projectRoot, entry.name);
    if (!isSafeProjectChild(targetPath)) continue;

    fs.rmSync(targetPath, { recursive: true, force: true });
    removed.push(entry.name);
  }

  return removed;
}

try {
  const removed = removeLegacyDistDirs();
  console.log(
    removed.length
      ? `[clean-build] Removed old build folders: ${removed.join(', ')}`
      : '[clean-build] No old build folders found'
  );
} catch (error) {
  console.error('[clean-build] Failed:', error.message);
  process.exit(1);
}
