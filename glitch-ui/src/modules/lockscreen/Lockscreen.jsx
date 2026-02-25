import { useState, useEffect } from 'react';
import { useStore } from '../../core/store';
import './Lockscreen.css';

const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0', '✓'],
];

export default function Lockscreen() {
  const { unlock, setPin, pinHash } = useStore();
  const firstRun = !pinHash;

  // 'enter' | 'confirm'
  const [stage, setStage]     = useState(firstRun ? 'enter' : 'enter');
  const [digits, setDigits]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [shake, setShake]     = useState(false);
  const [status, setStatus]   = useState(firstRun ? 'Set a 4-digit PIN' : 'Enter PIN');

  const current = stage === 'confirm' ? confirm : digits;
  const setCurrent = stage === 'confirm' ? setConfirm : setDigits;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submit = async (pin) => {
    if (firstRun || stage === 'confirm') {
      if (firstRun && stage === 'enter') {
        // First PIN entry — go to confirm stage
        setStage('confirm');
        setStatus('Confirm PIN');
        return;
      }
      // Confirm stage: check they match
      if (pin !== digits) {
        setStatus('PINs do not match — try again');
        triggerShake();
        setConfirm('');
        setDigits('');
        setStage('enter');
        return;
      }
      await setPin(pin);
      return;
    }
    // Normal unlock
    const result = await unlock(pin);
    if (result === 'NO_PIN') {
      // shouldn't happen — but handle gracefully
      setStatus('Set a 4-digit PIN');
      setDigits('');
      return;
    }
    if (!result) {
      setStatus('Wrong PIN — try again');
      triggerShake();
      setDigits('');
    }
  };

  const pressKey = async (key) => {
    if (key === '⌫') {
      setCurrent(c => c.slice(0, -1));
      return;
    }
    if (key === '✓') {
      if (current.length === 4) await submit(current);
      return;
    }
    if (current.length >= 4) return;
    const next = current + key;
    setCurrent(next);
    if (next.length === 4) {
      // auto-submit after brief visual pause
      setTimeout(() => submit(next), 120);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('⌫');
      else if (e.key === 'Enter') pressKey('✓');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="lockscreen">
      <div className="lock-card">
        <div className="lock-logo">
          <span className="lock-glyph">⚡</span>
          <span className="lock-name">Glitch</span>
        </div>

        <p className="lock-status">{status}</p>

        <div className={`lock-dots ${shake ? 'shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={`lock-dot ${i < current.length ? 'filled' : ''}`} />
          ))}
        </div>

        <div className="lock-pad">
          {PAD.map((row, ri) =>
            row.map(key => (
              <button
                key={ri + key}
                className={`lock-key btn-ghost ${key === '✓' ? 'lock-key-submit' : ''} ${key === '⌫' ? 'lock-key-del' : ''}`}
                onClick={() => pressKey(key)}
              >
                {key}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
