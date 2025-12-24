"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// ... rest of your code
export default function OrganizerDashboard() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    
    // In a real app, handle image upload to Supabase Storage here first
    
    await supabase.from('events').insert({
      title: formData.get('title'),
      date: formData.get('date'),
      price: formData.get('price'),
      location: formData.get('location'),
      organizer_id: 'USER_ID_HERE', // Get from Auth context
      image_url: 'https://placehold.co/600x400' // Placeholder
    });
    
    setLoading(false);
    alert('Event Created!');
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
      <h2 className="text-2xl font-bold mb-6">Create New Event</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="title" placeholder="Event Title" className="w-full p-3 border rounded-xl" required />
        <div className="grid grid-cols-2 gap-4">
          <input name="date" type="date" className="w-full p-3 border rounded-xl" required />
          <input name="price" type="number" placeholder="Price (GHS)" className="w-full p-3 border rounded-xl" required />
        </div>
        <input name="location" placeholder="Location" className="w-full p-3 border rounded-xl" required />
        <button disabled={loading} className="w-full bg-lumina-600 text-white py-3 rounded-xl font-bold hover:bg-lumina-700">
          {loading ? 'Publishing...' : 'Publish Event'}
        </button>
      </form>
    </div>
  );
}
