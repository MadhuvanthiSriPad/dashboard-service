import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep logs in dev tools for stack traces while still rendering fallback UI.
    // eslint-disable-next-line no-console
    console.error('Dashboard runtime error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0f1117',
            color: '#f1f5f9',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '24px',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: '20px', color: '#ef4444' }}>
            Dashboard crashed at runtime
          </h1>
          <p style={{ margin: '0 0 12px', color: '#94a3b8' }}>
            Open browser DevTools console for full stack trace.
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#13151e',
              border: '1px solid #2a2d3a',
              borderRadius: '8px',
              padding: '12px',
              color: '#fca5a5',
            }}
          >
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
