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
import { Attachment, Conversation, IndexedSource, ChatTurn, ActivityStage, InvestigationMeta } from '@/lib/investigation/types';

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
  const [renamingConversation, setRenamingConversation] = useState<Conversation | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);

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

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  // Aggregate all sources for active conversation
  const allSources: IndexedSource[] = [];
  if (activeConversation) {
    activeConversation.turns.forEach(t => {
      if (t.role === 'assistant' && t.meta?.sources) {
        t.meta.sources.forEach(src => {
          if (!allSources.some(existing => existing.id === src.id)) {
            allSources.push(src);
          }
        });
      }
    });
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEvidencePanelOpen(false);
        setApiKeysModalOpen(false);
        setMethodologyModalOpen(false);
        setUrlModalOpen(false);
        setRenamingConversation(null);
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
            saveConversations([...updatedConversations]);
          } else if (eventType === 'token') {
            assistantTurn.fullText += parsed.text || '';
            saveConversations([...updatedConversations]);
          } else if (eventType === 'meta') {
            assistantTurn.meta = parsed;
            saveConversations([...updatedConversations]);
          } else if (eventType === 'done') {
            assistantTurn.isLive = false;
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
      setIsStreaming(false);
      saveConversations([...updatedConversations]);
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

  return (
    <div className="app-shell" id="appShell">
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
        evidenceCount={allSources.length}
        onOpenEvidence={() => setEvidencePanelOpen(true)}
      />

      <main className="main-area" id="mainArea">
        <Topbar
          title={activeConversation ? activeConversation.title : 'New investigation'}
          caseId={activeConversation?.caseId}
          isLive={isStreaming}
          onOpenApiKeys={() => setApiKeysModalOpen(true)}
          onOpenMethodology={() => setMethodologyModalOpen(true)}
          onToggleEvidence={() => setEvidencePanelOpen(prev => !prev)}
          evidenceCount={allSources.length}
        />

        <section className="workspace" id="workspace" ref={workspaceRef}>
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
            />
          )}

          {/* Persistent Composer (Centered on empty landing, docked on conversation) */}
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
          />
        </section>
      </main>

      {/* Contextual Evidence Panel */}
      <EvidencePanel
        isOpen={evidencePanelOpen}
        onClose={() => setEvidencePanelOpen(false)}
        sources={allSources}
        highlightIndex={highlightCitation}
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
