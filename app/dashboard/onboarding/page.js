"use client";
import { useState } from 'react';
import { Landmark, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', bank: 'MTN', account: '' });
  const [status, setStatus] = useState(null);

  const ghanaBanks = [
    { name: "MTN Mobile Money", code: "MTN" },
    { name: "Telecel Cash", code: "VOD" },
    { name: "AirtelTigo Money", code: "ATL" },
    { name: "GCB Bank", code: "044" },
    { name: "Ecobank Ghana", code: "013" },
    { name: "Zenith Bank", code: "057" },
  ];

  const handleOnboard = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/organizer/onboard', {
        method: 'POST',
        body: JSON.stringify({
          business_name: form.name,
          settlement_bank: form.bank,
          account_number: form.account
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', msg: 'Payout account connected!' });
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ fontWeight: 900, fontSize: '32px' }}>Payout Settings</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Connect your bank or Mobile Money to receive 95% of your ticket sales instantly.
      </p>

      <form onSubmit={handleOnboard} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Business or Event Name</label>
          <input 
            required
            style={styles.input}
            placeholder="e.g. Afrochella Events"
            onChange={e => setForm({...form, name: e.target.value})}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Settlement Method</label>
          <select 
            style={styles.input}
            onChange={e => setForm({...form, bank: e.target.value})}
          >
            {ghanaBanks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Account Number / MoMo Number</label>
          <input 
            required
            style={styles.input}
            placeholder="054XXXXXXX"
            onChange={e => setForm({...form, account: e.target.value})}
          />
        </div>

        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading ? 'Processing...' : 'Link Payout Account'}
        </button>
      </form>

      {status && (
        <div style={{...styles.alert, background: status.type === 'success' ? '#dcfce7' : '#fee2e2'}}>
          {status.type === 'success' ? <CheckCircle color="#16a34a" /> : <AlertCircle color="#dc2626" />}
          <span style={{color: status.type === 'success' ? '#16a34a' : '#dc2626'}}>{status.msg}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: '500px', margin: '60px auto', padding: '0 20px' },
  form: { background: '#fff', padding: '30px', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' },
  inputGroup: { marginBottom: '20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '8px', color: '#444' },
  input: { width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '15px', outline: 'none' },
  submitBtn: { width: '100%', padding: '18px', borderRadius: '15px', border: 'none', background: '#000', color: '#fff', fontWeight: 900, cursor: 'pointer', marginTop: '10px' },
  alert: { marginTop: '20px', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }
};
