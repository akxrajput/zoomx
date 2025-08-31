'use client';

import { useRouter } from 'next/navigation';
import { useState, use } from 'react';

export default function UserProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);

  const handleNewMeeting = async () => {
    setIsCreatingMeeting(true);
    
    // Generate a unique meeting ID (you can customize this logic)
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Navigate to the meeting page
    router.push(`/meeting/${meetingId}`);
  };

  return (
    <div className="min-h-screen flex bg-gray-950 text-gray-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 text-2xl font-bold tracking-wide text-gray-100">
          ⚡ Dashboard
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a
            href={`/profile/${userId}`}
            className="block py-2 px-4 rounded-lg hover:bg-gray-800 transition"
          >
            Home
          </a>
          <a
            href={`/profile/${userId}/about`}
            className="block py-2 px-4 rounded-lg hover:bg-gray-800 transition"
          >
            About
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-10 bg-gray-950">
        <h1 className="text-5xl font-light mb-12 text-center capitalize">
          Welcome, <span className="text-purple-400 font-semibold">{userId}</span>
        </h1>

        {/* Techy Buttons */}
        <div className="flex gap-6">
          <button 
            onClick={handleNewMeeting}
            disabled={isCreatingMeeting}
            className="group relative flex items-center gap-3 px-6 py-4 border border-gray-700 rounded-xl text-gray-300 hover:border-purple-500 hover:text-purple-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0 rounded-xl bg-purple-500/10 opacity-0 group-hover:opacity-100 blur-md transition"></span>
            <span className="relative text-lg font-medium">
              {isCreatingMeeting ? '⏳ Creating...' : '➕ New Meeting'}
            </span>
          </button>

          <button className="group relative flex items-center gap-3 px-6 py-4 border border-gray-700 rounded-xl text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-all duration-300">
            <span className="absolute inset-0 rounded-xl bg-blue-500/10 opacity-0 group-hover:opacity-100 blur-md transition"></span>
            <span className="relative text-lg font-medium">🔗 Join Meeting</span>
          </button>

          <button className="group relative flex items-center gap-3 px-6 py-4 border border-gray-700 rounded-xl text-gray-300 hover:border-green-500 hover:text-green-400 transition-all duration-300">
            <span className="absolute inset-0 rounded-xl bg-green-500/10 opacity-0 group-hover:opacity-100 blur-md transition"></span>
            <span className="relative text-lg font-medium">🖥 Share Screen</span>
          </button>
        </div>
      </main>
    </div>
  );
}