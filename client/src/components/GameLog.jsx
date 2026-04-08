import { useEffect, useRef } from 'react';

export function GameLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="game-log">
      <h4>Game Log</h4>
      <div className="log-entries">
        {logs.map((entry, i) => (
          <div key={i} className={`log-entry ${entry.type || ''}`}>
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
