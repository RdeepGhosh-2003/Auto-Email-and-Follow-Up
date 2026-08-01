# Changelog

All notable changes to **AutoApply AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-08-01

### 🚀 Added
- **Multi-Stage Drip Campaign Engine**:
  - Full support for multi-step AI-generated email outreach sequences (`maxAttempts`, default 4; `daysGap`, default 3).
  - Sequence tone progression across attempts:
    - Attempt 1: Gentle bump / polite application check-in.
    - Attempt 2: Value-add (sharing specific project/skill achievements mapping to JD).
    - Attempt 3: Brief inquiry regarding team timelines and roadmap.
    - Attempt 4 (Final): Polite wrap-up / closing the loop graciously.
- **Local Catch-Up Background Worker**:
  - Immediate execution on server bootup to process past-due follow-ups when terminal/app was offline.
  - Periodic background interval (60s ticker loop) checking for due scheduled emails.
  - Automatic sequence advancement: increments `currentAttempt`, calculates `next_date = NOW() + daysGap days`, and updates status to `Sent` upon sequence completion.
- **Enhanced AI Generation Engine (Structured JSON & Sanitization)**:
  - Gemini 2.5 structured JSON prompt: `{"subject": "...", "body": "...", "follow_ups": ["...", "..."]}`.
  - Injected `maxAttempts` parameter into prompt to dynamically match user sequence configuration.
  - `_sanitize_llm_output` mapped over all generated follow-up drafts to strip rogue sign-offs and soft line wraps.
- **Multi-Draft Editor Sub-Tabs**:
  - Interactive UI sub-pills (`Draft 1`, `Draft 2`, `Draft 3`, `Draft 4`) in generator preview pane allowing review and editing of each unique follow-up draft prior to dispatch.
- **Unified Outreach Log & Filter Tabs**:
  - Expanded dashboard navigation with state filters: `All`, `Sent`, `Scheduled`, `Cancelled`.
  - Dynamic sequence progress badges: `⏳ Scheduled (Attempt X of Y)`.
  - Manual override controls: `⚡ Send Now` (immediate step dispatch) and `Cancel` (stop sequence).
- **Multi-Line Custom Prompt Textarea**:
  - Upgraded "Custom Instructions" input to a multi-line `<textarea>` (`rows={3}`).
  - High-priority prompt injection ensuring strict LLM adherence to user formatting/phrasing directives.
- **Dual-Backend Support**:
  - Full feature parity between Python FastAPI ([`app.py`](file:///c:/Users/KIIT/OneDrive/Documents/Automate%20Jobs/gemini-20260731T153359Z-1-001/.gemini/antigravity/scratch/job-email-automation/app.py)) and Node.js Express ([`server.js`](file:///c:/Users/KIIT/OneDrive/Documents/Automate%20Jobs/gemini-20260731T153359Z-1-001/.gemini/antigravity/scratch/job-email-automation/server.js)).

### 🛡️ Security & Privacy
- Zero cloud storage of credentials; all user SMTP settings and API keys stay local in `data/settings.json`.
- Automatic `.gitignore` rules shielding private settings and PDF uploads from source control.

---

## [1.3.0] - 2026-07-31

### Added
- Dedicated **LinkedIn Profile URL** & **GitHub Profile URL** configuration fields.
- Automatic HTML MIME multipart email builder adding clean, un-underlined social links (`LinkedIn | GitHub`) to email signatures.
- Double sign-off protection: AI system prompt forbidding signatures, paired with regex-based sign-off cleaning fallback.

---

## [1.2.0] - 2026-07-31

### Added
- Portable Windows 1-Click launcher (`run.bat`).
- Automated virtual environment initialization (`.venv`).
- Standardized `requirements.txt` for Python dependencies.

---

## [1.1.0] - 2026-07-31

### Changed
- UI overhaul featuring Glassmorphic dark design tokens (`#0f172a`, `#1e293b`, `#38bdf8`, `#34d399`).
- Dual-pane layout: Input panel on left, live Email Preview & ATS Breakdown on right.
- Dynamic radial score indicator for ATS skill alignment.

---

## [1.0.0] - 2026-07-30

### Added
- Initial release.
- PDF resume parser (`pypdf` / `pdf-parse`).
- Gemini API integration with Smart Fallback Synthesizer.
- SMTPLib email dispatch with PDF resume attachments.
- Application history logger (`data/history.json`).
