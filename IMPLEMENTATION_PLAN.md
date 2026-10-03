# Implementation Plan - Job Application Cold Email Automation System (Auto Email and Follow-Up)

Build a full-stack, local web application that allows users to upload/manage resume PDFs, paste a target Job Description (or job link), calculate ATS Match Score & Keyword Gaps, generate AI-tailored cover emails, live preview & edit drafts in-app, and dispatch emails with attachments via SMTP directly to the target recipient.

## Features Included

1. **ATS Resume Match Score & Skill Gap Analysis**: Displays visual match percentage and breakdown of matching vs. missing keywords between your resume and the JD.
2. **Resume Profile Presets**: Store multiple resumes (e.g., "Fullstack Developer Resume", "Backend Resume") and switch with one click.
3. **Smart Tone & Custom Prompt Modifiers**: Choose from *Professional*, *Direct/Short*, *Enthusiastic*, *Executive*, or add custom prompt instructions (e.g. "Highlight my 5 years in AWS").
4. **In-App Live Email Preview**: Interactive visual email preview showing exact headers (From, To, Subject, Attachment Badge) and rich formatted body right inside the UI.
5. **Direct SMTP Delivery with HTML Social Signature Links**: Send email + attached resume directly to the recipient from your email account using standard SMTP (e.g., Gmail App Password). Automatically builds dual Plain Text + HTML MIME payloads containing clickable `<a href="...">LinkedIn</a> | <a href="...">GitHub</a>` links.
6. **Follow-Up Email Generator & Tracker**: Automatically generate a 5-day follow-up email draft and mark follow-up dates in sent application history.

---

## Technical Stack & Architecture

- **Backend**: Python FastAPI (`app.py`), Uvicorn server, `pypdf` for PDF text extraction, `smtplib` for email dispatch (MIME alternative plain+HTML), local JSON storage (`data/`).
- **Frontend**: Single-Page Application (`static/index.html`) styled with Vanilla CSS glassmorphism dark theme, Plus Jakarta Sans & JetBrains Mono typography, Lucide Icons.
- **Portability**: `requirements.txt` + `run.bat` for 1-click execution on any Windows system.
