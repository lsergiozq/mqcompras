import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook fino sobre Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Suporta pt-BR. Sem dependências, sem servidor — roda nativamente em Chrome/Edge
 * (desktop e Android). Safari/iOS: suporte limitado; o hook retorna `supported: false`.
 *
 * Uso:
 *   const { supported, listening, transcript, error, start, stop, reset } = useSpeechRecognition();
 *   start(); // começa a escutar
 *   stop();  // para
 */
export default function useSpeechRecognition({ lang = 'pt-BR', interimResults = false, continuous = false } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = interimResults;
    recognition.continuous = continuous;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text.trim());
    };

    recognition.onerror = (event) => {
      setError(event.error || 'unknown');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    };
  }, [lang, interimResults, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {
      // start() lança se já está rodando
      setError(err?.message || 'start_failed');
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}

/**
 * Quebra uma transcrição corrida em itens individuais.
 * "leite, pão de forma e sabão" -> ["leite", "pão de forma", "sabão"]
 * "duas caixas de leite" -> ["duas caixas de leite"]  (a interpretação fica pro caller)
 */
export function splitVoiceTranscript(text) {
  if (!text) return [];
  return text
    .split(/,| e | mais |;|\.|\//gi)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Capitaliza a primeira letra (respeitando acentos). Mantém o restante igual.
 * "leite" -> "Leite"
 * "óleo de soja" -> "Óleo de soja"
 * "ABC" -> "ABC" (já começa em maiúsculo)
 */
export function capitalizeFirst(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  // Usa locale pt-BR para que acentos funcionem corretamente
  return trimmed.charAt(0).toLocaleUpperCase('pt-BR') + trimmed.slice(1);
}
