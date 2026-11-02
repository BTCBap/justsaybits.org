import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { announce } from '../utils/liveRegion';

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

const getSnapshot = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine);
const getServerSnapshot = (): boolean => true;

/** A small fog-backed state bar so a lost connection is visible, not silent. */
const OfflineNotice: React.FC = () => {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const wasOffline = useRef(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setReconnected(false);
      announce('Offline. Screens already loaded still work.');
      return undefined;
    }
    if (wasOffline.current) {
      setReconnected(true);
      announce('Back online');
      const timer = window.setTimeout(() => setReconnected(false), 2400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [online]);

  if (online && !reconnected) return null;

  return (
    <div className="offline-notice" role="status" aria-live="polite">
      <span className="offline-notice__mark" aria-hidden="true">
        {online ? <RefreshCw className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      </span>
      <span className="offline-notice__text">
        {online ? 'Back online.' : 'Offline.'}
      </span>
      {!online && (
        <button type="button" className="offline-notice__action" onClick={() => window.location.reload()}>
          Reconnect
        </button>
      )}
    </div>
  );
};

export default OfflineNotice;
