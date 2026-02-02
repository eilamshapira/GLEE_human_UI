import { useCallback, useRef } from "react";

interface UseEventTrackerArgs {
  send: (type: string, payload: Record<string, unknown>) => void;
  roundNumber: number;
}

export interface EventTracker {
  trackEvent: (event: string, data?: Record<string, unknown>) => void;
  trackSlider: (pct: number) => void;
  trackTyping: (text: string) => void;
  trackPaste: (blocked: boolean) => void;
  trackClick: (button: string, extra?: Record<string, unknown>) => void;
}

export function useEventTracker({
  send,
  roundNumber,
}: UseEventTrackerArgs): EventTracker {
  const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSliderRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackEvent = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      send("track_event", {
        event,
        ts: new Date().toISOString(),
        round: roundNumber,
        data: data ?? {},
      });
    },
    [send, roundNumber],
  );

  const trackSlider = useCallback(
    (pct: number) => {
      if (sliderTimerRef.current) clearTimeout(sliderTimerRef.current);
      sliderTimerRef.current = setTimeout(() => {
        if (pct === lastSliderRef.current) return;
        lastSliderRef.current = pct;
        trackEvent("slider_change", { pct });
      }, 500);
    },
    [trackEvent],
  );

  const trackTyping = useCallback(
    (text: string) => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        trackEvent("typing", {
          length: text.length,
          preview: text.slice(0, 200),
        });
      }, 1000);
    },
    [trackEvent],
  );

  const trackPaste = useCallback(
    (blocked: boolean) => {
      trackEvent("paste_attempt", { blocked });
    },
    [trackEvent],
  );

  const trackClick = useCallback(
    (button: string, extra?: Record<string, unknown>) => {
      trackEvent("button_click", { button, ...extra });
    },
    [trackEvent],
  );

  return { trackEvent, trackSlider, trackTyping, trackPaste, trackClick };
}
