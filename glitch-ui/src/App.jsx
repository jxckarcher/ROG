import { useStore } from './core/store';
import Sidebar from './ui/components/Sidebar';
import TopBar from './ui/components/TopBar';
import ConnectionPanel from './modules/connection/ConnectionPanel';
import ChatPanel from './modules/chat/ChatPanel';
import SchedulerPanel from './modules/scheduler/SchedulerPanel';
import BudgetPanel from './modules/budget/BudgetPanel';
import MemoryPanel from './modules/memory/MemoryPanel';
import TerminalPanel from './modules/terminal/TerminalPanel';
import './App.css';

const PANELS = {
  connection: ConnectionPanel,
  chat:       ChatPanel,
  scheduler:  SchedulerPanel,
  budget:     BudgetPanel,
  memory:     MemoryPanel,
  terminal:   TerminalPanel,
};

export default function App() {
  const { activeModule } = useStore();
  const Panel = PANELS[activeModule] || ChatPanel;

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-panel">
          <Panel />
        </div>
      </div>
    </div>
  );
}
