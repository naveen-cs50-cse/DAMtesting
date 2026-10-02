const state = {
  conversations: JSON.parse(localStorage.getItem('dam-conversations') || '[]'),
  current: null,
  attachments: [],
};

const els = {
  body: document.body,
  sidebar: document.querySelector('#sidebar'),
  collapse: document.querySelector('#collapseSidebar'),
  mobileMenu: document.querySelector('#mobileMenu'),
  newConversation: document.querySelector('#newConversation'),
  historyList: document.querySelector('#historyList'),
  title: document.querySelector('#conversationTitle'),
  workspace: document.querySelector('#workspace'),
  conversation: document.querySelector('#conversation'),
  welcome: document.querySelector('#welcome'),
  form: document.querySelector('#composer'),
  input: document.querySelector('#promptInput'),
  send: document.querySelector('#sendButton'),
  fileInput: document.querySelector('#fileInput'),
  tray: document.querySelector('#attachmentTray'),
  report: document.querySelector('#downloadReport'),
  toast: document.querySelector('#toast'),
};

const icons = {
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5M7 8a7 7 0 0 1 11 1l2 3M4 12l2 3a7 7 0 0 0 11 1"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h4"/></svg>',
};

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

function save() {
  localStorage.setItem('dam-conversations', JSON.stringify(state.conversations.slice(0, 20)));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function titleFromPrompt(prompt) {
  return prompt.replace(/^fact-check\s*(this claim)?\s*:?\s*/i, '').slice(0, 42) || 'New investigation';
}

function renderHistory() {
  els.historyList.innerHTML = state.conversations.length
    ? state.conversations.map(item => `<button class="history-item ${item.id === state.current ? 'current' : ''}" data-id="${item.id}">${escapeHtml(item.title)}</button>`).join('')
    : '<div style="padding:10px 11px;color:#606067;font-size:12px;line-height:1.5">Your completed investigations will appear here.</div>';
}

function renderAttachments() {
  els.tray.hidden = !state.attachments.length;
  els.tray.innerHTML = state.attachments.map((file, index) => `
    <span class="attachment-chip">${icons.file}<span>${escapeHtml(file.name)}</span><button type="button" data-remove="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button></span>
  `).join('');
  updateSendState();
}

function updateSendState() {
  els.send.disabled = !els.input.value.trim() && state.attachments.length === 0;
}

function resizeInput() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(els.input.scrollHeight, 145)}px`;
}

function localAssessment(prompt) {
  const isClaim = /claim|true|false|fact.?check|deadline|announced|located|is |was /i.test(prompt);
  const isRisk = /scam|phish|suspicious|message|url|link|risk/i.test(prompt);
  const hasAttachment = state.attachments.length > 0;
  const heading = isRisk ? 'This needs source and sender verification' : isClaim ? 'The claim is ready for evidence review' : 'Investigation scope prepared';
  const label = isRisk ? 'RISK NOT YET DETERMINED' : 'EVIDENCE PENDING';
  const summary = isRisk
    ? 'DAM can identify risk signals from the text provided, but it cannot conclude that a message is fraudulent without inspecting its sender, destination and supporting context.'
    : 'The request has been converted into a checkable investigation. Live web research is not connected in this preview, so no factual verdict or citation has been invented.';
  const finding = isRisk
    ? 'Do not open links or provide credentials until the sender and destination domain are independently confirmed.'
    : 'A reliable answer should match the exact entity, jurisdiction and date in the claim against an original or authoritative source.';
  const attachmentNote = hasAttachment
    ? `${state.attachments.length} attachment${state.attachments.length > 1 ? 's were' : ' was'} validated locally and queued for secure extraction.`
    : 'No document or screenshot was attached to this request.';
  return { heading, label, summary, finding, attachmentNote };
}

function answerMarkup(prompt) {
  const result = localAssessment(prompt);
  const activityLabel = '3 observable steps completed';
  return `
    <div class="message assistant">
      <div class="assistant-mark">D</div>
      <div class="assistant-content">
        <div class="assistant-name">DAM AI</div>
        <details class="activity" open>
          <summary class="activity-summary"><svg class="chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg><strong>${activityLabel}</strong></summary>
          <div class="activity-list">
            <div class="activity-step"><span class="step-dot"></span><span>Parsed the request and identified the investigation intent.</span></div>
            <div class="activity-step"><span class="step-dot"></span><span>${escapeHtml(result.attachmentNote)}</span></div>
            <div class="activity-step"><span class="step-dot warn"></span><span>Live evidence search is not configured; stopped before making an unsupported factual claim.</span></div>
          </div>
        </details>
        <article class="answer">
          <span class="verdict">${result.label}</span>
          <h2>${escapeHtml(result.heading)}</h2>
          <p>${escapeHtml(result.summary)}</p>
          <div class="answer-section">
            <h3>What can be said now</h3>
            <ul>
              <li>${escapeHtml(result.finding)}</li>
              <li>Your wording and attachment metadata are saved in this browser for follow-up.</li>
            </ul>
          </div>
          <div class="evidence-row">
            <div class="evidence-card"><div class="evidence-meta"><span>Request</span><span class="evidence-status">Captured</span></div><strong>Original user statement</strong><p>${escapeHtml(prompt.slice(0, 155))}</p></div>
            <div class="evidence-card"><div class="evidence-meta"><span>Source access</span><span style="color:#e8a44b">Not connected</span></div><strong>No external evidence added</strong><p>Configure a search and source-reading backend before using DAM for factual decisions.</p></div>
          </div>
          <div class="limitation"><strong>Limitation:</strong> This published preview demonstrates the DAM investigation workflow and local persistence. It does not have credentials for live search, private file extraction or durable server-side storage.</div>
        </article>
        <div class="message-actions">
          <button class="action-button copy-answer" aria-label="Copy answer" title="Copy answer">${icons.copy}</button>
          <button class="action-button retry-answer" aria-label="Retry" title="Retry">${icons.retry}</button>
        </div>
      </div>
    </div>`;
}

function renderConversation(item) {
  if (!item) {
    els.conversation.innerHTML = els.welcome.outerHTML;
    bindStarters();
    els.title.textContent = 'Investigation brief';
    return;
  }
  els.title.textContent = item.title;
  els.conversation.innerHTML = item.messages.map(message => message.role === 'user'
    ? `<div class="message user"><div class="user-bubble">${escapeHtml(message.text)}</div></div>`
    : answerMarkup(item.messages[0].text)
  ).join('');
  els.workspace.scrollTop = els.workspace.scrollHeight;
}

function beginInvestigation(prompt) {
  const clean = prompt.trim() || `Review attached file${state.attachments.length > 1 ? 's' : ''}`;
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: titleFromPrompt(clean),
    createdAt: new Date().toISOString(),
    attachments: state.attachments.map(file => ({ name: file.name, type: file.type, size: file.size })),
    messages: [{ role: 'user', text: clean }, { role: 'assistant', text: 'local-assessment' }],
  };
  state.conversations.unshift(item);
  state.current = item.id;
  save();
  renderHistory();
  renderConversation(item);
  state.attachments = [];
  renderAttachments();
  els.input.value = '';
  resizeInput();
}

function bindStarters() {
  document.querySelectorAll('.starter').forEach(button => {
    button.addEventListener('click', () => {
      els.input.value = button.dataset.prompt;
      resizeInput();
      updateSendState();
      els.input.focus();
    });
  });
}

function newConversation() {
  state.current = null;
  state.attachments = [];
  els.input.value = '';
  renderAttachments();
  renderHistory();
  renderConversation(null);
  resizeInput();
  els.input.focus();
}

els.collapse.addEventListener('click', () => els.body.classList.toggle('sidebar-collapsed'));
els.mobileMenu.addEventListener('click', () => els.body.classList.toggle('menu-open'));
els.newConversation.addEventListener('click', newConversation);
els.input.addEventListener('input', () => { resizeInput(); updateSendState(); });
els.input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!els.send.disabled) els.form.requestSubmit(); }
});
els.form.addEventListener('submit', event => { event.preventDefault(); beginInvestigation(els.input.value); });

els.fileInput.addEventListener('change', event => {
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024;
  [...event.target.files].forEach(file => {
    if (!allowed.includes(file.type)) return showToast(`${file.name}: unsupported file type`);
    if (file.size > maxSize) return showToast(`${file.name}: file exceeds 10 MB`);
    if (state.attachments.length >= 4) return showToast('A maximum of 4 files can be attached');
    state.attachments.push(file);
  });
  event.target.value = '';
  renderAttachments();
});

els.tray.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  state.attachments.splice(Number(button.dataset.remove), 1);
  renderAttachments();
});

els.historyList.addEventListener('click', event => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  state.current = button.dataset.id;
  renderHistory();
  renderConversation(state.conversations.find(item => item.id === state.current));
  els.body.classList.remove('menu-open');
});

els.conversation.addEventListener('click', async event => {
  if (event.target.closest('.copy-answer')) {
    const text = event.target.closest('.assistant-content').querySelector('.answer').innerText;
    await navigator.clipboard.writeText(text);
    showToast('Answer copied');
  }
  if (event.target.closest('.retry-answer')) {
    const item = state.conversations.find(conversation => conversation.id === state.current);
    if (item) { renderConversation(item); showToast('Local assessment refreshed'); }
  }
});

els.report.addEventListener('click', () => {
  const item = state.conversations.find(conversation => conversation.id === state.current);
  if (!item) return showToast('Start an investigation before downloading a report');
  const result = localAssessment(item.messages[0].text);
  const report = `DAM AI INVESTIGATION REPORT\n\nRequest\n${item.messages[0].text}\n\nStatus\n${result.label}\n\nAssessment\n${result.summary}\n\nLimitation\nNo live evidence search or external sources were available in this preview.\n`;
  const blob = new Blob([report], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `dam-report-${item.id.slice(0, 8)}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Report downloaded');
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newConversation(); }
  if (event.key === 'Escape') els.body.classList.remove('menu-open');
});

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.view !== 'investigate') showToast(`${button.textContent.trim()} will populate when a server backend is connected`);
}));

bindStarters();
renderHistory();
updateSendState();

// Expose the primary journey to compatible agent-enabled browsers.
if (document.modelContext?.registerTool) {
  document.modelContext.registerTool({
    name: 'start_investigation',
    title: 'Start DAM investigation',
    description: 'Start a new visible DAM investigation using the provided question or claim.',
    inputSchema: {
      type: 'object',
      properties: { request: { type: 'string', minLength: 1 } },
      required: ['request'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      if (!input || typeof input.request !== 'string' || !input.request.trim()) throw new Error('A non-empty request is required.');
      beginInvestigation(input.request);
      return { conversationId: state.current, status: 'evidence_pending', liveSearchConfigured: false };
    },
  });
}
