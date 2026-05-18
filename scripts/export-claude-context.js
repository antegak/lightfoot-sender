const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'claude-context');

const BLOCKED_NAMES = new Set([
  'node_modules',
  'chromium',
  'dist',
  'build',
  'logs',
  'temp',
  '.cache',
  'renderer',
  'assets',
]);

const TOP_LEVEL_DOCS = {
  'README.md': `# Claude Context Export

This folder is a local, portable context pack for manually loading LightFoot Sender project files into Claude.

It is not a Claude integration. There is no API, sync, watcher, webhook, background service, or auto-upload.

## How To Update

Run from the project root:

\`\`\`bash
npm run export:claude
\`\`\`

The script deletes the old \`claude-context/\` folder and recreates it from current project files.

## What Is Included

- \`knowledge/\`: core, features, specs, tasks, and snapshots.
- \`fixtures/\`: QA and conversation regression fixtures.
- \`services/\`: AI-related services only.
- \`runtime/\`: selected runtime files needed to understand orchestration and BILLZ context.
- Top-level onboarding docs for Claude: bootstrap, summary, system map, current focus, and failure examples.

## What Is Excluded

The export never copies heavy or unrelated folders such as \`node_modules/\`, \`chromium/\`, \`dist/\`, \`build/\`, \`logs/\`, \`temp/\`, \`.cache/\`, \`renderer/\`, or \`assets/\`.
`,

  'CLAUDE_BOOTSTRAP.md': `# Claude Bootstrap For LightFoot Sender

LightFoot Sender is a Windows Electron app for LightFoot managers. It supports WhatsApp workflows, BILLZ product data, product search, and an AI Manager sandbox for creating product-aware customer replies.

## Current Project Direction

The AI is now an AI store consultant for LightFoot, not a therapist, AI friend, generic chatbot, or life coach.

Target behavior:
- calm, practical, and product-aware;
- knows barefoot footwear, comfort, use cases, brands, models, sizes, and store addresses;
- uses BILLZ data for concrete product facts;
- recommends and explains like a good shoe-store consultant;
- stays short, readable, and conversational.

## AI Architecture

The current principle is:

\`\`\`text
logic engine decides WHAT to do
LLM decides HOW to say it
\`\`\`

The LLM must not decide business flow, product search, intent priority, availability, prices, branch stock, or medical claims. It may only help with natural wording.

## Core Flow

\`\`\`text
user message
-> parser
-> memory
-> conversation state
-> anchoredConversationSubject
-> orchestration responsePlan
-> optional BILLZ/search
-> product media resolver when gallery is requested
-> deterministic humanizer
-> final response
\`\`\`

## BILLZ

BILLZ integration provides product data, auth/token handling, cache, local search context, and diagnostics. Concrete product facts must come from BILLZ/cache/search, not from the LLM.

## Product Media

Product gallery support is local architecture only. It resolves real photos from product fields or \`config/product-media.json\`. Do not generate AI product images.

## Do Not Break

- BILLZ auth, token cache, product cache, search, and diagnostics.
- WhatsApp Playwright sessions, collection, dedupe, sending, and progress.
- Electron main/preload/renderer IPC boundaries.
- Updater/build configuration.
- Existing QA runner and fixtures.
- Deterministic humanizer safety: no raw SKU/barcode/stock leaks.
- No autonomous WhatsApp replies and no auto-send behavior.
`,

  'PROJECT_SUMMARY.md': `# Project Summary

LightFoot Sender is an Electron desktop application for LightFoot managers. It combines WhatsApp contact/message workflows with BILLZ product context and an AI Manager sandbox.

## Main Systems

- Electron shell: \`main.js\`, \`preload.js\`, and renderer UI.
- WhatsApp automation: Playwright-based contact collection and controlled sending.
- BILLZ: auth, product loading, cache, diagnostics, and product search.
- Parser/search: extracts customer/product attributes and finds relevant products.
- Memory/conversation: keeps short-term context and separates adult/child/family profiles.
- Orchestration: deterministic response plans for mode, search, clarification, safety, and recommendation.
- Humanizer: final customer-facing wording, product formatting, and safety filters.
- Product media: real product photo/gallery architecture.

## Conversational AI Flow

\`\`\`text
message -> parse -> memory -> conversation state -> responsePlan -> optional search -> humanizer -> response
\`\`\`

The response plan is the source of truth. The LLM is draft/naturalization only.

## Current Goals

- Make the AI feel like a smart LightFoot store consultant.
- Keep active subject stable across follow-ups.
- Reduce clarification loops and repetitive summaries.
- Search only when concrete product facts or galleries are needed.
- Support real product photo galleries without AI-generated images.

## Current Problems

- Some business rules are duplicated across parser, search, humanizer, prompt, and orchestration.
- \`main.js\` still mixes Electron IPC, AI orchestration, memory, BILLZ context, and response formatting.
- Product media needs real source mapping from BILLZ image fields or \`config/product-media.json\`.
- More fixtures are needed as real conversations reveal regressions.
`,

  'AI_SYSTEM_MAP.md': `# AI System Map

\`\`\`text
user message
-> parser
-> memory
-> conversation state
-> anchoredConversationSubject
-> orchestration
-> responsePlan
-> search / BILLZ context when allowed
-> product media resolver when gallery mode is active
-> humanizer
-> final response
\`\`\`

## Parser

Files: \`intent-detector.js\`, \`product-parser.js\`, \`services/search/query-normalizer.js\`.

Extracts intent, brand, color, material, size, foot length, customer type, age, SKU/barcode, and gallery/photo intent.

## Memory

Files: \`services/memory/\`.

Stores short-term turns and extracted entities. Memory helps continuity, but fresh user input wins.

## Conversation State

Files: \`services/conversation/\`.

Tracks adult, child, teen, and family context; current focus; stage; next best action; repetition; and \`anchoredConversationSubject\`.

## Orchestration

Files: \`services/orchestration/\`.

Deterministic logic chooses intent priority, response mode, search permission, clarification, recommendation confidence, safety flags, and allowed/forbidden topics.

## BILLZ And Search

Files: \`billz-client.js\`, \`product-index.js\`, \`services/search/\`.

Used only when concrete availability, exact product facts, size/color/model checks, or gallery/product-showcase requests need product data.

## Product Media

Files: \`services/product-media/\`, \`config/product-media.json\`.

Builds gallery payloads from real product media. It does not generate images and does not upload anywhere.

## Humanizer

Files: \`services/humanizer/\`.

Owns final customer-facing text. It keeps replies short, readable, product-aware, and safe. It must not expose raw SKU, barcode, stock, branch-specific inventory, JSON, or API fields.

## LLM

The LLM is a wording/reasoning layer only. It must not override \`responsePlan\`, product facts, search decisions, safety, or business logic.
`,

  'CURRENT_FOCUS.md': `# Current Focus

## Direction

LightFoot AI is being tuned into a calm, smart, product-aware store consultant.

It should:
- understand footwear and barefoot use cases;
- recommend brands/models/directions confidently;
- hold active subject across follow-ups;
- use BILLZ/search only when product facts are needed;
- show real product photos when available;
- avoid generic chatbot, therapy, life-coach, or overly emotional behavior.

## Active Conversational Issues

- Active subject loss between adult and child contexts.
- Repeated summary loops after the AI already knows enough.
- Endless clarification instead of moving to recommendation.
- Premature product search on health/comfort discovery.
- Recommendation hesitation after size/use case/brand/profile are known.
- Product gallery/photo requests need real media mapping.

## Latest Architectural Changes

- \`anchoredConversationSubject\` added with confidence and turn expiry.
- \`product_gallery\` response mode added.
- \`services/product-media\` added for real product photo resolution.
- Debug now exposes anchored subject, subject confidence, response mode, gallery intent, media found, selected products, and recommendation reason.
- Persona/prompt direction simplified toward store consultant behavior.
`,

  'FAILURE_EXAMPLES.md': `# Failure Examples And Expected Behavior

## Repeated Summary Loop

Failure:
- Customer gives size/use case.
- AI repeats the same summary and asks "show options?" again.

Expected:
- Treat known size/use case as commitment.
- Move to recommendation, comparison, or product/gallery flow.

## Active Subject Loss

Failure:
- Conversation discusses adult shoes.
- Customer says "покажи be lenka".
- AI answers for the child.

Expected:
- Use \`anchoredConversationSubject\`.
- Keep adult context unless the customer explicitly switches to child.

## Child/Adult Switching

Failure:
- Family conversation contains both adult and child facts.
- Follow-up "какие?" or "эти?" randomly uses the wrong profile.

Expected:
- Follow-ups inherit the anchored subject.
- Explicit "ребенку", "сыну", "дочке" switches to child.
- Explicit "для себя", "мне" switches to adult.

## Endless Clarification

Failure:
- AI keeps asking for size, color, or foot length even when enough context exists.

Expected:
- Ask at most one useful question only when critical.
- If profile, size, brand, or use case is known, recommend or show options.

## Premature Search

Failure:
- Customer says "вросшие ногти" or "широкая стопа".
- AI immediately dumps products and prices.

Expected:
- Use comfort guidance first.
- Explain toe-box, pressure, and barefoot comfort softly.
- Avoid medical promises and product spam until concrete options are requested.

## Recommendation Hesitation

Failure:
- Customer says "мне на каждый день, 39, хочу be lenka".
- AI returns to discovery or asks generic questions.

Expected:
- Search/check product context if needed.
- Continue with recommendation or product showcase.

## Photo Request

Failure:
- Customer asks "можешь отправить фото?"
- AI talks about products but does not start gallery flow.

Expected:
- Set intent/mode to \`product_gallery\`.
- Use real product media from BILLZ fields or \`config/product-media.json\`.
- If media is missing, say that photo links are not attached yet and keep selected product context.
`,
};

const COPY_DIRS = [
  ['knowledge/core', 'knowledge/core'],
  ['knowledge/features', 'knowledge/features'],
  ['knowledge/specs', 'knowledge/specs'],
  ['knowledge/tasks', 'knowledge/tasks'],
  ['knowledge/snapshots', 'knowledge/snapshots'],
  ['fixtures', 'fixtures'],
  ['services/conversation', 'services/conversation'],
  ['services/orchestration', 'services/orchestration'],
  ['services/humanizer', 'services/humanizer'],
  ['services/search', 'services/search'],
  ['services/memory', 'services/memory'],
  ['services/product-media', 'services/product-media'],
  ['services/qa', 'services/qa'],
];

const RUNTIME_FILES = [
  'main.js',
  'billz-client.js',
  'knowledge-base.js',
  'package.json',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isBlocked(name) {
  return BLOCKED_NAMES.has(name);
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) return false;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (isBlocked(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) copyFile(from, to);
  }
  return true;
}

function writeDoc(name, content) {
  fs.writeFileSync(path.join(OUT, name), content.trimStart(), 'utf8');
}

function recreateRoot() {
  fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);
  for (const dir of ['knowledge', 'fixtures', 'services', 'runtime']) {
    ensureDir(path.join(OUT, dir));
  }
}

function exportContext() {
  recreateRoot();

  for (const [name, content] of Object.entries(TOP_LEVEL_DOCS)) {
    writeDoc(name, content);
  }

  const copiedDirs = [];
  const skippedDirs = [];
  for (const [sourceRel, targetRel] of COPY_DIRS) {
    const ok = copyDir(path.join(ROOT, sourceRel), path.join(OUT, targetRel));
    (ok ? copiedDirs : skippedDirs).push(sourceRel);
  }

  const copiedFiles = [];
  const skippedFiles = [];
  for (const fileRel of RUNTIME_FILES) {
    const src = path.join(ROOT, fileRel);
    if (fs.existsSync(src) && fs.statSync(src).isFile()) {
      copyFile(src, path.join(OUT, 'runtime', path.basename(fileRel)));
      copiedFiles.push(fileRel);
    } else {
      skippedFiles.push(fileRel);
    }
  }

  const summary = {
    out: path.relative(ROOT, OUT),
    copiedDirs,
    skippedDirs,
    copiedFiles,
    skippedFiles,
  };
  console.log(JSON.stringify(summary, null, 2));
}

exportContext();
