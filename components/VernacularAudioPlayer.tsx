'use client';

import React, { useState, useEffect, useRef } from 'react';

interface VernacularAudioPlayerProps {
  text: string;
  verdictSummary?: {
    factualCorrectness?: string;
    scamRisk?: string;
  };
}

interface LanguageOption {
  code: string;
  label: string;
  native: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', label: 'English (IN)', native: 'English' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
];

function cleanMarkdownForAudio(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[\d+\]/g, '') // remove [1], [2] citations
    .replace(/^#{1,6}\s+/gm, '') // remove headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links
    .replace(/`[^`]+`/g, '') // remove inline code
    .replace(/^\s*[-*+]\s+/gm, '. ') // bullets to pauses
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

export const VernacularAudioPlayer: React.FC<VernacularAudioPlayerProps> = ({
  text,
  verdictSummary,
}) => {
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlay = () => {
    if (!isSupported || !text) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();

    const cleaned = cleanMarkdownForAudio(text);
    if (!cleaned) return;

    // Optional audio preamble with verdict for immediate clarity
    let speechContent = cleaned;
    if (verdictSummary?.scamRisk && verdictSummary.scamRisk !== 'Low' && verdictSummary.scamRisk !== 'Not applicable') {
      speechContent = `Security Notice. High risk alert: ${verdictSummary.scamRisk} scam risk detected. ` + speechContent;
    }

    const utterance = new SpeechSynthesisUtterance(speechContent);
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;
    utterance.lang = selectedLang;

    // Find best matching voice for selected language
    const langPrefix = selectedLang.split('-')[0];
    const match = availableVoices.find(
      v => v.lang.toLowerCase() === selectedLang.toLowerCase() || v.lang.toLowerCase().startsWith(langPrefix)
    );

    if (match) {
      utterance.voice = match;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);

    if (isPlaying) {
      // Re-trigger with new rate seamlessly
      handleStop();
      setTimeout(handlePlay, 50);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="vernacular-audio-bar" aria-label="Vernacular Regional Audio Advisory">
      <div className="audio-bar-left">
        <button
          type="button"
          className={`audio-play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? handlePause : handlePlay}
          title={isPlaying ? 'Pause audio advisory' : 'Listen to audio advisory'}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio advisory'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {isPlaying && (
          <button
            type="button"
            className="audio-stop-btn"
            onClick={handleStop}
            title="Stop audio playback"
            aria-label="Stop audio"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
        )}

        <div className="audio-info">
          <div className="audio-title-row">
            <span className="audio-label">Citizen Voice Advisory</span>
            {isPlaying && (
              <div className="audio-equalizer" aria-hidden="true">
                <span className="eq-bar bar-1" />
                <span className="eq-bar bar-2" />
                <span className="eq-bar bar-3" />
                <span className="eq-bar bar-4" />
              </div>
            )}
          </div>
          <span className="audio-status-text">
            {isPlaying
              ? 'Speaking briefing...'
              : isPaused
              ? 'Playback paused'
              : 'Listen to verdict & guidance in regional dialect'}
          </span>
        </div>
      </div>

      <div className="audio-bar-right">
        {/* Language selector */}
        <div className="audio-lang-selector">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <select
            value={selectedLang}
            onChange={e => {
              setSelectedLang(e.target.value);
              if (isPlaying) {
                handleStop();
              }
            }}
            className="audio-lang-select"
            aria-label="Select Voice Language"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.native} ({lang.label})
              </option>
            ))}
          </select>
        </div>

        {/* Speed toggle */}
        <button
          type="button"
          className="audio-speed-btn"
          onClick={cycleSpeed}
          title="Playback speed"
          aria-label={`Playback speed: ${playbackRate}x`}
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
};
