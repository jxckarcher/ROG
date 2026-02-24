import { useStore } from './core/store';
import Sidebar from './ui/components/Sidebar';
import StatusBar from './ui/components/StatusBar';
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
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="app-content">
          <Panel />
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
