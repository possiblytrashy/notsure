"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, AlertCircle, 
  CheckCircle2, Loader2, ChevronLeft, Info,
  Layers, CreditCard, Sparkles, Upload, CloudLightning,
  Eye, Settings, HelpCircle, ShieldCheck, Zap,
  FileText, Tag, Globe, Lock, User
} from 'lucide-react';

export default function CreateEvent() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // --- 1. COMPREHENSIVE STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState(null);

  // Core Event Data
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'Entertainment',
    image_url: '',
    is_published: true,
    capacity_total: 0,
    tags: []
  });

  // Ticket Tiers Data
  const [tiers, setTiers] = useState([
    { 
      id: crypto.randomUUID(),
      name: 'Regular', 
      price: '', 
      capacity: '', 
      description: 'Standard entry to the event' 
    }
  ]);

  // --- 2. AUTHENTICATION & SECURITY CHECK ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("Unauthorized access attempt.");
        router.push('/login');
      } else {
        setUser(user);
      }
    };
    checkUser();
  }, [router]);

  // --- 3. ADVANCED IMAGE HANDLING & STORAGE LOGIC ---
  
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // File Validation
    if (!file.type.startsWith('image/')) {
      setFormError("Invalid file type. Please upload an image (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("File too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setFormError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      setEventData(prev => ({ ...prev, image_url: publicUrl }));
      setUploadProgress(100);
      
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      console.error("Storage Error:", err);
      setFormError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // --- 4. TIER DYNAMICS ---
  const addTier = () => {
    const newTier = {
      id: crypto.randomUUID(),
      name: '',
      price: '',
      capacity: '',
      description: ''
    };
    setTiers([...tiers, newTier]);
  };

  const removeTier = (id) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter(t => t.id !== id));
    } else {
      setFormError("An event must have at least one ticket tier.");
    }
  };

  const updateTier = (id, field, value) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- 5. FINAL SUBMISSION ENGINE ---
  const validateForm = () => {
    if (!eventData.title.trim()) return "Event title is required.";
    if (!eventData.date) return "Event date is required.";
    if (!eventData.location.trim()) return "Location is required.";
    if (!eventData.image_url) return "Please upload an event poster.";
    
    for (let tier of tiers) {
      if (!tier.name || !tier.price || !tier.capacity) {
        return `Please complete all fields for the ${tier.name || 'unnamed'} tier.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      // 1. Insert Event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          organizer_id: user.id,
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          time: eventData.time,
          location: eventData.location,
          category: eventData.category,
          images: [eventData.image_url],
          is_published: eventData.is_published
        }])
        .select()
        .single();

      if (eventError) throw eventError;

      // 2. Insert Tiers
      const tiersPayload = tiers.map(t => ({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price),
        capacity: parseInt(t.capacity),
        description: t.description
      }));

      const { error: tiersError } = await supabase
        .from('ticket_tiers')
        .insert(tiersPayload);

      if (tiersError) throw tiersError;

      // Success Redirect
      router.push('/dashboard/organizer');
    } catch (err) {
      setFormError("Database Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 6. FULL-SCALE STYLING OBJECTS ---
  const styles = {
    pageContainer: {
      padding: '40px 24px 100px',
      maxWidth: '1280px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#fcfdfe',
      color: '#0f172a',
      fontFamily: '"Inter", sans-serif'
    },
    topHeader: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginBottom: '48px'
    },
    backBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'none',
      border: 'none',
      color: '#64748b',
      fontSize: '14px',
      fontWeight: '700',
      cursor: 'pointer',
      width: 'fit-content',
      padding: '0',
      transition: 'color 0.2s'
    },
    mainTitle: {
      fontSize: '40px',
      fontWeight: '950',
      letterSpacing: '-0.04em',
      margin: '0',
      color: '#000'
    },
    errorBanner: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 20px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fee2e2',
      borderRadius: '16px',
      color: '#991b1b',
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '32px',
      animation: 'slideIn 0.3s ease-out'
    },
    formLayout: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
      gap: '40px',
      alignItems: 'start'
    },
    formColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    },
    formSection: {
      backgroundColor: '#ffffff',
      borderRadius: '32px',
      padding: '40px',
      border: '1px solid #f1f5f9',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
    },
    sectionTitleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '32px'
    },
    iconBox: (color) => ({
      width: '44px',
      height: '44px',
      borderRadius: '14px',
      backgroundColor: `${color}10`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color
    }),
    sectionHeading: {
      fontSize: '20px',
      fontWeight: '800',
      margin: '0',
      letterSpacing: '-0.02em'
    },
    // Dropzone specific
    dropZone: (active, hasImage) => ({
      width: '100%',
      minHeight: '300px',
      borderRadius: '24px',
      border: active ? '3px solid #0ea5e9' : '2px dashed #e2e8f0',
      backgroundColor: active ? '#f0f9ff' : '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer'
    }),
    uploadStatus: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      color: '#0ea5e9',
      fontWeight: '700'
    },
    progressBarContainer: {
      width: '200px',
      height: '6px',
      backgroundColor: '#e2e8f0',
      borderRadius: '10px',
      marginTop: '8px',
      overflow: 'hidden'
    },
    progressBar: (progress) => ({
      width: `${progress}%`,
      height: '100%',
      backgroundColor: '#0ea5e9',
      transition: 'width 0.3s ease'
    }),
    previewWrapper: {
      width: '100%',
      height: '100%',
      position: 'relative'
    },
    previewImg: {
      width: '100%',
      height: '300px',
      objectFit: 'cover',
      borderRadius: '20px'
    },
    removeImgBtn: {
      position: 'absolute',
      top: '16px',
      right: '16px',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      border: 'none',
      color: '#fff',
      width: '36px',
      height: '36px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'transform 0.2s'
    },
    dropLabel: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '20px'
    },
    fileInputHidden: {
      position: 'absolute',
      inset: '0',
      opacity: '0',
      cursor: 'pointer'
    },
    // Input elements
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '24px'
    },
    label: {
      fontSize: '12px',
      fontWeight: '800',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginLeft: '4px'
    },
    input: {
      width: '100%',
      backgroundColor: '#f8fafc',
      border: '2px solid #f1f5f9',
      borderRadius: '16px',
      padding: '16px 20px',
      fontSize: '16px',
      fontWeight: '600',
      color: '#1e293b',
      outline: 'none',
      transition: 'border-color 0.2s, background-color 0.2s'
    },
    textarea: {
      width: '100%',
      backgroundColor: '#f8fafc',
      border: '2px solid #f1f5f9',
      borderRadius: '16px',
      padding: '16px 20px',
      fontSize: '16px',
      fontWeight: '600',
      color: '#1e293b',
      outline: 'none',
      minHeight: '120px',
      resize: 'vertical',
      fontFamily: 'inherit'
    },
    inputRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px'
    },
    // Tier cards
    tierCard: {
      backgroundColor: '#f8fafc',
      borderRadius: '24px',
      padding: '24px',
      border: '1px solid #f1f5f9',
      marginBottom: '16px',
      position: 'relative'
    },
    tierHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    tierTitleInput: {
      background: 'none',
      border: 'none',
      borderBottom: '2px solid #e2e8f0',
      fontSize: '18px',
      fontWeight: '900',
      color: '#0f172a',
      padding: '4px 0',
      outline: 'none',
      width: '70%',
      transition: 'border-color 0.2s'
    },
    removeTierBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      backgroundColor: '#fff1f2',
      color: '#e11d48',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    },
    addTierBtn: {
      width: '100%',
      padding: '16px',
      borderRadius: '16px',
      border: '2px dashed #cbd5e1',
      backgroundColor: 'transparent',
      color: '#64748b',
      fontSize: '14px',
      fontWeight: '800',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    // Sticky Publish Card
    publishCard: {
      position: 'sticky',
      top: '40px',
      backgroundColor: '#0f172a',
      borderRadius: '32px',
      padding: '40px',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
    },
    publishHeader: {
      display: 'flex',
      gap: '20px',
      alignItems: 'center'
    },
    publishTitle: {
      fontSize: '20px',
      fontWeight: '800',
      margin: '0 0 4px 0'
    },
    publishSub: {
      fontSize: '14px',
      color: '#94a3b8',
      margin: '0',
      lineHeight: '1.5'
    },
    submitBtn: {
      width: '100%',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      border: 'none',
      padding: '20px',
      borderRadius: '20px',
      fontSize: '16px',
      fontWeight: '900',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      cursor: 'pointer',
      transition: 'transform 0.2s, background-color 0.2s'
    },
    securityBadge: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontSize: '12px',
      fontWeight: '700',
      color: '#4ade80'
    }
  };

  return (
    <div style={styles.pageContainer}>
      {/* 1. Header Section */}
      <div style={styles.topHeader}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <ChevronLeft size={18} /> BACK TO OVERVIEW
        </button>
        <h1 style={styles.mainTitle}>Launch Experience</h1>
      </div>

      {/* 2. Error Display */}
      {formError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.formLayout}>
        {/* LEFT COLUMN: PRIMARY DATA */}
        <div style={styles.formColumn}>
          
          {/* POSTER UPLOAD SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#8b5cf6')}><ImageIcon size={22} /></div>
              <h2 style={styles.sectionHeading}>Event Media</h2>
            </div>

            <div 
              style={styles.dropZone(dragActive, !!eventData.image_url)}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              {uploading ? (
                <div style={styles.uploadStatus}>
                  <Loader2 className="animate-spin" size={40} />
                  <p>Processing High-Res Image...</p>
                  <div style={styles.progressBarContainer}>
                    <div style={styles.progressBar(uploadProgress)} />
                  </div>
                </div>
              ) : eventData.image_url ? (
                <div style={styles.previewWrapper}>
                  <img src={eventData.image_url} style={styles.previewImg} alt="Poster Preview" />
                  <button 
                    type="button" 
                    style={styles.removeImgBtn} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEventData({...eventData, image_url: ''});
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div style={styles.dropLabel}>
                  <div style={{...styles.iconBox('#94a3b8'), width: '60px', height: '60px', marginBottom: '20px'}}>
                    <Upload size={30} />
                  </div>
                  <p style={{margin: '0 0 8px', fontSize: '18px', fontWeight: '800'}}>Drag and drop poster</p>
                  <p style={{margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: '500'}}>
                    PNG, JPG or WEBP up to 5MB. 16:9 recommended.
                  </p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                style={{display: 'none'}} 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e.target.files[0])}
              />
            </div>
          </div>

          {/* CORE DETAILS SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#0ea5e9')}><FileText size={22} /></div>
              <h2 style={styles.sectionHeading}>Experience Details</h2>
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Event Title</label>
              <input 
                style={styles.input} 
                placeholder="Name your experience..." 
                value={eventData.title}
                onChange={(e) => setEventData({...eventData, title: e.target.value})}
              />
            </div>

            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Date</label>
                <input 
                  type="date" 
                  style={styles.input} 
                  value={eventData.date}
                  onChange={(e) => setEventData({...eventData, date: e.target.value})}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Start Time</label>
                <input 
                  type="time" 
                  style={styles.input} 
                  value={eventData.time}
                  onChange={(e) => setEventData({...eventData, time: e.target.value})}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Venue / Location</label>
              <input 
                style={styles.input} 
                placeholder="Where is the magic happening?" 
                value={eventData.location}
                onChange={(e) => setEventData({...eventData, location: e.target.value})}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Experience Description</label>
              <textarea 
                style={styles.textarea} 
                placeholder="Tell the world why they can't miss this..."
                value={eventData.description}
                onChange={(e) => setEventData({...eventData, description: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TICKETING & PUBLISH */}
        <div style={styles.formColumn}>
          
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#f59e0b')}><Ticket size={22} /></div>
              <h2 style={styles.sectionHeading}>Ticketing Strategy</h2>
            </div>

            {tiers.map((tier) => (
              <div key={tier.id} style={styles.tierCard}>
                <div style={styles.tierHeader}>
                  <input 
                    style={styles.tierTitleInput} 
                    placeholder="Tier Name (e.g. VIP)" 
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                  />
                  <button type="button" style={styles.removeTierBtn} onClick={() => removeTier(tier.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={styles.inputRow}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Price (GHS)</label>
                    <input 
                      type="number" 
                      style={styles.input} 
                      placeholder="0.00"
                      value={tier.price}
                      onChange={(e) => updateTier(tier.id, 'price', e.target.value)}
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Inventory</label>
                    <input 
                      type="number" 
                      style={styles.input} 
                      placeholder="Qty"
                      value={tier.capacity}
                      onChange={(e) => updateTier(tier.id, 'capacity', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addTier} style={styles.addTierBtn}>
              <Plus size={18} /> ADD NEW TICKET TYPE
            </button>
          </div>

          {/* STICKY CTA CARD */}
          <div style={styles.publishCard}>
            <div style={styles.publishHeader}>
              <div style={{...styles.iconBox('#4ade80'), backgroundColor: 'rgba(74, 222, 128, 0.1)'}}>
                <Zap size={24} />
              </div>
              <div>
                <h3 style={styles.publishTitle}>Ready to Go Live?</h3>
                <p style={styles.publishSub}>Your event will be instantly discoverable once you hit publish.</p>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <button 
                type="submit" 
                style={styles.submitBtn} 
                disabled={loading || uploading}
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : (
                  <><CheckCircle2 size={22} /> PUBLISH EXPERIENCE</>
                )}
              </button>
              
              <div style={styles.securityBadge}>
                <ShieldCheck size={16} />
                <span>SECURED BY OUSTED PAYMENTS</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
