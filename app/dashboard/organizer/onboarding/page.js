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
  Percent,
  Phone,
  KeyRound,
  RefreshCw
} from 'lucide-react';

// ─── Steps ────────────────────────────────────────────────────────────────────
// STEP 1: Enter phone number → request OTP
// STEP 2: Enter 6-digit OTP → verify phone
// STEP 3: Enter payout details → complete onboarding

export default function Onboarding() {
  const router = useRouter();

  // Step tracking
  const [step, setStep] = useState(1); // 1 | 2 | 3

  // Step 1 & 2: Phone verification
  const [phone, setPhone]           = useState('');
  const [otp, setOtp]               = useState('');
  const [otpSent, setOtpSent]       = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 3: Payout details
  const [form, setForm]   = useState({ name: '', bank: 'MTN', account: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState(null);

  const ghanaBanks = [
    { name: "MTN Mobile Money",  code: "MTN" },
    { name: "Telecel Cash",      code: "VOD" },
    { name: "AirtelTigo Money",  code: "ATL" },
    { name: "GCB Bank",          code: "044" },
    { name: "Ecobank Ghana",     code: "013" },
    { name: "Zenith Bank",       code: "057" },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Authentication failed. Please log in again.");
    return user;
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const user = await getUser();
      const res  = await fetch('/api/organizer/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-phone', phone, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code.');
      setOtpSent(true);
      setStep(2);
      startResendCooldown();
      setStatus({ type: 'success', msg: data.message });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const user = await getUser();
      const res  = await fetch('/api/organizer/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, otp, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      setStatus({ type: 'success', msg: 'Phone verified! Now set up your payout account.' });
      setStep(3);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const user = await getUser();
      const res  = await fetch('/api/organizer/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-phone', phone, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend.');
      startResendCooldown();
      setStatus({ type: 'success', msg: 'New code sent!' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete onboarding ──────────────────────────────────────────────
  const handleOnboard = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const user = await getUser();
      const res  = await fetch('/api/organizer/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          business_name: form.name,
          settlement_bank: form.bank,
          account_number: form.account,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create payout account.");

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        business_name: form.name,
        bank_code: form.bank,
        account_number: form.account,
        paystack_subaccount_code: data.subaccount_code,
        onboarding_completed: true,
        updated_at: new Date(),
      }, { onConflict: 'id' });

      if (profileError) throw new Error("Profile sync failed: " + profileError.message);

      await supabase.auth.refreshSession();
      setStatus({ type: 'success', msg: 'Payout account connected! Redirecting...' });
      setTimeout(() => router.push('/dashboard/organizer'), 2000);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: 'Phone Number' },
    { n: 2, label: 'Verify Code'  },
    { n: 3, label: 'Payout Setup' },
  ];

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
          margin-bottom: 20px; transition: 0.2s; box-sizing: border-box;
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
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Step indicator */
        .step-indicator {
          display: flex; align-items: center; gap: 0; margin-bottom: 32px;
        }
        .step-dot {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          flex: 1;
        }
        .step-circle {
          width: 36px; height: 36px; border-radius: 50%; border: 2px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 900; color: #94a3b8; background: #f8fafc;
          transition: all 0.3s;
        }
        .step-circle.active  { background: #000; color: #fff; border-color: #000; }
        .step-circle.done    { background: #22c55e; color: #fff; border-color: #22c55e; }
        .step-label {
          font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;
          letter-spacing: 0.04em; white-space: nowrap;
        }
        .step-label.active { color: #000; }
        .step-connector {
          flex: 1; height: 2px; background: #e2e8f0; margin-bottom: 22px; transition: 0.3s;
        }
        .step-connector.done { background: #22c55e; }

        /* OTP input group */
        .otp-input {
          width: 100%; padding: 20px; border-radius: 16px; border: 2px solid #f1f5f9;
          font-size: 28px; font-weight: 900; text-align: center; letter-spacing: 0.3em;
          outline: none; background: #f8fafc; margin-bottom: 20px; transition: 0.2s;
          box-sizing: border-box;
        }
        .otp-input:focus { border-color: #000; background: #fff; }

        .resend-row {
          display: flex; align-items: center; justify-content: center; 
          gap: 8px; margin-bottom: 24px;
        }
        .resend-btn {
          background: none; border: none; cursor: pointer; font-size: 13px;
          font-weight: 700; color: #000; display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 10px; transition: 0.2s;
        }
        .resend-btn:hover { background: #f1f5f9; }
        .resend-btn:disabled { color: #94a3b8; cursor: not-allowed; }

        .phone-hint {
          font-size: 12px; color: #64748b; font-weight: 600;
          text-align: center; margin-bottom: 20px; padding: 12px;
          background: #f8fafc; border-radius: 12px;
        }

        /* MOBILE OPTIMIZATION */
        @media (max-width: 900px) {
          .onboarding-container { grid-template-columns: 1fr; gap: 30px; }
          .onboarding-title { font-size: 32px; }
          .right-col { padding: 24px; }
          .page-wrapper { padding: 20px 15px; }
        }
      `}</style>

      <div className="onboarding-container">
        
        {/* LEFT COLUMN */}
        <div className="left-col">
          <div className="split-badge">
            <Percent size={14} /> 95% ORGANIZER SHARE
          </div>
          <h1 className="onboarding-title">Secure Your Revenue Stream.</h1>
          <p style={{color: '#64748b', fontSize: '16px', fontWeight: '500', lineHeight: '1.5'}}>
            Connect your bank account or Mobile Money to automate payouts and manage your finances with precision.
          </p>

          <div className="explainer-box">
            <h4 style={{margin: '0 0 15px 0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#000'}}>
              Why phone verification?
            </h4>

            <div className="benefit-row">
              <div className="benefit-icon"><ShieldCheck size={18}/></div>
              <div className="benefit-text">
                <strong>Payout Security:</strong> Verifying your number ensures only you can change where funds are sent.
              </div>
            </div>

            <div className="benefit-row">
              <div className="benefit-icon"><Phone size={18}/></div>
              <div className="benefit-text">
                <strong>OTP Gate:</strong> Every future payout change requires a fresh one-time code sent to this number.
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

        {/* RIGHT COLUMN */}
        <div className="right-col">

          {/* Step Indicator */}
          <div className="step-indicator">
            {steps.map((s, i) => (
              <>
                <div className="step-dot" key={s.n}>
                  <div className={`step-circle ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
                    {step > s.n ? <CheckCircle size={16}/> : s.n}
                  </div>
                  <span className={`step-label ${step === s.n ? 'active' : ''}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`step-connector ${step > s.n ? 'done' : ''}`} key={`c${i}`} />
                )}
              </>
            ))}
          </div>

          {/* ── STEP 1: Phone Input ─────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <div style={{marginBottom: 24}}>
                <h2 style={{fontSize: 20, fontWeight: 900, margin: '0 0 6px', color: '#0f172a'}}>
                  Verify Your Phone
                </h2>
                <p style={{margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500}}>
                  We'll send a 6-digit code to confirm your identity.
                </p>
              </div>

              <label className="label-text">
                <Phone size={11} style={{display:'inline', marginRight:5}}/>
                Ghanaian Phone Number
              </label>
              <input
                required
                type="tel"
                className="input-field"
                placeholder="054 000 0000 or +233..."
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />

              <div className="phone-hint">
                📱 Enter the phone number where you want to receive payout security alerts
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>

              {status && <StatusBox status={status} />}
            </form>
          )}

          {/* ── STEP 2: OTP Verification ────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{marginBottom: 24}}>
                <h2 style={{fontSize: 20, fontWeight: 900, margin: '0 0 6px', color: '#0f172a'}}>
                  Enter Your Code
                </h2>
                <p style={{margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500}}>
                  We sent a 6-digit code to <strong>{phone}</strong>
                </p>
              </div>

              <label className="label-text">
                <KeyRound size={11} style={{display:'inline', marginRight:5}}/>
                Verification Code
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                className="otp-input"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))}
                autoFocus
              />

              <button type="submit" disabled={loading || otp.length < 6} className="submit-btn">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                {loading ? 'Verifying...' : 'Confirm Code'}
              </button>

              <div className="resend-row" style={{marginTop: 16}}>
                <span style={{fontSize: 12, color: '#94a3b8', fontWeight: 600}}>Didn't receive it?</span>
                <button
                  type="button"
                  className="resend-btn"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResend}
                >
                  <RefreshCw size={13}/>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setStatus(null); }}
                style={{
                  width: '100%', background: 'none', border: '2px solid #f1f5f9',
                  borderRadius: 16, padding: '12px', fontSize: 13, fontWeight: 700,
                  color: '#64748b', cursor: 'pointer', marginTop: 8,
                }}
              >
                ← Change Phone Number
              </button>

              {status && <StatusBox status={status} />}
            </form>
          )}

          {/* ── STEP 3: Payout Setup ────────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleOnboard}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
                background: '#f0fdf4', padding: '14px 18px', borderRadius: 16,
                border: '1px solid #bbf7d0',
              }}>
                <CheckCircle size={18} color="#16a34a"/>
                <div>
                  <div style={{fontSize: 13, fontWeight: 800, color: '#166534'}}>Phone Verified</div>
                  <div style={{fontSize: 12, color: '#15803d'}}>{phone}</div>
                </div>
              </div>

              <h2 style={{fontSize: 20, fontWeight: 900, margin: '0 0 20px', color: '#0f172a'}}>
                Payout Details
              </h2>

              <label className="label-text">Business / Brand Name</label>
              <input
                required
                className="input-field"
                placeholder="e.g. Ousted VIP Events"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />

              <label className="label-text">Settlement Method (Ghana)</label>
              <select
                className="input-field"
                value={form.bank}
                onChange={e => setForm({...form, bank: e.target.value})}
              >
                {ghanaBanks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>

              <label className="label-text">Account / MoMo Number</label>
              <input
                required
                className="input-field"
                placeholder="054XXXXXXX"
                value={form.account}
                onChange={e => setForm({...form, account: e.target.value})}
              />

              <button type="submit" disabled={loading} className="submit-btn" style={{opacity: loading ? 0.7 : 1}}>
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                {loading ? 'Setting Up...' : 'Complete Setup'}
              </button>

              {status && <StatusBox status={status} />}
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

function StatusBox({ status }) {
  return (
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
  );
}
