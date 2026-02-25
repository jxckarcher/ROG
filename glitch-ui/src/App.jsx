import { useEffect } from 'react';
import { useStore } from './core/store';
import Sidebar from './ui/components/Sidebar';
import TopBar from './ui/components/TopBar';
import ConnectionPanel from './modules/connection/ConnectionPanel';
import ChatPanel from './modules/chat/ChatPanel';
import SchedulerPanel from './modules/scheduler/SchedulerPanel';
import BudgetPanel from './modules/budget/BudgetPanel';
import MemoryPanel from './modules/memory/MemoryPanel';
import TerminalPanel from './modules/terminal/TerminalPanel';
import AgentsPanel from './modules/agents/AgentsPanel';
import SettingsPanel from './modules/settings/SettingsPanel';
import GitHubPanel from './modules/github/GitHubPanel';
import WorkspacesPanel from './modules/workspaces/WorkspacesPanel';
import Lockscreen from './modules/lockscreen/Lockscreen';
import './App.css';

const PANELS = {
  connection: ConnectionPanel,
  chat:       ChatPanel,
  agents:     AgentsPanel,
  scheduler:  SchedulerPanel,
  budget:     BudgetPanel,
  memory:     MemoryPanel,
  terminal:   TerminalPanel,
  settings:   SettingsPanel,
  github:     GitHubPanel,
  workspaces: WorkspacesPanel,
};

export default function App() {
  const { activeModule, locked, initTheme } = useStore();
  const Panel = PANELS[activeModule] || ChatPanel;

  useEffect(() => { initTheme(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-panel">
          <Panel />
        </div>
      </div>
      {locked && <Lockscreen />}
    </div>
  );
}
