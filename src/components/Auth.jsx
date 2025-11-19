import React, { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import * as api from '../api';
import { useTranslation } from 'react-i18next';

export default function Auth({ onLogin }) {
  const { t } = useTranslation();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);

  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITEKEY;

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    try {
      if (mode === 'login') {
        const res = await api.login(username, password);
        if (res && res.token) {
          onLogin(res.token);
          setMsg(t('loggedIn'));
        } else {
          setMsg(res.error || t('errorGeneric'));
        }
      } else {
        if (!captchaToken) {
          setMsg(t('pleaseCompleteCaptcha'));
          return;
        }
        const res = await api.register(username, password, captchaToken);
        if (res && res.token) {
          onLogin(res.token);
          setMsg(t('registeredLoggedIn'));
        } else {
          setMsg(res.error || t('errorGeneric'));
        }
      }
    } catch (e) {
      setMsg(e.message || t('errorGeneric'));
    }
  }

  function handleModeSwitch() {
    setMode(mode === 'login' ? 'register' : 'login');
    setMsg('');
    setCaptchaToken(null);
  }

  return (
    <div className="auth card">
      <h2>{mode === 'login' ? t('login') : t('register')}</h2>

      <form onSubmit={submit}>
        <input
          placeholder={t('usernamePlaceholder')}
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />

        <input
          placeholder={t('passwordPlaceholder')}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {mode === 'register' && (
          <div style={{ marginTop: '10px', marginBottom: '10px' }}>
            {recaptchaSiteKey ? (
              <ReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={token => setCaptchaToken(token)}
              />
            ) : (
              <p style={{ color: 'red' }}>{t('recaptchaNotConfigured')}</p>
            )}
          </div>
        )}

        <button type="submit">
          {mode === 'login' ? t('submitLogin') : t('submitRegister')}
        </button>
      </form>

      <p>
        <button type="button" onClick={handleModeSwitch}>
          {t('switchTo', {
            mode: mode === 'login' ? t('register') : t('login')
          })}
        </button>
      </p>

      {msg && <p className="msg">{msg}</p>}
    </div>
  );
}
