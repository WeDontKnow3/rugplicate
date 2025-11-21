import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function ApiKeyPanel({ onClose }) {
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [apiMsg, setApiMsg] = useState('');

  async function loadApiKeys() {
    try {
      const res = await api.listApiKeys();
      if (res && res.keys) setApiKeys(res.keys);
    } catch (err) {
      console.error('failed to load api keys', err);
    }
  }

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function handleCreateApiKey(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiMsg('');
    try {
      const res = await api.createApiKey(newKeyName.trim());
      if (res && res.ok) {
        setApiMsg(`API Key created: ${res.key.api_key}`);
        setNewKeyName('');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to create API key');
      }
    } catch (err) {
      setApiMsg('Error creating API key');
    }
    setCreatingKey(false);
  }

  async function handleDeleteApiKey(id) {
    if (!window.confirm('Delete this API key? This cannot be undone.')) return;
    try {
      const res = await api.deleteApiKey(id);
      if (res && res.ok) {
        setApiMsg('API key deleted');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to delete key');
      }
    } catch (err) {
      setApiMsg('Error deleting API key');
    }
  }

  async function handleResetApiKey(id) {
    if (!window.confirm('Reset request counter for this API key?')) return;
    try {
      const res = await api.resetApiKeyUsage(id);
      if (res && res.ok) {
        setApiMsg('Request counter reset');
        await loadApiKeys();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to reset');
      }
    } catch (err) {
      setApiMsg('Error resetting key');
    }
  }

  return (
    <div style={{ 
      marginTop: 12,
      padding: 12,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      maxHeight: 300,
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>API Keys</h4>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 18,
            padding: 0
          }}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleCreateApiKey} style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Key name"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          style={{ 
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            marginBottom: 8,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            color: 'white'
          }}
          disabled={creatingKey}
        />
        <button
          type="submit"
          disabled={creatingKey || !newKeyName.trim()}
          style={{
            width: '100%',
            padding: '6px',
            fontSize: 12,
            background: 'rgba(59, 130, 246, 0.5)',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {creatingKey ? 'Creating...' : 'Create API Key'}
        </button>
      </form>

      {apiMsg && (
        <div style={{ 
          fontSize: 11,
          padding: 8,
          background: apiMsg.includes('created') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: apiMsg.includes('created') ? '#86efac' : '#fda4af',
          borderRadius: 4,
          marginBottom: 12,
          wordBreak: 'break-all'
        }}>
          {apiMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {apiKeys.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            No API keys yet
          </div>
        )}
        {apiKeys.map(key => (
          <div 
            key={key.id}
            style={{
              padding: 8,
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 4,
              fontSize: 11
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{key.name}</div>
            <div style={{ color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' }}>
              {key.api_key}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: '#94a3b8' }}>
                {key.requests_used}/{key.requests_limit} requests
              </span>
              <span style={{ 
                fontSize: 10,
                padding: '2px 6px',
                background: key.active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: key.active ? '#86efac' : '#fda4af',
                borderRadius: 3
              }}>
                {key.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleResetApiKey(key.id)}
                style={{
                  flex: 1,
                  padding: '4px',
                  fontSize: 10,
                  background: 'rgba(59, 130, 246, 0.3)',
                  border: 'none',
                  borderRadius: 3,
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
              <button
                onClick={() => handleDeleteApiKey(key.id)}
                style={{
                  flex: 1,
                  padding: '4px',
                  fontSize: 10,
                  background: 'rgba(239, 68, 68, 0.3)',
                  border: 'none',
                  borderRadius: 3,
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: 12,
        padding: 8,
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
        fontSize: 10,
        color: '#94a3b8'
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>API Endpoint:</div>
        <code style={{ color: '#bfc7d6' }}>GET /api/v1/coin/:symbol</code>
        <div style={{ marginTop: 4 }}>
          Use header: <code style={{ color: '#bfc7d6' }}>X-API-Key: your_key</code>
        </div>
      </div>
    </div>
  );
}
