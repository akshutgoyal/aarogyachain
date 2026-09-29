import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChainProvider } from './chain';
import { ToastProvider } from './components/Toast';
import AppShell from './components/shell/AppShell';
import RoleGate from './components/shell/RoleGate';

import Home from './pages/Home';
import Access from './pages/Access';
import Admin from './pages/Admin';
import Doctor from './pages/Doctor';
import Patient from './pages/Patient';
import Auditor from './pages/Auditor';
import Verify from './pages/Verify';
import Ai from './pages/Ai';
import Profile from './pages/Profile';
import PublicChrome from './components/shell/PublicChrome';

import AdminDashboard from './pages/dashboards/AdminDashboard';
import DoctorDashboard from './pages/dashboards/DoctorDashboard';
import AuditorDashboard from './pages/dashboards/AuditorDashboard';
import PatientDashboard from './pages/dashboards/PatientDashboard';

/**
 * Home renders its own full-page design (hero, footer). /access is its own gate
 * screen. Verify and AI are public utilities that share a slim chrome with the
 * dashboard door in the top right.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/access" element={<Access />} />
      <Route path="/verify" element={<PublicChrome><Verify /></PublicChrome>} />
      <Route path="/ai" element={<PublicChrome><Ai /></PublicChrome>} />

      {/* Dashboards — the landing surface for each role. */}
      <Route
        path="/admin"
        element={
          <RoleGate role="admin">
            <AppShell><AdminDashboard /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/doctor"
        element={
          <RoleGate role="doctor">
            <AppShell><DoctorDashboard /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/auditor"
        element={
          <RoleGate role="auditor">
            <AppShell><AuditorDashboard /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/patient"
        element={
          <RoleGate role="patient">
            <AppShell><PatientDashboard /></AppShell>
          </RoleGate>
        }
      />

      {/* Operational consoles — where the transactions actually happen. Same
          gates, because a dashboard link is not an authorisation. */}
      <Route
        path="/admin/console"
        element={
          <RoleGate role="admin">
            <AppShell><Admin /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/doctor/console"
        element={
          <RoleGate role="doctor">
            <AppShell><Doctor /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/auditor/console"
        element={
          <RoleGate role="auditor">
            <AppShell><Auditor /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/patient/console"
        element={
          <RoleGate role="patient">
            <AppShell><Patient /></AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <RoleGate role="patient">
            <AppShell><Profile /></AppShell>
          </RoleGate>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <ChainProvider>
          <AppRoutes />
        </ChainProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
