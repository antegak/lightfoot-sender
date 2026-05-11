# WhatsApp Feature

Source file: `whatsapp.js`; UI controls in `renderer/`.

## Playwright

WhatsApp automation uses Playwright Chromium. The app opens WhatsApp Web and controls browser interactions for collection and sending.

## Collection

Contact collection scans WhatsApp chats according to manager-selected options and returns contacts to renderer state.

Important behaviors:
- progress updates;
- collection limits;
- session state awareness;
- safe handling of unavailable WhatsApp UI elements.

## Dedupe

Dedupe prevents repeated contacts from being messaged multiple times. Changes to dedupe logic can affect campaigns and must be manually tested.

## Sending

Sending opens WhatsApp Web send URLs or UI flows, applies message text, respects delay settings, and reports progress.

Safety rules:
- never send without explicit manager action;
- preserve progress/error reporting;
- avoid silent skipped contacts;
- keep sending delays understandable.

## Sessions

WhatsApp Web session should persist so QR is usually scanned once. Session reset/change behavior should be documented before edits.

## Progress

Progress updates are part of user trust. Do not remove progress events or collapse errors into generic failures.
