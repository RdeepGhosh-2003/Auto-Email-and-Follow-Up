import React, { useState, useEffect } from 'react';
import {
  Send,
  Sparkles,
  FileText,
  Settings,
  History,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  Paperclip,
  Check,
  RotateCcw,
  Zap,
  Mail,
  User,
  Key,
  Server,
  X
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('generator');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form State
  const [receiverEmail, setReceiverEmail] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [resumes, setResumes] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedResumeText, setExtractedResumeText] = useState('');
  const [selectedResumePath, setSelectedResumePath] = useState('');
  const [selectedResumeFilename, setSelectedResumeFilename] = useState('');

  const [tone, setTone] = useState('Professional');
  const [customNotes, setCustomNotes] = useState('');

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [followUpBody, setFollowUpBody] = useState('');
  const [followUpDrafts, setFollowUpDrafts] = useState([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [atsAnalysis, setAtsAnalysis] = useState(null);
  const [activePreviewSubTab, setActivePreviewSubTab] = useState('main'); // 'main' | 'followup'

  // Sending State
  const [isSending, setIsSending] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('All');

  // Settings State
  const [settings, setSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    senderName: '',
    signature: 'Best regards,\n[Your Name]\n[Your Phone] | [Your Email]',
    linkedinUrl: '',
    githubUrl: '',
    geminiApiKey: '',
    autoFollowUpEnabled: true,
    followUpDelayDays: 3,
    daysGap: 3,
    maxAttempts: 4
  });
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial Load
  useEffect(() => {
    fetchSettings();
    fetchResumes();
    fetchHistory();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch('/api/resumes');
      const data = await res.json();
      if (data.success) {
        setResumes(data.resumes || []);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Select a saved resume profile
  const handleSelectResume = (e) => {
    const id = e.target.value;
    setSelectedResumeId(id);
    const found = resumes.find(r => r.id === id);
    if (found) {
      setExtractedResumeText(found.text);
      setSelectedResumePath(found.filePath);
      setSelectedResumeFilename(found.filename);
      showToast(`Loaded resume preset: ${found.name}`);
    }
  };

  // Upload PDF Resume
  const handleFileUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profileName', file.name.replace('.pdf', ''));

    showToast('Extracting resume PDF...', 'info');
    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setExtractedResumeText(data.text);
        setSelectedResumePath(data.resume.filePath);
        setSelectedResumeFilename(data.resume.filename);
        setSelectedResumeId(data.resume.id);
        fetchResumes();
        showToast('Resume parsed successfully!');
      } else {
        showToast('Failed to parse PDF.', 'error');
      }
    } catch (err) {
      showToast(`Upload error: ${err.message}`, 'error');
    }
  };

  // Generate Tailored Email with Multi-Stage Drip Sequence
  const handleGenerateEmail = async () => {
    if (!extractedResumeText) {
      showToast('Please upload or select a Resume PDF first.', 'error');
      return;
    }
    if (!jobDescription.trim()) {
      showToast('Please paste the Job Description.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: extractedResumeText,
          jobDescription,
          tone,
          customNotes,
          senderName: settings.senderName
        })
      });
      const data = await res.json();

      if (data.success) {
        const cleanSignOff = (text) => text ? text.replace(/(Best regards|Sincerely|Thank you|Yours truly|Kind regards|Warm regards|Regards)[,\s]+.*$/is, '').trim() : '';
        setSubject(data.subject);
        setEmailBody(cleanSignOff(data.body));
        const drafts = (data.followUpDrafts || [data.followUp]).map(cleanSignOff).filter(Boolean);
        setFollowUpDrafts(drafts);
        setFollowUpBody(drafts[0] || '');
        setActiveDraftIndex(0);
        setAtsAnalysis(data.atsAnalysis);
        showToast(`Tailored email & ${drafts.length}-step drip sequence generated!`);
      } else {
        showToast(data.message || 'Generation failed.', 'error');
      }
    } catch (err) {
      showToast(`Generation error: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Send Email to Recipient
  const handleSendEmail = async () => {
    if (!receiverEmail.trim()) {
      showToast('Please enter the Recipient Email address.', 'error');
      return;
    }
    if (!subject.trim() || !emailBody.trim()) {
      showToast('Please generate or write an email first.', 'error');
      return;
    }
    if (!settings.smtpUser || !settings.smtpPass) {
      showToast('Please configure your SMTP email settings first.', 'error');
      setShowSettingsModal(true);
      return;
    }

    setIsSending(true);
    try {
      const draftsToSend = followUpDrafts.length > 0 ? followUpDrafts : (followUpBody ? [followUpBody] : []);
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverEmail,
          subject,
          body: emailBody,
          followUpBody: draftsToSend[0] || followUpBody,
          followUpDrafts: draftsToSend,
          maxAttempts: settings.maxAttempts || 4,
          daysGap: settings.daysGap || settings.followUpDelayDays || 3,
          resumeFilePath: selectedResumePath,
          resumeFilename: selectedResumeFilename,
          jobTitle: subject.replace('Application for ', '')
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Email sent successfully to ${receiverEmail}! Drip sequence scheduled.`, 'success');
        fetchHistory();
      } else {
        showToast(data.message || 'Failed to send email.', 'error');
      }
    } catch (err) {
      showToast(`Send error: ${err.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Trigger manual follow-up dispatch
  const handleSendFollowUpNow = async (id) => {
    try {
      showToast('Sending follow-up email...', 'info');
      const res = await fetch(`/api/history/${id}/send-followup`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Follow-up email dispatched!');
        fetchHistory();
      } else {
        showToast(data.message || 'Failed to send follow-up.', 'error');
      }
    } catch (err) {
      showToast(`Follow-up error: ${err.message}`, 'error');
    }
  };

  // Cancel scheduled follow-up
  const handleCancelFollowUp = async (id) => {
    try {
      const res = await fetch(`/api/history/${id}/cancel-followup`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Follow-up cancelled.');
        fetchHistory();
      } else {
        showToast(data.message || 'Failed to cancel follow-up.', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully!');
        setShowSettingsModal(false);
      }
    } catch (err) {
      showToast(`Settings save error: ${err.message}`, 'error');
    }
  };

  // Verify SMTP Connection
  const handleVerifySmtp = async () => {
    setIsVerifyingSmtp(true);
    try {
      const res = await fetch('/api/settings/verify-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        showToast('SMTP connection test succeeded! Ready to send emails.', 'success');
      } else {
        showToast(data.message || 'SMTP connection failed.', 'error');
      }
    } catch (err) {
      showToast(`SMTP test error: ${err.message}`, 'error');
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  // Delete Resume
  const handleDeleteResume = async (id) => {
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Resume profile deleted.');
        fetchResumes();
      }
    } catch (err) {
      showToast('Error deleting resume.', 'error');
    }
  };

  // Delete History Record
  const handleDeleteHistory = async (id) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('History item removed.');
        fetchHistory();
      }
    } catch (err) {
      showToast('Error removing item.', 'error');
    }
  };

  // Helper Sample Paste
  const handlePasteSampleJd = () => {
    setJobDescription(
`Senior Full Stack Engineer
Company: TechFlow Innovations
Location: Remote

About the Role:
We are looking for a Senior Full Stack Engineer experienced in React, Node.js, REST APIs, and Cloud Infrastructure (AWS). You will be building scalable web applications, optimizing frontend performance, and leading feature development.

Key Requirements:
• 4+ years experience with React, JavaScript, HTML5, CSS3.
• Strong backend skills in Node.js, Express, and PostgreSQL/MongoDB.
• Experience with RESTful APIs, Git workflows, and CI/CD pipelines.
• Excellent communication skills and ability to work in an agile team.`
    );
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Navigation */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={24} />
          </div>
          <div>
            <h1 className="brand-title">Auto Email and Follow-Up</h1>
            <p className="brand-subtitle">Cold Email & Job Application Automation</p>
          </div>
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'generator' ? 'active' : ''}`}
            onClick={() => setActiveTab('generator')}
          >
            <Sparkles size={16} />
            <span>Email Generator</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'resumes' ? 'active' : ''}`}
            onClick={() => setActiveTab('resumes')}
          >
            <FileText size={16} />
            <span>Saved Resumes ({resumes.length})</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>Outreach Log ({history.length})</span>
          </button>

          <button
            className="nav-tab"
            style={{ marginLeft: '8px', borderLeft: '1px solid var(--border-color)' }}
            onClick={() => setShowSettingsModal(true)}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* --- TAB 1: COLD EMAIL GENERATOR --- */}
      {activeTab === 'generator' && (
        <div className="generator-grid">
          {/* LEFT COLUMN: INPUTS */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={20} color="var(--primary)" />
              Application Parameters
            </h2>

            {/* Recipient Email */}
            <div className="form-group">
              <label className="form-label">
                <span>Receiver's Email Address</span>
                <span className="form-label-sub">Recruiter or Hiring Manager</span>
              </label>
              <input
                type="email"
                className="input-text"
                placeholder="e.g. recruiter@company.com"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
              />
            </div>

            {/* Resume Selection / Upload */}
            <div className="form-group">
              <div className="form-label">
                <span>Your Resume PDF</span>
                <span className="form-label-sub">Upload or pick preset</span>
              </div>

              {resumes.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <select
                    className="input-text"
                    value={selectedResumeId}
                    onChange={handleSelectResume}
                  >
                    <option value="" disabled>-- Select a Saved Resume --</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        📄 {r.name} ({new Date(r.uploadedAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  fileInput.accept = '.pdf';
                  fileInput.onchange = (e) => handleFileUpload(e.target.files[0]);
                  fileInput.click();
                }}
              >
                <UploadCloud className="dropzone-icon" />
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {selectedResumeFilename ? `Selected: ${selectedResumeFilename}` : 'Click or Drag & Drop Resume PDF here'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Text will be parsed automatically for ATS matching
                </p>
              </div>
            </div>

            {/* Job Description Textarea */}
            <div className="form-group">
              <div className="form-label">
                <span>Target Job Description</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handlePasteSampleJd}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    + Paste Sample JD
                  </button>
                  {jobDescription && (
                    <button
                      type="button"
                      onClick={() => setJobDescription('')}
                      style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="textarea"
                rows={6}
                placeholder="Paste the full job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {/* Email Tone Selection */}
            <div className="form-group">
              <label className="form-label">
                <span>Communication Tone</span>
              </label>
              <div className="tone-pills">
                {['Professional', 'Enthusiastic', 'Executive', 'Direct'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tone-pill ${tone === t ? 'active' : ''}`}
                    onClick={() => setTone(t)}
                  >
                    {t === 'Professional' && '💼 '}
                    {t === 'Enthusiastic' && '🚀 '}
                    {t === 'Executive' && '🏆 '}
                    {t === 'Direct' && '🎯 '}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt / Instructions */}
            <div className="form-group">
              <label className="form-label">
                <span>Custom Prompt / Instructions</span>
                <span className="form-label-sub">Optional</span>
              </label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="e.g., Write this in a highly aggressive sales tone, keep it under 3 sentences, and mention my background in Python."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </div>

            {/* Generate Action Button */}
            <button
              className="btn-primary"
              onClick={handleGenerateEmail}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <RotateCcw className="spin" size={18} />
                  <span>Synthesizing AI Email...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Tailored Email</span>
                </>
              )}
            </button>
          </div>

          {/* RIGHT COLUMN: PREVIEW & ATS MATCH */}
          <div>
            {/* ATS Score Card */}
            {atsAnalysis ? (
              <div className="ats-card">
                <div className="score-circle">
                  <span>{atsAnalysis.score}%</span>
                  <span className="score-label">ATS Match</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '4px' }}>Keyword & Skill Breakdown</h4>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Matching: </span>
                    <div className="keywords-tags">
                      {atsAnalysis.matched.map((m, i) => (
                        <span key={i} className="tag-match">✓ {m}</span>
                      ))}
                    </div>
                  </div>
                  {atsAnalysis.missing.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Missing / Add To Resume: </span>
                      <div className="keywords-tags">
                        {atsAnalysis.missing.slice(0, 8).map((m, i) => (
                          <span key={i} className="tag-missing">+ {m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(99, 102, 241, 0.05)' }}>
                <Zap size={20} color="var(--primary)" />
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  ATS Match Score & Keyword Analysis will automatically calculate when you generate your email.
                </p>
              </div>
            )}

            {/* In-App Live Email Preview Pane */}
            <div className="email-preview-card">
              <div className="email-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`btn-secondary ${activePreviewSubTab === 'main' ? 'active' : ''}`}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        background: activePreviewSubTab === 'main' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                        borderColor: activePreviewSubTab === 'main' ? 'var(--primary)' : 'var(--border-color)'
                      }}
                      onClick={() => setActivePreviewSubTab('main')}
                    >
                      Main Application Email
                    </button>
                    <button
                      className={`btn-secondary ${activePreviewSubTab === 'followup' ? 'active' : ''}`}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        background: activePreviewSubTab === 'followup' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        borderColor: activePreviewSubTab === 'followup' ? 'var(--accent)' : 'var(--border-color)'
                      }}
                      onClick={() => setActivePreviewSubTab('followup')}
                    >
                      Drip Sequence ({followUpDrafts.length || 1} Drafts)
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const txt = activePreviewSubTab === 'main' 
                        ? `${subject}\n\n${emailBody}` 
                        : (followUpDrafts[activeDraftIndex] || followUpBody);
                      navigator.clipboard.writeText(txt);
                      showToast('Copied text to clipboard!');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                  >
                    <Copy size={14} /> Copy Text
                  </button>
                </div>

                <div className="email-meta-row">
                  <span className="email-meta-label">From:</span>
                  <span className="email-meta-val">{settings.senderEmail || settings.smtpUser || 'Your Configured Email'}</span>
                </div>
                <div className="email-meta-row">
                  <span className="email-meta-label">To:</span>
                  <span className="email-meta-val">{receiverEmail || '[Recipient Email Address]'}</span>
                </div>
                <div className="email-meta-row" style={{ alignItems: 'center', marginBottom: 0 }}>
                  <span className="email-meta-label">Attached:</span>
                  <span className="attachment-badge">
                    <Paperclip size={12} />
                    {selectedResumeFilename || 'Resume.pdf'}
                  </span>
                </div>
              </div>

              {/* Editable Preview Body */}
              <div style={{ padding: '20px' }}>
                {activePreviewSubTab === 'main' ? (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Subject Line:</label>
                      <input
                        type="text"
                        className="input-text"
                        style={{ fontWeight: 600, color: 'var(--text-main)' }}
                        placeholder="Email Subject Line"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Body (Editable):</label>
                      <textarea
                        className="textarea textarea-mono"
                        rows={11}
                        placeholder="Generated email body will appear here..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    {followUpDrafts && followUpDrafts.length > 0 ? (
                      <div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                          {followUpDrafts.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveDraftIndex(idx)}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: 'none',
                                background: activeDraftIndex === idx ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                                color: activeDraftIndex === idx ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                            >
                              Draft {idx + 1}
                            </button>
                          ))}
                        </div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Follow-Up Draft {activeDraftIndex + 1} of {followUpDrafts.length} (Editable):
                        </label>
                        <textarea
                          className="textarea textarea-mono"
                          rows={11}
                          placeholder="Follow-up draft will appear here..."
                          value={followUpDrafts[activeDraftIndex] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...followUpDrafts];
                            updated[activeDraftIndex] = val;
                            setFollowUpDrafts(updated);
                            if (activeDraftIndex === 0) setFollowUpBody(val);
                          }}
                        />
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Follow-Up Email Draft (Editable):</label>
                        <textarea
                          className="textarea textarea-mono"
                          rows={11}
                          placeholder="Follow-up draft will appear here..."
                          value={followUpBody}
                          onChange={(e) => {
                            setFollowUpBody(e.target.value);
                            setFollowUpDrafts([e.target.value]);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Action Send Button */}
                <div style={{ marginTop: '20px' }}>
                  <button
                    className="btn-primary btn-success"
                    onClick={handleSendEmail}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <>
                        <RotateCcw className="spin" size={18} />
                        <span>Dispatching Email via SMTP...</span>
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Send Email to Recipient</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: SAVED RESUMES --- */}
      {activeTab === 'resumes' && (
        <div className="glass-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Saved Resume Profiles</h2>
          {resumes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No saved resumes yet. Upload one on the Email Generator tab!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {resumes.map((r) => (
                <div key={r.id} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{r.name}</h3>
                    <button
                      onClick={() => handleDeleteResume(r.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
                    Uploaded: {new Date(r.uploadedAt).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxHheight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.text.slice(0, 180)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: OUTREACH LOG & FOLLOW-UP TRACKER --- */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Outreach Log</h2>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {['All', 'Sent', 'Scheduled', 'Cancelled'].map((tab) => {
                const count = history.filter((item) => {
                  if (tab === 'All') return true;
                  if (tab === 'Sent') return item.followUpStatus === 'Sent' || !item.followUpStatus || item.followUpStatus === 'None';
                  if (tab === 'Scheduled') return item.followUpStatus === 'Pending';
                  if (tab === 'Cancelled') return item.followUpStatus === 'Cancelled';
                  return true;
                }).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setHistoryFilter(tab)}
                    style={{
                      padding: '4px 14px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: historyFilter === tab ? 'var(--primary)' : 'transparent',
                      color: historyFilter === tab ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No emails sent yet. Applications you send will be logged here.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Recipient</th>
                    <th style={{ padding: '12px' }}>Subject</th>
                    <th style={{ padding: '12px' }}>Attachment</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .filter((item) => {
                      if (historyFilter === 'All') return true;
                      if (historyFilter === 'Sent') return item.followUpStatus === 'Sent' || !item.followUpStatus || item.followUpStatus === 'None';
                      if (historyFilter === 'Scheduled') return item.followUpStatus === 'Pending';
                      if (historyFilter === 'Cancelled') return item.followUpStatus === 'Cancelled';
                      return true;
                    })
                    .map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-dim)' }}>
                          {new Date(item.sentAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'white' }}>{item.receiverEmail}</td>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>{item.subject}</td>
                        <td style={{ padding: '12px' }}>
                          <span className="attachment-badge">{item.resumeAttached}</span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {item.followUpStatus === 'Pending' ? (
                            <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              ⏳ Scheduled (Attempt {(item.currentAttempt || 0) + 1} of {item.maxAttempts || 4})
                            </span>
                          ) : item.followUpStatus === 'Cancelled' ? (
                            <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(244,63,94,0.15)', color: '#f43f5e', fontSize: '0.75rem', fontWeight: 600 }}>
                              Cancelled
                            </span>
                          ) : (
                            <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>
                              ✓ Sent
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {item.followUpStatus === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleSendFollowUpNow(item.id)}
                                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, marginRight: '8px' }}
                                title="Send Follow-Up Immediately"
                              >
                                ⚡ Send Now
                              </button>
                              <button
                                onClick={() => handleCancelFollowUp(item.id)}
                                style={{ background: 'rgba(244,63,94,0.2)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', marginRight: '12px' }}
                                title="Cancel Scheduled Follow-Up"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.body);
                              showToast('Copied email body!');
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}
                            title="Copy Email Body"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}
                            title="Delete History Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--primary)" />
                SMTP & AI Settings
              </h3>
              <button className="btn-close" onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>1. Outgoing SMTP Server (Gmail / Custom)</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="smtp.gmail.com"
                    value={settings.smtpHost}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="465"
                    value={settings.smtpPort}
                    onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">SMTP Email User</label>
                <input
                  type="email"
                  className="input-text"
                  placeholder="your.email@gmail.com"
                  value={settings.smtpUser}
                  onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>SMTP Password / Gmail App Password</span>
                  <span className="form-label-sub">16-character App Password</span>
                </label>
                <input
                  type="password"
                  className="input-text"
                  placeholder="•••• •••• •••• ••••"
                  value={settings.smtpPass}
                  onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleVerifySmtp}
                  disabled={isVerifyingSmtp}
                >
                  {isVerifyingSmtp ? 'Testing Connection...' : '⚡ Test SMTP Connection'}
                </button>
              </div>

              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px' }}>2. Candidate Profile & Signature</h4>

              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Rajdeep Ghosh"
                  value={settings.senderName}
                  onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Custom Email Signature</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Best regards,&#10;Your Name&#10;Phone | your.email@example.com"
                  value={settings.signature}
                  onChange={(e) => setSettings({ ...settings, signature: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">LinkedIn Profile URL</label>
                <input
                  type="url"
                  className="input-text"
                  placeholder="e.g. https://linkedin.com/in/username"
                  value={settings.linkedinUrl || ''}
                  onChange={(e) => setSettings({ ...settings, linkedinUrl: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GitHub Profile URL</label>
                <input
                  type="url"
                  className="input-text"
                  placeholder="e.g. https://github.com/username"
                  value={settings.githubUrl || ''}
                  onChange={(e) => setSettings({ ...settings, githubUrl: e.target.value })}
                />
              </div>

              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#34d399', marginBottom: '12px' }}>3. Optional Gemini API Key</h4>
              <div className="form-group">
                <label className="form-label">
                  <span>Gemini API Key</span>
                  <span className="form-label-sub">Optional - for enhanced AI Generation</span>
                </label>
                <input
                  type="password"
                  className="input-text"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                />
              </div>

              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fbbf24', marginBottom: '12px' }}>4. Automated Drip Campaign Settings</h4>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="autoFollowUpEnabled"
                  checked={settings.autoFollowUpEnabled !== false}
                  onChange={(e) => setSettings({ ...settings, autoFollowUpEnabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="autoFollowUpEnabled" style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  Enable Automated Background Drip Follow-Ups
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">
                    <span>Gap Between Emails (Days)</span>
                    <span className="form-label-sub">Days delay between sequence steps</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="input-text"
                    placeholder="3"
                    value={settings.daysGap || settings.followUpDelayDays || 3}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 3;
                      setSettings({ ...settings, daysGap: val, followUpDelayDays: val });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>Total Follow-Up Attempts</span>
                    <span className="form-label-sub">Number of follow-up drafts in sequence</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input-text"
                    placeholder="4"
                    value={settings.maxAttempts || 4}
                    onChange={(e) => setSettings({ ...settings, maxAttempts: parseInt(e.target.value) || 4 })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSettingsModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
