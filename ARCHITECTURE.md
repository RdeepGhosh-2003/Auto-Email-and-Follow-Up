# Auto Email and Follow-Up - System Architecture & Technical Specifications

This document outlines the architecture, data schemas, background worker lifecycle, and REST API specification for **Auto Email and Follow-Up v2.0.0**.

---

## 🏛️ System Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         React / Glassmorphic UI                         │
 │                (App.jsx / static/index.html SPA Frontend)               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ REST HTTP / JSON
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Backend Server (FastAPI / Express)                │
 │  ┌─────────────────┬──────────────────┬─────────────────────────────┐  │
 │  │ PDF Resume      │ ATS Matcher      │ Gemini 2.5 Structured AI    │  │
 │  │ Extractor       │ Engine           │ Generator & Sanitizer       │  │
 │  └─────────────────┴──────────────────┴─────────────────────────────┘  │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ Local Catch-Up Background Worker (Boot Trigger + 60s Ticker)      │  │
 │  └─────────────────────────────────┬────────────────────────────────┘  │
 └────────────────────────────────────┼───────────────────────────────────┘
                                      │ SMTPLib / Nodemailer (SSL/TLS)
                                      ▼
 ┌──────────────────────────────────┬─────────────────────────────────────┐
 │ Outgoing Email Server (Gmail/SMTP)│ Local JSON Storage (data/*.json)    │
 └──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 💾 Data Models & Schemas

### 1. Outreach History Item (`data/history.json`)
```json
{
  "id": "1722513600000",
  "receiverEmail": "recruiter@company.com",
  "subject": "Application for Senior Full Stack Engineer - Rajdeep Ghosh",
  "body": "Dear Hiring Manager,\n\nI am thrilled to apply...",
  "jobTitle": "Senior Full Stack Engineer",
  "sentAt": "2026-08-01T14:00:00.000Z",
  "messageId": "<message-id@smtp.gmail.com>",
  "status": "Sent",
  "resumeAttached": "Resume_Rajdeep.pdf",
  "followUpBody": "Hi Hiring Manager,\n\nI wanted to follow up...",
  "followUpDrafts": [
    "Draft 1: Gentle bump...",
    "Draft 2: Value add sharing Node.js project...",
    "Draft 3: Quick check-in on hiring timelines...",
    "Draft 4: Final wrap-up..."
  ],
  "currentAttempt": 1,
  "maxAttempts": 4,
  "daysGap": 3,
  "followUpDate": "2026-08-04T14:00:00.000Z",
  "followUpStatus": "Pending"
}
```

### 2. User Settings (`data/settings.json`)
```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 465,
  "smtpSecure": true,
  "smtpUser": "your.email@gmail.com",
  "smtpPass": "app-password",
  "senderName": "Rajdeep Ghosh",
  "signature": "Best regards,\nRajdeep Ghosh\nPhone | Email",
  "linkedinUrl": "https://linkedin.com/in/username",
  "githubUrl": "https://github.com/username",
  "geminiApiKey": "AIzaSy...",
  "autoFollowUpEnabled": true,
  "daysGap": 3,
  "maxAttempts": 4
}
```

---

## 🤖 AI Prompt Engineering & Sanitization Pipeline

1. **Prompt Construction**:
   - System prompt instructs Gemini 2.5 Flash to output structured JSON:
     `{"subject": "...", "body": "...", "follow_ups": ["...", "..."]}`
   - `maxAttempts` parameter dynamically scales the length of `follow_ups`.
   - Sequence tone instructions: Attempt 1 (Gentle bump), Attempt 2 (Value add), Attempt 3 (Timeline inquiry), Attempt 4 (Polite wrap-up).
2. **Double Sign-Off Prevention**:
   - System prompt explicitly forbids valedictions/signatures in LLM output.
   - Output sanitizer function strips any residual sign-offs (`Best regards`, `Sincerely`, `Thank you`, etc.) via regex filtering.
3. **Soft-Wrap Normalization**:
   - Normalizes single newline soft wraps while preserving double newline paragraph breaks (`\n\n`).

---

## ⏰ Catch-Up Background Worker Lifecycle

```
[Server Start] ──► Call process_due_followups() (Immediate Catch-Up)
                         │
                         ▼
             Query history.json for items where:
             (followUpStatus == "Pending" OR "Scheduled")
             AND followUpDate <= NOW()
                         │
                         ├─────────► Dispatch followUpDrafts[currentAttempt] via SMTP
                         │
                         ├─────────► Increment currentAttempt += 1
                         │
                         ├─────────► If currentAttempt < maxAttempts:
                         │             next_date = NOW() + daysGap days
                         │             followUpStatus = "Pending"
                         │
                         └─────────► If currentAttempt >= maxAttempts:
                                       followUpStatus = "Sent"
                         │
                         ▼
        Start 60s Ticker Loop (setInterval / async loop)
```

---

## 🌐 REST API Specifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/settings` | Retrieve user SMTP configuration and settings |
| `POST` | `/api/settings` | Update user settings |
| `POST` | `/api/settings/verify-smtp` | Test SMTP server connection and credentials |
| `POST` | `/api/parse-pdf` | Extract text from uploaded Resume PDF and store profile |
| `GET` | `/api/resumes` | List saved resume profiles |
| `DELETE` | `/api/resumes/:id` | Delete resume profile |
| `POST` | `/api/generate-email` | Generate cold email & drip sequence via Gemini / Smart Synthesizer |
| `POST` | `/api/send-email` | Send initial email with PDF attachment via SMTP and schedule drip campaign |
| `GET` | `/api/history` | Retrieve full outreach activity log |
| `POST` | `/api/history/:id/send-followup` | Immediate manual override trigger (`⚡ Send Now`) for next drip step |
| `POST` | `/api/history/:id/cancel-followup` | Cancel scheduled drip sequence |
| `DELETE` | `/api/history/:id` | Delete log record |
