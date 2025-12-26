"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, AlertCircle, 
  CheckCircle2, Loader2, ChevronLeft, Info,
  Layers, CreditCard, Sparkles, Upload, CloudLightning,
  Eye, Settings, HelpCircle, ShieldCheck, Zap,
  FileText, Tag, Globe, Lock, User, ChevronUp, ChevronDown
} from 'lucide-react';

export default function CreateEvent() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // --- 1. COMPREHENSIVE STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [organizerSubaccount, setOrganizerSubaccount] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState(null);

  // Core Event Data
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    hour: '12',
    minute: '00',
    period: 'PM',
    location: '',
    category: 'Entertainment',
    image_urls: [], 
    is_published: true,
  });

  // Ticket Tiers Data
  const [tiers, setTiers] = useState([
    { 
      id: crypto.randomUUID(),
      name: 'Regular', 
      price: '', 
      capacity: '', 
      description: 'Standard entry to the experience' 
    }
  ]);

  // --- 2. AUTHENTICATION & SUBACCOUNT SECURITY CHECK ---
  useEffect(() => {
    const checkUserAndPayouts = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Verify the organizer has a payout account for the 5% split
      const { data: profile } = await supabase
        .from('profiles')
        .select('paystack_subaccount_code')
        .eq('id', user.id)
        .single();

      if (!profile?.paystack_subaccount_code) {
        setFormError("No Payout Account detected. Visit Settings to link your Bank/MoMo before publishing.");
      } else {
        setOrganizerSubaccount(profile.paystack_subaccount_code);
      }
    };
    checkUserAndPayouts();
  }, [router]);

  // --- 3. MULTI-IMAGE STORAGE LOGIC ---
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        setFormError("One or more files are not valid images.");
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError("One or more files exceed the 5MB limit.");
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setFormError(null);
    let newUrls = [...eventData.image_urls];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100));

        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      setEventData(prev => ({ ...prev, image_urls: newUrls }));
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      setFormError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (index) => {
    const filtered = eventData.image_urls.filter((_, i) => i !== index);
    setEventData({ ...eventData, image_urls: filtered });
  };

  // --- 4. TIER DYNAMICS ---
  const addTier = () => {
    setTiers([...tiers, { id: crypto.randomUUID(), name: '', price: '', capacity: '', description: '' }]);
  };

  const removeTier = (id) => {
    if (tiers.length > 1) setTiers(tiers.filter(t => t.id !== id));
    else setFormError("At least one ticket tier is required.");
  };

  const updateTier = (id, field, value) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- 5. SUBMISSION ENGINE (WITH 5% SPLIT LOGIC) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!organizerSubaccount) {
      setFormError("Payout account missing. 5% Split cannot be initialized.");
      return;
    }

    if (!eventData.title.trim() || !eventData.date || eventData.image_urls.length === 0) {
      setFormError("Missing required fields or images.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    const formattedTime = `${eventData.hour}:${eventData.minute} ${eventData.period}`;

    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          organizer_id: user.id,
          organizer_subaccount: organizerSubaccount, // Linked for payments
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          time: formattedTime,
          location: eventData.location,
          category: eventData.category,
          images: eventData.image_urls,
          is_published: eventData.is_published
        }])
        .select().single();

      if (eventError) throw eventError;

      const tiersPayload = tiers.map(t => ({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price),
        capacity: parseInt(t.capacity),
        description: t.description
      }));

      const { error: tiersError } = await supabase.from('ticket_tiers').insert(tiersPayload);
      if (tiersError) throw tiersError;

      router.push('/dashboard/organizer');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 6. LUXURY STYLING ---
  const styles = {
    pageContainer: { padding: '40px 24px 100px', maxWidth: '1280px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#fcfdfe', fontFamily: '"Inter", sans-serif' },
    topHeader: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' },
    backBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    mainTitle: { fontSize: '40px', fontWeight: '950', letterSpacing: '-0.04em', margin: '0', color: '#000' },
    errorBanner: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '16px', color: '#991b1b', fontSize: '14px', fontWeight: '600', marginBottom: '32px' },
    formLayout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '40px' },
    formColumn: { display: 'flex', flexDirection: 'column', gap: '32px' },
    formSection: { backgroundColor: '#ffffff', borderRadius: '32px', padding: '40px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
    sectionTitleRow: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
    iconBox: (color) => ({ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }),
    sectionHeading: { fontSize: '20px', fontWeight: '800', margin: '0' },
    
    dropZone: (active) => ({
      width: '100%',
      minHeight: '220px',
      borderRadius: '24px',
      border: active ? '3px solid #0ea5e9' : '2px dashed #e2e8f0',
      backgroundColor: active ? '#f0f9ff' : '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: 'pointer',
      transition: '0.3s',
      marginBottom: '20px'
    }),
    imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px', marginTop: '20px' },
    imageThumb: { position: 'relative', height: '120px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #e2e8f0' },
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    removeBtnSmall: { position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px', cursor: 'pointer' },

    timePickerContainer: { display: 'flex', gap: '12px', alignItems: 'center' },
    timeSelectBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    timeInput: { width: '60px', textAlign: 'center', padding: '12px', borderRadius: '12px', border: '2px solid #f1f5f9', fontSize: '18px', fontWeight: '800', backgroundColor: '#f8fafc', outline: 'none' },
    periodToggle: (active) => ({ padding: '12px 16px', borderRadius: '12px', border: 'none', backgroundColor: active ? '#000' : '#f1f5f9', color: active ? '#fff' : '#64748b', fontWeight: '800', cursor: 'pointer', transition: '0.2s' }),

    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' },
    label: { fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', backgroundColor: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '16px', padding: '16px', fontSize: '16px', fontWeight: '600', outline: 'none' },
    textarea: { width: '100%', backgroundColor: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '16px', padding: '16px', fontSize: '16px', fontWeight: '600', outline: 'none', minHeight: '100px' },
    
    tierCard: { backgroundColor: '#f8fafc', borderRadius: '24px', padding: '24px', border: '1px solid #f1f5f9', marginBottom: '16px' },
    tierInput: { background: 'none', border: 'none', borderBottom: '2px solid #e2e8f0', fontSize: '18px', fontWeight: '900', padding: '4px 0', outline: 'none', width: '100%', marginBottom: '15px' },
    addTierBtn: { width: '100%', padding: '18px', borderRadius: '18px', border: '2px dashed #e2e8f0', background: 'none', color: '#64748b', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    
    publishCard: { position: 'sticky', top: '40px', backgroundColor: '#0f172a', borderRadius: '32px', padding: '40px', color: '#fff' },
    submitBtn: { width: '100%', backgroundColor: '#fff', color: '#0f172a', border: 'none', padding: '20px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer' }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.topHeader}>
        <button style={styles.backBtn} onClick={() => router.back()}><ChevronLeft size={18} /> BACK</button>
        <h1 style={styles.mainTitle}>New Experience</h1>
      </div>

      {formError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} />
          {formError}
          {!organizerSubaccount && (
            <button 
              onClick={() => router.push('/dashboard/onboarding')} 
              style={{ marginLeft: 'auto', background: '#991b1b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Link Now
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.formLayout}>
        <div style={styles.formColumn}>
          
          {/* MEDIA SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#8b5cf6')}><ImageIcon size={22} /></div>
              <h2 style={styles.sectionHeading}>Gallery & Posters</h2>
            </div>
            <div 
              style={styles.dropZone(dragActive)} 
              onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              {uploading ? (
                <div style={{textAlign: 'center'}}><Loader2 className="animate-spin" size={32} /> <p>Syncing Media... {uploadProgress}%</p></div>
              ) : (
                <div style={{textAlign: 'center'}}>
                  <Upload size={30} color="#94a3b8" style={{marginBottom: '10px'}}/>
                  <p style={{fontWeight: 800, margin: 0}}>Add Multiple Images</p>
                  <p style={{fontSize: '12px', color: '#94a3b8'}}>Drag and drop or click to upload</p>
                </div>
              )}
              <input type="file" multiple ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={(e) => handleFileUpload(e.target.files)} />
            </div>

            <div style={styles.imageGrid}>
              {eventData.image_urls.map((url, idx) => (
                <div key={idx} style={styles.imageThumb}>
                  <img src={url} style={styles.thumbImg} alt="Preview" />
                  <button type="button" style={styles.removeBtnSmall} onClick={() => removeImage(idx)}><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* INFO SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#0ea5e9')}><FileText size={22} /></div>
              <h2 style={styles.sectionHeading}>Event Information</h2>
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Title</label>
              <input style={styles.input} placeholder="Epic Night Accra..." value={eventData.title} onChange={(e) => setEventData({...eventData, title: e.target.value})} />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px'}}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Date</label>
                <input type="date" style={styles.input} value={eventData.date} onChange={(e) => setEventData({...eventData, date: e.target.value})} />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Start Time</label>
                <div style={styles.timePickerContainer}>
                  <div style={styles.timeSelectBox}>
                    <input style={styles.timeInput} maxLength="2" value={eventData.hour} onChange={(e) => setEventData({...eventData, hour: e.target.value})} />
                  </div>
                  <span style={{fontWeight:900, fontSize:'20px'}}>:</span>
                  <div style={styles.timeSelectBox}>
                    <input style={styles.timeInput} maxLength="2" value={eventData.minute} onChange={(e) => setEventData({...eventData, minute: e.target.value})} />
                  </div>
                  <div style={{display:'flex', gap:'5px', marginLeft:'10px'}}>
                    <button type="button" style={styles.periodToggle(eventData.period === 'AM')} onClick={() => setEventData({...eventData, period: 'AM'})}>AM</button>
                    <button type="button" style={styles.periodToggle(eventData.period === 'PM')} onClick={() => setEventData({...eventData, period: 'PM'})}>PM</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Location</label>
              <div style={{position:'relative'}}>
                <MapPin size={18} style={{position:'absolute', left:'15px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}}/>
                <input style={{...styles.input, paddingLeft:'45px'}} placeholder="Venue Name" value={eventData.location} onChange={(e) => setEventData({...eventData, location: e.target.value})} />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Description</label>
              <textarea style={styles.textarea} value={eventData.description} onChange={(e) => setEventData({...eventData, description: e.target.value})} />
            </div>
          </div>
        </div>

        {/* TICKETING & SUBMIT */}
        <div style={styles.formColumn}>
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#f59e0b')}><Ticket size={22} /></div>
              <h2 style={styles.sectionHeading}>Ticket Tiers</h2>
            </div>
            {tiers.map((tier) => (
              <div key={tier.id} style={styles.tierCard}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <input style={styles.tierInput} placeholder="Tier Name (e.g. VIP)" value={tier.name} onChange={(e) => updateTier(tier.id, 'name', e.target.value)} />
                   <button type="button" onClick={() => removeTier(tier.id)} style={{background:'none', border:'none', color:'#fca5a5', cursor:'pointer'}}><Trash2 size={18}/></button>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                   <div style={styles.inputGroup}><label style={styles.label}>Price (GHS)</label><input type="number" style={styles.input} value={tier.price} onChange={(e) => updateTier(tier.id, 'price', e.target.value)} /></div>
                   <div style={styles.inputGroup}><label style={styles.label}>Qty</label><input type="number" style={styles.input} value={tier.capacity} onChange={(e) => updateTier(tier.id, 'capacity', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addTier} style={styles.addTierBtn}><Plus size={16}/> ADD TICKET TYPE</button>
          </div>

          <div style={styles.publishCard}>
             <div style={{display:'flex', gap:'20px', marginBottom:'30px'}}>
                <div style={styles.iconBox('#4ade80')}><Zap size={24}/></div>
                <div>
                   <h3 style={{margin:0, fontWeight:900}}>Ready to launch?</h3>
                   <p style={{margin:0, color:'#94a3b8', fontSize:'14px'}}>Posters, details, and tickets are set.</p>
                </div>
             </div>
             <button type="submit" style={styles.submitBtn} disabled={loading || uploading}>
                {loading ? <Loader2 className="animate-spin" size={24}/> : <><CheckCircle2 size={24}/> PUBLISH NOW</>}
             </button>
             <div style={{display:'flex', justifyContent:'center', marginTop:'20px', color:'#4ade80', fontSize:'12px', fontWeight:800, gap:'5px'}}>
                <ShieldCheck size={14}/> SECURE CONNECTION
             </div>
          </div>
        </div>
      </form>
    </div>
  );
}
