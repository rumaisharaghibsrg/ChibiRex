import React, { useState } from 'react';
import LandingPage    from './components/LandingPage';
import AuthPage       from './components/AuthPage';
import OnboardingPage from './components/OnboardingPage';
import DashboardApp   from './components/DashboardApp';

/**
 * App Router — 4-tahap alur pengguna:
 *   dashboard (default demo) | landing | auth | onboarding
 */
export default function App() {
  // 'landing' | 'login' | 'register' | 'onboarding' | 'dashboard'
  const [page, setPage]   = useState('dashboard');
  const [user, setUser]   = useState({
    name: 'Budi Santoso',
    business: 'Retail Nusantara Flagship'
  });

  // Landing → Auth
  const goLogin    = () => setPage('login');
  const goRegister = () => setPage('register');
  const goDashboard = () => setPage('dashboard');

  // Auth → Onboarding (register) or Dashboard (login)
  const handleAuthSuccess = (userData) => {
    setUser(userData);
    if (page === 'register') {
      setPage('onboarding');
    } else {
      setPage('dashboard');
    }
  };

  // Onboarding → Dashboard
  const handleOnboardingComplete = (data) => {
    setUser(u => ({ ...u, ...data }));
    setPage('dashboard');
  };

  // Dashboard → Landing (logout)
  const handleLogout = () => {
    setPage('landing');
  };

  return (
    <>
      {page === 'landing' && (
        <LandingPage
          onLogin={goLogin}
          onRegister={goRegister}
          onDemo={goDashboard}
        />
      )}

      {(page === 'login' || page === 'register') && (
        <AuthPage
          mode={page}
          onBack={() => setPage('landing')}
          onSuccess={handleAuthSuccess}
        />
      )}

      {page === 'onboarding' && (
        <OnboardingPage
          user={user}
          onComplete={handleOnboardingComplete}
        />
      )}

      {page === 'dashboard' && (
        <DashboardApp
          user={user}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
