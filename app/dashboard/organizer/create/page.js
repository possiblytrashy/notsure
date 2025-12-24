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

  // Cleanup Object URLs to prevent memory leaks
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in first");

      // Parallel Uploads
      const uploadedUrls = await Promise.all(
        images.map(async (file) => {
          const filePath = `${user.id}/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from('event-images').upload(filePath, file);
          if (error) throw error;
          return supabase.storage.from('event-images').getPublicUrl(filePath).data.publicUrl;
        })
      );

      const { error } = await supabase.from('events').insert([{
        ...form,
        organizer_id: user.id,
        images: uploadedUrls,
        ticket_tiers: tiers,
        price: parseFloat(tiers[0]?.price || 0)
      }]);

      if (error) throw error;
      window.location.href = '/dashboard/organizer';
    } catch (err) {
      alert(err.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 20px' }}>
      {/* LOADING OVERLAY */}
      {uploading && (
        <div style={overlayS}>
          <Loader2 size={48} className="animate-spin" style={{ color: '#000', marginBottom: '20px' }} />
          <h2 style={{ fontWeight: 900 }}>LAUNCHING OUSTED...</h2>
          <p style={{ color: '#666' }}>Creating your experience and uploading media.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <header>
          <h1 style={{ fontSize: '38px', fontWeight: 950, letterSpacing: '-1px' }}>OUSTED</h1>
          <p style={{ color: '#666' }}>Host a new experience.</p>
        </header>

        {/* IMAGE UPLOAD */}
        <div style={cardS}>
          <input type="file" multiple accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={dropzoneS}>
            <Upload size={28} />
            <span style={{ fontWeight: 700, marginTop: '10px' }}>Add Photos</span>
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            {previews.map((url, i) => (
              <div key={i} style={thumbS}>
                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => removeImage(i)} style={removeBtnS}><X size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* INFO */}
        <div style={cardS}>
          <h2 style={labelS}>EVENT DETAILS</h2>
          <input required placeholder="Event Title" style={inputS} onChange={e => setForm({...form, title: e.target.value})} />
          <textarea required placeholder="Description" style={{...inputS, height: '100px', marginTop: '10px'}} onChange={e => setForm({...form, description: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <input required placeholder="Date" style={inputS} onChange={e => setForm({...form, date: e.target.value})} />
            <input required placeholder="Location" style={inputS} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
        </div>

        {/* TIERS */}
        <div style={cardS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h2 style={labelS}>TICKETS</h2>
            <button type="button" onClick={() => setTiers([...tiers, { name: '', price: '', capacity: '' }])} style={addBtnS}>+ Add</button>
          </div>
          {tiers.map((tier, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="Name" style={inputS} value={tier.name} onChange={e => {
                const nt = [...tiers]; nt[i].name = e.target.value; setTiers(nt);
              }} />
              <input type="number" placeholder="$" style={inputS} value={tier.price} onChange={e => {
                const nt = [...tiers]; nt[i].price = e.target.value; setTiers(nt);
              }} />
              <input type="number" placeholder="Qty" style={inputS} value={tier.capacity} onChange={e => {
                const nt = [...tiers]; nt[i].capacity = e.target.value; setTiers(nt);
              }} />
              <button type="button" onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={uploading} style={submitBtnS}>
          CREATE EVENT
        </button>
      </form>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// STYLES
const overlayS = { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const cardS = { background: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #eee' };
const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #eee', outline: 'none' };
const labelS = { fontSize: '12px', fontWeight: 900, color: '#888', marginBottom: '10px' };
const dropzoneS = { height: '100px', border: '2px dashed #eee', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const thumbS = { width: '60px', height: '60px', borderRadius: '10px', overflow: 'hidden', position: 'relative' };
const removeBtnS = { position: 'absolute', top: 2, right: 2, background: '#000', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px' };
const addBtnS = { background: '#f0f0f0', border: 'none', padding: '5px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' };
const submitBtnS = { background: '#000', color: '#fff', padding: '20px', borderRadius: '15px', fontWeight: 900, border: 'none', cursor: 'pointer' };
