import React, { useEffect, useState } from 'react';
import { useLiveMessage } from '../utils/liveRegion';

/** Polite live region for settings changes and other status messages. */
const LiveStatus: React.FC = () => {
  const message = useLiveMessage();
  const [text, setText] = useState('');

  // Clear first so an identical message is announced again.
  useEffect(() => {
    if (!message) return;
    setText('');
    const timer = window.setTimeout(() => setText(message.text), 40);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
};

export default LiveStatus;
