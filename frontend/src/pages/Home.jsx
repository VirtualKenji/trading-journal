import { useState, useEffect } from 'react';
import { checkHealth } from '../api/client';

function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkHealth()
      .then(data => setHealth(data))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Trading Journal MVP</h1>
      <p>Phase 1: Foundation Setup</p>

      {error && (
        <div style={{ color: 'red', padding: '1rem', border: '1px solid red' }}>
          Error: {error}
        </div>
      )}

      {health && (
        <div style={{ padding: '1rem', border: '1px solid green' }}>
          <h3>Backend Health Check</h3>
          <pre>{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default Home;
