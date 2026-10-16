'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { LandingBlock } from './LandingBlock';
import { Composer } from './Composer';
import { ConversationFeed } from './ConversationFeed';
import { EvidencePanel } from './EvidencePanel';
import { FloatingEvidenceButton } from './FloatingEvidenceButton';
import { MethodologyModal } from './modals/MethodologyModal';
import { UrlModal } from './modals/UrlModal';
import { RenameModal } from './modals/RenameModal';
import { ShareModal } from './modals/ShareModal';
import { FolderModal } from './modals/FolderModal';
import { MoveToFolderModal } from './modals/MoveToFolderModal';
import { WhatsAppModal } from './modals/WhatsAppModal';
import { ExtensionModal } from './modals/ExtensionModal';
import { Attachment, Conversation, Folder, IndexedSource, ChatTurn, ActivityStage, InvestigationMeta, getQueryVerdictStatus } from '@/lib/investigation/types';
import { generateSmartTitle } from '@/lib/investigation/naming';

export const InvestigationWorkspace: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('dam-conversations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('dam-folders');
      if (stored) return JSON.parse(stored);
      const defaultFolders: Folder[] = [
        { id: 'f_cybercrime', name: 'Cyber Crime & 1930 Cases', color: '#888888', createdAt: new Date(0).toISOString() },
        { id: 'f_banking', name: 'Banking & KYC Verifications', color: '#888888', createdAt: new Date(0).toISOString() },
        { id: 'f_circulars', name: 'PIB & Regulatory Circulars', color: '#888888', createdAt: new Date(0).toISOString() },
      ];
      return defaultFolders;
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const draft = localStorage.getItem('dam-draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        return parsed.text || '';
      }
    } catch {
      return '';
    }
    return '';
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeMode, setActiveMode] = useState('evidence');
  const [activeLang, setActiveLang] = useState('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [highlightCitation, setHighlightCitation] = useState<number | null>(null);

  // Modals state
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [moveToFolderConv, setMoveToFolderConv] = useState<Conversation | null>(null);
  const [renamingConversation, setRenamingConversation] = useState<Conversation | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const anchorToActiveTurn = (smooth = true) => {
    if (!scrollAreaRef.current) return;
    const container = scrollAreaRef.current;
    // Find the live assistant turn or latest turn in the feed
    const liveTurn = container.querySelector('.chat-turn.assistant-row.live-turn, #conversation .chat-turn:last-child');
    if (liveTurn instanceof HTMLElement) {
      // Anchor to the user prompt right above this assistant turn if available, so user sees prompt + thinking pane
      const prevTurn = liveTurn.previousElementSibling as HTMLElement | null;
      const targetElement = prevTurn || liveTurn;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top;
      const targetScrollTop = container.scrollTop + offset - 18;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  // When activeId changes, scroll down to the active conversation if not streaming
  useEffect(() => {
    if (activeId && scrollAreaRef.current && !isStreaming) {
      userScrolledUpRef.current = false;
      setIsScrolledUp(false);
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      });
    }
  }, [activeId, isStreaming]);

  // Save conversations (sanitizing heavy raw base64 bytes to stay well within localStorage quota)
  const saveConversations = (updated: Conversation[]) => {
    setConversations(updated);
    try {
      const sanitized = updated.slice(0, 50).map(c => ({
        ...c,
        turns: c.turns.map(t => ({
          ...t,
          attachments: t.attachments?.map(a => {
            const { preview, ...rest } = a;
            // Strip data: URLs to keep file storage external to localStorage; retain metadata and server previewUrl
            if (preview && preview.startsWith('data:')) {
              return {
                ...rest,
                previewUrl: a.previewUrl,
              };
            }
            return a;
          }),
        })),
      }));
      localStorage.setItem('dam-conversations', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('Failed to persist conversations to localStorage', e);
    }
  };

  // Save folders
  const saveFolders = (updated: Folder[]) => {
    setFolders(updated);
    localStorage.setItem('dam-folders', JSON.stringify(updated));
  };

  const handleCreateOrUpdateFolder = (name: string, color: string) => {
    if (folderToEdit) {
      const updated = folders.map(f => f.id === folderToEdit.id ? { ...f, name, color } : f);
      saveFolders(updated);
      showToast(`Folder "${name}" updated`);
    } else {
      const folderId = `f_${folders.length + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const newFolder: Folder = {
        id: folderId,
        name,
        color,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      saveFolders([...folders, newFolder]);
      showToast(`Folder "${name}" created`);
    }
    setFolderToEdit(null);
  };

  const handleDeleteFolder = (folderId: string) => {
    const target = folders.find(f => f.id === folderId);
    const updatedFolders = folders.filter(f => f.id !== folderId);
    saveFolders(updatedFolders);
    // Unfile any conversations in this folder so no data is lost
    const updatedConversations = conversations.map(c => c.folderId === folderId ? { ...c, folderId: null } : c);
    saveConversations(updatedConversations);
    showToast(`Folder "${target?.name || ''}" deleted. Investigations are now unfiled.`);
  };

  const handleMoveToFolder = (convId: string, folderId: string | null) => {
    const updated = conversations.map(c => c.id === convId ? { ...c, folderId } : c);
    saveConversations(updated);
    const targetFolder = folders.find(f => f.id === folderId);
    if (targetFolder) {
      showToast(`Moved to "${targetFolder.name}"`);
    } else {
      showToast('Removed from folder (unfiled)');
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const hasQuery = Boolean(activeConversation && activeConversation.turns.length > 0);

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
    showToast(target?.isPinned ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEvidencePanelOpen(false);
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

    const nowIso = new Date().toISOString();
    const targetId = activeConversation?.id || ('conv_' + Date.now());
    const caseId = activeConversation?.caseId || ('DAM-2026-IND-' + Math.floor(1000 + Math.random() * 9000));
    const title = activeConversation?.title || (promptToSend.slice(0, 52) || 'India Regulatory Investigation');
    const folderId = activeConversation?.folderId || null;
    const isPinned = activeConversation?.isPinned || false;
    const priorTurns = activeConversation ? [...activeConversation.turns] : [];

    // Add user turn
    const userTurn: ChatTurn = {
      id: 'u_' + Date.now(),
      role: 'user',
      content: promptToSend,
      attachments: [...attachments],
      createdAt: nowIso,
    };

    // Add assistant turn placeholder
    const assistantTurnId = 'a_' + (Date.now() + 1);
    const initialAssistantTurn: ChatTurn = {
      id: assistantTurnId,
      role: 'assistant',
      isLive: true,
      stages: [] as ActivityStage[],
      fullText: '',
      meta: null,
      createdAt: nowIso,
    };

    const initialConv: Conversation = {
      id: targetId,
      title,
      caseId,
      folderId,
      isPinned,
      createdAt: activeConversation?.createdAt || nowIso,
      turns: [...priorTurns, userTurn, initialAssistantTurn],
    };

    setActiveId(targetId);
    setConversations(prev => {
      const exists = prev.some(c => c.id === targetId);
      const nextList = exists
        ? prev.map(c => c.id === targetId ? initialConv : c)
        : [initialConv, ...prev];
      try {
        localStorage.setItem('dam-conversations', JSON.stringify(nextList.slice(0, 50)));
      } catch {
        // Safe localStorage fallback
      }
      return nextList;
    });

    setInput('');
    setAttachments([]);
    try {
      localStorage.removeItem('dam-draft');
    } catch {
      // Safe fallback
    }
    setIsStreaming(true);

    // Reset scroll state and anchor viewport to the new inquiry and thinking pane
    userScrolledUpRef.current = false;
    setIsScrolledUp(false);
    requestAnimationFrame(() => anchorToActiveTurn(true));
    setTimeout(() => anchorToActiveTurn(true), 60);
    setTimeout(() => anchorToActiveTurn(false), 220);

    abortControllerRef.current = new AbortController();

    const currentStages: ActivityStage[] = [];
    let accumulatedText = '';
    let currentMeta: InvestigationMeta | null = null;

    try {
      const historyPayload = priorTurns.map(t => ({
        role: t.role,
        content: t.content || t.fullText || '',
      }));

      const res = await fetch('/api/investigate/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true'
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          prompt: promptToSend,
          attachments,
          mode: activeMode,
          lang: activeLang,
          history: historyPayload,
          // apiKey: localStorage.getItem('dam-openai-key') || undefined,
          // tavilyKey: localStorage.getItem('dam-tavily-key') || undefined,
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
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(eventData); } catch { continue; }

          if (eventType === 'stage') {
            const stg = parsed as unknown as ActivityStage;
            const idx = currentStages.findIndex(s => s.id === stg.id);
            if (idx >= 0) currentStages[idx] = { ...currentStages[idx], ...stg };
            else currentStages.push(stg);

            setConversations(prev => prev.map(c => {
              if (c.id !== targetId) return c;
              return {
                ...c,
                turns: c.turns.map(t => t.id === assistantTurnId ? { ...t, stages: [...currentStages] } : t)
              };
            }));
          } else if (eventType === 'token') {
            const tok = parsed as { text?: string };
            accumulatedText += tok.text || '';

            setConversations(prev => prev.map(c => {
              if (c.id !== targetId) return c;
              return {
                ...c,
                turns: c.turns.map(t => t.id === assistantTurnId ? { ...t, fullText: accumulatedText } : t)
              };
            }));
          } else if (eventType === 'meta') {
            currentMeta = parsed as unknown as InvestigationMeta;
            setConversations(prev => prev.map(c => {
              if (c.id !== targetId) return c;
              return {
                ...c,
                turns: c.turns.map(t => t.id === assistantTurnId ? { ...t, meta: currentMeta } : t)
              };
            }));

            // Immediately trigger ambient backlight flash upon verdict determination
            const status = currentMeta?.verdicts?.verdictStatus || getQueryVerdictStatus(currentMeta);
            if (status) {
              setAmbientGlow(status);
              setTimeout(() => setAmbientGlow(null), 6800);
            }
          } else if (eventType === 'done') {
            const smartTitle = generateSmartTitle(promptToSend, currentMeta);
            setConversations(prev => {
              const nextList = prev.map(c => {
                if (c.id !== targetId) return c;
                return {
                  ...c,
                  title: smartTitle,
                  turns: c.turns.map(t => t.id === assistantTurnId ? { ...t, isLive: false } : t)
                };
              });
              try {
                localStorage.setItem('dam-conversations', JSON.stringify(nextList.slice(0, 50)));
              } catch {
                // Safe storage fallback
              }
              return nextList;
            });
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (err instanceof Error && err.name === 'AbortError') {
        showToast('Investigation halted by user');
      } else {
        showToast('Investigation error: ' + errMsg);
      }
    } finally {
      setIsStreaming(false);
      setConversations(prev => {
        const nextList = prev.map(c => {
          if (c.id !== targetId) return c;
          const smartTitle = generateSmartTitle(promptToSend, currentMeta);
          return {
            ...c,
            title: smartTitle,
            turns: c.turns.map(t => t.id === assistantTurnId ? { ...t, isLive: false } : t)
          };
        });
        try {
          localStorage.setItem('dam-conversations', JSON.stringify(nextList.slice(0, 50)));
        } catch {
          // Safe storage fallback
        }
        return nextList;
      });
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

  const latestAssistantTurn = activeConversation?.turns?.filter(t => t.role === 'assistant').slice(-1)[0];
  const activeVerdictStatus = latestAssistantTurn?.meta?.verdicts?.verdictStatus || getQueryVerdictStatus(latestAssistantTurn?.meta);

  // Ambient background flash when a verdict (right / false / unverified) is decided
  const [ambientGlow, setAmbientGlow] = useState<'right' | 'false' | 'unverified' | null>(null);

  useEffect(() => {
    // Expose window trigger for live preview / testing
    if (typeof window !== 'undefined') {
      (window as unknown as { __triggerAmbientGlow?: (type?: 'right' | 'false' | 'unverified') => void }).__triggerAmbientGlow = (type = 'false') => {
        setAmbientGlow(type);
        setTimeout(() => setAmbientGlow(null), 6800);
      };
    }

    if (activeVerdictStatus) {
      setAmbientGlow(activeVerdictStatus);
      const timer = setTimeout(() => {
        setAmbientGlow(null);
      }, 6800); // Smooth non-sharp ambient sweep lasts 6.8 seconds then smoothly fades out
      return () => clearTimeout(timer);
    }
  }, [activeId, activeVerdictStatus]);

  return (
    <div className={`app-shell${mobileMenuOpen ? ' menu-open' : ''} ${sidebarOpen ? '' : 'sidebar-closed'}`} id="appShell">
      {/* Google Gemini-Style Ambient Light: Smooth, organic rotating backlight aura (no sharp rectangular lines) */}
      {ambientGlow && (
        <div
          className={`ambient-verdict-backdrop gemini-ambient active glow-${ambientGlow}`}
          aria-hidden="true"
        >
          {/* Deep atmospheric inward glow */}
          <div className="gemini-ambient-haze" />
          {/* Smooth organic rotating ambient aura (soft, non-sharp, non-squarish) */}
          <div className="gemini-ambient-aura-wrap">
            <div className="gemini-ambient-stream" />
          </div>
          {/* Soft edge vignette */}
          <div className="gemini-ambient-vignette" />
        </div>
      )}

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
        folders={folders}
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
        evidenceCount={caseSources.length}
        hasQuery={hasQuery}
        onOpenEvidence={() => setEvidencePanelOpen(true)}
        onTogglePinConversation={handleTogglePin}
        onOpenCreateFolder={() => {
          setFolderToEdit(null);
          setFolderModalOpen(true);
        }}
        onEditFolder={folder => {
          setFolderToEdit(folder);
          setFolderModalOpen(true);
        }}
        onDeleteFolder={handleDeleteFolder}
        onMoveToFolder={handleMoveToFolder}
        onOpenMoveToFolderModal={conv => setMoveToFolderConv(conv)}
        onOpenMethodology={() => setMethodologyModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onOpenWhatsApp={() => setWhatsappModalOpen(true)}
        onOpenExtension={() => setExtensionModalOpen(true)}
        onOpenSettings={() => showToast('Verification Settings: Default regulatory profile active')}
        onSignOut={() => {
          setActiveId(null);
          showToast('Workstation session reset');
        }}
      />

      <main className="main-area" id="mainArea">
        <Topbar
          title={activeConversation ? activeConversation.title : 'New investigation'}
          caseId={activeConversation?.caseId}
          isLive={isStreaming}
          hasQuery={hasQuery}
          onOpenMethodology={() => setMethodologyModalOpen(true)}
          onToggleEvidence={() => setEvidencePanelOpen(prev => !prev)}
          evidenceCount={caseSources.length}
          onMobileMenuToggle={() => {
            if (window.innerWidth < 768) {
              setMobileMenuOpen(prev => !prev);
            } else {
              setSidebarOpen(prev => !prev);
            }
          }}
          onOpenShare={() => setShareModalOpen(true)}
          sidebarOpen={sidebarOpen}
          verdictStatus={activeVerdictStatus}
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
                <LandingBlock
                  onSelectPrompt={p => { setInput(p); handleSendInvestigation(p); }}
                  onOpenWhatsApp={() => setWhatsappModalOpen(true)}
                  onOpenExtension={() => setExtensionModalOpen(true)}
                />
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
                onUpdateAttachment={(idx, updated) => setAttachments(prev => prev.map((a, i) => i === idx ? { ...a, ...updated } : a))}
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

      {/* Floating Bottom-Right World Icon with Little Number on Top & Hover Evidence Popover */}
      {/* Appears ONLY when a query has been asked in chat, and shows ONLY that active chat's evidence */}
      {hasQuery && (
        <FloatingEvidenceButton
          sources={caseSources}
          onOpenFullEvidence={() => setEvidencePanelOpen(prev => !prev)}
          onCitationClick={handleCitationClick}
        />
      )}

      {/* Contextual Evidence Panel Drawer */}
      <EvidencePanel
        isOpen={evidencePanelOpen}
        onClose={() => setEvidencePanelOpen(false)}
        sources={caseSources}
        highlightIndex={highlightCitation}
      />

      {/* Share Briefing Modal (Phase 4) */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        conversation={activeConversation}
      />

      {/* Modals */}
      <MethodologyModal
        isOpen={methodologyModalOpen}
        onClose={() => setMethodologyModalOpen(false)}
      />

      <UrlModal
        isOpen={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        onConfirm={async u => {
          const tempAtt: Attachment = {
            name: u,
            type: 'url',
            size: 0,
            url: u,
            isUrl: true,
            ocrStatus: 'pending',
          };
          setAttachments(prev => [...prev, tempAtt]);
          try {
            const res = await fetch('/api/ingest-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: u })
            });
            const data = await res.json();
            if (res.ok && data.result) {
              setAttachments(prev => prev.map(a => a.url === u ? {
                ...a,
                name: data.result.title || data.result.domain || u,
                extractedText: data.result.extractedText || undefined,
                ocrStatus: data.result.status === 'success' ? 'success' : 'failed',
                threatEntities: {
                  phones: [],
                  urls: [data.result.finalUrl, ...(data.result.downloadLinks || [])],
                  senderIds: [],
                  amounts: []
                },
                urlAnalysis: data.result
              } : a));
              showToast(`Ingested: ${data.result.title || data.result.domain}`);
            } else {
              setAttachments(prev => prev.map(a => a.url === u ? {
                ...a,
                ocrStatus: 'failed',
                urlAnalysis: data.result
              } : a));
              showToast(data.error || 'Failed to ingest URL');
            }
          } catch (e) {
            console.warn('URL ingestion request failed', e);
            showToast('Network error while ingesting URL');
          }
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

      <FolderModal
        isOpen={folderModalOpen}
        folderToEdit={folderToEdit}
        onClose={() => {
          setFolderModalOpen(false);
          setFolderToEdit(null);
        }}
        onSave={handleCreateOrUpdateFolder}
      />

      <MoveToFolderModal
        isOpen={Boolean(moveToFolderConv)}
        conversation={moveToFolderConv}
        folders={folders}
        onClose={() => setMoveToFolderConv(null)}
        onMoveToFolder={handleMoveToFolder}
        onCreateNewFolder={() => {
          setFolderToEdit(null);
          setFolderModalOpen(true);
        }}
      />

      <WhatsAppModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
      />

      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />

      {toastMsg && (
        <div className="toast show" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
