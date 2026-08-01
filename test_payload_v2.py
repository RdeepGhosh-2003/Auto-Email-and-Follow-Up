"""
Verification test for Issue 1 (no underlines) and Issue 2 (dynamic portfolio label).
Imports directly from app.py to test the live code.
"""
import re, sys

# ---- import from app.py directly ----
sys.path.insert(0, '.')
from app import construct_email_payloads, _body_to_html

PASS = "[PASS]"
FAIL = "[FAIL]"
errors = 0

def check(label, ok, got="", expected=""):
    global errors
    mark = PASS if ok else FAIL
    print(f"  {mark}  {label}")
    if not ok:
        print(f"         Expected: {expected}")
        print(f"         Got:      {got!r}")
        errors += 1

# ----------------------------------------------------------------
# Build a payload using GitHub as portfolio name (the common case)
# ----------------------------------------------------------------
body = "Dear Hiring Manager,\n\nI am applying for the Senior Role.\nI have 5 years of experience.\n\nPlease find my resume attached.\n\nBest regards,\nAlex"
sig  = "Best regards,\nAlex Developer\n+1234567890 | alex@example.com"

plain, html = construct_email_payloads(
    body, sig,
    linkedin_url="https://linkedin.com/in/alex",
    portfolio_url="https://github.com/alex",
    portfolio_name="GitHub"
)

print("\n" + "="*60)
print("ISSUE 1 — No underlines on anchor tags")
print("="*60)

check(
    "LinkedIn anchor has text-decoration: none",
    'text-decoration: none' in html and 'text-decoration: underline' not in html,
    html[html.find('<a href'):html.find('<a href')+200] if '<a href' in html else '',
    "text-decoration: none"
)

check(
    "Portfolio anchor has text-decoration: none",
    html.count('text-decoration: none') == 2,
    f"count={html.count('text-decoration: none')}",
    "exactly 2 anchors with text-decoration: none"
)

print("\n" + "="*60)
print("ISSUE 2 — Dynamic portfolio label (GitHub)")
print("="*60)

check(
    "HTML contains '>GitHub</a>' (not hardcoded 'Github')",
    ">GitHub</a>" in html,
    html[-600:],
    ">GitHub</a>"
)

check(
    "Plain text contains 'GitHub: https://github.com/alex'",
    "GitHub: https://github.com/alex" in plain,
    plain[-300:],
    "GitHub: https://github.com/alex"
)

# ----------------------------------------------------------------
# Test with a custom portfolio name (non-GitHub)
# ----------------------------------------------------------------
print("\n" + "="*60)
print("ISSUE 2 — Custom portfolio label ('My Blog')")
print("="*60)

_, html2 = construct_email_payloads(
    body, sig,
    linkedin_url="https://linkedin.com/in/alex",
    portfolio_url="https://myblog.com",
    portfolio_name="My Blog"
)
plain2, _ = construct_email_payloads(
    body, sig,
    linkedin_url="https://linkedin.com/in/alex",
    portfolio_url="https://myblog.com",
    portfolio_name="My Blog"
)

check(
    "HTML label uses custom name '>My Blog</a>'",
    ">My Blog</a>" in html2,
    html2[-400:],
    ">My Blog</a>"
)

check(
    "HTML does NOT contain hardcoded 'Github' or 'GitHub' for custom label",
    ">Github</a>" not in html2 and ">GitHub</a>" not in html2,
    html2[-400:],
    "no hardcoded Github/GitHub label"
)

check(
    "Plain text contains 'My Blog: https://myblog.com'",
    "My Blog: https://myblog.com" in plain2,
    plain2[-200:],
    "My Blog: https://myblog.com"
)

# ----------------------------------------------------------------
# Social links pipe-separated on same line
# ----------------------------------------------------------------
print("\n" + "="*60)
print("FORMAT — Links pipe-separated on same line")
print("="*60)

check(
    "HTML has 'LinkedIn</a> | <a' (same line, pipe separator)",
    "LinkedIn</a> | <a" in html,
    html[-600:],
    "LinkedIn</a> | <a"
)

check(
    "Plain text has 'LinkedIn: ... | GitHub: ...' on single line",
    "\nLinkedIn: https://linkedin.com/in/alex | GitHub: https://github.com/alex" in plain,
    plain[-200:],
    "LinkedIn and GitHub on one \\n-prefixed line"
)

# ----------------------------------------------------------------
# Summary
# ----------------------------------------------------------------
print("\n" + "="*60)
print("PLAIN TEXT OUTPUT (signature block):")
print("="*60)
idx = plain.find("---")
print(plain[idx:] if idx >= 0 else plain[-300:])

print("\n" + "="*60)
print("HTML OUTPUT (signature+social block):")
print("="*60)
idx = html.find("border-top")
print(html[max(0,idx-8):] if idx >= 0 else html[-500:])

print("\n" + "="*60)
if errors == 0:
    print(f"ALL {8} CHECKS PASSED")
else:
    print(f"{errors} check(s) FAILED")
    sys.exit(1)
print("="*60 + "\n")
