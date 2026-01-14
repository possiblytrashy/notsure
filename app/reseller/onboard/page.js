// FILE: app/reseller/onboard/page.js
// UPDATED - Reseller onboarding with Mobile Money & Bank options

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, DollarSign, Building, CreditCard, CheckCircle, Smartphone } from 'lucide-react';

export default function ResellerOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money'); // 'mobile_money' or 'bank'

  // Form Data
  const [formData, setFormData] = useState({
    business_name: '',
    phone: '',
    // Mobile Money
    mobile_money_provider: '',
    mobile_money_number: '',
    // Bank Account
    bank_code: '',
    account_number: '',
    account_name: ''
  });

  // Ghana Mobile Money Providers
  const mobileMoneyProviders = [
    { code: 'mtn', name: 'MTN Mobile Money' },
    { code: 'vod', name: 'Vodafone Cash' },
    { code: 'tgo', name: 'AirtelTigo Money' }
  ];

  // Ghana Banks
  const banks = [
    { code: '280100', name: 'Ecobank Ghana' },
    { code: '040101', name: 'GCB Bank Limited' },
    { code: '030100', name: 'Stanbic Bank' },
    { code: '020100', name: 'Standard Chartered' },
    { code: '050100', name: 'ADB Bank' },
    { code: '080100', name: 'Barclays Bank' },
    { code: '070101', name: 'Fidelity Bank' },
    { code: '130100', name: 'CalBank' },
    { code: '340100', name: 'Zenith Bank' },
    { code: '300361', name: 'Access Bank' }
  ];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Pre-fill phone from user metadata if available
      if (user.user_metadata?.phone) {
        setFormData(prev => ({ ...prev, phone: user.user_metadata.phone }));
      }

      // Check if already a reseller
      const { data: existing } = await supabase
        .from('resellers')
        .select('id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.is_active) {
        router.push('/reseller/dashboard');
        return;
      }

      setLoading(false);
    };
    checkUser();
  }, [router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please log in to continue');
        setSubmitting(false);
        return;
      }

      // Prepare payload based on payment method
      const payload = {
        business_name: formData.business_name,
        phone: formData.phone,
        payment_method: paymentMethod
      };

      if (paymentMethod === 'mobile_money') {
        payload.mobile_money_provider = formData.mobile_money_provider;
        payload.mobile_money_number = formData.mobile_money_number;
      } else {
        payload.settlement_bank = formData.bank_code;
        payload.account_number = formData.account_number;
      }

      // Call API with authorization header
      const res = await fetch('/api/reseller/onboard', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Error: ${data.error || 'Onboarding failed'}`);
        setSubmitting(false);
        return;
      }

      // Success! Go to step 2
      setStep(2);

    } catch (err) {
      console.error('Onboarding error:', err);
      alert('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="animate-spin" size={40} color="#CDa434" />
        <p style={styles.loadingText}>LOADING...</p>
      </div>
    );
  }

  // Step 2: Success Screen
  if (step === 2) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>
            <CheckCircle size={60} color="#10b981" />
          </div>
          <h1 style={styles.successTitle}>Welcome to the Reseller Program! 🎉</h1>
          <p style={styles.successText}>
            Your account has been activated. You can now start promoting events and earning commissions.
          </p>
          <div style={styles.benefitsGrid}>
            <div style={styles.benefit}>
              <DollarSign size={24} color="#CDa434" />
              <p style={styles.benefitText}>10% commission on every sale</p>
            </div>
            <div style={styles.benefit}>
              <Building size={24} color="#CDa434" />
              <p style={styles.benefitText}>
                {paymentMethod === 'mobile_money' ? 'Mobile Money payouts' : 'Bank transfer payouts'}
              </p>
            </div>
            <div style={styles.benefit}>
              <CreditCard size={24} color="#CDa434" />
              <p style={styles.benefitText}>Real-time earnings tracking</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/reseller/dashboard')}
            style={styles.ctaBtn}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Onboarding Form
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Become a Reseller</h1>
        <p style={styles.subtitle}>
          Earn 10% commission on every ticket sale. Choose your preferred payment method.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Basic Info */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Business Name *</label>
            <input
              type="text"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              placeholder="Your Name or Business Name"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0244123456"
              style={styles.input}
              required
            />
          </div>

          {/* Payment Method Selection */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Payment Method *</label>
            <div style={styles.paymentMethodGrid}>
              <div 
                onClick={() => setPaymentMethod('mobile_money')}
                style={styles.paymentMethodCard(paymentMethod === 'mobile_money')}
              >
                <Smartphone size={24} color={paymentMethod === 'mobile_money' ? '#CDa434' : '#666'} />
                <p style={styles.paymentMethodText}>Mobile Money</p>
                <p style={styles.paymentMethodDesc}>MTN, Vodafone, AirtelTigo</p>
              </div>

              <div 
                onClick={() => setPaymentMethod('bank')}
                style={styles.paymentMethodCard(paymentMethod === 'bank')}
              >
                <Building size={24} color={paymentMethod === 'bank' ? '#CDa434' : '#666'} />
                <p style={styles.paymentMethodText}>Bank Account</p>
                <p style={styles.paymentMethodDesc}>All Ghana banks</p>
              </div>
            </div>
          </div>

          {/* Mobile Money Fields */}
          {paymentMethod === 'mobile_money' && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Mobile Money Provider *</label>
                <select
                  name="mobile_money_provider"
                  value={formData.mobile_money_provider}
                  onChange={handleChange}
                  style={styles.input}
                  required
                >
                  <option value="">Select provider</option>
                  {mobileMoneyProviders.map(provider => (
                    <option key={provider.code} value={provider.code}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Mobile Money Number *</label>
                <input
                  type="tel"
                  name="mobile_money_number"
                  value={formData.mobile_money_number}
                  onChange={handleChange}
                  placeholder="0244123456"
                  style={styles.input}
                  maxLength={10}
                  required
                />
                <p style={styles.helpText}>
                  Enter the number registered with your mobile money account
                </p>
              </div>
            </>
          )}

          {/* Bank Account Fields */}
          {paymentMethod === 'bank' && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Bank *</label>
                <select
                  name="bank_code"
                  value={formData.bank_code}
                  onChange={handleChange}
                  style={styles.input}
                  required
                >
                  <option value="">Select your bank</option>
                  {banks.map(bank => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Account Number *</label>
                <input
                  type="text"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  placeholder="1234567890"
                  style={styles.input}
                  maxLength={15}
                  required
                />
              </div>
            </>
          )}

          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              💰 Your commissions will be automatically paid to this {paymentMethod === 'mobile_money' ? 'mobile money account' : 'bank account'} within 24 hours of each sale.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={styles.submitBtn(submitting)}
          >
            {submitting ? (
              <><Loader2 className="animate-spin" size={18} /> Creating Account...</>
            ) : (
              'Activate Reseller Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#fff',
    padding: '40px 20px',
    fontFamily: 'sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingScreen: {
    height: '100vh',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '10px',
    letterSpacing: '3px',
    color: '#666',
    fontWeight: 'bold'
  },
  card: {
    maxWidth: '500px',
    width: '100%',
    background: '#111',
    border: '1px solid #222',
    borderRadius: '24px',
    padding: '40px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '900',
    margin: '0 0 10px',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '40px',
    lineHeight: '1.6'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#999'
  },
  input: {
    background: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '15px',
    color: '#fff',
    outline: 'none',
    fontFamily: 'inherit'
  },
  helpText: {
    fontSize: '12px',
    color: '#666',
    margin: '4px 0 0',
    fontStyle: 'italic'
  },
  paymentMethodGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  paymentMethodCard: (active) => ({
    background: active ? '#1a1a1a' : '#0a0a0a',
    border: active ? '2px solid #CDa434' : '1px solid #222',
    borderRadius: '16px',
    padding: '20px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s'
  }),
  paymentMethodText: {
    fontSize: '14px',
    fontWeight: '700',
    margin: '8px 0 4px',
    color: '#fff'
  },
  paymentMethodDesc: {
    fontSize: '11px',
    color: '#666',
    margin: 0
  },
  infoBox: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '10px'
  },
  infoText: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
    lineHeight: '1.5'
  },
  submitBtn: (disabled) => ({
    background: disabled ? '#333' : '#CDa434',
    color: disabled ? '#666' : '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '800',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '10px'
  }),
  successCard: {
    maxWidth: '600px',
    width: '100%',
    background: '#111',
    border: '1px solid #222',
    borderRadius: '24px',
    padding: '60px 40px',
    textAlign: 'center'
  },
  successIcon: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: '#10b98120',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 30px'
  },
  successTitle: {
    fontSize: '28px',
    fontWeight: '900',
    margin: '0 0 16px'
  },
  successText: {
    fontSize: '16px',
    color: '#999',
    marginBottom: '40px',
    lineHeight: '1.6'
  },
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  benefit: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '20px',
    background: '#0a0a0a',
    borderRadius: '16px',
    border: '1px solid #222'
  },
  benefitText: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
    textAlign: 'center'
  },
  ctaBtn: {
    background: '#CDa434',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 40px',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer'
  }
};
