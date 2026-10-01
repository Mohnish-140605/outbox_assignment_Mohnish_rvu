import { useCallback, useEffect, useRef, useState } from 'react';
import { acknowledgeSlackNotifications, fetchSlackNotifications } from '../lib/api';
import type { SlackNotification } from '../types/notifications';

const POLL_INTERVAL_MS = 8000;
const MAX_INITIAL_DRAIN_PAGES = 20;
const SOUND_STORAGE_KEY = 'reachinbox.slackNotificationSound';

function playNotificationSound(): void {
  try {
    const context = new AudioContext();
    void context.resume().then(() => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660;
      volume.gain.setValueAtTime(0.035, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.onended = () => { void context.close(); };
    }).catch(() => { void context.close(); });
  } catch {
    // Browser audio can be unavailable or blocked until a user gesture.
  }
}

function getInitialSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function useSlackNotifications() {
  const [queue, setQueue] = useState<SlackNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundPreference);
  const soundEnabledRef = useRef(soundEnabled);
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const appOpenedAt = Date.now();

    const showNewEvents = (notifications: SlackNotification[]) => {
      const newEvents = notifications
        .filter((notification) => Date.parse(notification.createdAt) >= appOpenedAt)
        .filter((notification) => !seenIdsRef.current.has(notification.id))
        .reverse();

      if (newEvents.length === 0) return;
      for (const event of newEvents) seenIdsRef.current.add(event.id);
      setQueue((current) => [...current, ...newEvents].slice(-50));
      if (soundEnabledRef.current) {
        for (const _event of newEvents) playNotificationSound();
      }
    };

    const schedulePoll = () => {
      timer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (!active) return;
      if (document.visibilityState === 'hidden') {
        schedulePoll();
        return;
      }

      try {
        const result = await fetchSlackNotifications(10);
        if (!active) return;
        showNewEvents(result.notifications);
        if (result.notifications.length > 0) {
          await acknowledgeSlackNotifications(result.notifications.map((event) => event.id));
        }
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Slack notifications could not be checked.');
      } finally {
        if (active) schedulePoll();
      }
    };

    const clearHistoricalEvents = async () => {
      try {
        for (let page = 0; page < MAX_INITIAL_DRAIN_PAGES && active; page += 1) {
          const result = await fetchSlackNotifications(50);
          if (!active || result.notifications.length === 0) break;
          const ids = result.notifications.map((event) => event.id);
          showNewEvents(result.notifications);
          await acknowledgeSlackNotifications(ids);
          if (result.notifications.length < 50) break;
        }
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Slack notifications could not be checked.');
      } finally {
        if (active) schedulePoll();
      }
    };

    void clearHistoricalEvents();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const acknowledgeDisplayed = useCallback((id: string) => {
    setQueue((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const updateSoundPreference = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Keep the in-memory setting when storage is unavailable.
    }
  }, []);

  return {
    notification: queue[0] ?? null,
    acknowledgeDisplayed,
    error,
    soundEnabled,
    setSoundEnabled: updateSoundPreference,
  };
}