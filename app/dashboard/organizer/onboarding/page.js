"use client";

import { useState } from 'react';
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

  return (
    <div className="page-wrapper">
      <style>{`
        .page-wrapper { 
          min-height: 100vh; 
          background: #f8fafc; 
          padding: 40px 20px;
          font-family: 'Inter', sans-serif;
        }
        .onboarding-container { 
          max-width: 1000px; 
          margin: 0 auto; 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 40px; 
          align-items: start; 
        }
        .left-col { padding: 10px; }
        .right-col { 
          background: #fff; 
          padding: 40px; 
          borderRadius: 40px; 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.08); 
          border: 1px solid #e2e8f0; 
          border-radius: 32px;
        }
        .onboarding-title { 
          font-weight: 950; 
          font-size: 42px; 
          letter-spacing: -0.05em; 
          margin: 0 0 20px 0; 
          color: #000; 
          line-height: 1.1; 
        }
        .explainer-box { 
          background: #f1f5f9; 
          padding: 24px; 
          border-radius: 24px; 
          margin-top: 30px; 
        }
        .benefit-row { display: flex; gap: 15px; margin-bottom: 20px; }
        .benefit-icon { 
          background: #000; color: #fff; width: 36px; height: 36px; 
          border-radius: 10px; display: flex; align-items: center; 
          justify-content: center; flex-shrink: 0; 
        }
        .benefit-text { font-size: 14px; fontWeight: 500; color: #475569; line-height: 1.4; }
        .split-badge { 
          display: inline-flex; align-items: center; gap: 8px; background: #000; 
          color: #fff; padding: 8px 16px; border-radius: 50px; font-size: 11px; 
          font-weight: 800; margin-bottom: 20px; 
        }
        .input-field { 
          width: 100%; padding: 16px; border-radius: 16px; border: 2px solid #f1f5f9; 
          font-size: 16px; font-weight: 600; outline: none; background-color: #f8fafc; 
          margin-bottom: 20px; transition: 0.2s;
        }
        .input-field:focus { border-color: #000; background: #fff; }
        .label-text { 
          display: block; font-size: 11px; font-weight: 800; margin-bottom: 8px; 
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; 
        }
        .submit-btn { 
          width: 100%; padding: 20px; border-radius: 20px; border: none; 
          background: #000; color: #fff; font-weight: 900; font-size: 16px; 
          cursor: pointer; display: flex; align-items: center; justify-content: center; 
          gap: 10px; transition: 0.3s;
        }
        .submit-btn:active { transform: scale(0.98); }

        /* MOBILE OPTIMIZATION */
        @media (max-width: 900px) {
          .onboarding-container { grid-template-columns: 1fr; gap: 30px; }
          .onboarding-title { font-size: 32px; }
          .right-col { padding: 24px; }
          .page-wrapper { padding: 20px 15px; }
        }
      `}</style>

      <div className="onboarding-container">
        
        {/* LEFT COLUMN: THE EXPLAINER */}
        <div className="left-col">
          <div className="split-badge">
            <Percent size={14} /> 95% ORGANIZER SHARE
          </div>
          <h1 className="onboarding-title">Secure Your Revenue Stream.</h1>
          <p style={{color: '#64748b', fontSize: '16px', fontWeight: '500', lineHeight: '1.5'}}>
            Connect your bank account or Mobile Money to automate payouts and manage your finances with luxury precision.
          </p>

          <div className="explainer-box">
            <h4 style={{margin: '0 0 15px 0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#000'}}>Why the 5% split?</h4>
            
            <div className="benefit-row">
              <div className="benefit-icon"><ShieldCheck size={18}/></div>
              <div className="benefit-text">
                <strong>Fraud Protection:</strong> Military-grade Paystack security for every cedi earned.
              </div>
            </div>

            <div className="benefit-row">
              <div className="benefit-icon"><Zap size={18}/></div>
              <div className="benefit-text">
                <strong>Instant Logistics:</strong> Auto-generated QR codes and premium email delivery for guests.
              </div>
            </div>

            <div className="benefit-row">
              <div className="benefit-icon"><TrendingUp size={18}/></div>
              <div className="benefit-text">
                <strong>Real-time Insights:</strong> Full access to scanning tools and live revenue tracking.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: THE FORM */}
        <div className="right-col">
          <form onSubmit={handleOnboard}>
            <label className="label-text">Business / Brand Name</label>
            <input 
              required 
              className="input-field" 
              placeholder="e.g. Ousted VIP Events" 
              onChange={e => setForm({...form, name: e.target.value})}
            />

            <label className="label-text">Settlement Method (Ghana)</label>
            <select 
              className="input-field" 
              onChange={e => setForm({...form, bank: e.target.value})}
            >
              {ghanaBanks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>

            <label className="label-text">Account / MoMo Number</label>
            <input 
              required 
              className="input-field" 
              placeholder="054XXXXXXX" 
              onChange={e => setForm({...form, account: e.target.value})}
            />

            <button 
              type="submit" 
              disabled={loading} 
              className="submit-btn"
              style={{ opacity: loading ? 0.7 : 1 }}
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
