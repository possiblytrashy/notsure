"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function UnifiedAuth() {
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState('user'); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

const handleAuth = async () => {
  if (password.length < 6) {
    alert("Password must be at least 6 characters long.");
    return;
  }

  setLoading(true);
  try {
    const { data, error } = isSignup 
      ? await supabase.auth.signUp({ 
          email, 
          password, 
          options: { 
            data: { role: role },
            emailRedirectTo: `${window.location.origin}/auth/callback` 
          } 
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // 422 often means the user already exists or password fails validation
      if (error.status === 422) {
        alert("Signup failed: Check if your email is valid or if you already have an account.");
      } else {
        alert("Error: " + error.message);
      }
      console.error("Auth Error details:", error);
    } else {
      if (isSignup && data.user && data.session === null) {
        alert("Verification email sent! Please check your inbox (and spam) to activate your account.");
      } else {
        // Redirect based on metadata role
        const userRole = data.user?.user_metadata?.role || 'user';
        window.location.href = userRole === 'admin' ? '/admin/dashboard' : userRole === 'organizer' ? '/dashboard/organizer' : '/dashboard/user';
      }
    }
  } catch (err) {
    alert("A system error occurred. Please try again later.");
  } finally {
    setLoading(false);
  }
};
  
  return (
    <div style={{ maxWidth: '450px', margin: '40px auto', padding: '40px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderRadius: '40px', border: '1px solid white' }}>
      <h2 style={{ fontWeight: 900, fontSize: '32px', textAlign: 'center' }}>{isSignup ? 'Join Ousted' : 'Welcome Back'}</h2>
      
      {/* ROLE SELECTOR */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '15px', padding: '5px', margin: '25px 0' }}>
        {['user', 'organizer'].map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer',
            background: role === r ? 'white' : 'transparent', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase'
          }}>{r}</button>
        ))}
      </div>

      <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '15px' }} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '20px' }} />
      
      <button onClick={handleAuth} disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: '15px', border: 'none', background: '#000', color: 'white', fontWeight: 900, cursor: 'pointer' }}>
        {loading ? 'Processing...' : isSignup ? 'CREATE ACCOUNT' : 'SIGN IN'}
      </button>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
        {isSignup ? 'Already have an account?' : "Don't have an account?"} 
        <span onClick={() => setIsSignup(!isSignup)} style={{ color: '#0ea5e9', fontWeight: 800, cursor: 'pointer', marginLeft: '5px' }}>
          {isSignup ? 'Login' : 'Create one'}
        </span>
      </p>
    </div>
  );
}
