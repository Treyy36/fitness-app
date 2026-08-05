import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ChatProvider } from './context/ChatContext';
import { BottomNav } from './components/layout/BottomNav';
import { LoginScreen } from './components/layout/LoginScreen';
import { ChatView } from './components/chat/ChatView';
import { PlanListView } from './components/plans/PlanListView';
import { ExerciseListView } from './components/exercises/ExerciseListView';
import { DataDashboard } from './components/data/DataDashboard';
import { MacroHistoryView } from './components/data/MacroHistoryView';
import { SessionHistoryView } from './components/history/SessionHistoryView';
import { SettingsView } from './components/settings/SettingsView';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-slate-950">
        <p className="text-slate-500 text-lg">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <AppProvider userId={user.uid}>
      <ChatProvider>
        <div className="flex flex-col h-dvh bg-slate-950 safe-top">
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<ChatView />} />
              <Route path="/plans" element={<PlanListView />} />
              <Route path="/exercises" element={<ExerciseListView />} />
              <Route path="/data" element={<DataDashboard />} />
              <Route path="/macros" element={<MacroHistoryView />} />
              <Route path="/history" element={<SessionHistoryView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </ChatProvider>
    </AppProvider>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/fitness-app">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
