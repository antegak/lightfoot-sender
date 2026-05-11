# /audit-project

Purpose: inspect project health before risky AI development.

Check:
- dead code;
- duplicated logic;
- giant files;
- missing logs;
- IPC problems;
- secrets crossing into renderer;
- silent catch blocks;
- parser/search behavior risks;
- build/release drift.

Output:
- findings by severity;
- files/lines when available;
- suggested safe next steps;
- confidence score;
- manual tests required.
