"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase'; // Ensure this path is correct for your project
import { Landmark, Smartphone, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const router = useRouter();
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
    setStatus(null);
    
    try {
      // 1. Get the current user session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Authentication failed. Please log in again.");
      }

      // 2. Call the onboarding API with the userId
      const res = await fetch('/api/organizer/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id, // Critical for the updated API logic
          business_name: form.name,
          settlement_bank: form.bank,
          account_number: form.account
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus({ type: 'success', msg: 'Payout account connected successfully!' });
        
        // 3. Redirect to Create Event page after a short delay
        setTimeout(() => {
          router.push('/dashboard/events/create');
        }, 2000);
      } else {
        throw new Error(data.error || "Failed to create payout account.");
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { maxWidth: '500px', margin: '60px auto', padding: '0 20px', fontFamily: '"Inter", sans-serif' },
    form: { background: '#fff', padding: '40px', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    header: { marginBottom: '32px' },
    title: { fontWeight: 950, fontSize: '36px', letterSpacing: '-0.04em', margin: '0 0 12px 0', color: '#000' },
    subtitle: { color: '#64748b', fontSize: '16px', lineHeight: '1.5', fontWeight: '500' },
    inputGroup: { marginBottom: '24px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '800', marginBottom: '8px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: '600', outline: 'none', backgroundColor: '#f8fafc', transition: 'border-color 0.2s' },
    submitBtn: { width: '100%', padding: '20px', borderRadius: '20px', border: 'none', background: '#000', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'transform 0.2s' },
    alert: { marginTop: '24px', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '700', fontSize: '14px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Payout Settings</h1>
        <p style={styles.subtitle}>
          Connect your bank or Mobile Money to receive 95% of your ticket sales instantly.
        </p>
      </div>

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
          <label style={styles.label}>Account / MoMo Number</label>
          <input 
            required
            style={styles.input}
            placeholder="054XXXXXXX"
            onChange={e => setForm({...form, account: e.target.value})}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{
            ...styles.submitBtn, 
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>
              Link Payout Account
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>

      {status && (
        <div style={{
          ...styles.alert, 
          background: status.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${status.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {status.type === 'success' ? <CheckCircle color="#16a34a" size={20} /> : <AlertCircle color="#dc2626" size={20} />}
          <span style={{color: status.type === 'success' ? '#166534' : '#991b1b'}}>{status.msg}</span>
        </div>
      )}
    </div>
  );
}
