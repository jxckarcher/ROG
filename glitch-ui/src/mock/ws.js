/**
 * MockWebSocket — replaces window.WebSocket in VITE_MOCK=1 mode.
 *
 * Simulates the OpenClaw gateway WS protocol:
 *  1. onopen → emit connect.challenge
 *  2. client sends connect req → emit hello-ok
 *  3. client sends chat.send → emit agent lifecycle + deltas + chat.final
 */

let _runCounter = 0;

const MOCK_REPLIES = {
  default: "Hi! I'm Glitch running in mock mode. How can I help?",
  hello:   "Hey! Mock mode is working perfectly.",
  test:    "Test received. Streaming works. Bubbles split correctly.",
};

const TERM_REPLIES = {
  default: "Running df -h...\n\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        80G   12G   65G  16% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm",
};

export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen    = null;
    this.onmessage = null;
    this.onclose   = null;
    this.onerror   = null;
    this.OPEN      = 1;
    this.CLOSED    = 3;

    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.({ type: 'open' });
      // Immediately fire the connect.challenge
      this._emit({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'mock-nonce-' + Date.now() },
      });
    }, 20);
  }

  _emit(msg) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  send(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.method === 'connect') {
      // Respond with hello-ok after a short delay
      setTimeout(() => {
        this._emit({
          type: 'res',
          id:   msg.id,
          ok:   true,
          payload: {
            type: 'hello-ok',
            auth: { deviceToken: 'mock-device-token-abc123' },
          },
        });
      }, 40);
      return;
    }

    if (msg.method === 'chat.send') {
      const sessionKey = msg.params?.sessionKey || 'main';
      const userText   = (msg.params?.message || '').toLowerCase().trim();
      const isTerm = sessionKey === 'terminal';
      const reply = isTerm
        ? (TERM_REPLIES[userText] || TERM_REPLIES.default)
        : (MOCK_REPLIES[userText] || MOCK_REPLIES.default);
      this._streamReply(sessionKey, reply);
      return;
    }

    // Ignore unknown methods silently
  }

  /**
   * Simulate a streaming agent response:
   * lifecycle:start → N assistant deltas → lifecycle:end → chat.final
   */
  _streamReply(sessionKey, fullText) {
    const runId = `mock-run-${++_runCounter}`;
    const words = fullText.split(' ');

    // 1. lifecycle:start
    setTimeout(() => {
      this._emit({
        type: 'event', event: 'agent',
        payload: { stream: 'lifecycle', data: { phase: 'start' }, runId, sessionKey },
      });
    }, 30);

    // 2. word-by-word deltas
    let cumulative = '';
    words.forEach((word, i) => {
      const delay = 80 + i * 45;
      setTimeout(() => {
        cumulative += (i === 0 ? '' : ' ') + word;
        this._emit({
          type: 'event', event: 'agent',
          payload: {
            stream: 'assistant',
            data: { delta: (i === 0 ? '' : ' ') + word, text: cumulative },
            runId, sessionKey,
          },
        });
      }, delay);
    });

    const endDelay = 80 + words.length * 45 + 60;

    // 3. lifecycle:end
    setTimeout(() => {
      this._emit({
        type: 'event', event: 'agent',
        payload: { stream: 'lifecycle', data: { phase: 'end' }, runId, sessionKey },
      });
    }, endDelay);

    // 4. chat.final (canonical snapshot)
    setTimeout(() => {
      this._emit({
        type: 'event', event: 'chat',
        payload: {
          state: 'final',
          message: { content: fullText },
          runId, sessionKey,
        },
      });
    }, endDelay + 20);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: 'mock close' });
  }
}
