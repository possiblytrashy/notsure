"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Plus, Trash2, X, Loader2 } from 'lucide-react';

export default function AdvancedCreateEvent() {
  const [form, setForm] = useState({ title: '', date: '', location: '', description: '' });
  const [tiers, setTiers] = useState([{ name: 'General Admission', price: '', capacity: '' }]);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) return alert("Max 5 images");
    setImages(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) throw new Error("Please log in first");

      // 1. Upload images to the bucket we created
      const uploadedUrls = await Promise.all(
        images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('event-images')
            .upload(fileName, file);
            
          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('event-images')
            .getPublicUrl(fileName);
            
          return data.publicUrl;
        })
      );

      // 2. Insert the event record
      const { error: dbError } = await supabase.from('events').insert([{
        title: form.title,
        description: form.description,
        date: form.date, // type="date" input ensures this is valid
        location: form.location,
        organizer_id: user.id,
        images: uploadedUrls, // Passes as ['url1', 'url2']
        ticket_tiers: tiers,
        price: parseFloat(tiers[0]?.price || 0)
      }]);

      if (dbError) {
        console.error("Supabase Insert Error:", dbError);
        throw new Error(dbError.message);
      }

      window.location.href = '/dashboard/organizer';
    } catch (err) {
      console.error("Full Error Object:", err);
      alert(err.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 20px' }}>
      {uploading && (
        <div style={overlayS}>
          <Loader2 size={48} className="animate-spin" style={{ color: '#0ea5e9', marginBottom: '20px' }} />
          <h2 style={{ fontWeight: 900 }}>LAUNCHING EXPERIENCE...</h2>
          <p style={{ color: '#666' }}>Uploading media and syncing with database.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <header>
          <h1 style={{ fontSize: '38px', fontWeight: 950, letterSpacing: '-1px' }}>OUSTED</h1>
          <p style={{ color: '#666' }}>Host a new experience.</p>
        </header>

        <div style={cardS}>
          <input type="file" multiple accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={dropzoneS}>
            <Upload size={28} color="#0ea5e9" />
            <span style={{ fontWeight: 700, marginTop: '10px' }}>Add Photos ({images.length}/5)</span>
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
            {previews.map((url, i) => (
              <div key={i} style={thumbS}>
                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                <button type="button" onClick={() => removeImage(i)} style={removeBtnS}><X size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        <div style={cardS}>
          <h2 style={labelS}>EVENT DETAILS</h2>
          <input required placeholder="Event Title" style={inputS} onChange={e => setForm({...form, title: e.target.value})} />
          <textarea required placeholder="What's the vibe? (Description)" style={{...inputS, height: '100px', marginTop: '10px'}} onChange={e => setForm({...form, description: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <input required type="date" style={inputS} onChange={e => setForm({...form, date: e.target.value})} />
            <input required placeholder="Venue/Location" style={inputS} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
        </div>

        <div style={cardS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h2 style={labelS}>TICKETS</h2>
            <button type="button" onClick={() => setTiers([...tiers, { name: '', price: '', capacity: '' }])} style={addBtnS}>+ Add Tier</button>
          </div>
          {tiers.map((tier, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="e.g. Early Bird" style={inputS} value={tier.name} onChange={e => {
                const nt = [...tiers]; nt[i].name = e.target.value; setTiers(nt);
              }} />
              <input type="number" placeholder="Price" style={inputS} value={tier.price} onChange={e => {
                const nt = [...tiers]; nt[i].price = e.target.value; setTiers(nt);
              }} />
              <input type="number" placeholder="Qty" style={inputS} value={tier.capacity} onChange={e => {
                const nt = [...tiers]; nt[i].capacity = e.target.value; setTiers(nt);
              }} />
              <button type="button" onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={uploading} style={submitBtnS}>
          {uploading ? "SYNCING..." : "CREATE EVENT"}
        </button>
      </form>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// STYLES (Kept consistent with your design)
const overlayS = { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const cardS = { background: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #eee' };
const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #eee', outline: 'none', fontSize: '14px' };
const labelS = { fontSize: '12px', fontWeight: 900, color: '#aaa', marginBottom: '10px', letterSpacing: '1px' };
const dropzoneS = { height: '100px', border: '2px dashed #0ea5e9', background: '#f0f9ff', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const thumbS = { width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid #eee' };
const removeBtnS = { position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBtnS = { background: '#000', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' };
const submitBtnS = { background: '#000', color: '#fff', padding: '20px', borderRadius: '15px', fontWeight: 900, border: 'none', cursor: 'pointer', letterSpacing: '1px' };
