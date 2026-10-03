# 🚀 Auto Email and Follow-Up - Automated Job Application & Drip Campaign Engine

[![Version](https://img.shields.io/badge/version-2.1.1-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)

**Auto Email and Follow-Up** is an intelligent, privacy-first local desktop application designed to supercharge your job search. It automates resume skill extraction, calculates an **ATS Match Score (%)**, generates tailored cold emails via **Gemini 2.5**, and runs automated, multi-stage **Drip Campaign Sequences** locally on your machine.

---

## ✨ Key Features (v2.1.1)

- 🤖 **Gemini 2.5 Structured AI Generator**: Crafts highly personalized cold emails and multi-draft follow-up sequences formatted as structured JSON.
- 📬 **Multi-Stage AI Drip Campaign Engine**: Automatically plans and dispatches sequence follow-ups with tone progression across attempts (Attempt 1: Gentle bump, Attempt 2: Value add, Attempt 3: Timeline check, Attempt 4: Polite wrap-up).
- ⏰ **Local Catch-Up Background Worker**: Runs on server bootup and on interval to dispatch due emails—catching up automatically on past-due follow-ups if your computer was off.
- 🎨 **Multi-Draft Review & Editor Tabs**: Sub-pill selector tabs (`Draft 1`, `Draft 2`, `Draft 3`, `Draft 4`) allowing you to preview and edit every unique follow-up draft before sending.
- 📊 **Unified Outreach Log & Filter Tabs**: Filter outbox items by status (`All`, `Sent`, `Scheduled`, `Cancelled`) with progress badges (`⏳ Scheduled (Attempt 2 of 4)`), `⚡ Send Now` manual triggers, and cancellation controls.
- ✍️ **Multi-Line Custom Prompt Box**: Custom instructions box formatted as a multiline `<textarea>` with high-priority system prompt injection.
- 📎 **PDF Resume Skill Parser & ATS Engine**: Parses PDF resumes, compares key technical terms against job descriptions, and calculates match percentages.
- 🛡️ **Double Sign-Off Prevention & Regex Sanitizer**: Guaranteed single signature block appended programmatically with un-underlined social links (`LinkedIn | GitHub`).
- ⚡ **Dual Backend Parity**: Full feature parity available via Python FastAPI ([`app.py`](app.py)) or Node.js Express ([`server.js`](server.js)).

---

## 📁 Repository Structure

```
job-email-automation/
├── app.py                  # Python FastAPI Backend & Catch-Up Worker
├── server.js               # Node.js Express Backend & Catch-Up Worker
├── run.bat                 # 1-Click Portable Windows Launcher
├── requirements.txt        # Python Dependencies
├── package.json            # Node.js Dependencies
├── README.md               # Main Documentation & Overview
├── CHANGELOG.md            # Semantic Version History
├── ARCHITECTURE.md         # Data Models & Technical Specification
├── USAGE_GUIDE.md          # Step-by-Step User & SMTP Setup Guide
├── IMPLEMENTATION_PLAN.md  # Engineering Roadmap & Specs
├── static/
│   └── index.html          # Single-Page Web Dashboard Interface
├── src/
│   └── App.jsx             # React Vite Application Component
└── data/
    ├── settings.example.json  # Configuration Template
    ├── resumes.json           # Saved Resume Profiles
    ├── history.json           # Outreach Activity Log
    └── uploads/               # Extracted Resume PDF Storage
```

---

## ⚡ Quick Start (Windows 1-Click)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/RdeepGhosh-2003/Auto-Email-and-Follow-Up.git
   cd Auto-Email-and-Follow-Up
   ```
2. Double-click **`run.bat`**.
3. The launcher automatically configures virtual environment dependencies and opens your browser at:
   ```
   http://127.0.0.1:3000
   ```

*For macOS/Linux setup or Node.js Express instructions, see [USAGE_GUIDE.md](USAGE_GUIDE.md).*

---

## ⚙️ Configuration & SMTP Setup

1. Open **Settings (⚙️)** in the top-right navbar.
2. Configure your Gmail SMTP credentials:
   - **SMTP Host**: `smtp.gmail.com`
   - **Port**: `465` (SSL)
   - **SMTP User**: `your.email@gmail.com`
   - **App Password**: 16-character Google App Password (*Google Account > Security > 2-Step Verification > App Passwords*).
3. Set your **Sender Name**, **Custom Signature**, **LinkedIn URL**, and **GitHub URL**.
4. Set Drip Campaign parameters (**Gap Between Emails**, **Total Follow-Up Attempts**).
5. Click **"⚡ Test SMTP Connection"** to verify, then **"Save Configuration"**.

---

## 📖 Documentation Index

- 📘 **[USAGE_GUIDE.md](USAGE_GUIDE.md)**: Detailed user manual and SMTP setup guide.
- 📐 **[ARCHITECTURE.md](ARCHITECTURE.md)**: Data schemas, background worker lifecycle, and REST API specification.
- 📝 **[CHANGELOG.md](CHANGELOG.md)**: Detailed version history tracking v1.0.0 to v2.0.0.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
