# AutoApply AI - User & Setup Guide

This guide provides step-by-step instructions on setting up, configuring, and using **AutoApply AI** for cold email job outreach and automated drip campaigns.

---

## 🚀 Installation & Quick Start

### Windows (Recommended 1-Click Launch)
1. Navigate to the project folder.
2. Double-click **`run.bat`**.
3. The launcher will automatically create a virtual environment (`.venv`), install missing dependencies, start the server, and launch `http://127.0.0.1:3000` in your web browser.

### Manual Setup (Cross-Platform)

#### Python FastAPI Backend
```bash
# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or .\.venv\Scripts\activate on Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run FastAPI Server
python app.py
```
App will run at: `http://localhost:3000`

#### Node.js Express Backend
```bash
# 1. Install npm dependencies
npm install

# 2. Run Express Server
node server.js
```
App will run at: `http://localhost:3000`

---

## ⚙️ SMTP & Social Links Setup

To enable direct email sending from your Gmail/SMTP account:

1. Click the **Settings (⚙️)** button in the top navbar.
2. **SMTP Connection**:
   - **SMTP Host**: `smtp.gmail.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **SMTP User**: Your full Gmail address (`e.g. user@gmail.com`).
   - **App Password**: Generate a 16-character App Password via Google Account Security:
     - Visit Google Account > Security > 2-Step Verification > App Passwords.
     - Select App: *Mail*, Device: *Windows Computer*.
     - Copy the 16-letter password into the **App Password** input.
3. **Sender Details & Social Links**:
   - Enter your **Sender Name**, **Custom Email Signature**, **LinkedIn Profile URL**, and **GitHub Profile URL**.
4. **Drip Campaign Settings**:
   - **Gap Between Emails (Days)**: Number of days between sequence attempts (default: 3).
   - **Total Follow-Up Attempts**: Total number of follow-up drafts generated in sequence (default: 4).
5. Click **"⚡ Test SMTP Connection"** to verify connection, then click **"Save Configuration"**.

---

## ✉️ Generating & Customizing Drip Campaigns

1. **Upload Resume**: Drag and drop your resume PDF or select a saved resume profile.
2. **Job Description**: Paste the target job description.
3. **Custom Prompt / Instructions**: Enter multi-line directives for the AI (e.g. *"Emphasize my experience building REST APIs with Python, keep it under 3 paragraphs"*).
4. **Tone Selection**: Choose between *Professional*, *Enthusiastic*, or *Executive*.
5. Click **"✨ Generate Tailored Email"**.
6. **Reviewing & Editing Drafts**:
   - Use the **Main Application Email** tab to review and edit the initial cold email.
   - Click **Drip Sequence (4 Drafts)** tab to toggle between sub-pills (`Draft 1`, `Draft 2`, `Draft 3`, `Draft 4`) and customize each follow-up message before sending.
7. Click **"Send Email to Recipient"** to send the main email and automatically schedule the background drip campaign!

---

## 📊 Outreach Log & Manual Overrides

Navigate to the **History / Outbox** tab to monitor all sent emails and active drip campaigns:

- **Filter Tabs**: Toggle between `All`, `Sent`, `Scheduled`, and `Cancelled` rows.
- **Sequence Badges**: View progress indicators such as `⏳ Scheduled (Attempt 2 of 4)`.
- **⚡ Send Now**: Instantly dispatch the next due sequence step without waiting for the scheduled date.
- **Cancel**: Cancel a scheduled drip campaign if a recruiter replies.
