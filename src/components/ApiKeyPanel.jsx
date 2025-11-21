import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function ApiKeyPanel() {
  const [apiKey, setApiKey] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [apiMsg, setApiMsg] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadApiKey() {
    setLoading(true);
    try {
      const res = await api.listApiKeys();
      if (res && res.keys && res.keys.length > 0) {
        setApiKey(res.keys[0]);
      } else {
        setApiKey(null);
      }
    } catch (err) {
      console.error('failed to load api key', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApiKey();
  }, []);

  async function handleCreateApiKey(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiMsg('');
    try {
      const res = await api.createApiKey(newKeyName.trim());
      if (res && res.ok) {
        setApiMsg(`API Key created successfully!`);
        setNewKeyName('');
        await loadApiKey();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to create API key');
      }
    } catch (err) {
      setApiMsg('Error creating API key');
    }
    setCreatingKey(false);
  }

  async function handleDeleteApiKey() {
    if (!apiKey) return;
    if (!window.confirm('Delete your API key? This cannot be undone and you will need to update any applications using this key.')) return;
    try {
      const res = await api.deleteApiKey(apiKey.id);
      if (res && res.ok) {
        setApiMsg('API key deleted successfully');
        await loadApiKey();
      } else {
        setApiMsg(res && res.error ? res.error : 'Failed to delete key');
      }
    } catch (err) {
      setApiMsg('Error deleting API key');
    }
  }

  function getDaysUntilReset() {
    if (!apiKey || !apiKey.last_reset_at) return 30;
    const lastReset = new Date(apiKey.last_reset_at);
    const now = new Date();
    const daysSince = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysSince);
  }

  function getUsagePercentage() {
    if (!apiKey) return 0;
    return ((apiKey.requests_used / apiKey.requests_limit) * 100).toFixed(1);
  }

  function getUsageColor() {
    const percentage = parseFloat(getUsagePercentage());
    if (percentage >= 90) return '#fda4af';
    if (percentage >= 70) return '#fbbf24';
    return '#86efac';
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>API Keys</h2>
        <p className="muted">
          Access coin data programmatically with your personal API key. Limited to 1 API key per user with 2,000 requests per month.
        </p>

        {!apiKey ? (
          <>
            <form onSubmit={handleCreateApiKey} style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Key name (e.g., My Trading Bot)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  style={{ 
                    flex: 1,
                    minWidth: 200,
                    padding: '10px 14px',
                    fontSize: 14
                  }}
                  disabled={creatingKey}
                  maxLength={50}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={creatingKey || !newKeyName.trim()}
                  style={{ minWidth: 140 }}
                >
                  {creatingKey ? 'Creating...' : 'Create API Key'}
                </button>
              </div>
            </form>

            {apiMsg && (
              <div 
                className="msg" 
                style={{ 
                  marginTop: 12, 
                  color: apiMsg.includes('successfully') ? '#86efac' : '#fda4af'
                }}
              >
                {apiMsg}
              </div>
            )}

            <div style={{
              marginTop: 24,
              padding: 20,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No API Key Yet</div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                Create your API key to start making requests to the API
              </div>
            </div>
          </>
        ) : (
          <>
            {apiMsg && (
              <div 
                className="msg" 
                style={{ 
                  marginTop: 16, 
                  color: apiMsg.includes('successfully') ? '#86efac' : '#fda4af'
                }}
              >
                {apiMsg}
              </div>
            )}

            <div style={{
              marginTop: 24,
              padding: 20,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{apiKey.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Created {new Date(apiKey.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ 
                    color: '#94a3b8', 
                    fontFamily: 'monospace',
                    fontSize: 13,
                    wordBreak: 'break-all',
                    background: 'rgba(0,0,0,0.4)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {apiKey.api_key}
                  </div>
                </div>
                <span style={{ 
                  fontSize: 12,
                  padding: '6px 14px',
                  background: apiKey.active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: apiKey.active ? '#86efac' : '#fda4af',
                  borderRadius: 6,
                  fontWeight: 700,
                  border: `1px solid ${apiKey.active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {apiKey.active ? '✓ Active' : '✗ Inactive'}
                </span>
              </div>

              <div style={{
                marginTop: 24,
                padding: 16,
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Monthly Usage</div>
                  <div style={{ fontSize: 13, color: getUsageColor(), fontWeight: 700 }}>
                    {getUsagePercentage()}%
                  </div>
                </div>

                <div style={{
                  width: '100%',
                  height: 8,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 12
                }}>
                  <div style={{
                    width: `${getUsagePercentage()}%`,
                    height: '100%',
                    background: getUsageColor(),
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 16
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Requests Used</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                      {apiKey.requests_used.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Remaining</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: '#86efac' }}>
                      {(apiKey.requests_limit - apiKey.requests_used).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Monthly Limit</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                      {apiKey.requests_limit.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Resets In</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                      {getDaysUntilReset()} days
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleDeleteApiKey}
                  className="btn ghost"
                  style={{ width: '100%' }}
                >
                  Delete API Key
                </button>
              </div>
            </div>
          </>
        )}

        <div style={{ 
          marginTop: 32,
          padding: 20,
          background: 'rgba(59, 130, 246, 0.08)',
          borderRadius: 8,
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 16 }}>📚 API Documentation</div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
              <strong style={{ color: '#bfc7d6' }}>Base URL:</strong>
            </div>
            <code style={{ 
              display: 'block',
              color: '#bfc7d6', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '8px 12px', 
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'monospace'
            }}>
              https://devsite-backend-production.up.railway.app
            </code>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
              <strong style={{ color: '#bfc7d6' }}>Endpoint:</strong>
            </div>
            <code style={{ 
              display: 'block',
              color: '#bfc7d6', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '8px 12px', 
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'monospace'
            }}>
              GET /api/v1/coin/:symbol
            </code>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
              <strong style={{ color: '#bfc7d6' }}>Authentication Header:</strong>
            </div>
            <code style={{ 
              display: 'block',
              color: '#bfc7d6', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '8px 12px', 
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'monospace'
            }}>
              X-API-Key: your_api_key_here
            </code>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
              <strong style={{ color: '#bfc7d6' }}>Example Request:</strong>
            </div>
            <code style={{ 
              display: 'block',
              color: '#bfc7d6', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '12px', 
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
{`curl -X GET "https://devsite-backend-production.up.railway.app/api/v1/coin/BTC" \\
  -H "X-API-Key: your_api_key_here"`}
            </code>
          </div>

          <div style={{ 
            padding: 12,
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 6,
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              <strong style={{ color: '#bfc7d6' }}>Rate Limits:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>2,000 requests per month per API key</li>
                <li>Counter resets automatically on the 1st of each month</li>
                <li>Requests return 429 error when limit is exceeded</li>
              </ul>
            </div>
          </div>

          <div style={{ 
            marginTop: 16,
            padding: 12,
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 6,
            border: '1px solid rgba(34, 197, 94, 0.2)'
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              <strong style={{ color: '#86efac' }}>Response Data:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>Current price and market cap</li>
                <li>24h volume and price change</li>
                <li>Liquidity pool data</li>
                <li>Top 10 token holders</li>
                <li>Circulating supply info</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
