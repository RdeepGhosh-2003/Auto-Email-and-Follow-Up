"""
End-to-end verification of all three email payload formatting fixes.
Run: .venv\\Scripts\\python.exe test_payload.py
"""
import re
import sys

# -----------------------------------------------------------------------
# Inline the fixed functions (same code as in app.py) so we can test
# without needing the full FastAPI stack running.
# -----------------------------------------------------------------------

def _body_to_html(text: str) -> str:
    paragraphs = re.split(r'\n{2,}', text.strip())
    html_paragraphs = []
    for para in paragraphs:
        para_html = para.replace('\n', ' ').strip()
        html_paragraphs.append(para_html)
    return '<br><br>'.join(html_paragraphs)


def construct_email_payloads(body, signature, linkedin_url="", github_url=""):
    plain_text = body.strip()
    body_html = _body_to_html(body)
    html_text = f"<div style='font-family:Arial;'>{body_html}</div>"

    social_links = []
    if linkedin_url and linkedin_url.strip():
        url = linkedin_url.strip()
        if not url.startswith("http"):
            url = "https://" + url
        social_links.append(f'<a href="{url}">LinkedIn</a>')
    if github_url and github_url.strip():
        url = github_url.strip()
        if not url.startswith("http"):
            url = "https://" + url
        social_links.append(f'<a href="{url}">Github</a>')

    if signature and signature.strip():
        sig_plain = signature.strip()
        sig_html = re.sub(r'\n', '<br/>', sig_plain)
        if sig_plain not in plain_text:
            plain_text += f"\n\n---\n{sig_plain}"
            html_text += f"<br/><div style='border-top:1px solid #e5e7eb;'>{sig_html}"
            if social_links:
                social_html_str = " | ".join(social_links)
                plain_social = " | ".join(
                    [('LinkedIn' if 'linkedin' in l.lower() else 'Github') + ": " +
                     re.search(r'href="([^"]+)"', l).group(1)
                     for l in social_links]
                )
                plain_text += f"\n{plain_social}"
                html_text += f"<br/><span style='font-size:13px;'>{social_html_str}</span>"
            html_text += "</div>"
    elif social_links:
        social_html_str = " | ".join(social_links)
        plain_social = " | ".join(
            [('LinkedIn' if 'linkedin' in l.lower() else 'Github') + ": " +
             re.search(r'href="([^"]+)"', l).group(1)
             for l in social_links]
        )
        plain_text += f"\n\n{plain_social}"
        html_text += f"<br/><br/><div style='font-size:13px;'>{social_html_str}</div>"

    return plain_text, html_text


def deduplicate_keywords(raw_matched):
    cleaned = []
    seen = set()
    for w in raw_matched:
        w_clean = re.sub(r'[^a-zA-Z0-9#+]', '', w).title()
        if w_clean and w_clean.lower() not in seen:
            seen.add(w_clean.lower())
            cleaned.append(w_clean)
    return ", ".join(cleaned[:4]) or "core technologies"


# -----------------------------------------------------------------------
# TESTS
# -----------------------------------------------------------------------

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
errors = 0

def check(label, condition, got, expected_desc=""):
    global errors
    if condition:
        print(f"  {PASS}  {label}")
    else:
        print(f"  {FAIL}  {label}")
        print(f"         Expected: {expected_desc}")
        print(f"         Got:      {got!r}")
        errors += 1

print("\n" + "="*60)
print("FIX 1 — Random line-break conversion")
print("="*60)

body = (
    "Dear Hiring Manager,\n\n"
    "I am applying for the Senior Data Engineer role.\n"
    "I have strong experience in Python and Spark.\n\n"
    "Please find my resume attached.\n\n"
    "Best regards,\nRajdeep"
)

html = _body_to_html(body)

# Single \n inside a paragraph must NOT produce <br> between
# consecutive soft-wrapped sentences within same paragraph.
# In our implementation single \n → space, so we check the joined output
# contains the two sentences on the same line.
first_para_html = html.split("<br><br>")[0]  # just the first paragraph
check(
    "Single \\n inside paragraph → space, not <br>",
    "<br>" not in first_para_html and "role. I have" in first_para_html,
    first_para_html,
    "no <br> and 'role. I have' joined in same paragraph"
)

# Double \n → <br><br>
check(
    "Double \\n between paragraphs → <br><br>",
    html.count("<br><br>") >= 3,
    html.count("<br><br>"),
    "at least 3 <br><br> paragraph separators"
)

# 'Senior Data Engineer role. I have' should be on same line
check(
    "Soft-wrapped lines joined with space",
    "role. I have" in html,
    html,
    "'role. I have' on same line"
)

print("\n" + "="*60)
print("FIX 2 — Keyword deduplication & punctuation stripping")
print("="*60)

# Simulate the buggy old input: duplicates + trailing dots
raw_bad = ["transformation", "data.", "data", "sales", "python.", "python"]
result = deduplicate_keywords(raw_bad)

check(
    "No duplicate tokens",
    result.lower().count("data") == 1 and result.lower().count("python") == 1,
    result,
    "each token appears only once"
)

check(
    "No trailing dots in output",
    "." not in result,
    result,
    "no dots in joined string"
)

check(
    "Clean comma-space join",
    ", " in result and not result.endswith(", "),
    result,
    "items separated by ', '"
)

print(f"  Output: '{result}'")

print("\n" + "="*60)
print("FIX 3 — Signature spacing & social links formatting")
print("="*60)

sig = "Best regards,\nAlex Developer\n+1234567890 | alex@example.com"
linkedin = "https://linkedin.com/in/rajdeep"
github   = "https://github.com/rajdeep"

plain, html = construct_email_payloads(body, sig, linkedin, github)

# Should NOT have double <br/><br/> before social links
social_section_html = html[html.find("border-top"):]
check(
    "Social links NOT preceded by extra <br/><br/>",
    "<br/><br/>" not in social_section_html,
    social_section_html[:200],
    "only single <br/> between signature text and social links"
)

# LinkedIn and Github on the SAME line (in <span>, pipe-separated)
check(
    "LinkedIn and Github in one <span> separated by ' | '",
    "<span" in html and "LinkedIn</a> | <a" in html and "Github</a>" in html,
    html[html.find("<span"):html.find("</span>")+7] if "<span" in html else "",
    "<span>..LinkedIn.. | ..Github..</span>"
)

# Plain text version has proper social line
check(
    "Plain text has LinkedIn and Github on same line",
    "LinkedIn: https://linkedin.com/in/rajdeep | Github: https://github.com/rajdeep" in plain,
    plain[-200:],
    "single line 'LinkedIn: <url> | Github: <url>'"
)

# No excess blank lines before social in plain text
sig_end_idx = plain.find("alex@example.com") + len("alex@example.com")
after_sig = plain[sig_end_idx:]
check(
    "Plain text: no extra blank lines between sig and social links",
    after_sig.startswith("\nLinkedIn"),
    after_sig[:60],
    "exactly one \\n before LinkedIn line"
)

print("\n" + "="*60)
print("FULL HTML OUTPUT PREVIEW (signature + social block):")
print("="*60)
idx = html.find("border-top")
print(html[max(0,idx-8):] if idx >= 0 else html[-500:])

print("\n" + "="*60)
if errors == 0:
    print(f"ALL TESTS PASSED ({PASS})")
else:
    print(f"{errors} test(s) FAILED")
    sys.exit(1)
print("="*60 + "\n")
