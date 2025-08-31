'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, use } from 'react';
import { io } from 'socket.io-client';

// Join Meeting Modal Component
function JoinMeetingModal({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) {
  const [meetingId, setMeetingId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const router = useRouter();

  // Format meeting ID as user types
  const formatMeetingId = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const formatted = cleaned.replace(/(.{3})/g, '$1-').replace(/-$/, '');
    return formatted.slice(0, 11); // Max length: XXX-XXX-XXX
  };

  // Validate meeting ID format
  const isValidMeetingId = (id: string) => {
    const regex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/;
    return regex.test(id);
  };

  // Check if meeting exists on server
  const validateMeetingExists = async (roomId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setIsValidating(true);
      
      const socket = io('http://localhost:3001');
      socketRef.current = socket;

      const timeout = setTimeout(() => {
        socket.disconnect();
        setIsValidating(false);
        resolve(false);
      }, 5000);

      socket.on('connect', () => {
        socket.emit('check-room-exists', { roomId });
      });

      socket.on('room-exists-response', (data: { exists: boolean; roomId: string; participantCount?: number }) => {
        clearTimeout(timeout);
        socket.disconnect();
        setIsValidating(false);
        resolve(data.exists);
      });

      socket.on('connect_error', () => {
        clearTimeout(timeout);
        socket.disconnect();
        setIsValidating(false);
        resolve(false);
      });
    });
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMeetingId(e.target.value);
    setMeetingId(formatted);
    setError('');
  };

  // Handle form submission
  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!meetingId.trim()) {
      setError('Please enter a meeting ID');
      return;
    }

    if (!isValidMeetingId(meetingId)) {
      setError('Invalid meeting ID format. Use format: XXX-XXX-XXX');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const exists = await validateMeetingExists(meetingId);
      
      if (!exists) {
        setError('Meeting not found. Please check the ID and try again.');
        setIsJoining(false);
        return;
      }

      // Meeting exists, redirect to meeting page
      router.push(`/meeting/${meetingId}`);
      
    } catch (error) {
      console.error('Error joining meeting:', error);
      setError('Failed to join meeting. Please try again.');
      setIsJoining(false);
    }
  };

  // Quick paste from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const formatted = formatMeetingId(text);
      setMeetingId(formatted);
      setError('');
    } catch (error) {
      setError('Failed to read clipboard. Please paste manually.');
    }
  };

  // Reset modal state when closing
  const handleClose = () => {
    setMeetingId('');
    setError('');
    setIsJoining(false);
    setIsValidating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md transform transition-all duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl text-white mx-auto mb-3">
            🔗
          </div>
          <h2 className="text-xl font-bold text-white">Join Meeting</h2>
          <p className="text-gray-400 text-sm">Enter the meeting ID to join</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoinMeeting} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="meetingId" className="block text-sm font-medium text-gray-300">
              Meeting ID
            </label>
            <div className="relative">
              <input
                id="meetingId"
                type="text"
                value={meetingId}
                onChange={handleInputChange}
                placeholder="XXX-XXX-XXX"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono tracking-wider"
                disabled={isJoining || isValidating}
                autoComplete="off"
                maxLength={11}
              />
              
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors duration-200"
                disabled={isJoining || isValidating}
              >
                Paste
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Validation status */}
          {isValidating && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-blue-400 text-sm">Checking meeting...</p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isJoining || isValidating}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-gray-300 rounded-lg transition-colors duration-200 border border-gray-600"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={!meetingId || isJoining || isValidating || !isValidMeetingId(meetingId)}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200"
            >
              {isJoining ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Joining...</span>
                </div>
              ) : (
                'Join Meeting'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleNewMeeting = async () => {
    setIsCreatingMeeting(true);
    
    // Generate a unique meeting ID in XXX-XXX-XXX format
    const generateMeetingId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 9; i++) {
        if (i === 3 || i === 6) {
          result += '-';
        }
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const meetingId = generateMeetingId();
    
    // Navigate to the meeting page
    router.push(`/meeting/${meetingId}`);
  };

  const handleJoinMeeting = () => {
    setShowJoinModal(true);
  };

  return (
    <>
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

          {/* Action Buttons */}
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

            <button 
              onClick={handleJoinMeeting}
              className="group relative flex items-center gap-3 px-6 py-4 border border-gray-700 rounded-xl text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-all duration-300"
            >
              <span className="absolute inset-0 rounded-xl bg-blue-500/10 opacity-0 group-hover:opacity-100 blur-md transition"></span>
              <span className="relative text-lg font-medium">🔗 Join Meeting</span>
            </button>

            <button className="group relative flex items-center gap-3 px-6 py-4 border border-gray-700 rounded-xl text-gray-300 hover:border-green-500 hover:text-green-400 transition-all duration-300">
              <span className="absolute inset-0 rounded-xl bg-green-500/10 opacity-0 group-hover:opacity-100 blur-md transition"></span>
              <span className="relative text-lg font-medium">🖥 Share Screen</span>
            </button>
          </div>

          {/* Quick Actions Info */}
          <div className="mt-12 text-center space-y-4 max-w-lg">
            <h2 className="text-xl font-semibold text-gray-300">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-purple-400 mb-2">Host Meeting</h3>
                <p className="text-gray-400">Start a new meeting and invite others with a generated meeting ID</p>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-blue-400 mb-2">Join Meeting</h3>
                <p className="text-gray-400">Enter a meeting ID to join an existing meeting room</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Join Meeting Modal */}
      <JoinMeetingModal 
        isOpen={showJoinModal} 
        onClose={() => setShowJoinModal(false)}
        userId={userId}
      />
    </>
  );
}