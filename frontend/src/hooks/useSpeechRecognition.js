import { useEffect, useRef, useState } from 'react';

/**
 * F2-21 — thin wrapper around the browser Web Speech API. We use the
 * browser's local recognition (Chromium / Safari) so each participant
 * transcribes their own audio and posts back the finalised segments
 * tagged with their own identity. That keeps the speaker label
 * accurate without voice diarisation (matching the AC) and avoids the
 * server-side audio pipe entirely.
 *
 * <p>
 * When the browser doesn't expose <c>SpeechRecognition</c> (Firefox at
 * time of writing), <see cref="useSpeechRecognition"/> reports
 * <c>supported: false</c> and quietly no-ops — other participants on
 * supported browsers still feed the room's transcript.
 * </p>
 *
 * Usage:
 *
 *   const { supported, listening, start, stop } = useSpeechRecognition({
 *     onFinalSegment: ({ text, startedAt, endedAt }) => post(...),
 *   });
 */
export function useSpeechRecognition({ onFinalSegment } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const segmentStartRef = useRef(null);
  const callbackRef = useRef(onFinalSegment);

  useEffect(() => { callbackRef.current = onFinalSegment; }, [onFinalSegment]);

  useEffect(() => {
    const Impl = typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : null;
    setSupported(!!Impl);
  }, []);

  function start() {
    const Impl = typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : null;
    if (!Impl) {
      setError('Browser speech recognition is not supported on this browser.');
      return;
    }
    if (recognitionRef.current) return; // already running

    const rec = new Impl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onstart = () => {
      setListening(true);
      setError(null);
      segmentStartRef.current = new Date();
    };
    rec.onerror = (event) => {
      // 'no-speech' is a normal idle state for a quiet participant; the
      // browser auto-recovers, so we don't surface it as an error.
      if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
    };
    rec.onend = () => {
      // The browser ends the recognition session every few seconds even
      // with continuous=true. Restart automatically while the consumer
      // still wants to be listening.
      if (recognitionRef.current === rec && listeningRef.current) {
        try { rec.start(); } catch { /* ignored — flaky on quick toggles */ }
      } else {
        setListening(false);
      }
    };
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          const startedAt = segmentStartRef.current ?? new Date();
          const endedAt = new Date();
          segmentStartRef.current = endedAt;
          callbackRef.current?.({
            text,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            confidence: result[0]?.confidence ?? null,
          });
        }
      }
    };

    recognitionRef.current = rec;
    listeningRef.current = true;
    try {
      rec.start();
    } catch (err) {
      setError(err?.message ?? 'Could not start speech recognition.');
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
    }
  }

  function stop() {
    listeningRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* ignored */ }
    }
    recognitionRef.current = null;
    setListening(false);
  }

  // Plain (non-state) ref tracks "should auto-restart" — we read it
  // from inside the SpeechRecognition callbacks, which run outside React.
  const listeningRef = useRef(false);

  useEffect(() => () => stop(), []);

  return { supported, listening, error, start, stop };
}
