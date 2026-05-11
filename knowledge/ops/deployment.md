# Deployment

LightFoot Sender builds a Windows installer through Electron Builder.

## Build Commands

```bash
npm install
npm run build
```

`npm run build` currently runs:

```text
npm run clean:build
npm run install:chromium
npm run prepare:chromium
electron-builder
```

## electron-builder

Configuration lives in `package.json`.

Current release shape:
- app id: `com.lightfoot.sender`;
- product name: `LightFoot Sender`;
- output directory: `dist`;
- Windows target: NSIS;
- installer artifact: `LightFoot-Sender-Setup-${version}.exe`;
- icon: `assets/icon.ico`;
- Playwright Chromium copied as extra resource;
- app packaged with `asar`;
- Playwright modules unpacked for runtime compatibility.

## Installer

NSIS settings currently create desktop/start menu shortcuts and run app after install. The installer is one-click and per-user.

## Versioning

Version is stored in `package.json`. Changelog entries should use the same version family.

Before release:
- update `CHANGELOG.md`;
- create snapshot with stable systems and rollback notes;
- run build;
- manually launch installer or unpacked app;
- verify WhatsApp, BILLZ status UI, and AI Manager basics.
