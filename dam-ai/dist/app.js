/**
 * UseDAM — Conversational Evidence-First AI Workspace
 * Combining ChatGPT-style multi-turn dialogue with Genspark-style visible research activity.
 */

// STATE MANAGEMENT
const state = {
  conversations: JSON.parse(localStorage.getItem('dam-conversations') || '[]'),
  current: null, // active conversation ID
  attachments: [], // Array of { name, type, size, url, preview, isUrl }
  activeMode: 'evidence', // 'evidence' | 'quick' | 'deep'
  activeLang: 'auto',     // 'auto' | 'en' | 'hi' | 'mr' | 'ta' | 'bn' | 'te'
  isStreaming: false,
  streamAbortController: null,
  evidencePanelOpen: false,
  evidenceFilter: '',
  historySearchQuery: '',
};

// DOM SELECTORS
const els = {
  body: document.body,
  appShell: document.querySelector('#appShell'),
  sidebar: document.querySelector('#sidebar'),
  collapseSidebar: document.querySelector('#collapseSidebar'),
  mobileMenu: document.querySelector('#mobileMenu'),
  newConversation: document.querySelector('#newConversation'),
  brandLink: document.querySelector('#brandLink'),
  navInvestigate: document.querySelector('#navInvestigate'),
  navEvidence: document.querySelector('#navEvidence'),
  navReports: document.querySelector('#navReports'),
  evidenceCountBadge: document.querySelector('#evidenceCountBadge'),
  historyList: document.querySelector('#historyList'),
  openCommandPaletteBtn: document.querySelector('#openCommandPaletteBtn'),
  workspaceMenuTrigger: document.querySelector('#workspaceMenuTrigger'),
  workspaceMenuPopover: document.querySelector('#workspaceMenuPopover'),
  menuSettings: document.querySelector('#menuSettings'),
  menuUsage: document.querySelector('#menuUsage'),
  menuSwitchWorkspace: document.querySelector('#menuSwitchWorkspace'),
  menuSignOut: document.querySelector('#menuSignOut'),

  // Topbar
  title: document.querySelector('#conversationTitle'),
  statusPulse: document.querySelector('#statusPulse'),
  caseIdBadge: document.querySelector('#caseIdBadge'),
  shareInvestigationBtn: document.querySelector('#shareInvestigationBtn'),
  downloadReport: document.querySelector('#downloadReport'),
  howItWorksBtn: document.querySelector('#howItWorksBtn'),
  disclaimerHowLink: document.querySelector('#disclaimerHowLink'),
  toggleEvidencePanelBtn: document.querySelector('#toggleEvidencePanelBtn'),
  topbarEvidenceBadge: document.querySelector('#topbarEvidenceBadge'),

  // Workspace
  workspace: document.querySelector('#workspace'),
  dropOverlay: document.querySelector('#dropOverlay'),
  landingBlock: document.querySelector('#landingBlock'),
  conversation: document.querySelector('#conversation'),
  jumpToLatestBtn: document.querySelector('#jumpToLatestBtn'),

  // Contextual Evidence Panel
  evidencePanel: document.querySelector('#evidencePanel'),
  closeEvidencePanelBtn: document.querySelector('#closeEvidencePanelBtn'),
  evidenceSearchInput: document.querySelector('#evidenceSearchInput'),
  evidencePanelBody: document.querySelector('#evidencePanelBody'),
  evidencePanelSubtitle: document.querySelector('#evidencePanelSubtitle'),

  // Composer
  composerContainer: document.querySelector('#composerContainer'),
  form: document.querySelector('#composer'),
  input: document.querySelector('#promptInput'),
  send: document.querySelector('#sendButton'),
  fileInput: document.querySelector('#fileInput'),
  fileInputScreenshot: document.querySelector('#fileInputScreenshot'),
  fileInputPdf: document.querySelector('#fileInputPdf'),
  addUrlChipBtn: document.querySelector('#addUrlChipBtn'),
  pasteClipboardBtn: document.querySelector('#pasteClipboardBtn'),
  tray: document.querySelector('#attachmentTray'),
  draftIndicator: document.querySelector('#draftIndicator'),

  // Mode Dropdown
  modeDropdownTrigger: document.querySelector('#modeDropdownTrigger'),
  modeDropdownMenu: document.querySelector('#modeDropdownMenu'),
  selectedModeLabel: document.querySelector('#selectedModeLabel'),

  // Language Dropdown
  langDropdownTrigger: document.querySelector('#langDropdownTrigger'),
  langDropdownMenu: document.querySelector('#langDropdownMenu'),
  selectedLangLabel: document.querySelector('#selectedLangLabel'),

  // Modals
  commandPaletteModal: document.querySelector('#commandPaletteModal'),
  paletteSearchInput: document.querySelector('#paletteSearchInput'),
  paletteResults: document.querySelector('#paletteResults'),
  urlModal: document.querySelector('#urlModal'),
  urlInputText: document.querySelector('#urlInputText'),
  closeUrlModal: document.querySelector('#closeUrlModal'),
  cancelUrlBtn: document.querySelector('#cancelUrlBtn'),
  confirmUrlBtn: document.querySelector('#confirmUrlBtn'),
  methodologyModal: document.querySelector('#methodologyModal'),
  closeMethodologyModal: document.querySelector('#closeMethodologyModal'),
  dismissMethodologyBtn: document.querySelector('#dismissMethodologyBtn'),
  renameModal: document.querySelector('#renameModal'),
  renameInputText: document.querySelector('#renameInputText'),
  closeRenameModal: document.querySelector('#closeRenameModal'),
  cancelRenameBtn: document.querySelector('#cancelRenameBtn'),
  confirmRenameBtn: document.querySelector('#confirmRenameBtn'),

  // API Keys Modal
  topbarApiKeysBtn: document.querySelector('#topbarApiKeysBtn'),
  apiKeysModal: document.querySelector('#apiKeysModal'),
  closeApiKeysModal: document.querySelector('#closeApiKeysModal'),
  cancelApiKeysBtn: document.querySelector('#cancelApiKeysBtn'),
  saveApiKeysBtn: document.querySelector('#saveApiKeysBtn'),
  clearApiKeysBtn: document.querySelector('#clearApiKeysBtn'),
  llmProviderSelect: document.querySelector('#llmProviderSelect'),
  llmApiKeyInput: document.querySelector('#llmApiKeyInput'),
  searchProviderSelect: document.querySelector('#searchProviderSelect'),
  searchApiKeyInput: document.querySelector('#searchApiKeyInput'),
  backendUrlInput: document.querySelector('#backendUrlInput'),

  toast: document.querySelector('#toast'),
};

// SVG ICONS
const icons = {
  check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A4 4 0 0 1 14 9V4h1a1 1 0 0 0 0-2H9a1 1 0 0 0 0 2h1v5a4 4 0 0 1-2.11 3.56l-1.78.89A2 2 0 0 0 5 15.24Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5M7 8a7 7 0 0 1 11 1l2 3M4 12l2 3a7 7 0 0 0 11 1"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  emptyShield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  spinner: '<svg viewBox="0 0 24 24" class="spin"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="32" stroke-linecap="round"/></svg>',
  evidence: '<svg viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h7.5A2.5 2.5 0 0 1 22 8.5v9a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17.5v-11zM2 10.5h20M4 14.5h20"/></svg>',
};

// UTILITY FUNCTIONS
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));
}

function showToast(message, undoAction = null) {
  els.toast.innerHTML = undoAction 
    ? `<span>${escapeHtml(message)}</span><button class="toast-undo-btn" id="toastUndoBtn">Undo</button>`
    : escapeHtml(message);
  els.toast.classList.add('show');
  
  if (undoAction) {
    const btn = document.querySelector('#toastUndoBtn');
    if (btn) btn.onclick = () => { undoAction(); els.toast.classList.remove('show'); };
  }

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), undoAction ? 4500 : 2600);
}

function saveConversations() {
  localStorage.setItem('dam-conversations', JSON.stringify(state.conversations.slice(0, 50)));
}

function titleFromPrompt(prompt) {
  const clean = prompt
    .replace(/^(fact-check|verify|assess|check this|is this)\s*(claim|message|notice|sms)?:?\s*/i, '')
    .trim();
  return clean.slice(0, 52) || 'India Regulatory Investigation';
}

function renderMarkdownText(md = '', isStreaming = false) {
  let cleaned = md
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\]\s+\[/g, '][');

  let html = cleaned
    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
    .replace(/## (.*?)\n/g, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<p></p>')
    .replace(/\[([0-9]+)\]/g, (match, p1) => {
      return `<a href="#evidence-card-${p1}" class="citation-ref" data-citation="${p1}" title="Jump to source ${p1}">[${p1}]</a>`;
    });

  if (isStreaming) {
    html += '<span class="genai-cursor">▌</span>';
  }
  return html;
}

// CONVERSATION VIEW LOGIC
function switchView(toConversation = false) {
  if (toConversation) {
    els.landingBlock.hidden = true;
    els.conversation.hidden = false;
    els.shareInvestigationBtn.hidden = false;
    els.downloadReport.disabled = false;
  } else {
    els.landingBlock.hidden = false;
    els.conversation.hidden = true;
    els.title.textContent = 'New investigation';
    els.caseIdBadge.hidden = true;
    els.shareInvestigationBtn.hidden = true;
    els.downloadReport.disabled = true;
    state.current = null;
  }
}

function getActiveConversation() {
  if (!state.current) return null;
  return state.conversations.find(c => c.id === state.current) || null;
}

function renderConversationFeed() {
  const conv = getActiveConversation();
  if (!conv) {
    switchView(false);
    return;
  }

  switchView(true);
  els.title.textContent = conv.title;
  els.caseIdBadge.textContent = `CASE #${conv.caseId || 'DAM-2026'}`;
  els.caseIdBadge.hidden = false;

  // Count total indexed sources
  let allSources = [];
  (conv.turns || []).forEach(t => {
    if (t.role === 'assistant' && t.meta?.sources) {
      allSources = [...allSources, ...t.meta.sources];
    }
  });
  updateEvidenceSources(allSources);

  // Render turns
  els.conversation.innerHTML = (conv.turns || []).map((turn, turnIdx) => {
    if (turn.role === 'user') {
      return `
        <div class="chat-turn" id="turn-${turn.id}">
          <div class="user-turn">
            <div class="user-turn-header">
              <span class="user-avatar-small">U</span>
              <span class="user-turn-title">User Query</span>
            </div>
            <div class="user-turn-text">${escapeHtml(turn.content)}</div>
            ${turn.attachments && turn.attachments.length ? `
              <div class="user-turn-attachments">
                ${turn.attachments.map(att => `
                  <span class="attachment-pill">
                    ${att.type === 'application/pdf' ? icons.file : icons.image}
                    <span>${escapeHtml(att.name)}</span>
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (turn.role === 'assistant') {
      const meta = turn.meta || {};
      const stages = turn.stages || [];
      const isLive = turn.isLive && state.isStreaming;

      return `
        <div class="chat-turn" id="turn-${turn.id}">
          <div class="assistant-turn">
            <!-- 1. GENSPARK-STYLE VISIBLE RESEARCH ACTIVITY ACCORDION -->
            <details class="investigation-activity" id="activity-${turn.id}" ${isLive ? 'open' : ''}>
              <summary class="activity-summary-bar">
                <div class="activity-summary-left">
                  <span class="activity-pulse-dot ${isLive ? 'running' : ''}" aria-hidden="true"></span>
                  <span class="activity-summary-title">
                    ${isLive ? 'Live Investigation in Progress...' : 'Investigation Audit Trail & Primary Registries'}
                  </span>
                </div>
                <div class="activity-summary-meta">
                  <span>${stages.length ? stages.length + ' stages' : '5 stages'} &bull; ${meta.sources?.length || 0} sources</span>
                </div>
              </summary>
              <div class="activity-stages-list" id="activityStages-${turn.id}">
                ${renderActivityStages(stages, isLive)}
              </div>
            </details>

            <!-- 2. STREAMING PROSE BRIEFING -->
            <div class="answer-prose ${isLive ? 'generating' : ''}" id="prose-${turn.id}">
              ${renderMarkdownText(turn.fullText || '', isLive)}
            </div>





            <!-- 5. PRIMARY SOURCES STRIP & OPEN EVIDENCE PANEL LINK -->
            ${meta.sources && meta.sources.length ? `
              <div class="sources-section revealed">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <h4>Indexed Primary Sources (${meta.sources.length})</h4>
                  <button type="button" class="quiet-button text-link open-evidence-btn" data-turn="${turn.id}">
                    ${icons.evidence} <span>Open Evidence Explorer &rarr;</span>
                  </button>
                </div>
                <div class="sources-grid">
                  ${meta.sources.map((src, i) => `
                    <div class="source-card" data-index="${src.id || i + 1}">
                      <div class="source-card-head">
                        <span class="source-domain">[${src.id || i + 1}] ${escapeHtml(src.domain)}</span>
                        <span class="source-badge ${(src.type || 'news').toLowerCase().replace(/[^a-z]/g, '')}">${escapeHtml(src.type || 'Registry')}</span>
                      </div>
                      <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="source-title">
                        ${escapeHtml(src.title)}
                      </a>
                      <div class="source-date">Published ${escapeHtml(src.date || 'Recent')} &bull; Direct Link ${icons.external}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- 6. CHALLENGER AGENT (What could make this wrong?) -->
            ${meta.challengerAudit && meta.challengerAudit.length ? `
              <details class="challenger-box revealed" open>
                <summary class="challenger-summary">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>What could make this assessment wrong? (Challenger Agent)</span>
                </summary>
                <div class="challenger-content">
                  <p>To avoid unearned certainty, our adversarial verifier checked the following counter-hypotheses:</p>
                  <ul>
                    ${meta.challengerAudit.map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
                  </ul>
                </div>
              </details>
            ` : ''}

            <!-- 7. TURN ACTION CONTROLS -->
            <div class="investigation-controls">
              <div class="controls-left">
                ${isLive ? `
                  <button class="control-btn stop stop-turn-btn" title="Stop generation">
                    ${icons.stop} <span>Stop</span>
                  </button>
                ` : `
                  <button class="control-btn icon-only-btn copy-turn-btn" data-turn="${turn.id}" title="Copy briefing" aria-label="Copy">
                    📋
                  </button>
                  <button class="control-btn icon-only-btn retry-turn-btn" data-turn="${turn.id}" title="Re-evaluate investigation" aria-label="Re-evaluate">
                    🔄
                  </button>
                `}
              </div>
              <div class="controls-right">
                <button class="control-btn export-pdf-btn" data-turn="${turn.id}" title="Export as PDF Document">
                  ${icons.file} <span>Export PDF</span>
                </button>
                <button class="control-btn export-md-btn" data-turn="${turn.id}" title="Download Briefing">
                  ${icons.file} <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    return '';
  }).join('');

  bindTurnEvents();
}

function renderActivityStages(stages = [], isLive = false) {
  if (!stages.length) {
    return `
      <div class="activity-stage-item">
        <span class="activity-stage-icon ${isLive ? 'running' : 'completed'}">
          ${isLive ? icons.spinner : icons.check}
        </span>
        <div class="activity-stage-content">
          <div class="activity-stage-name">Analysing Request & Scope</div>
          <div class="activity-stage-desc">Cross-referencing entities against official Indian registries...</div>
        </div>
      </div>
    `;
  }

  return stages.map(s => `
    <div class="activity-stage-item">
      <span class="activity-stage-icon ${s.status === 'running' ? 'running' : 'completed'}">
        ${s.status === 'running' ? icons.spinner : icons.check}
      </span>
      <div class="activity-stage-content">
        <div class="activity-stage-head">
          <span class="activity-stage-name">${escapeHtml(s.title)}</span>
        </div>
        <div class="activity-stage-desc">${escapeHtml(s.summary || '')}</div>
        ${s.details?.queries ? `
          <div class="activity-stage-chips">
            ${s.details.queries.map(q => `<span class="query-chip">${escapeHtml(q)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function bindTurnEvents() {
  // Citation links
  document.querySelectorAll('.citation-ref').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const citeId = link.getAttribute('data-citation');
      openEvidencePanel(citeId);
    });
  });

  // Open evidence buttons
  document.querySelectorAll('.open-evidence-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openEvidencePanel();
    });
  });

  // Copy briefing buttons
  document.querySelectorAll('.copy-turn-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const turnId = btn.getAttribute('data-turn');
      const prose = document.querySelector(`#prose-${turnId}`);
      if (prose) {
        await navigator.clipboard.writeText(prose.innerText);
        showToast('Briefing copied to clipboard');
      }
    });
  });

  // Re-evaluate
  document.querySelectorAll('.retry-turn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const conv = getActiveConversation();
      if (!conv || !conv.turns.length) return;
      const lastUserTurn = [...conv.turns].reverse().find(t => t.role === 'user');
      if (lastUserTurn) {
        showToast('Re-running investigation pipeline...');
        executeInvestigation(lastUserTurn.content, lastUserTurn.attachments || [], true);
      }
    });
  });

  // Stop button
  document.querySelectorAll('.stop-turn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.streamAbortController) {
        state.streamAbortController.abort();
        state.isStreaming = false;
        showToast('Investigation halted by user');
        renderConversationFeed();
      }
    });
  });

  // Export PDF
  document.querySelectorAll('.export-pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => window.print());
  });

  // Export Markdown
  document.querySelectorAll('.export-md-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const conv = getActiveConversation();
      if (!conv) return;
      const turnId = btn.getAttribute('data-turn');
      const turn = conv.turns.find(t => t.id === turnId);
      if (turn && turn.fullText) {
        const blob = new Blob([turn.fullText], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${conv.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_briefing.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Markdown briefing downloaded');
      }
    });
  });
}

// CONTEXTUAL EVIDENCE PANEL LOGIC
function updateEvidenceSources(sources = []) {
  els.topbarEvidenceBadge.textContent = sources.length;
  els.topbarEvidenceBadge.style.display = sources.length ? 'inline-flex' : 'none';
  if (els.evidenceCountBadge) {
    els.evidenceCountBadge.textContent = sources.length;
  }
  els.evidencePanelSubtitle.textContent = `${sources.length} indexed primary records`;

  renderEvidenceCards(sources);
}

function renderEvidenceCards(sources = []) {
  const query = state.evidenceFilter.toLowerCase().trim();
  const filtered = sources.filter(s => {
    if (!query) return true;
    return (s.title || '').toLowerCase().includes(query) ||
           (s.domain || '').toLowerCase().includes(query) ||
           (s.passage || '').toLowerCase().includes(query);
  });

  if (!filtered.length) {
    els.evidencePanelBody.innerHTML = `
      <div style="text-align:center;padding:40px 10px;color:var(--dam-text-muted);">
        <p>No sources matching "${escapeHtml(query)}"</p>
      </div>
    `;
    return;
  }

  els.evidencePanelBody.innerHTML = filtered.map(src => `
    <div class="evidence-card" id="evidence-card-${src.id}" data-index="${src.id}">
      <div class="evidence-card-header">
        <span class="evidence-index-badge">[${src.id}]</span>
        <span class="evidence-card-domain">${escapeHtml(src.domain)}</span>
        <span class="evidence-stance-badge ${src.stance || 'context'}">${escapeHtml(src.stance || 'Context')}</span>
      </div>
      <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="evidence-card-title">
        ${escapeHtml(src.title)} ${icons.external}
      </a>
      <div class="evidence-passage">
        "${escapeHtml(src.passage)}"
      </div>
      <div style="font-size:11px;color:var(--dam-text-muted);display:flex;justify-content:space-between;">
        <span>Published ${escapeHtml(src.date || 'Recent')}</span>
        <span>${escapeHtml(src.type || 'Government')}</span>
      </div>
    </div>
  `).join('');
}

function openEvidencePanel(focusIndex = null) {
  els.evidencePanel.hidden = false;
  els.evidencePanel.classList.add('open');
  state.evidencePanelOpen = true;

  if (focusIndex) {
    setTimeout(() => {
      const card = els.evidencePanelBody.querySelector(`[data-index="${focusIndex}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-target');
        setTimeout(() => card.classList.remove('highlight-target'), 2400);
      }
    }, 150);
  }
}

function closeEvidencePanel() {
  els.evidencePanel.classList.remove('open');
  state.evidencePanelOpen = false;
  setTimeout(() => {
    if (!state.evidencePanelOpen) els.evidencePanel.hidden = true;
  }, 220);
}

// EXECUTE INVESTIGATION (Connects to /api/investigate/stream)
async function executeInvestigation(promptText, attachments = [], isRetry = false) {
  const cleanPrompt = (promptText || '').trim();
  if (!cleanPrompt && !attachments.length) return;

  // Ensure active conversation
  let conv = getActiveConversation();
  if (!conv || !isRetry) {
    if (!conv) {
      conv = {
        id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: titleFromPrompt(cleanPrompt),
        caseId: 'DAM-2026-IND-' + Math.floor(1000 + Math.random() * 9000),
        createdAt: new Date().toISOString(),
        turns: [],
      };
      state.conversations.unshift(conv);
      state.current = conv.id;
      saveConversations();
    }
  }

  // Add User Turn
  const userTurnId = 'turn_u_' + Date.now();
  conv.turns.push({
    id: userTurnId,
    role: 'user',
    content: cleanPrompt,
    attachments: attachments.map(a => ({ name: a.name, type: a.type, size: a.size })),
    createdAt: new Date().toISOString(),
  });

  // Add Assistant Turn placeholder
  const assistantTurnId = 'turn_a_' + Date.now();
  const assistantTurn = {
    id: assistantTurnId,
    role: 'assistant',
    isLive: true,
    stages: [],
    fullText: '',
    meta: null,
  };
  conv.turns.push(assistantTurn);
  saveConversations();

  // Render conversation feed
  renderConversationFeed();
  renderHistory();
  els.workspace.scrollTop = els.workspace.scrollHeight;

  // Clear inputs and draft
  els.input.value = '';
  state.attachments = [];
  renderAttachments();
  resizeInput();
  clearDraft();

  // Start real SSE streaming pipeline
  state.isStreaming = true;
  state.streamAbortController = new AbortController();

  try {
    const historyPayload = conv.turns.slice(0, -2).map(t => ({
      role: t.role,
      content: t.content || t.fullText || ''
    }));

    const response = await fetch('/api/investigate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: state.streamAbortController.signal,
      body: JSON.stringify({
        prompt: cleanPrompt,
        attachments: attachments,
        mode: state.activeMode,
        lang: state.activeLang,
        history: historyPayload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop(); // keep trailing incomplete chunk

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        const lines = rawEvent.split('\n');
        let eventType = 'message';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6).trim();
          }
        }

        if (!eventData) continue;
        let payload = {};
        try { payload = JSON.parse(eventData); } catch (e) { continue; }

        if (eventType === 'stage') {
          // Update stage in assistant turn
          const existingStage = assistantTurn.stages.find(s => s.id === payload.id);
          if (existingStage) {
            Object.assign(existingStage, payload);
          } else {
            assistantTurn.stages.push(payload);
          }

          // Update stages DOM directly
          const stagesContainer = document.querySelector(`#activityStages-${assistantTurn.id}`);
          if (stagesContainer) {
            stagesContainer.innerHTML = renderActivityStages(assistantTurn.stages, true);
          }
        } else if (eventType === 'token') {
          assistantTurn.fullText += (payload.text || '');
          const proseEl = document.querySelector(`#prose-${assistantTurn.id}`);
          if (proseEl) {
            proseEl.innerHTML = renderMarkdownText(assistantTurn.fullText, true);
          }
          if (els.workspace) {
            els.workspace.scrollTop = els.workspace.scrollHeight;
          }
        } else if (eventType === 'meta') {
          assistantTurn.meta = payload;
          if (payload.sources) {
            updateEvidenceSources(payload.sources);
          }
        } else if (eventType === 'done') {
          assistantTurn.isLive = false;
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      showToast('Generation cancelled');
    } else {
      console.error('Investigation streaming error:', err);
      showToast('Investigation encountered an error: ' + err.message);
      assistantTurn.fullText += `\n\n> [!WARNING]\n> Network stream interrupted. Partial findings recorded above.`;
    }
  } finally {
    assistantTurn.isLive = false;
    state.isStreaming = false;
    saveConversations();
    renderConversationFeed();
    els.workspace.scrollTop = els.workspace.scrollHeight;
  }
}

// ATTACHMENTS HANDLING
function handleFileSelection(files) {
  Array.from(files).forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`"${file.name}" exceeds 10MB limit.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      state.attachments.push({
        name: file.name,
        type: file.type,
        size: file.size,
        preview: e.target.result,
      });
      renderAttachments();
    };
    reader.readAsDataURL(file);
  });
}

function renderAttachments() {
  if (!state.attachments.length) {
    els.tray.hidden = true;
    els.tray.innerHTML = '';
    return;
  }
  els.tray.hidden = false;
  els.tray.innerHTML = state.attachments.map((a, i) => `
    <div class="attachment-chip">
      ${a.type === 'application/pdf' ? icons.file : `<img src="${a.preview}" alt="${escapeHtml(a.name)}" class="attachment-thumb" />`}
      <span class="attachment-name">${escapeHtml(a.name)}</span>
      <button type="button" class="attachment-remove" data-index="${i}" aria-label="Remove">&times;</button>
    </div>
  `).join('');

  els.tray.querySelectorAll('.attachment-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      state.attachments.splice(idx, 1);
      renderAttachments();
    });
  });
}

// SIDEBAR HISTORY GROUPING
function renderHistory() {
  const query = state.historySearchQuery.toLowerCase().trim();
  const filtered = state.conversations.filter(c => {
    if (!query) return true;
    return (c.title || '').toLowerCase().includes(query);
  });

  if (!filtered.length) {
    els.historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">${icons.emptyShield}</div>
        <p>${query ? 'No matching investigations.' : 'No recent investigations.'}</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const last7Days = today - 6 * 86400000;

  const groups = { today: [], yesterday: [], last7: [], older: [] };

  filtered.forEach(item => {
    const itemDate = new Date(item.createdAt || Date.now()).getTime();
    if (itemDate >= today) groups.today.push(item);
    else if (itemDate >= yesterday) groups.yesterday.push(item);
    else if (itemDate >= last7Days) groups.last7.push(item);
    else groups.older.push(item);
  });

  const renderGroup = (label, items) => {
    if (!items.length) return '';
    return `
      <div class="history-group">
        <div class="history-group-title">${label}</div>
        ${items.map(item => `
          <div class="history-item ${item.id === state.current ? 'active' : ''}" data-id="${item.id}">
            <span class="history-title">${escapeHtml(item.title)}</span>
            <div class="history-item-actions">
              <button class="history-action-btn rename-history-btn" data-id="${item.id}" title="Rename">${icons.edit}</button>
              <button class="history-action-btn delete-history-btn" data-id="${item.id}" title="Delete">${icons.trash}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  els.historyList.innerHTML = 
    renderGroup('Today', groups.today) +
    renderGroup('Yesterday', groups.yesterday) +
    renderGroup('Previous 7 Days', groups.last7) +
    renderGroup('Older', groups.older);

  // Bind click on history items
  els.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.history-action-btn')) return;
      const id = item.getAttribute('data-id');
      state.current = id;
      renderConversationFeed();
      renderHistory();
      if (document.body.classList.contains('menu-open')) {
        document.body.classList.remove('menu-open');
      }
    });
  });

  // Rename
  els.historyList.querySelectorAll('.rename-history-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const conv = state.conversations.find(c => c.id === id);
      if (!conv) return;
      state.editingItem = conv;
      els.renameInputText.value = conv.title;
      els.renameModal.hidden = false;
      els.renameInputText.focus();
    });
  });

  // Delete with Undo Toast
  els.historyList.querySelectorAll('.delete-history-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const idx = state.conversations.findIndex(c => c.id === id);
      if (idx === -1) return;
      const deleted = state.conversations.splice(idx, 1)[0];
      saveConversations();
      if (state.current === id) {
        state.current = null;
        switchView(false);
      }
      renderHistory();
      showToast(`Deleted "${deleted.title.slice(0, 24)}..."`, () => {
        state.conversations.splice(idx, 0, deleted);
        saveConversations();
        renderHistory();
      });
    });
  });
}

// COMPOSER & INPUT LOGIC
function resizeInput() {
  els.input.style.height = 'auto';
  els.input.style.height = Math.min(els.input.scrollHeight, 180) + 'px';
}

function updateSendState() {
  const hasText = els.input.value.trim().length > 0;
  const hasFiles = state.attachments.length > 0;
  els.send.disabled = !(hasText || hasFiles) || state.isStreaming;
}

function saveDraft() {
  localStorage.setItem('dam-draft', JSON.stringify({ text: els.input.value }));
  els.draftIndicator.classList.toggle('visible', els.input.value.trim().length > 0);
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem('dam-draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.text) {
      els.input.value = d.text;
      resizeInput();
      updateSendState();
      els.draftIndicator.classList.add('visible');
    }
  } catch (e) {}
}

function clearDraft() {
  localStorage.removeItem('dam-draft');
  els.draftIndicator.classList.remove('visible');
}

// SETUP EVENT LISTENERS
function init() {
  // Restore draft and render history
  restoreDraft();
  renderHistory();

  // New Conversation
  els.newConversation.addEventListener('click', () => {
    switchView(false);
    renderHistory();
    els.input.focus();
  });
  if (els.brandLink) {
    els.brandLink.addEventListener('click', e => {
      e.preventDefault();
      switchView(false);
    });
  }

  // Sidebar toggle
  if (els.collapseSidebar) {
    els.collapseSidebar.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
    });
  }
  if (els.mobileMenu) {
    els.mobileMenu.addEventListener('click', () => {
      document.body.classList.toggle('menu-open');
    });
  }

  // Input listeners
  els.input.addEventListener('input', () => {
    resizeInput();
    updateSendState();
    saveDraft();
  });

  els.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!els.send.disabled) {
        executeInvestigation(els.input.value, state.attachments);
      }
    }
  });

  els.form.addEventListener('submit', e => {
    e.preventDefault();
    if (!els.send.disabled) {
      executeInvestigation(els.input.value, state.attachments);
    }
  });

  // Attachments
  [els.fileInput, els.fileInputScreenshot, els.fileInputPdf].forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        if (input.files) handleFileSelection(input.files);
        input.value = '';
      });
    }
  });

  // Paste from clipboard
  if (els.pasteClipboardBtn) {
    els.pasteClipboardBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          els.input.value = (els.input.value ? els.input.value + '\n' : '') + text;
          resizeInput();
          updateSendState();
          showToast('Text pasted from clipboard');
        }
      } catch (err) {
        showToast('Clipboard access denied');
      }
    });
  }

  // URL modal
  if (els.addUrlChipBtn) {
    els.addUrlChipBtn.addEventListener('click', () => {
      els.urlModal.hidden = false;
      els.urlInputText.focus();
    });
  }
  if (els.closeUrlModal) els.closeUrlModal.onclick = () => els.urlModal.hidden = true;
  if (els.cancelUrlBtn) els.cancelUrlBtn.onclick = () => els.urlModal.hidden = true;
  if (els.confirmUrlBtn) {
    els.confirmUrlBtn.onclick = () => {
      const u = els.urlInputText.value.trim();
      if (u) {
        state.attachments.push({ name: u, type: 'url', size: 0, url: u });
        renderAttachments();
        els.urlInputText.value = '';
        els.urlModal.hidden = true;
      }
    };
  }

  // Evidence panel toggle & close
  if (els.toggleEvidencePanelBtn) {
    els.toggleEvidencePanelBtn.addEventListener('click', () => {
      if (state.evidencePanelOpen) closeEvidencePanel();
      else openEvidencePanel();
    });
  }
  if (els.closeEvidencePanelBtn) {
    els.closeEvidencePanelBtn.addEventListener('click', closeEvidencePanel);
  }
  if (els.evidenceSearchInput) {
    els.evidenceSearchInput.addEventListener('input', () => {
      state.evidenceFilter = els.evidenceSearchInput.value;
      const conv = getActiveConversation();
      let allSources = [];
      if (conv) {
        (conv.turns || []).forEach(t => {
          if (t.role === 'assistant' && t.meta?.sources) allSources = [...allSources, ...t.meta.sources];
        });
      }
      renderEvidenceCards(allSources);
    });
  }

  // Jump to latest button
  if (els.workspace && els.jumpToLatestBtn) {
    els.workspace.addEventListener('scroll', () => {
      const distFromBottom = els.workspace.scrollHeight - els.workspace.scrollTop - els.workspace.clientHeight;
      els.jumpToLatestBtn.hidden = distFromBottom < 220 || !state.current;
    });
    els.jumpToLatestBtn.addEventListener('click', () => {
      els.workspace.scrollTo({ top: els.workspace.scrollHeight, behavior: 'smooth' });
    });
  }

  // Starters & Trends
  document.querySelectorAll('.starter').forEach(card => {
    card.addEventListener('click', () => {
      const p = card.getAttribute('data-prompt');
      els.input.value = p;
      resizeInput();
      updateSendState();
      els.input.focus();
    });
  });

  document.querySelectorAll('.trend-pill, .example-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-prompt');
      els.input.value = p;
      resizeInput();
      updateSendState();
      els.input.focus();
    });
  });

  // Methodology modal
  if (els.howItWorksBtn) els.howItWorksBtn.onclick = () => els.methodologyModal.hidden = false;
  if (els.disclaimerHowLink) els.disclaimerHowLink.onclick = () => els.methodologyModal.hidden = false;
  if (els.closeMethodologyModal) els.closeMethodologyModal.onclick = () => els.methodologyModal.hidden = true;
  if (els.dismissMethodologyBtn) els.dismissMethodologyBtn.onclick = () => els.methodologyModal.hidden = true;

  // Rename modal
  if (els.closeRenameModal) els.closeRenameModal.onclick = () => els.renameModal.hidden = true;
  if (els.cancelRenameBtn) els.cancelRenameBtn.onclick = () => els.renameModal.hidden = true;
  if (els.confirmRenameBtn) {
    els.confirmRenameBtn.onclick = () => {
      const newTitle = els.renameInputText.value.trim();
      if (newTitle && state.editingItem) {
        state.editingItem.title = newTitle;
        saveConversations();
        renderHistory();
        if (state.current === state.editingItem.id) els.title.textContent = newTitle;
        els.renameModal.hidden = true;
        showToast('Investigation renamed');
      }
    };
  }

  // API Keys modal
  if (els.topbarApiKeysBtn) els.topbarApiKeysBtn.onclick = () => els.apiKeysModal.hidden = false;
  if (els.closeApiKeysModal) els.closeApiKeysModal.onclick = () => els.apiKeysModal.hidden = true;
  if (els.cancelApiKeysBtn) els.cancelApiKeysBtn.onclick = () => els.apiKeysModal.hidden = true;
  if (els.saveApiKeysBtn) {
    els.saveApiKeysBtn.onclick = () => {
      const k = els.llmApiKeyInput.value.trim();
      const tk = els.searchApiKeyInput.value.trim();
      if (k) localStorage.setItem('dam-openai-key', k);
      if (tk) localStorage.setItem('dam-tavily-key', tk);
      els.apiKeysModal.hidden = true;
      showToast('API configuration saved');
    };
  }
  if (els.clearApiKeysBtn) {
    els.clearApiKeysBtn.onclick = () => {
      localStorage.removeItem('dam-openai-key');
      localStorage.removeItem('dam-tavily-key');
      els.llmApiKeyInput.value = '';
      els.searchApiKeyInput.value = '';
      els.apiKeysModal.hidden = true;
      showToast('API keys cleared');
    };
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    // Esc: close modals or panels
    if (e.key === 'Escape') {
      if (state.evidencePanelOpen) closeEvidencePanel();
      [els.urlModal, els.methodologyModal, els.renameModal, els.apiKeysModal, els.commandPaletteModal].forEach(m => {
        if (m) m.hidden = true;
      });
    }

    // Ctrl+B: toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.body.classList.toggle('sidebar-collapsed');
    }

    // Alt+E: toggle evidence panel
    if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (state.evidencePanelOpen) closeEvidencePanel();
      else openEvidencePanel();
    }

    // Cmd/Ctrl+K: New investigation or palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      switchView(false);
      els.input.focus();
    }

    // 1-4 shortcuts on empty landing
    if (['1', '2', '3', '4'].includes(e.key) && !state.current && document.activeElement !== els.input) {
      const starter = document.querySelector(`.starter[data-key="${e.key}"]`);
      if (starter) {
        e.preventDefault();
        starter.click();
      }
    }
  });

  // Drag and drop files onto workspace
  window.addEventListener('dragover', e => {
    e.preventDefault();
    els.dropOverlay.hidden = false;
  });
  window.addEventListener('dragleave', e => {
    if (e.clientX <= 0 || e.clientY <= 0) els.dropOverlay.hidden = true;
  });
  window.addEventListener('drop', e => {
    e.preventDefault();
    els.dropOverlay.hidden = true;
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFileSelection(e.dataTransfer.files);
    }
  });
}

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
