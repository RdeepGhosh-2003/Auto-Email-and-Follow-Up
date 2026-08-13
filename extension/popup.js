document.addEventListener('DOMContentLoaded', () => {
  checkServerHealth();
  setupEventListeners();
});

const BACKEND_URL = 'http://127.0.0.1:3000';

async function checkServerHealth() {
  const statusBar = document.getElementById('server-status-bar');
  const statusText = document.getElementById('status-text');

  try {
    const res = await fetch(`${BACKEND_URL}/api/settings`, { method: 'GET' });
    const data = await res.json();
    if (data.success) {
      statusBar.className = 'status-bar online';
      statusText.textContent = 'Server Online (http://127.0.0.1:3000)';
    } else {
      throw new Error('Server returned unsuccessful response');
    }
  } catch (err) {
    statusBar.className = 'status-bar offline';
    statusText.textContent = 'Server Offline — Double click run.bat to start';
  }
}

function setupEventListeners() {
  // Extract text from active browser tab
  document.getElementById('btn-extract-tab').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel = window.getSelection().toString();
          if (sel && sel.trim().length > 20) return sel.trim();
          return document.body.innerText.slice(0, 3000);
        }
      });

      if (result) {
        document.getElementById('ext-job-description').value = result;
      }
    } catch (err) {
      console.warn('Extraction notice:', err.message);
    }
  });

  // Open full dashboard in a new tab
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('static/index.html') });
  };

  document.getElementById('btn-open-dashboard').addEventListener('click', openDashboard);
  document.getElementById('btn-open-dashboard-header').addEventListener('click', openDashboard);
  document.getElementById('link-open-options').addEventListener('click', (e) => {
    e.preventDefault();
    openDashboard();
  });

  // Quick generate trigger
  document.getElementById('btn-quick-generate').addEventListener('click', () => {
    openDashboard();
  });
}
