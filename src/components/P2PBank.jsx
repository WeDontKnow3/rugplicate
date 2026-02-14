import React, { useEffect, useState } from 'react';
import * as api from '../api';

export default function P2PBank({ onActionComplete }) {
  const [tab, setTab] = useState('overview');
  const [deposits, setDeposits] = useState([]);
  const [loans, setLoans] = useState([]);
  const [creditScore, setCreditScore] = useState(null);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [collateralCoin, setCollateralCoin] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [userTokens, setUserTokens] = useState([]);

  async function loadData() {
    setLoading(true);
    try {
      const [depositsRes, loansRes, scoreRes, statsRes, meRes] = await Promise.all([
        api.p2pGetMyDeposits(),
        api.p2pGetMyLoans(),
        api.p2pGetCreditScore(),
        api.p2pGetStats(),
        api.getMe()
      ]);

      if (depositsRes && !depositsRes.error) setDeposits(depositsRes.deposits || []);
      if (loansRes && !loansRes.error) setLoans(loansRes.loans || []);
      if (scoreRes && !scoreRes.error) setCreditScore(scoreRes);
      if (statsRes && !statsRes.error) setStats(statsRes);
      if (meRes && meRes.user) setUserTokens(meRes.user.tokens || []);
    } catch (err) {
      console.error('Load P2P data error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeposit() {
    if (!depositAmount || Number(depositAmount) <= 0) {
      setMsg('Enter valid amount');
      return;
    }

    setLoading(true);
    setMsg('');

    const res = await api.p2pDeposit(Number(depositAmount));

    if (res && res.ok) {
      setMsg(`Deposited $${depositAmount} successfully`);
      setDepositAmount('');
      await loadData();
      if (onActionComplete) {
        onActionComplete({ 
          keepView: true, 
          animate: { amount: Number(depositAmount), type: 'down' } 
        });
      }
    } else {
      setMsg(res?.error || 'Deposit failed');
    }

    setLoading(false);
  }

  async function handleWithdraw(depositId) {
    if (!window.confirm('Withdraw this deposit?')) return;

    setLoading(true);
    setMsg('');

    const res = await api.p2pWithdraw(depositId);

    if (res && res.ok) {
      setMsg(`Withdrawn $${res.withdrawn.toFixed(2)} (Interest: $${res.interest.toFixed(2)})`);
      await loadData();
      if (onActionComplete) {
        onActionComplete({ 
          keepView: true, 
          animate: { amount: res.withdrawn, type: 'up' } 
        });
      }
    } else {
      setMsg(res?.error || 'Withdrawal failed');
    }

    setLoading(false);
  }

 async function handleRequestLoan() {
  if (!loanAmount || Number(loanAmount) <= 0) {
    setMsg('Enter valid loan amount');
    return;
  }

  setLoading(true);
  setMsg('');

  let coinId = null;
  if (collateralCoin && collateralAmount) {
    const meRes = await api.getMe();
    if (meRes && meRes.user && meRes.user.tokens) {
      const token = meRes.user.tokens.find(t => t.symbol === collateralCoin);
      if (!token) {
        setMsg('Selected collateral token not found');
        setLoading(false);
        return;
      }
    }

    const coinRes = await api.getCoin(collateralCoin);
    if (coinRes && coinRes.coin) {
      coinId = coinRes.coin.id;
    } else {
      setMsg('Failed to fetch collateral coin data');
      setLoading(false);
      return;
    }
  }

  const res = await api.p2pRequestLoan(
    Number(loanAmount),
    coinId,
    collateralAmount ? Number(collateralAmount) : null
  );

  if (res && res.ok) {
    setMsg(`Loan approved: $${loanAmount}`);
    setLoanAmount('');
    setCollateralCoin('');
    setCollateralAmount('');
    await loadData();
    if (onActionComplete) {
      onActionComplete({ 
        keepView: true, 
        animate: { amount: Number(loanAmount), type: 'up' } 
      });
    }
  } else {
    setMsg(res?.error || 'Loan request failed');
  }

  setLoading(false);
}

  async function handleRepayLoan(loanId) {
    if (!window.confirm('Repay this loan?')) return;

    setLoading(true);
    setMsg('');

    const res = await api.p2pRepayLoan(loanId);

    if (res && res.ok) {
      setMsg(`Loan repaid: $${res.repaid.toFixed(2)}`);
      await loadData();
      if (onActionComplete) {
        onActionComplete({ 
          keepView: true, 
          animate: { amount: res.repaid, type: 'down' } 
        });
      }
    } else {
      setMsg(res?.error || 'Repayment failed');
    }

    setLoading(false);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString();
  }

  function formatDateTime(iso) {
    return new Date(iso).toLocaleString();
  }

  function getStatusColor(status) {
    switch(status) {
      case 'active': return '#3b82f6';
      case 'repaid': return '#10b981';
      case 'defaulted': return '#ef4444';
      case 'liquidated': return '#f59e0b';
      default: return '#64748b';
    }
  }

  function getCreditScoreColor(score) {
    if (score >= 750) return '#10b981';
    if (score >= 650) return '#3b82f6';
    if (score >= 550) return '#f59e0b';
    return '#ef4444';
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 8 }}>P2P Bank</h2>
        <p className="muted">Peer-to-peer lending and deposits</p>
      </div>

      {msg && (
        <div className="msg" style={{ 
          marginBottom: 16,
          background: msg.includes('success') || msg.includes('approved') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)',
          color: msg.includes('success') || msg.includes('approved') ? '#10b981' : '#ef4444'
        }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button 
          className={`nav-btn ${tab === 'overview' ? 'active' : ''}`} 
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`nav-btn ${tab === 'deposits' ? 'active' : ''}`} 
          onClick={() => setTab('deposits')}
        >
          My Deposits
        </button>
        <button 
          className={`nav-btn ${tab === 'loans' ? 'active' : ''}`} 
          onClick={() => setTab('loans')}
        >
          My Loans
        </button>
        <button 
          className={`nav-btn ${tab === 'borrow' ? 'active' : ''}`} 
          onClick={() => setTab('borrow')}
        >
          Borrow
        </button>
        <button 
          className={`nav-btn ${tab === 'lend' ? 'active' : ''}`} 
          onClick={() => setTab('lend')}
        >
          Lend
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            <div className="card">
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Credit Score</div>
              <div style={{ 
                fontSize: 32, 
                fontWeight: 800, 
                color: creditScore ? getCreditScoreColor(creditScore.score) : '#64748b'
              }}>
                {creditScore ? creditScore.score : '---'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                300 - 850 range
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Max Loan Available</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6' }}>
                ${creditScore ? creditScore.maxLoan.toLocaleString() : '---'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Based on credit score
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Interest Rate</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>
                {creditScore ? creditScore.interestRate : '---'}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                For new loans
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Active Deposits</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>
                {deposits.filter(d => d.active).length}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Earning interest
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Platform Statistics</h3>
            {stats && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginTop: 16
              }}>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Total Deposits</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    ${stats.totalDeposits.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Total Interest Earned</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                    ${stats.totalInterestEarned.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Active Loans</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    ${stats.totalLoansActive.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Loans Repaid</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                    {stats.totalLoansRepaid}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Loans Defaulted</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                    {stats.totalLoansDefaulted}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'lend' && (
        <div className="card">
          <h3>Create Deposit</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Deposit funds to earn interest from loans. Minimum: $100
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Amount ($)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="100"
                min="100"
                style={{ width: '100%' }}
              />
            </div>
            <button 
              className="btn" 
              onClick={handleDeposit}
              disabled={loading}
            >
              Deposit
            </button>
          </div>
        </div>
      )}

      {tab === 'deposits' && (
        <div className="card">
          <h3>My Deposits ({deposits.length})</h3>

          {deposits.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: 40 }}>
              No deposits yet. Start lending to earn interest!
            </div>
          )}

          {deposits.map(deposit => (
            <div 
              key={deposit.id}
              style={{
                padding: 16,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                marginBottom: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    ${Number(deposit.amount).toFixed(2)}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    Interest earned: ${Number(deposit.interest_earned || 0).toFixed(2)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Created: {formatDate(deposit.created_at)}
                  </div>
                  {!deposit.active && deposit.withdrawn_at && (
                    <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                      ✓ Withdrawn on {formatDate(deposit.withdrawn_at)}
                    </div>
                  )}
                </div>

                {deposit.active && (
                  <button
                    className="btn"
                    onClick={() => handleWithdraw(deposit.id)}
                    disabled={loading}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'borrow' && (
        <div className="card">
          <h3>Request Loan</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Borrow funds from depositors. Repay within 7 days to avoid penalties.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Loan Amount ($)
              </label>
              <input
                type="number"
                value={loanAmount}
                onChange={e => setLoanAmount(e.target.value)}
                placeholder="50"
                min="50"
                style={{ width: '100%' }}
              />
              {creditScore && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Max available: ${creditScore.maxLoan.toLocaleString()} at {creditScore.interestRate}% interest
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Collateral (Optional)
              </label>
              <select
                value={collateralCoin}
                onChange={e => setCollateralCoin(e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
              >
                <option value="">No collateral</option>
                {userTokens.map(token => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} ({Number(token.amount).toLocaleString()})
                  </option>
                ))}
              </select>

              {collateralCoin && (
                <input
                  type="number"
                  value={collateralAmount}
                  onChange={e => setCollateralAmount(e.target.value)}
                  placeholder="Collateral amount"
                  min="1"
                  style={{ width: '100%' }}
                />
              )}
            </div>

            <button 
              className="btn" 
              onClick={handleRequestLoan}
              disabled={loading}
            >
              Request Loan
            </button>
          </div>
        </div>
      )}

      {tab === 'loans' && (
        <div className="card">
          <h3>My Loans ({loans.length})</h3>

          {loans.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: 40 }}>
              No loans yet.
            </div>
          )}

          {loans.map(loan => {
            const totalDebt = Number(loan.amount) * (1 + Number(loan.interest_rate));
            const isOverdue = loan.status === 'active' && new Date() > new Date(loan.due_date);

            return (
              <div 
                key={loan.id}
                style={{
                  padding: 16,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isOverdue ? '#ef4444' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 8,
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        ${Number(loan.amount).toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: `${getStatusColor(loan.status)}22`,
                        color: getStatusColor(loan.status),
                        textTransform: 'uppercase'
                      }}>
                        {loan.status}
                      </div>
                    </div>

                    <div className="muted" style={{ fontSize: 13 }}>
                      Interest rate: {(Number(loan.interest_rate) * 100).toFixed(2)}%
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Total to repay: ${totalDebt.toFixed(2)}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Due: {formatDateTime(loan.due_date)}
                      {isOverdue && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠ OVERDUE</span>}
                    </div>

                    {loan.collateral_coin_id && (
  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
    🔒 Collateral: {Number(loan.collateral_amount).toLocaleString()} tokens (ID: {loan.collateral_coin_id})
  </div>
)}

                    {loan.repaid_at && (
                      <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                        ✓ Repaid on {formatDate(loan.repaid_at)}
                      </div>
                    )}
                  </div>

                  {loan.status === 'active' && (
                    <button
                      className="btn"
                      onClick={() => handleRepayLoan(loan.id)}
                      disabled={loading}
                      style={{ padding: '8px 16px', fontSize: 13 }}
                    >
                      Repay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}