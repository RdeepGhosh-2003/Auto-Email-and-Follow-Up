import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure data and upload directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Data file paths
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const RESUMES_FILE = path.join(DATA_DIR, 'resumes.json');

// Helper to read/write JSON files safely
const readJson = (file, defaultVal = []) => {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return defaultVal;
};

const writeJson = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
};

// Configure Multer for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${cleanName}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  }
});

// --- API ENDPOINTS ---

// 1. Get & Save Settings
app.get('/api/settings', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    senderName: '',
    senderEmail: '',
    signature: 'Best regards,\n[Your Name]\n[Your Phone] | [Your LinkedIn]',
    geminiApiKey: '',
    autoFollowUpEnabled: true,
    followUpDelayDays: 3,
    daysGap: 3,
    maxAttempts: 4
  });
  if (settings.daysGap === undefined) settings.daysGap = settings.followUpDelayDays || 3;
  if (settings.maxAttempts === undefined) settings.maxAttempts = 4;
  res.json({ success: true, settings });
});

app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  writeJson(SETTINGS_FILE, newSettings);
  res.json({ success: true, message: 'Settings saved successfully!' });
});

// Verify SMTP connection
app.post('/api/settings/verify-smtp', async (req, res) => {
  const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body;
  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(400).json({ success: false, message: 'SMTP Host, User, and Password are required.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 465,
      secure: Boolean(smtpSecure),
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection verified successfully!' });
  } catch (err) {
    console.error('SMTP Verification Error:', err);
    res.status(500).json({ success: false, message: `SMTP Connection Failed: ${err.message}` });
  }
});

// 2. Parse PDF Resume
app.post('/api/parse-pdf', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text.replace(/\r\n/g, '\n').trim();
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Save as resume profile preset option automatically
    const resumes = readJson(RESUMES_FILE, []);
    const newResume = {
      id: Date.now().toString(),
      name: req.body.profileName || originalName.replace('.pdf', ''),
      filename: originalName,
      filePath,
      text: extractedText,
      uploadedAt: new Date().toISOString()
    };
    resumes.unshift(newResume);
    writeJson(RESUMES_FILE, resumes);

    res.json({
      success: true,
      resume: newResume,
      text: extractedText,
      numPages: pdfData.numpages
    });
  } catch (err) {
    console.error('PDF Parse Error:', err);
    res.status(500).json({ success: false, message: `Failed to parse PDF: ${err.message}` });
  }
});

// Get all saved Resumes
app.get('/api/resumes', (req, res) => {
  const resumes = readJson(RESUMES_FILE, []);
  res.json({ success: true, resumes });
});

// Delete a Resume Profile
app.delete('/api/resumes/:id', (req, res) => {
  let resumes = readJson(RESUMES_FILE, []);
  resumes = resumes.filter(r => r.id !== req.params.id);
  writeJson(RESUMES_FILE, resumes);
  res.json({ success: true, message: 'Resume deleted successfully.' });
});

// 3. ATS Score & Keyword Match Engine
const EXTRACT_KEYWORDS_REGEX = /[a-zA-Z0-9+#.-]{2,}/g;
const COMMON_STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'will', 'you',
  'are', 'was', 'were', 'been', 'being', 'our', 'their', 'work', 'working', 'team',
  'experience', 'years', 'ability', 'knowledge', 'skills', 'strong', 'good', 'must',
  'should', 'could', 'looking', 'role', 'company', 'candidate', 'responsibilities',
  'requirements', 'job', 'description', 'join', 'help', 'build', 'create', 'develop'
]);

function analyzeAtsScore(resumeText, jobDescription) {
  if (!resumeText || !jobDescription) return { score: 0, matched: [], missing: [] };

  const normalize = (text) => text.toLowerCase();
  const resNorm = normalize(resumeText);
  const jdNorm = normalize(jobDescription);

  const extractTokens = (text) => {
    const matches = text.match(EXTRACT_KEYWORDS_REGEX) || [];
    return matches
      .map(w => w.toLowerCase())
      .filter(w => w.length > 2 && !COMMON_STOPWORDS.has(w) && !/^\d+$/.test(w));
  };

  const jdTokens = Array.from(new Set(extractTokens(jdNorm)));
  if (jdTokens.length === 0) return { score: 75, matched: [], missing: [] };

  const matched = [];
  const missing = [];

  jdTokens.forEach(token => {
    if (resNorm.includes(token)) {
      matched.push(token);
    } else {
      missing.push(token);
    }
  });

  const rawScore = Math.round((matched.length / jdTokens.length) * 100);
  // Give a fair score baseline if core tech matches
  const score = Math.max(Math.min(rawScore + 15, 98), 45);

  return {
    score,
    matched: matched.slice(0, 15),
    missing: missing.slice(0, 15)
  };
}

app.post('/api/match-score', (req, res) => {
  const { resumeText, jobDescription } = req.body;
  const analysis = analyzeAtsScore(resumeText, jobDescription);
  res.json({ success: true, analysis });
});

// 4. Generate AI Tailored Cold Email & Follow-Up
app.post('/api/generate-email', async (req, res) => {
  const { resumeText, jobDescription, tone = 'Professional', customNotes = '', senderName = '' } = req.body;

  if (!resumeText || !jobDescription) {
    return res.status(400).json({ success: false, message: 'Both Resume text and Job Description are required.' });
  }

  const settings = readJson(SETTINGS_FILE, {});
  const maxAttempts = Number(settings.maxAttempts) || 4;
  const apiKey = (settings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

  let generatedSubject = '';
  let generatedBody = '';
  let generatedFollowUps = [];

  // Attempt to use Gemini AI if API Key is available
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const customPromptVal = customNotes && customNotes.trim() ? customNotes.trim() : 'None';
      const prompt = `You are an expert executive career strategist. Craft a highly compelling, personalized job application cold email AND a sequence of exactly ${maxAttempts} unique follow-up email drafts based on the candidate's resume and target job description.

Tone: ${tone}
Sender Name: ${senderName || 'the applicant'}

Candidate Resume:
"""
${resumeText.slice(0, 3000)}
"""

Target Job Description:
"""
${jobDescription.slice(0, 3000)}
"""

SEQUENCE TONE PROGRESSION INSTRUCTIONS (for the ${maxAttempts} follow-up drafts):
- Attempt 1: Gentle bump / polite check-in on the initial application.
- Attempt 2: Value-add / sharing a specific relevant project, technical skill, or achievement mapping to their JD.
- Attempt 3: Brief inquiry regarding their hiring timelines or team roadmap.
- Attempt 4 (Final Attempt): Polite wrap-up / closing the loop graciously.
(If maxAttempts is different, scale the tone progression logically across the sequence).

Do NOT include a valediction, sign-off, or signature block (e.g., 'Best regards', 'Sincerely', 'Thank you', or the sender's name) at the end of any email. Stop generating text immediately after the final closing sentence. A standard signature block will be appended programmatically.

Format your response strictly as JSON matching this schema:
{
  "subject": "Clear, attention-grabbing email subject line incorporating job title/role",
  "body": "Natural, professional cold email (3-4 concise paragraphs) tying candidate's top achievements directly to key job requirements. Do NOT use generic buzzwords. Do NOT include any sign-off, valediction, or signature block.",
  "follow_ups": [
    "Follow-up draft 1 text...",
    "Follow-up draft 2 text...",
    "Follow-up draft 3 text...",
    "Follow-up draft 4 text..."
  ]
}

USER'S CUSTOM INSTRUCTIONS: ${customPromptVal}
If the user has provided custom instructions above, you MUST follow them strictly, even if they contradict previous tone or formatting instructions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const responseText = response.text;
      const jsonRes = JSON.parse(responseText);

      const cleanSignOff = (text) => {
        if (!text) return '';
        return text.replace(/(?:Best regards|Sincerely|Thank you|Yours truly|Kind regards|Warm regards|Regards)[,\s]+.*$/is, '').trim();
      };

      generatedSubject = jsonRes.subject;
      generatedBody = cleanSignOff(jsonRes.body);
      const rawFollowUps = jsonRes.follow_ups || jsonRes.followUps || [];
      const list = Array.isArray(rawFollowUps) ? rawFollowUps : [rawFollowUps];
      generatedFollowUps = list.map(cleanSignOff).filter(Boolean);

    } catch (aiErr) {
      console.warn('Gemini API Call failed, falling back to smart synthesizer:', aiErr.message);
    }
  }

  // Fallback Smart Synthesizer if no API Key or API error
  if (!generatedBody || generatedFollowUps.length === 0) {
    const analysis = analyzeAtsScore(resumeText, jobDescription);
    const topMatched = analysis.matched.slice(0, 4).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

    // Extract probable job title
    const firstLine = jobDescription.split('\n')[0] || '';
    const jobTitleMatch = jobDescription.match(/(?:Senior|Junior|Lead|Full Stack|Frontend|Backend|Software|Product|Data|Marketing|Sales|Project|DevOps)\s+[A-Za-z\s]{3,25}/i);
    const detectedTitle = jobTitleMatch ? jobTitleMatch[0].trim() : (firstLine.slice(0, 40) || 'Open Position');

    generatedSubject = `Application for ${detectedTitle} - ${senderName || 'Candidate Application'}`;

    if (tone === 'Enthusiastic') {
      generatedBody = `Hi Hiring Manager,\n\nI was thrilled to come across the ${detectedTitle} opening. Having worked extensively with ${topMatched || 'modern technology stacks'}, I am confident that my background aligns directly with what your team is building.\n\nKey highlights from my experience that map to your requirements:\n• Hands-on expertise in ${topMatched || 'core requirements'} demonstrated through production releases.\n• Strong problem-solving mindset with a focus on delivering high-performance, maintainable solutions.\n• Proven track record of collaborating across teams to ship features on schedule.\n\n${customNotes ? 'Note: ' + customNotes + '\n\n' : ''}I have attached my resume for your review. I would love the opportunity to discuss how my skill set can support your upcoming projects.\n\nLooking forward to speaking with you!`;
    } else if (tone === 'Executive') {
      generatedBody = `Dear Hiring Manager,\n\nI am writing to express my interest in the ${detectedTitle} position. With strong experience in ${topMatched || 'key domain areas'}, I have consistently driven technical solutions and high-impact results.\n\nWhy I fit this role:\n1. Direct expertise in ${topMatched || 'essential technical capabilities'}.\n2. Passion for delivering scalable, well-engineered outcomes aligned with business objectives.\n3. Quick adaptability to complex domain environments.\n\n${customNotes ? 'Additional Context: ' + customNotes + '\n\n' : ''}Please find my resume attached. I welcome the opportunity to connect for a brief interview.`;
    } else {
      // Standard Professional
      generatedBody = `Dear Hiring Team,\n\nI am writing to apply for the ${detectedTitle} role. Based on your job description, my background in ${topMatched || 'relevant technical domains'} makes me a strong fit for your team.\n\nHighlights of my qualifications:\n- Proven experience leveraging ${topMatched || 'core tools and methodologies'} to build efficient systems.\n- High attention to code quality, usability, and execution velocity.\n- Strong communication skills and collaborative workflow experience.\n\n${customNotes ? customNotes + '\n\n' : ''}My resume is attached for your consideration. I look forward to the possibility of discussing this opportunity further.`;
    }

    generatedFollowUps = [
      `Hi Hiring Manager,\n\nI wanted to follow up briefly on my application for the ${detectedTitle} position sent a few days ago. I remain very enthusiastic about the possibility of contributing to your team.\n\nPlease let me know if you need any additional information from my side.`,
      `Hi Hiring Team,\n\nFollowing up on my note regarding the ${detectedTitle} opening. In addition to my resume, I wanted to share that my background with ${topMatched || 'core technical requirements'} aligns directly with your team's current goals.\n\nI'd welcome the chance to briefly connect.`,
      `Hi Hiring Manager,\n\nQuick check-in on my application for ${detectedTitle}. I'd love to learn more about your team's timeline for filling this position.\n\nDo you have a few minutes for a brief call next week?`,
      `Hi Hiring Team,\n\nI am writing one final note regarding my application for the ${detectedTitle} role. If the timing isn't right, I'd still love to stay connected for future opportunities.`
    ];

    while (generatedFollowUps.length < maxAttempts) {
      const idx = generatedFollowUps.length + 1;
      generatedFollowUps.push(`Hi Hiring Team,\n\nFollowing up on my application for ${detectedTitle} (Follow-Up ${idx}). I remain interested in discussing how my skills align with your goals.`);
    }
    if (generatedFollowUps.length > maxAttempts) {
      generatedFollowUps = generatedFollowUps.slice(0, maxAttempts);
    }
  }

  // Calculate ATS match breakdown
  const atsAnalysis = analyzeAtsScore(resumeText, jobDescription);

  res.json({
    success: true,
    subject: generatedSubject,
    body: generatedBody,
    followUp: generatedFollowUps[0] || '',
    followUpDrafts: generatedFollowUps,
    atsAnalysis
  });
});

// Helper to send individual SMTP email
async function dispatchSmtpEmail({ receiverEmail, subject, body, resumeFilePath, resumeFilename, settings }) {
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort) || 465,
    secure: Boolean(settings.smtpSecure),
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
    tls: { rejectUnauthorized: false }
  });

  let finalBody = body;
  if (settings.signature && !finalBody.includes(settings.signature)) {
    finalBody += `\n\n---\n${settings.signature}`;
  }

  const attachments = [];
  if (resumeFilePath && fs.existsSync(resumeFilePath)) {
    attachments.push({
      filename: resumeFilename || 'Resume.pdf',
      path: resumeFilePath
    });
  }

  const mailOptions = {
    from: `"${settings.senderName || settings.smtpUser}" <${settings.smtpUser}>`,
    to: receiverEmail,
    subject: subject,
    text: finalBody,
    attachments
  };

  const info = await transporter.sendMail(mailOptions);
  return { info, finalBody, attachments };
}

// Background scheduler loop
async function processDueFollowups() {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    if (settings.autoFollowUpEnabled === false) return;

    const history = readJson(HISTORY_FILE, []);
    let updated = false;
    const now = new Date();

    for (const item of history) {
      if ((item.followUpStatus === 'Pending' || item.followUpStatus === 'Scheduled') && item.followUpDate) {
        const followupDt = new Date(item.followUpDate);
        if (now >= followupDt) {
          const drafts = item.followUpDrafts || [];
          if (drafts.length === 0 && item.followUpBody) drafts.push(item.followUpBody);

          const currentAttempt = Number(item.currentAttempt) || 0;
          const maxAttempts = Number(item.maxAttempts) || (drafts.length || 1);
          const daysGap = Number(item.daysGap) || Number(settings.daysGap) || Number(settings.followUpDelayDays) || 3;

          const bodyTxt = currentAttempt < drafts.length ? drafts[currentAttempt] : (drafts[drafts.length - 1] || item.followUpBody);
          if (!bodyTxt) continue;

          try {
            await dispatchSmtpEmail({
              receiverEmail: item.receiverEmail,
              subject: `Re: ${item.subject || 'Application Follow-Up'}`,
              body: bodyTxt,
              settings
            });

            const nextAttempt = currentAttempt + 1;
            item.currentAttempt = nextAttempt;

            if (nextAttempt < maxAttempts) {
              const nextDate = new Date(now.getTime() + daysGap * 24 * 60 * 60 * 1000);
              item.followUpDate = nextDate.toISOString();
              item.followUpStatus = 'Pending';
            } else {
              item.followUpStatus = 'Sent';
              item.followUpSentAt = now.toISOString();
            }

            updated = true;
            console.log(`[AutoFollowUp] Sent follow-up (Attempt ${nextAttempt}/${maxAttempts}) to ${item.receiverEmail}`);
          } catch (err) {
            console.error(`[AutoFollowUp] Error sending to ${item.receiverEmail}:`, err.message);
          }
        }
      }
    }
    if (updated) writeJson(HISTORY_FILE, history);
  } catch (err) {
    console.error('[AutoFollowUp] Scheduler error:', err);
  }
}

// Immediate bootup catch-up trigger & interval ticker
processDueFollowups();
setInterval(processDueFollowups, 60000);

// 5. Send Email via SMTP
app.post('/api/send-email', async (req, res) => {
  const {
    receiverEmail,
    subject,
    body,
    followUpBody,
    followUpDrafts = [],
    maxAttempts: reqMaxAttempts,
    daysGap: reqDaysGap,
    resumeFilePath,
    resumeFilename,
    jobTitle = 'Job Application'
  } = req.body;

  if (!receiverEmail || !subject || !body) {
    return res.status(400).json({ success: false, message: 'Receiver Email, Subject, and Email Body are required.' });
  }

  const settings = readJson(SETTINGS_FILE, {});
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    return res.status(400).json({
      success: false,
      message: 'SMTP settings are incomplete. Please configure your SMTP Host, User, and App Password in Settings.'
    });
  }

  try {
    const { info, finalBody, attachments } = await dispatchSmtpEmail({
      receiverEmail,
      subject,
      body,
      resumeFilePath,
      resumeFilename,
      settings
    });

    const daysGap = Number(reqDaysGap) || Number(settings.daysGap) || Number(settings.followUpDelayDays) || 3;
    const maxAttempts = Number(reqMaxAttempts) || Number(settings.maxAttempts) || 4;

    const drafts = Array.isArray(followUpDrafts) && followUpDrafts.length > 0 ? followUpDrafts : (followUpBody && followUpBody.trim() ? [followUpBody.trim()] : []);
    const followUpDate = new Date(Date.now() + daysGap * 24 * 60 * 60 * 1000).toISOString();
    const hasFollowUp = drafts.length > 0;

    // Save to History Log
    const history = readJson(HISTORY_FILE, []);
    const historyItem = {
      id: Date.now().toString(),
      receiverEmail,
      subject,
      body: finalBody,
      jobTitle,
      sentAt: new Date().toISOString(),
      messageId: info.messageId,
      status: 'Sent',
      resumeAttached: attachments.length > 0 ? (resumeFilename || 'Resume.pdf') : 'None',
      followUpBody: drafts[0] || '',
      followUpDrafts: drafts,
      currentAttempt: 0,
      maxAttempts,
      daysGap,
      followUpDate: hasFollowUp ? followUpDate : '',
      followUpStatus: hasFollowUp ? 'Pending' : 'None'
    };
    history.unshift(historyItem);
    writeJson(HISTORY_FILE, history);

    res.json({
      success: true,
      message: `Email successfully sent to ${receiverEmail}!`,
      messageId: info.messageId,
      historyItem
    });

  } catch (err) {
    console.error('Send Mail Error:', err);
    res.status(500).json({ success: false, message: `Failed to send email: ${err.message}` });
  }
});

// 6. Get Application History
app.get('/api/history', (req, res) => {
  const history = readJson(HISTORY_FILE, []);
  res.json({ success: true, history });
});

// Manual follow-up dispatch
app.post('/api/history/:id/send-followup', async (req, res) => {
  const history = readJson(HISTORY_FILE, []);
  const item = history.find(h => h.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'History record not found.' });

  const drafts = item.followUpDrafts || [];
  if (drafts.length === 0 && item.followUpBody) drafts.push(item.followUpBody);

  if (drafts.length === 0) {
    return res.status(400).json({ success: false, message: 'No follow-up draft available for this email.' });
  }

  const currentAttempt = Number(item.currentAttempt) || 0;
  const maxAttempts = Number(item.maxAttempts) || (drafts.length || 1);
  const daysGap = Number(item.daysGap) || 3;

  const bodyTxt = currentAttempt < drafts.length ? drafts[currentAttempt] : drafts[drafts.length - 1];
  const settings = readJson(SETTINGS_FILE, {});

  try {
    await dispatchSmtpEmail({
      receiverEmail: item.receiverEmail,
      subject: `Re: ${item.subject || 'Application Follow-Up'}`,
      body: bodyTxt,
      settings
    });

    const nextAttempt = currentAttempt + 1;
    item.currentAttempt = nextAttempt;

    if (nextAttempt < maxAttempts) {
      const nextDate = new Date(Date.now() + daysGap * 24 * 60 * 60 * 1000);
      item.followUpDate = nextDate.toISOString();
      item.followUpStatus = 'Pending';
    } else {
      item.followUpStatus = 'Sent';
      item.followUpSentAt = new Date().toISOString();
    }

    writeJson(HISTORY_FILE, history);
    res.json({ success: true, message: `Follow-up email (Attempt ${nextAttempt}/${maxAttempts}) sent to ${item.receiverEmail}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to send follow-up: ${err.message}` });
  }
});

// Cancel follow-up
app.post('/api/history/:id/cancel-followup', (req, res) => {
  const history = readJson(HISTORY_FILE, []);
  const item = history.find(h => h.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'History record not found.' });

  item.followUpStatus = 'Cancelled';
  writeJson(HISTORY_FILE, history);
  res.json({ success: true, message: 'Follow-up cancelled.' });
});

// Delete history item
app.delete('/api/history/:id', (req, res) => {
  let history = readJson(HISTORY_FILE, []);
  history = history.filter(h => h.id !== req.params.id);
  writeJson(HISTORY_FILE, history);
  res.json({ success: true, message: 'Record deleted.' });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 AutoApply Backend Server running on http://localhost:${PORT}`);
});
