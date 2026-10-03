'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { LandingBlock } from './LandingBlock';
import { Composer } from './Composer';
import { ConversationFeed } from './ConversationFeed';
import { EvidencePanel } from './EvidencePanel';
import { ApiKeysModal } from './modals/ApiKeysModal';
import { MethodologyModal } from './modals/MethodologyModal';
import { UrlModal } from './modals/UrlModal';
import { RenameModal } from './modals/RenameModal';
import { ShareModal } from './modals/ShareModal';
import { Attachment, Conversation, IndexedSource, ChatTurn, ActivityStage, InvestigationMeta } from '@/lib/investigation/types';
import { generateSmartTitle } from '@/lib/investigation/naming';

export const InvestigationWorkspace: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeMode, setActiveMode] = useState('evidence');
  const [activeLang, setActiveLang] = useState('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [highlightCitation, setHighlightCitation] = useState<number | null>(null);

  // Modals state
  const [apiKeysModalOpen, setApiKeysModalOpen] = useState(false);
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState<Conversation | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const userScrolledUpRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    // When within 60px of the bottom, user is at bottom and wants to follow stream
    if (distFromBottom < 60) {
      userScrolledUpRef.current = false;
      setIsScrolledUp(false);
    } else if (distFromBottom > 120 && !isAutoScrollingRef.current) {
      // User explicitly scrolled up to view prior messages
      userScrolledUpRef.current = true;
      setIsScrolledUp(true);
    }
  };

  const scrollToBottom = (smooth = true) => {
    userScrolledUpRef.current = false;
    setIsScrolledUp(false);
    if (!scrollAreaRef.current) return;
    isAutoScrollingRef.current = true;
    if (smooth) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 350);
  };

  const forceScrollToBottom = () => {
    userScrolledUpRef.current = false;
    setIsScrolledUp(false);
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  const autoScrollIfPinned = () => {
    if (!userScrolledUpRef.current && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  // Auto-scroll to bottom as investigation streams or turns update, as long as user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  });

  // When activeId changes, scroll down to the active conversation
  useEffect(() => {
    if (activeId && scrollAreaRef.current) {
      userScrolledUpRef.current = false;
      setIsScrolledUp(false);
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      });
    }
  }, [activeId]);

  // Load conversations on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dam-conversations');
      if (stored) {
        setConversations(JSON.parse(stored));
      }
      const draft = localStorage.getItem('dam-draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.text) setInput(parsed.text);
      }
    } catch (e) {}
  }, []);

  // Save conversations
  const saveConversations = (updated: Conversation[]) => {
    setConversations(updated);
    localStorage.setItem('dam-conversations', JSON.stringify(updated.slice(0, 50)));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Aggregate sources for active conversation
  const caseSources: IndexedSource[] = [];
  if (activeConversation) {
    activeConversation.turns.forEach(t => {
      if (t.role === 'assistant' && t.meta?.sources) {
        t.meta.sources.forEach(src => {
          if (!caseSources.some(existing => existing.id === src.id)) {
            caseSources.push(src);
          }
        });
      }
    });
  }

  // Aggregate all sources across ALL conversations stored on this workstation
  const globalSources: IndexedSource[] = React.useMemo(() => {
    const seen = new Set<string>();
    const list: IndexedSource[] = [];
    conversations.forEach(c => {
      c.turns.forEach(t => {
        if (t.role === 'assistant' && t.meta?.sources) {
          t.meta.sources.forEach(src => {
            const key = src.url || src.title;
            if (!seen.has(key)) {
              seen.add(key);
              list.push(src);
            }
          });
        }
      });
    });
    return list;
  }, [conversations]);

  const handleTogglePin = (id: string) => {
    const updated = conversations.map(c => 
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    );
    saveConversations(updated);
    const target = updated.find(c => c.id === id);
    showToast(target?.isPinned ? 'Investigation pinned to top' : 'Investigation unpinned');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEvidencePanelOpen(false);
        setApiKeysModalOpen(false);
        setMethodologyModalOpen(false);
        setUrlModalOpen(false);
        setRenamingConversation(null);
        setMobileMenuOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.body.classList.toggle('sidebar-collapsed');
      }
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setEvidencePanelOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendInvestigation = async (promptOverride?: string) => {
    const promptToSend = (promptOverride || input).trim();
    if (!promptToSend && attachments.length === 0) return;

    let targetConv = activeConversation;
    let updatedConversations = [...conversations];

    if (!targetConv) {
      targetConv = {
        id: 'conv_' + Date.now(),
        title: promptToSend.slice(0, 52) || 'India Regulatory Investigation',
        caseId: 'DAM-2026-IND-' + Math.floor(1000 + Math.random() * 9000),
        createdAt: new Date().toISOString(),
        turns: [],
      };
      updatedConversations = [targetConv, ...conversations];
      setActiveId(targetConv.id);
    }

    // Add user turn
    const userTurn = {
      id: 'u_' + Date.now(),
      role: 'user' as const,
      content: promptToSend,
      attachments: [...attachments],
      createdAt: new Date().toISOString(),
    };

    // Add assistant turn placeholder
    const assistantTurn: ChatTurn = {
      id: 'a_' + Date.now(),
      role: 'assistant',
      isLive: true,
      stages: [] as ActivityStage[],
      fullText: '',
      meta: null,
      createdAt: new Date().toISOString(),
    };

    targetConv.turns = [...targetConv.turns, userTurn, assistantTurn];
    saveConversations(updatedConversations);

    setInput('');
    setAttachments([]);
    localStorage.removeItem('dam-draft');
    setIsStreaming(true);

    // Reset scroll state so user sees their new question and following response
    userScrolledUpRef.current = false;
    setIsScrolledUp(false);
    forceScrollToBottom();
    requestAnimationFrame(forceScrollToBottom);
    setTimeout(forceScrollToBottom, 60);
    setTimeout(forceScrollToBottom, 180);

    abortControllerRef.current = new AbortController();

    try {
      const historyPayload = targetConv.turns.slice(0, -2).map(t => ({
        role: t.role,
        content: t.content || t.fullText || '',
      }));

      const res = await fetch('/api/investigate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          prompt: promptToSend,
          attachments,
          mode: activeMode,
          lang: activeLang,
          history: historyPayload,
          apiKey: localStorage.getItem('dam-openai-key') || undefined,
          tavilyKey: localStorage.getItem('dam-tavily-key') || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const raw of events) {
          if (!raw.trim()) continue;
          const lines = raw.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) eventData = line.slice(6).trim();
          }

          if (!eventData) continue;
          let parsed: any = {};
          try { parsed = JSON.parse(eventData); } catch (e) { continue; }

          if (eventType === 'stage') {
            if (!assistantTurn.stages) assistantTurn.stages = [];
            const existing = assistantTurn.stages.find(s => s.id === parsed.id);
            if (existing) Object.assign(existing, parsed);
            else assistantTurn.stages.push(parsed);
            targetConv.turns = [...targetConv.turns];
            saveConversations([...updatedConversations]);
            autoScrollIfPinned();
          } else if (eventType === 'token') {
            assistantTurn.fullText += parsed.text || '';
            targetConv.turns = [...targetConv.turns];
            saveConversations([...updatedConversations]);
            autoScrollIfPinned();
          } else if (eventType === 'meta') {
            assistantTurn.meta = parsed;
            targetConv.turns = [...targetConv.turns];
            saveConversations([...updatedConversations]);
            autoScrollIfPinned();
          } else if (eventType === 'done') {
            assistantTurn.isLive = false;
            // Auto-rename conversation to clean topic title if currently raw slice
            const smart = generateSmartTitle(promptToSend, assistantTurn.meta);
            targetConv.title = smart;
            targetConv.turns = [...targetConv.turns];
            saveConversations([...updatedConversations]);
            autoScrollIfPinned();
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Investigation halted by user');
      } else {
        showToast('Investigation error: ' + err.message);
      }
    } finally {
      assistantTurn.isLive = false;
      const smart = generateSmartTitle(promptToSend, assistantTurn.meta);
      targetConv.title = smart;
      targetConv.turns = [...targetConv.turns];
      saveConversations([...updatedConversations]);
      autoScrollIfPinned();
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleCitationClick = (idx: number) => {
    setEvidencePanelOpen(true);
    setHighlightCitation(idx);
    setTimeout(() => setHighlightCitation(null), 3000);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={`app-shell${mobileMenuOpen ? ' menu-open' : ''}`} id="appShell">
      {/* Mobile backdrop: tapping outside sidebar closes it */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop"
          aria-hidden="true"
          onClick={closeMobileMenu}
        />
      )}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={id => setActiveId(id)}
        onNewConversation={() => setActiveId(null)}
        onRenameConversation={conv => setRenamingConversation(conv)}
        onDeleteConversation={id => {
          const filtered = conversations.filter(c => c.id !== id);
          saveConversations(filtered);
          if (activeId === id) setActiveId(null);
          showToast('Investigation deleted');
        }}
        evidenceCount={caseSources.length > 0 ? caseSources.length : globalSources.length}
        onOpenEvidence={() => setEvidencePanelOpen(true)}
        onTogglePinConversation={handleTogglePin}
      />

      <main className="main-area" id="mainArea">
        <Topbar
          title={activeConversation ? activeConversation.title : 'New investigation'}
          caseId={activeConversation?.caseId}
          isLive={isStreaming}
          onOpenApiKeys={() => setApiKeysModalOpen(true)}
          onOpenMethodology={() => setMethodologyModalOpen(true)}
          onToggleEvidence={() => setEvidencePanelOpen(prev => !prev)}
          evidenceCount={caseSources.length > 0 ? caseSources.length : globalSources.length}
          onMobileMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          onOpenShare={() => setShareModalOpen(true)}
        />

        <section className="workspace-fixed-layout" id="workspace">
          {/* Scrollable conversation / landing viewport */}
          <div
            className="workspace-scroll-area"
            id="workspaceScrollArea"
            ref={scrollAreaRef}
            onScroll={handleScroll}
          >
            <div className="workspace-content-inner">
              {!activeConversation ? (
                <LandingBlock onSelectPrompt={p => { setInput(p); handleSendInvestigation(p); }} />
              ) : (
                <ConversationFeed
                  turns={activeConversation.turns}
                  isStreaming={isStreaming}
                  onCitationClick={handleCitationClick}
                  onOpenEvidence={() => setEvidencePanelOpen(true)}
                  onCopyBriefing={text => {
                    navigator.clipboard.writeText(text);
                    showToast('Briefing copied to clipboard');
                  }}
                  onRetry={() => {
                    const lastUser = [...activeConversation.turns].reverse().find(t => t.role === 'user');
                    if (lastUser?.content) handleSendInvestigation(lastUser.content);
                  }}
                  onStop={handleStop}
                  onFollowUpClick={prompt => handleSendInvestigation(prompt)}
                />
              )}
            </div>
          </div>

          {/* Fixed bottom docked composer bar */}
          <div className="composer-dock-container" id="composerDockContainer">
            {/* Scroll-to-bottom floating button (matches ChatGPT) */}
            {isScrolledUp && (
              <button
                type="button"
                className="scroll-to-bottom-floating-btn"
                onClick={() => scrollToBottom(true)}
                title="Scroll to latest message"
                aria-label="Scroll to bottom"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14m-6-6 6 6 6-6" />
                </svg>
              </button>
            )}

            <div className="composer-dock-inner">
              <Composer
                input={input}
                setInput={setInput}
                attachments={attachments}
                onAddAttachment={att => setAttachments(prev => [...prev, att])}
                onRemoveAttachment={idx => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                activeLang={activeLang}
                setActiveLang={setActiveLang}
                isStreaming={isStreaming}
                onSend={() => handleSendInvestigation()}
                onStop={handleStop}
                onOpenUrlModal={() => setUrlModalOpen(true)}
                hasCompletedTurn={Boolean(activeConversation?.turns.some(t => t.role === 'assistant' && !t.isLive))}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Contextual Evidence Panel */}
      <EvidencePanel
        isOpen={evidencePanelOpen}
        onClose={() => setEvidencePanelOpen(false)}
        sources={caseSources}
        allSources={globalSources}
        highlightIndex={highlightCitation}
      />

      {/* Share Briefing Modal (Phase 4) */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        conversation={activeConversation}
      />

      {/* Modals */}
      <ApiKeysModal
        isOpen={apiKeysModalOpen}
        onClose={() => setApiKeysModalOpen(false)}
        onSave={() => showToast('API configuration updated')}
      />

      <MethodologyModal
        isOpen={methodologyModalOpen}
        onClose={() => setMethodologyModalOpen(false)}
      />

      <UrlModal
        isOpen={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        onConfirm={u => {
          setAttachments(prev => [...prev, { name: u, type: 'url', size: 0, url: u, isUrl: true }]);
        }}
      />

      <RenameModal
        conversation={renamingConversation}
        onClose={() => setRenamingConversation(null)}
        onSave={(id, newTitle) => {
          const updated = conversations.map(c => c.id === id ? { ...c, title: newTitle } : c);
          saveConversations(updated);
          showToast('Investigation renamed');
        }}
      />

      {toastMsg && (
        <div className="toast show" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
