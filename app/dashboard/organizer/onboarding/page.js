"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase'; 
import { 
  Landmark, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Percent
} from 'lucide-react';

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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed. Please log in again.");

      const res = await fetch('/api/organizer/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          business_name: form.name,
          settlement_bank: form.bank,
          account_number: form.account
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            business_name: form.name,
            bank_code: form.bank,
            account_number: form.account,
            paystack_subaccount_code: data.subaccount_code,
            onboarding_completed: true,
            updated_at: new Date()
          }, { onConflict: 'id' });

        if (profileError) throw new Error("Profile sync failed: " + profileError.message);

        await supabase.auth.refreshSession();
        setStatus({ type: 'success', msg: 'Payout account connected! Redirecting...' });
        
        setTimeout(() => {
          router.push('/dashboard/organizer');
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
    pageWrapper: { minHeight: '100vh', background: '#f8fafc', padding: '60px 20px' },
    container: { maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' },
    leftCol: { padding: '20px' },
    rightCol: { background: '#fff', padding: '40px', borderRadius: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
    title: { fontWeight: 950, fontSize: '42px', letterSpacing: '-0.05em', margin: '0 0 20px 0', color: '#000', lineHeight: '1' },
    explainerBox: { background: '#f1f5f9', padding: '25px', borderRadius: '24px', marginTop: '30px' },
    benefitRow: { display: 'flex', gap: '15px', marginBottom: '20px' },
    benefitIcon: { background: '#000', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    benefitText: { fontSize: '14px', fontWeight: '500', color: '#475569', lineHeight: '1.4' },
    splitBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#000', color: '#fff', padding: '8px 16px', borderRadius: '50px', fontSize: '12px', fontWeight: '800', marginBottom: '20px' },
    input: { width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: '600', outline: 'none', backgroundColor: '#f8fafc', marginBottom: '20px' },
    label: { display: 'block', fontSize: '11px', fontWeight: '800', marginBottom: '8px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    submitBtn: { width: '100%', padding: '20px', borderRadius: '20px', border: 'none', background: '#000', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  };

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
        
        {/* LEFT COLUMN: THE EXPLAINER */}
        <div style={styles.leftCol}>
          <div style={styles.splitBadge}>
            <Percent size={14} /> 95% ORGANIZER SHARE
          </div>
          <h1 style={styles.title}>Secure Your Revenue Stream.</h1>
          <p style={{color: '#64748b', fontSize: '18px', fontWeight: '500'}}>
            Connect your bank account to automate payouts and manage your event finances with precision.
          </p>

          <div style={styles.explainerBox}>
            <h4 style={{margin: '0 0 15px 0', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase'}}>Why the 5% split?</h4>
            
            <div style={styles.benefitRow}>
              <div style={styles.benefitIcon}><ShieldCheck size={18}/></div>
              <div style={styles.benefitText}>
                <strong>Fraud Protection:</strong> Secure Paystack processing for every transaction.
              </div>
            </div>

            <div style={styles.benefitRow}>
              <div style={styles.benefitIcon}><Zap size={18}/></div>
              <div style={styles.benefitText}>
                <strong>Automated Logistics:</strong> Instant QR generation and luxury email delivery for every guest.
              </div>
            </div>

            <div style={styles.benefitRow}>
              <div style={styles.benefitIcon}><TrendingUp size={18}/></div>
              <div style={styles.benefitText}>
                <strong>Organizer Tools:</strong> Full access to real-time analytics, guest lists, and scanning tools.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: THE FORM */}
        <div style={styles.rightCol}>
          <form onSubmit={handleOnboard}>
            <label style={styles.label}>Business / Brand Name</label>
            <input 
              required 
              style={styles.input} 
              placeholder="e.g. Ousted VIP Events" 
              onChange={e => setForm({...form, name: e.target.value})}
            />

            <label style={styles.label}>Settlement Method (Ghana)</label>
            <select 
              style={styles.input} 
              onChange={e => setForm({...form, bank: e.target.value})}
            >
              {ghanaBanks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>

            <label style={styles.label}>Account Number / MoMo Number</label>
            <input 
              required 
              style={styles.input} 
              placeholder="054XXXXXXX" 
              onChange={e => setForm({...form, account: e.target.value})}
            />

            <button 
              type="submit" 
              disabled={loading} 
              style={{...styles.submitBtn, opacity: loading ? 0.7 : 1}}
            >
              {loading ? <Loader2 className="animate-spin" /> : "Verify & Complete Setup"}
              {!loading && <ArrowRight size={20} />}
            </button>

            {status && (
              <div style={{
                marginTop: '20px', padding: '15px', borderRadius: '15px', 
                background: status.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: status.type === 'success' ? '#166534' : '#991b1b',
                fontSize: '13px', fontWeight: '700', border: '1px solid currentColor',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                {status.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                {status.msg}
              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
