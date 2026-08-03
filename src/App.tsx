import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ChatProvider } from './context/ChatContext';
import { BottomNav } from './components/layout/BottomNav';
import { ChatView } from './components/chat/ChatView';
import { PlanListView } from './components/plans/PlanListView';
import { SessionHistoryView } from './components/history/SessionHistoryView';
import { SettingsView } from './components/settings/SettingsView';

export function App() {
  return (
    <BrowserRouter basename="/fitness-app">
      <AppProvider>
        <ChatProvider>
          <div className="flex flex-col h-dvh bg-slate-950 safe-top">
            <main className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<ChatView />} />
                <Route path="/plans" element={<PlanListView />} />
                <Route path="/history" element={<SessionHistoryView />} />
                <Route path="/settings" element={<SettingsView />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
        </ChatProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
