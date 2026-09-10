# VANES AI

VANES AI is a polished, browser-based study companion. It lets learners save study topics, generate a focused study plan, keep quick notes, and ask an in-app study coach for structured guidance.

## Run locally

No build step or dependencies are required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.

## Features

- Responsive study dashboard with progress, streak, and study-time insights.
- Topic cards that open a dedicated study workspace.
- Custom study-plan generator based on subject, goal, and available time.
- Notes area with automatic local browser storage.
- Deterministic study coach that gives clear explanations, practice prompts, and next steps.
- Light/dark theme toggle and mobile navigation.

All data is stored locally in the browser using `localStorage`; no account or API key is required.
