/**
 * Mock @tauri-apps/api/core for VITE_MOCK=1 mode.
 * Intercepts invoke() and returns fixture data so the app
 * runs without a real Tauri backend or VPS connection.
 */

// ls -la output — parseable by WorkspacesPanel loadDir
// Format: perms links owner group size month day time name
// parts.slice(8) → filename
const MOCK_LS_OUTPUT = `total 48
drwxr-xr-x  5 root root 4096 Feb 25 10:00 .
drwxr-xr-x 18 root root 4096 Feb 25 10:00 ..
-rw-r--r--  1 root root  234 Feb 25 10:00 README.md
-rw-r--r--  1 root root  876 Feb 25 10:00 SOUL.md
-rw-r--r--  1 root root  102 Feb 25 10:00 notes.md
-rw-r--r--  1 root root   45 Feb 25 10:00 .gitignore
drwxr-xr-x  3 root root 4096 Feb 25 10:00 src
`;

const MOCK_FILE_CONTENT = '# Mock File\n\nThis file is a fixture used in VITE_MOCK mode.\n';

// parseCronList expects lines with cols separated by 2+ spaces, ID length >= 10
const MOCK_CRON_OUTPUT = `ID                    NAME            SCHEDULE       NEXT            LAST            STATUS    AGENT
──────────────────────────────────────────────────────────────────────────────────────────────────
mock-cron-id-1        morning-brief   0 9 * * 1-5    2026-02-26      2026-02-25      ok        main
mock-cron-id-2        daily-review    0 18 * * *     2026-02-26      2026-02-25      disabled  main
`;

export async function invoke(cmd, args = {}) {
  const { cmd: sshCmd = '' } = args;

  // ── Tunnel / connection ──────────────────────────────────────────────────
  if (cmd === 'start_tunnel') return { ok: true };
  if (cmd === 'stop_tunnel')  return { ok: true };

  // ── SSH runner ───────────────────────────────────────────────────────────
  if (cmd === 'ssh_run') {
    // Initial connect check
    if (sshCmd.includes('echo SSH_OK')) {
      return { stdout: 'SSH_OK\nactive\n', stderr: '', code: 0 };
    }

    // git operations — use flexible matches to handle `git -C /path diff --stat` style
    if (sshCmd.includes('diff --stat')) {
      return { stdout: ' src/App.jsx | 3 +++\n src/core/store.js | 12 ++++++---\n 2 files changed, 11 insertions(+), 4 deletions(-)\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('git log --oneline') || sshCmd.includes('git log')) {
      return { stdout: 'abc1234 feat: add chat streaming fix\ndef5678 v0.2: full design overhaul\n982abc1 Initial commit\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('git add') || sshCmd.includes('git commit') || sshCmd.includes('git push')) {
      return { stdout: '[master abc1234] mock commit\n 2 files changed, 11 insertions(+)\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('gh repo clone')) {
      return { stdout: "Cloning into '/root/repos/jxckarcher/ROG'...\ndone.\n", stderr: '', code: 0 };
    }
    if (sshCmd.includes('git clone')) {
      return { stdout: "Cloning into '/root/repos/mock/repo'...\ndone.\n", stderr: '', code: 0 };
    }
    if (sshCmd.includes('git pull') || sshCmd.includes('git fetch')) {
      return { stdout: 'Already up to date.\n', stderr: '', code: 0 };
    }
    // git status --short returns dirty file list (enables Commit + Push button)
    if (sshCmd.includes('git') && sshCmd.includes('status --short')) {
      return { stdout: ' M src/App.jsx\n M src/core/store.js\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('git status')) {
      return { stdout: 'On branch main\nChanges not staged for commit:\n  modified: src/App.jsx\n', stderr: '', code: 0 };
    }

    // File ops — return proper ls -la format for loadDir parser
    if (sshCmd.match(/^ls\b/) || sshCmd.includes(' ls ')) {
      return { stdout: MOCK_LS_OUTPUT, stderr: '', code: 0 };
    }
    if (sshCmd.includes('cat ')) {
      return { stdout: MOCK_FILE_CONTENT, stderr: '', code: 0 };
    }
    if (sshCmd.includes('touch ') || sshCmd.includes('mkdir ')) {
      return { stdout: '', stderr: '', code: 0 };
    }
    if (sshCmd.includes('mv ') || sshCmd.includes('rm ')) {
      return { stdout: '', stderr: '', code: 0 };
    }

    // OpenClaw cron — use tabular format that parseCronList understands
    if (sshCmd.includes('openclaw cron list')) {
      return { stdout: MOCK_CRON_OUTPUT, stderr: '', code: 0 };
    }
    if (sshCmd.includes('openclaw cron runs') || sshCmd.includes('cron history')) {
      return { stdout: 'run-1  2026-02-25 09:00  ok  1200ms\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('openclaw cron add') || sshCmd.includes('openclaw cron remove')
        || sshCmd.includes('openclaw cron enable') || sshCmd.includes('openclaw cron disable')) {
      return { stdout: 'ok\n', stderr: '', code: 0 };
    }

    // OpenClaw chat (SSH fallback path)
    if (sshCmd.includes('openclaw chat send') || sshCmd.includes('openclaw send')) {
      const reply = JSON.stringify({ response: "I'm Glitch (mock/SSH fallback)." });
      return { stdout: reply, stderr: '', code: 0 };
    }

    // Memory files
    if (sshCmd.includes('find') && sshCmd.includes('memory')) {
      return { stdout: '/root/.openclaw/workspace/memory/main.md\n/root/.openclaw/workspace/memory/glitchlog.md\n', stderr: '', code: 0 };
    }

    // Budget / usage
    if (sshCmd.includes('openclaw') && sshCmd.includes('status')) {
      return { stdout: JSON.stringify({ budget: { used: 0.42, limit: 5.00, currency: 'USD' } }), stderr: '', code: 0 };
    }

    // GitHub via gh CLI — order matters: most specific checks first
    if (sshCmd.includes('gh api user')) {
      // Auth check — return a valid GitHub username
      return { stdout: 'jxckarcher\n', stderr: '', code: 0 };
    }
    if (sshCmd.includes('gh repo list')) {
      // Repo listing with all fields expected by GitHubPanel
      return { stdout: JSON.stringify([
        {
          name: 'ROG',
          visibility: 'PUBLIC',
          description: 'ROG Ally configs and Glitch UI',
          updatedAt: '2026-02-25T10:00:00Z',
          url: 'https://github.com/jxckarcher/ROG',
          defaultBranchRef: { name: 'main' },
        }
      ]), stderr: '', code: 0 };
    }
    if (sshCmd.includes('/branches')) {
      // Branch list for selected repo
      return { stdout: '["main"]', stderr: '', code: 0 };
    }
    if (sshCmd.includes('/contents')) {
      // Detect file fetch vs directory listing by checking for file extension in path
      const m = sshCmd.match(/\/contents(\/[^'"?]*)?\?/);
      const subPath = m?.[1] || '';
      if (subPath && /\.[a-z0-9]+$/i.test(subPath)) {
        // File content — return base64-encoded text
        const fileName = subPath.split('/').pop();
        const text = `# ${fileName}\n\nMock content for ${fileName}\n`;
        return { stdout: JSON.stringify({
          encoding: 'base64',
          content: btoa(text),
          size: text.length,
          html_url: `https://github.com/jxckarcher/ROG/blob/main${subPath}`,
        }), stderr: '', code: 0 };
      }
      // Directory listing
      return { stdout: JSON.stringify([
        { name: 'README.md', path: 'README.md', type: 'file', size: 1234,
          sha: 'aaabbbccc1112233', html_url: 'https://github.com/jxckarcher/ROG/blob/main/README.md' },
        { name: 'glitch-ui', path: 'glitch-ui', type: 'dir', size: 0,
          sha: 'dddeeefff4445566', html_url: 'https://github.com/jxckarcher/ROG/tree/main/glitch-ui' },
      ]), stderr: '', code: 0 };
    }
    if (sshCmd.includes('gh pr list')) {
      return { stdout: JSON.stringify([]), stderr: '', code: 0 };
    }
    if (sshCmd.includes('gh issue list')) {
      return { stdout: JSON.stringify([]), stderr: '', code: 0 };
    }
    if (sshCmd.includes('gh api')) {
      return { stdout: JSON.stringify({}), stderr: '', code: 0 };
    }

    // Default passthrough
    console.debug('[mock/invoke] unmatched cmd:', sshCmd.slice(0, 80));
    return { stdout: `mock: ${sshCmd.slice(0, 60)}\n`, stderr: '', code: 0 };
  }

  console.warn('[mock/invoke] unknown command:', cmd);
  return {};
}
