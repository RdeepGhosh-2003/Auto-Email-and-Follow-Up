import os
import json
import uuid
import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pypdf
import requests

app = FastAPI(title="Auto Email and Follow-Up - Job Application Email Automation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
RESUMES_FILE = os.path.join(DATA_DIR, "resumes.json")

# Helpers for JSON persistence
def read_json(filepath: str, default_val=None):
    if default_val is None:
        default_val = []
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
    return default_val

def write_json(filepath: str, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing {filepath}: {e}")

# Pydantic Schemas
class SettingsModel(BaseModel):
    smtpHost: str = "smtp.gmail.com"
    smtpPort: int = 465
    smtpSecure: bool = True
    smtpUser: str = ""
    smtpPass: str = ""
    senderName: str = ""
    signature: str = "Best regards,\n[Your Name]\n[Your Phone] | [Your Email]"
    linkedinUrl: Optional[str] = ""
    portfolioUrl: Optional[str] = ""
    portfolioName: Optional[str] = "GitHub"
    githubUrl: Optional[str] = ""
    geminiApiKey: Optional[str] = ""
    autoFollowUpEnabled: bool = True
    followUpDelayDays: int = 3
    daysGap: int = 3
    maxAttempts: int = 4

class EmailGenerateRequest(BaseModel):
    resumeText: str
    jobDescription: str
    tone: str = "Professional"
    customNotes: Optional[str] = ""
    senderName: Optional[str] = ""

class SendEmailRequest(BaseModel):
    receiverEmail: str
    subject: str
    body: str
    followUpBody: Optional[str] = ""
    followUpDrafts: Optional[List[str]] = []
    maxAttempts: Optional[int] = 4
    daysGap: Optional[int] = 3
    resumeFilePath: Optional[str] = ""
    resumeFilename: Optional[str] = ""

# --- ATS Keyword Engine ---
COMMON_STOPWORDS = {
    'and', 'the', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'will', 'you',
    'are', 'was', 'were', 'been', 'being', 'our', 'their', 'work', 'working', 'team',
    'experience', 'years', 'ability', 'knowledge', 'skills', 'strong', 'good', 'must',
    'should', 'could', 'looking', 'role', 'company', 'candidate', 'responsibilities',
    'requirements', 'job', 'description', 'join', 'help', 'build', 'create', 'develop'
}

def analyze_ats(resume_text: str, job_desc: str):
    import re
    words_res = set(re.findall(r'[a-zA-Z0-9+#.-]{2,}', resume_text.lower()))
    words_jd = re.findall(r'[a-zA-Z0-9+#.-]{2,}', job_desc.lower())

    clean_jd_words = [w for w in set(words_jd) if w not in COMMON_STOPWORDS and len(w) > 2 and not w.isdigit()]
    if not clean_jd_words:
        return {"score": 75, "matched": [], "missing": []}

    matched = [w for w in clean_jd_words if w in words_res]
    missing = [w for w in clean_jd_words if w not in words_res]

    raw_ratio = len(matched) / len(clean_jd_words)
    score = min(max(int(raw_ratio * 100) + 15, 45), 98)

    return {
        "score": score,
        "matched": matched[:15],
        "missing": missing[:15]
    }

# Helper to convert body text to HTML — only paragraph breaks (\n\n) become <br><br>.
# Single newlines (soft wraps) are converted to a single space to avoid mid-sentence breaks.
def _body_to_html(text: str) -> str:
    import re
    # Collapse any run of 2+ newlines into a paragraph marker
    paragraphs = re.split(r'\n{2,}', text.strip())
    html_paragraphs = []
    for para in paragraphs:
        # Within a paragraph, replace single \n with a space (soft-wrap fix)
        para_html = para.replace('\n', ' ').strip()
        html_paragraphs.append(para_html)
    return '<br><br>'.join(html_paragraphs)


# Helper to construct HTML and Plain text email bodies with social signature links.
# portfolio_name: the visible label for the second link (e.g. "GitHub", "My Blog").
# portfolio_url:  the href for that second link.
def construct_email_payloads(
    body: str,
    signature: str,
    linkedin_url: str = "",
    portfolio_url: str = "",
    portfolio_name: str = "Portfolio"
):
    import re

    plain_text = body.strip()

    # Paragraph-aware HTML conversion — only \n\n becomes <br><br>
    body_html = _body_to_html(body)
    html_text = f"<div style='font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827;'>{body_html}</div>"

    # --- Build social link anchor tags (no underline per Issue 1) ---
    social_links = []         # list of HTML anchor strings
    social_plain_parts = []   # list of "Label: url" strings for plain text

    if linkedin_url and linkedin_url.strip():
        url = linkedin_url.strip()
        if not url.startswith("http"):
            url = "https://" + url
        social_links.append(
            f'<a href="{url}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">LinkedIn</a>'
        )
        social_plain_parts.append(f"LinkedIn: {url}")

    if portfolio_url and portfolio_url.strip():
        url = portfolio_url.strip()
        if not url.startswith("http"):
            url = "https://" + url
        label = (portfolio_name or "Portfolio").strip()
        social_links.append(
            f'<a href="{url}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">{label}</a>'
        )
        social_plain_parts.append(f"{label}: {url}")

    # --- Append signature + social block ---
    if signature and signature.strip():
        sig_plain = signature.strip()
        sig_html = re.sub(r'\n', '<br/>', sig_plain)

        if sig_plain not in plain_text:
            plain_text += f"\n\n---\n{sig_plain}"
            html_text += (
                f"<br/><div style='border-top: 1px solid #e5e7eb; "
                f"padding-top: 10px; margin-top: 12px; color: #374151;'>{sig_html}"
            )
            if social_links:
                plain_text += "\n" + " | ".join(social_plain_parts)
                html_text += (
                    f"<br/><span style='font-size: 13px; color: #4b5563;'>"
                    + " | ".join(social_links)
                    + "</span>"
                )
            html_text += "</div>"
    elif social_links:
        # No signature configured — append links on their own
        plain_text += "\n\n" + " | ".join(social_plain_parts)
        html_text += (
            "<br/><br/><div style='font-size: 13px; color: #4b5563;'>"
            + " | ".join(social_links)
            + "</div>"
        )

    return plain_text, html_text

# --- API ENDPOINTS ---

@app.get("/api/settings")
def get_settings():
    default_settings = {
        "smtpHost": "smtp.gmail.com",
        "smtpPort": 465,
        "smtpSecure": True,
        "smtpUser": "",
        "smtpPass": "",
        "senderName": "",
        "signature": "Best regards,\n[Your Name]\n[Your Phone] | [Your Email]",
        "linkedinUrl": "",
        "githubUrl": "",
        "geminiApiKey": "",
        "autoFollowUpEnabled": True,
        "followUpDelayDays": 3,
        "daysGap": 3,
        "maxAttempts": 4
    }
    settings = read_json(SETTINGS_FILE, default_settings)
    if "daysGap" not in settings:
        settings["daysGap"] = settings.get("followUpDelayDays", 3)
    if "maxAttempts" not in settings:
        settings["maxAttempts"] = 4
    return {"success": True, "settings": settings}

@app.post("/api/settings")
def save_settings(settings: SettingsModel):
    write_json(SETTINGS_FILE, settings.dict())
    return {"success": True, "message": "Settings saved successfully!"}

@app.post("/api/settings/verify-smtp")
def verify_smtp(settings: SettingsModel):
    if not settings.smtpHost or not settings.smtpUser or not settings.smtpPass:
        raise HTTPException(status_code=400, detail="SMTP Host, User, and Password are required.")

    try:
        if settings.smtpPort == 465 or settings.smtpSecure:
            server = smtplib.SMTP_SSL(settings.smtpHost, settings.smtpPort, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtpHost, settings.smtpPort, timeout=10)
            server.starttls()

        server.login(settings.smtpUser, settings.smtpPass)
        server.quit()
        return {"success": True, "message": "SMTP connection verified successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP Connection Failed: {str(e)}")

@app.post("/api/parse-pdf")
async def parse_pdf(file: UploadFile = File(...), profileName: Optional[str] = Form(None)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    unique_name = f"{uuid.uuid4().hex[:8]}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOADS_DIR, unique_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    try:
        reader = pypdf.PdfReader(file_path)
        text_pages = [page.extract_text() for page in reader.pages if page.extract_text()]
        extracted_text = "\n".join(text_pages).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF text: {str(e)}")

    name = profileName or file.filename.replace(".pdf", "")
    resumes = read_json(RESUMES_FILE, [])
    new_resume = {
        "id": uuid.uuid4().hex,
        "name": name,
        "filename": file.filename,
        "filePath": file_path,
        "text": extracted_text,
        "uploadedAt": datetime.datetime.now().isoformat()
    }
    resumes.insert(0, new_resume)
    write_json(RESUMES_FILE, resumes)

    return {
        "success": True,
        "resume": new_resume,
        "text": extracted_text,
        "numPages": len(reader.pages)
    }

@app.get("/api/resumes")
def get_resumes():
    resumes = read_json(RESUMES_FILE, [])
    return {"success": True, "resumes": resumes}

@app.delete("/api/resumes/{resume_id}")
def delete_resume(resume_id: str):
    resumes = read_json(RESUMES_FILE, [])
    resumes = [r for r in resumes if r.get("id") != resume_id]
    write_json(RESUMES_FILE, resumes)
    return {"success": True, "message": "Resume profile deleted."}

@app.post("/api/generate-email")
def generate_email(req: EmailGenerateRequest):
    if not req.resumeText or not req.jobDescription:
        raise HTTPException(status_code=400, detail="Resume text and Job Description are required.")

    settings = read_json(SETTINGS_FILE, {})
    max_attempts = int(settings.get("maxAttempts", 4))
    api_key = settings.get("geminiApiKey") or os.environ.get("GEMINI_API_KEY")

    subject = ""
    body = ""
    follow_ups = []

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            custom_prompt_val = req.customNotes.strip() if req.customNotes and req.customNotes.strip() else 'None'
            prompt = f"""You are an executive career coach. Write a tailored cold email from candidate to hiring manager AND a sequence of exactly {max_attempts} unique follow-up email drafts based on:

Tone: {req.tone}
Sender Name: {req.senderName or 'Applicant'}

Resume:
{req.resumeText[:3000]}

Job Description:
{req.jobDescription[:3000]}

SEQUENCE TONE PROGRESSION INSTRUCTIONS (for the {max_attempts} follow-up drafts):
- Attempt 1: Gentle bump / polite check-in on the initial application.
- Attempt 2: Value-add / sharing a specific relevant project, technical skill, or achievement mapping to their JD.
- Attempt 3: Brief inquiry regarding their hiring timelines or team roadmap.
- Attempt 4 (Final Attempt): Polite wrap-up / closing the loop graciously.
(If maxAttempts is different, scale the tone progression logically across the sequence).

FORMATTING RULES (strictly follow these):
- Do NOT use hard line breaks for text wrapping. Output continuous sentences within each paragraph.
- Only use line breaks (\n\n) to separate actual paragraphs or list items.
- Never insert a \n mid-sentence just to wrap text at a certain column width.
- Each paragraph must be a single unbroken string of text.
- Do NOT include a valediction, sign-off, or signature block (e.g., 'Best regards', 'Sincerely', 'Thank you', or the sender's name) at the end of any email body or follow-up draft. Stop generating text immediately after the final closing sentence. A standard signature block will be appended programmatically.

Respond ONLY with valid JSON matching this schema:
{{
  "subject": "Clear subject line specifying candidate name and job title",
  "body": "Natural, highly professional 3-4 paragraph cold email emphasizing top matching skills and achievements. No generic filler. Each paragraph is one unbroken sentence string separated by \n\n. Do NOT include any valediction or signature block.",
  "follow_ups": [
    "Follow-up draft 1 text...",
    "Follow-up draft 2 text...",
    "Follow-up draft 3 text...",
    "Follow-up draft 4 text..."
  ]
}}

USER'S CUSTOM INSTRUCTIONS: {custom_prompt_val}
If the user has provided custom instructions above, you MUST follow them strictly, even if they contradict previous tone or formatting instructions."""

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )

            res_json = json.loads(response.text.strip().replace('```json', '').replace('```', ''))
            subject = res_json.get("subject", "")
            raw_body = res_json.get("body", "")
            raw_follow_ups = res_json.get("follow_ups") or res_json.get("followUps") or []
            if isinstance(raw_follow_ups, str):
                raw_follow_ups = [raw_follow_ups]

            import re as _re_fmt
            def _sanitize_llm_output(text: str) -> str:
                if not text:
                    return ""
                text = text.replace('\r\n', '\n').replace('\r', '\n')
                text = _re_fmt.sub(r'(?<!\n)\n(?!\n)', ' ', text)
                text = _re_fmt.sub(r'\n{3,}', '\n\n', text)
                text = _re_fmt.sub(r'\n?\s*(?:Best regards|Sincerely|Thank you|Yours truly|Kind regards|Warm regards|Regards)[,\s]+.*$', '', text, flags=_re_fmt.IGNORECASE | _re_fmt.DOTALL)
                return text.strip()

            body = _sanitize_llm_output(raw_body)
            follow_ups = [_sanitize_llm_output(f) for f in raw_follow_ups if f]
        except Exception as e:
            print(f"Gemini API Error: {e}")

    if not body or not follow_ups:
        ats = analyze_ats(req.resumeText, req.jobDescription)
        import re as _re
        raw_matched = ats["matched"][:6]
        cleaned = []
        seen = set()
        for w in raw_matched:
            w_clean = _re.sub(r'[^a-zA-Z0-9#+]', '', w).title()
            if w_clean and w_clean.lower() not in seen:
                seen.add(w_clean.lower())
                cleaned.append(w_clean)
        matched_str = ", ".join(cleaned[:4]) or "core technologies"

        import re
        job_title_match = re.search(r'(?:Senior|Junior|Lead|Full Stack|Frontend|Backend|Software|Product|Data|Project|DevOps)\s+[A-Za-z\s]{3,25}', req.jobDescription, re.IGNORECASE)
        title = job_title_match.group(0).strip() if job_title_match else "Software Engineer Position"

        subject = f"Application for {title} - {req.senderName or 'Candidate'}"

        if req.tone == "Enthusiastic":
            body = f"Hi Hiring Team,\n\nI was thrilled to come across the {title} opening! With direct experience leveraging {matched_str}, I am confident I can make an immediate impact on your team's upcoming roadmap.\n\nKey Highlights from my background:\n• Hands-on expertise in {matched_str} delivering high-performance features.\n• Strong problem-solving mindset and focus on clean, scalable code.\n• Proven ability to collaborate effectively in fast-paced agile environments.\n\n{f'Note: {req.customNotes}\n\n' if req.customNotes else ''}I have attached my resume for your review. I would welcome the opportunity to discuss how my skill set aligns with your goals."
        elif req.tone == "Executive":
            body = f"Dear Hiring Manager,\n\nI am writing to express my interest in the {title} role. My technical foundation in {matched_str} aligns closely with the core requirements outlined in your job description.\n\nWhy I fit this role:\n1. Track record of engineering solutions using {matched_str}.\n2. Commitment to architectural quality and business performance.\n3. Fast onboarding velocity.\n\n{f'Additional Context: {req.customNotes}\n\n' if req.customNotes else ''}Please find my resume attached. I look forward to connecting for a brief discussion."
        else:
            body = f"Dear Hiring Manager,\n\nI am applying for the {title} role. Having reviewed your requirements, my background in {matched_str} makes me a strong candidate for your engineering team.\n\nKey qualifications:\n- Demonstrated proficiency with {matched_str} in production software.\n- Focus on reliable delivery, automated testing, and team collaboration.\n- Clear communication skills.\n\n{f'{req.customNotes}\n\n' if req.customNotes else ''}My resume is attached for your review. I look forward to speaking with you."

        follow_ups = [
            f"Hi Hiring Manager,\n\nI wanted to follow up briefly on my application for the {title} position sent a few days ago. I remain very enthusiastic about the opportunity and would love to connect.\n\nPlease let me know if you need any additional details from my end!",
            f"Hi Hiring Team,\n\nFollowing up on my previous note for the {title} role. In addition to my resume, I wanted to highlight my experience with {matched_str}, which directly addresses your key engineering requirements.\n\nI would be excited to discuss how this background can benefit your upcoming projects.",
            f"Hi Hiring Manager,\n\nQuick check-in regarding the {title} opening. I am very interested in learning more about your team's current hiring timeline and engineering roadmap.\n\nDo you have a few minutes for a brief call next week?",
            f"Hi Hiring Team,\n\nI am writing one final note regarding my application for the {title} role. I understand your team is busy reviewing candidates.\n\nIf the timing isn't right, I'd still love to stay connected for future opportunities. Thank you again for your time and consideration!"
        ]
        if len(follow_ups) < max_attempts:
            while len(follow_ups) < max_attempts:
                idx = len(follow_ups) + 1
                follow_ups.append(f"Hi Hiring Team,\n\nFollowing up on my application for {title} (Follow-Up {idx}). I remain interested in discussing how my skills align with your goals.")
        elif len(follow_ups) > max_attempts:
            follow_ups = follow_ups[:max_attempts]

    ats_analysis = analyze_ats(req.resumeText, req.jobDescription)
    return {
        "success": True,
        "subject": subject,
        "body": body,
        "followUp": follow_ups[0] if follow_ups else "",
        "followUpDrafts": follow_ups,
        "atsAnalysis": ats_analysis
    }

def _dispatch_smtp_email(receiver_email: str, subject: str, body: str, settings: dict, resume_file_path: Optional[str] = None, resume_filename: Optional[str] = None):
    smtp_host = settings.get("smtpHost")
    smtp_port = int(settings.get("smtpPort", 465))
    smtp_secure = settings.get("smtpSecure", True)
    smtp_user = settings.get("smtpUser")
    smtp_pass = settings.get("smtpPass")
    sender_name = settings.get("senderName") or smtp_user
    signature = settings.get("signature", "")
    linkedin_url = settings.get("linkedinUrl", "")
    portfolio_url = settings.get("portfolioUrl") or settings.get("githubUrl", "")
    portfolio_name = settings.get("portfolioName") or "Portfolio"

    if not smtp_host or not smtp_user or not smtp_pass:
        raise ValueError("SMTP configuration incomplete. Please configure SMTP in Settings.")

    msg = MIMEMultipart('mixed')
    msg['From'] = f'"{sender_name}" <{smtp_user}>'
    msg['To'] = receiver_email
    msg['Subject'] = subject

    plain_text, html_text = construct_email_payloads(
        body, signature, linkedin_url, portfolio_url, portfolio_name
    )

    alt_part = MIMEMultipart('alternative')
    alt_part.attach(MIMEText(plain_text, 'plain', 'utf-8'))
    alt_part.attach(MIMEText(html_text, 'html', 'utf-8'))
    msg.attach(alt_part)

    attached_filename = "None"
    if resume_file_path and os.path.exists(resume_file_path):
        attached_filename = resume_filename or os.path.basename(resume_file_path)
        with open(resume_file_path, "rb") as f:
            part = MIMEApplication(f.read(), Name=attached_filename)
        part['Content-Disposition'] = f'attachment; filename="{attached_filename}"'
        msg.attach(part)

    if smtp_port == 465 or smtp_secure:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.starttls()

    server.login(smtp_user, smtp_pass)
    server.send_message(msg)
    server.quit()
    return plain_text, attached_filename

def process_due_followups():
    try:
        settings = read_json(SETTINGS_FILE, {})
        if not settings.get("autoFollowUpEnabled", True):
            return

        history = read_json(HISTORY_FILE, [])
        updated = False
        now = datetime.datetime.now()

        for item in history:
            status = item.get("followUpStatus")
            if status in ("Pending", "Scheduled"):
                followup_date_str = item.get("followUpDate")
                if followup_date_str:
                    try:
                        followup_dt = datetime.datetime.fromisoformat(followup_date_str)
                    except Exception:
                        continue

                    if now >= followup_dt:
                        drafts = item.get("followUpDrafts") or []
                        if not drafts and item.get("followUpBody"):
                            drafts = [item.get("followUpBody")]

                        current_attempt = item.get("currentAttempt", 0)
                        max_attempts = item.get("maxAttempts", len(drafts) or 1)
                        days_gap = item.get("daysGap") or int(settings.get("daysGap", 3)) or int(settings.get("followUpDelayDays", 3))

                        if current_attempt < len(drafts):
                            body_txt = drafts[current_attempt]
                        elif drafts:
                            body_txt = drafts[-1]
                        else:
                            body_txt = item.get("followUpBody", "")

                        if not body_txt:
                            continue

                        sub = f"Re: {item.get('subject', 'Application Follow-Up')}"
                        try:
                            _dispatch_smtp_email(
                                receiver_email=item.get("receiverEmail"),
                                subject=sub,
                                body=body_txt,
                                settings=settings
                            )

                            next_attempt = current_attempt + 1
                            item["currentAttempt"] = next_attempt

                            if next_attempt < max_attempts:
                                next_date = now + datetime.timedelta(days=days_gap)
                                item["followUpDate"] = next_date.isoformat()
                                item["followUpStatus"] = "Pending"
                            else:
                                item["followUpStatus"] = "Sent"
                                item["followUpSentAt"] = now.isoformat()

                            updated = True
                            print(f"[AutoFollowUp] Sent follow-up (Attempt {next_attempt}/{max_attempts}) to {item.get('receiverEmail')}")
                        except Exception as err:
                            print(f"[AutoFollowUp] Error sending follow-up to {item.get('receiverEmail')}: {err}")
        if updated:
            write_json(HISTORY_FILE, history)
    except Exception as e:
        print(f"[AutoFollowUp] Scheduler error: {e}")

def _start_followup_scheduler():
    import time
    import threading
    def _loop():
        process_due_followups()
        while True:
            time.sleep(60)
            process_due_followups()
    t = threading.Thread(target=_loop, daemon=True)
    t.start()

_start_followup_scheduler()

@app.post("/api/send-email")
def send_email(req: SendEmailRequest):
    if not req.receiverEmail or not req.subject or not req.body:
        raise HTTPException(status_code=400, detail="Receiver email, subject, and body are required.")

    settings = read_json(SETTINGS_FILE, {})
    try:
        plain_text, attached_filename = _dispatch_smtp_email(
            receiver_email=req.receiverEmail,
            subject=req.subject,
            body=req.body,
            settings=settings,
            resume_file_path=req.resumeFilePath,
            resume_filename=req.resumeFilename
        )

        days_gap = req.daysGap if req.daysGap is not None else int(settings.get("daysGap", settings.get("followUpDelayDays", 3)))
        max_attempts = req.maxAttempts if req.maxAttempts is not None else int(settings.get("maxAttempts", 4))

        drafts = req.followUpDrafts or []
        if not drafts and req.followUpBody and req.followUpBody.strip():
            drafts = [req.followUpBody.strip()]

        now = datetime.datetime.now()
        follow_up_date = (now + datetime.timedelta(days=days_gap)).isoformat()
        has_follow_up = len(drafts) > 0

        history = read_json(HISTORY_FILE, [])
        history_item = {
            "id": uuid.uuid4().hex,
            "receiverEmail": req.receiverEmail,
            "subject": req.subject,
            "body": plain_text,
            "sentAt": now.isoformat(),
            "resumeAttached": attached_filename,
            "status": "Sent",
            "followUpBody": drafts[0] if drafts else "",
            "followUpDrafts": drafts,
            "currentAttempt": 0,
            "maxAttempts": max_attempts,
            "daysGap": days_gap,
            "followUpDate": follow_up_date if has_follow_up else "",
            "followUpStatus": "Pending" if has_follow_up else "None"
        }
        history.insert(0, history_item)
        write_json(HISTORY_FILE, history)

        return {"success": True, "message": f"Email successfully sent to {req.receiverEmail}!", "historyItem": history_item}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@app.get("/api/history")
def get_history():
    return {"success": True, "history": read_json(HISTORY_FILE, [])}

@app.post("/api/history/{item_id}/send-followup")
def trigger_manual_followup(item_id: str):
    history = read_json(HISTORY_FILE, [])
    item = next((h for h in history if h.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="History record not found.")

    drafts = item.get("followUpDrafts") or []
    if not drafts and item.get("followUpBody"):
        drafts = [item.get("followUpBody")]

    if not drafts:
        raise HTTPException(status_code=400, detail="No follow-up draft available for this email.")

    current_attempt = item.get("currentAttempt", 0)
    max_attempts = item.get("maxAttempts", len(drafts) or 1)
    days_gap = item.get("daysGap", 3)

    if current_attempt < len(drafts):
        body_txt = drafts[current_attempt]
    else:
        body_txt = drafts[-1]

    settings = read_json(SETTINGS_FILE, {})
    sub = f"Re: {item.get('subject', 'Application Follow-Up')}"

    try:
        _dispatch_smtp_email(
            receiver_email=item.get("receiverEmail"),
            subject=sub,
            body=body_txt,
            settings=settings
        )
        now = datetime.datetime.now()
        next_attempt = current_attempt + 1
        item["currentAttempt"] = next_attempt

        if next_attempt < max_attempts:
            next_date = now + datetime.timedelta(days=days_gap)
            item["followUpDate"] = next_date.isoformat()
            item["followUpStatus"] = "Pending"
        else:
            item["followUpStatus"] = "Sent"
            item["followUpSentAt"] = now.isoformat()

        write_json(HISTORY_FILE, history)
        return {"success": True, "message": f"Follow-up email (Attempt {next_attempt}/{max_attempts}) sent to {item.get('receiverEmail')}!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send follow-up: {str(e)}")

@app.post("/api/history/{item_id}/cancel-followup")
def cancel_pending_followup(item_id: str):
    history = read_json(HISTORY_FILE, [])
    item = next((h for h in history if h.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="History record not found.")

    item["followUpStatus"] = "Cancelled"
    write_json(HISTORY_FILE, history)
    return {"success": True, "message": "Follow-up cancelled."}

@app.delete("/api/history/{item_id}")
def delete_history(item_id: str):
    history = read_json(HISTORY_FILE, [])
    history = [h for h in history if h.get("id") != item_id]
    write_json(HISTORY_FILE, history)
    return {"success": True, "message": "Record deleted."}

# Serve Frontend static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=3000, reload=True)
