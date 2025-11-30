import React, { useEffect, useState } from 'react';
import * as api from '../api';

const NEWS_PER_PAGE = 12;

export default function News() {
  const [news, setNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  async function loadNews() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listNews();
      if (res.error) {
        setError(res.error);
      } else {
        setNews(res.news || []);
      }
    } catch (err) {
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
    const interval = setInterval(() => {
      loadNews();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let result = [...news];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(article => 
        article.headline.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.token_symbol.toLowerCase().includes(query) ||
        (article.key_points && article.key_points.some(p => p.toLowerCase().includes(query))) ||
        (article.price_prediction && article.price_prediction.toLowerCase().includes(query))
      );
    }

    setFilteredNews(result);
    setCurrentPage(1);
  }, [news, searchQuery]);

  const totalPages = Math.ceil(filteredNews.length / NEWS_PER_PAGE);
  const startIndex = (currentPage - 1) * NEWS_PER_PAGE;
  const endIndex = startIndex + NEWS_PER_PAGE;
  const currentNews = filteredNews.slice(startIndex, endIndex);

  function getPageNumbers() {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }

  function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getSentimentColor(sentiment) {
    switch (sentiment) {
      case 'bullish': return '#10b981';
      case 'bearish': return '#ef4444';
      case 'neutral': return '#94a3b8';
      default: return '#94a3b8';
    }
  }

  function getSentimentIcon(sentiment) {
    switch (sentiment) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      case 'neutral': return '➖';
      default: return '📊';
    }
  }

  return (
    <div className="news-container">
      <div className="news-header">
        <div className="news-header-content">
          <div className="news-header-left">
            <h2 className="news-title">📰 Market News</h2>
            <p className="news-subtitle">AI-powered analysis of market trends and token movements</p>
          </div>
          <div className="news-live-indicator">
            <span className="live-dot"></span>
            <span className="live-text">Live Updates</span>
          </div>
        </div>

        <div className="news-controls">
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="news-search-input"
          />
          <div className="news-count">
            {loading ? 'Loading...' : `${filteredNews.length} articles`}
          </div>
        </div>
      </div>

      {error && (
        <div className="news-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading && news.length === 0 ? (
        <div className="news-loading">
          <div className="spinner"></div>
          <p>Loading news...</p>
        </div>
      ) : currentNews.length === 0 ? (
        <div className="news-empty">
          <span className="news-empty-icon">📰</span>
          <h3>{searchQuery ? 'No news found' : 'No news yet'}</h3>
          <p>
            {searchQuery 
              ? 'Try a different search term' 
              : 'AI journalist is analyzing the market. New articles will appear automatically.'}
          </p>
        </div>
      ) : (
        <div className="news-grid">
          {currentNews.map((article) => (
            <article key={article.id} className="news-card">
              <div className="news-card-header">
                <div className="news-meta">
                  <span className="news-time">{formatTimeAgo(article.created_at)}</span>
                  <span 
                    className="news-sentiment"
                    style={{ color: getSentimentColor(article.sentiment) }}
                  >
                    {getSentimentIcon(article.sentiment)} {article.sentiment}
                  </span>
                </div>
                {article.token_symbol && (
                  <div className="news-token-badge">
                    {article.token_symbol}
                  </div>
                )}
              </div>

              <h3 className="news-headline">{article.headline}</h3>
              <p className="news-content">{article.content}</p>

              {article.key_points && article.key_points.length > 0 && (
                <div className="news-key-points">
                  <div className="key-points-title">Key Points:</div>
                  <ul>
                    {article.key_points.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {article.price_prediction && (
                <div className="news-prediction">
                  <div className="prediction-label">Price Prediction:</div>
                  <div className="prediction-value">{article.price_prediction}</div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <>
          <div className="news-pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
              style={{
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>

            {getPageNumbers().map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
              style={{
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>

          <div className="news-pagination-info">
            Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, filteredNews.length)} of {filteredNews.length} articles
          </div>
        </>
      )}

      <style jsx>{`
        .news-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .news-header {
          margin-bottom: 2rem;
        }

        .news-header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }

        .news-header-left {
          flex: 1;
        }

        .news-title {
          font-size: 2rem;
          font-weight: 800;
          margin: 0 0 0.5rem 0;
          color: var(--text-primary, #e2e8f0);
        }

        .news-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary, #94a3b8);
          margin: 0;
        }

        .news-live-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 8px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .live-text {
          font-size: 0.85rem;
          font-weight: 700;
          color: #10b981;
          text-transform: uppercase;
        }

        .news-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .news-search-input {
          flex: 1 1 250px;
          padding: 10px 14px;
          fontSize: 14;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          borderRadius: 8px;
          color: #fff;
        }

        .news-search-input::placeholder {
          color: #64748b;
        }

        .news-count {
          font-size: 13px;
          color: #94a3b8;
          white-space: nowrap;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }

        .news-error {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #ef4444;
          margin-bottom: 1.5rem;
        }

        .news-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          gap: 1rem;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(226, 232, 240, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .news-empty {
          text-align: center;
          padding: 4rem 2rem;
        }

        .news-empty-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: 1rem;
        }

        .news-empty h3 {
          font-size: 1.5rem;
          margin: 0 0 0.5rem 0;
          color: var(--text-primary, #e2e8f0);
        }

        .news-empty p {
          color: var(--text-secondary, #94a3b8);
          margin: 0;
        }

        .news-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .news-card {
          background: rgba(148, 163, 184, 0.05);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.2s;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .news-card:hover {
          transform: translateY(-2px);
          border-color: rgba(148, 163, 184, 0.2);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .news-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .news-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .news-time {
          font-size: 0.8rem;
          color: var(--text-secondary, #94a3b8);
        }

        .news-sentiment {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .news-token-badge {
          padding: 0.35rem 0.75rem;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .news-headline {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0 0 1rem 0;
          color: var(--text-primary, #e2e8f0);
          line-height: 1.3;
        }

        .news-content {
          color: var(--text-secondary, #94a3b8);
          line-height: 1.6;
          margin: 0 0 1rem 0;
        }

        .news-key-points {
          background: rgba(59, 130, 246, 0.05);
          border-left: 3px solid #3b82f6;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }

        .key-points-title {
          font-weight: 700;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
          color: #3b82f6;
        }

        .news-key-points ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .news-key-points li {
          color: var(--text-secondary, #94a3b8);
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 0.25rem;
        }

        .news-prediction {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 6px;
        }

        .prediction-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #8b5cf6;
        }

        .prediction-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary, #e2e8f0);
        }

        .news-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 24px;
          flex-wrap: wrap;
        }

        .pagination-btn {
          padding: 8px 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
        }

        .pagination-number {
          padding: 8px 12px;
          min-width: 40px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .pagination-number:hover {
          background: rgba(255,255,255,0.12);
        }

        .pagination-number.active {
          background: var(--accent);
          font-weight: 700;
        }

        .pagination-ellipsis {
          color: #64748b;
          padding: 0 4px;
        }

        .news-pagination-info {
          text-align: center;
          margin-top: 12px;
          font-size: 13px;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .news-container {
            padding: 1rem;
          }

          .news-header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .news-title {
            font-size: 1.5rem;
          }

          .news-live-indicator {
            justify-content: center;
          }

          .news-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .news-search-input {
            width: 100%;
          }

          .news-count {
            text-align: center;
          }

          .news-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
