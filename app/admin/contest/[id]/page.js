"use client";
import { supabase } from '@/lib/supabase';

export default function ContestAdmin({ params }) {
  const downloadAllImages = async (imageUrls) => {
    // This loops through the array of images and triggers a browser download
    imageUrls.forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `candidate-media-${index}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div className="p-8 bg-white rounded-3xl shadow-2xl">
      <h1 className="text-3xl font-black mb-6">Contest Control Panel</h1>
      <button 
        onClick={() => downloadAllImages(candidates.map(c => c.image_url))}
        className="bg-lumina-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-lumina-600 transition-all"
      >
        Download All Contestant Images
      </button>
      
      {/* Live Vote Tracker */}
      <div className="mt-10 space-y-4">
        {candidates.map(c => (
          <div key={c.id} className="relative h-12 w-full bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
              style={{ width: `${(c.votes / totalVotes) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center px-4 font-bold text-sm">
              {c.name}: {c.votes} Votes
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
