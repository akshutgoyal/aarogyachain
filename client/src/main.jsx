import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/style.css';

function App() {
  return (
    <main className="starter-card">
      <h1>aarogyachain</h1>
      <p className="tagline">patient-owned health records, verifiable by anyone, instantly</p>
      <div className="guidelines-box">
        <strong>Team:</strong> Nirvans<br />
        <strong>Problem Statement:</strong> Medical records sit fragmented in paper files and private hospital databases — easily tampered with, lost in transfers, and impossible to verify without trusting the holder. Patients have no ownership of their own health data.
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
