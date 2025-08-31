'use client';

import { use, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Type definitions
interface MediaState {
    micEnabled: boolean;
    cameraEnabled: boolean;
    screenSharingEnabled?: boolean;
}

interface UserInfo {
    name: string;
}

interface Participant {
    socketId: string;
    userId: string;
    userInfo: UserInfo;
    mediaState?: MediaState;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// WebRTC Configuration
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [countdown, setCountdown] = useState(5);
    const [meetingStarted, setMeetingStarted] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [screenSharingEnabled, setScreenSharingEnabled] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [activeScreenShare, setActiveScreenShare] = useState<{
        socketId: string;
        userId: string;
        userName: string;
    } | null>(null);
    
    // Refs for WebRTC
    const socketRef = useRef<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const screenShareVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenShareStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const screenSharePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const [isVideoCallActive, setIsVideoCallActive] = useState(false);

    // Get user media (camera + microphone)
    const getUserMedia = async () => {
        try {
            console.log('🎥 Requesting user media...');
            
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: cameraEnabled,
                audio: micEnabled
            });
            
            localStreamRef.current = stream;
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            console.log('✅ Got user media:', { 
                video: cameraEnabled, 
                audio: micEnabled 
            });
            
            return stream;
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            
            // Handle specific permission errors
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    alert('Camera/Microphone access denied. Please allow permissions and refresh the page.');
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    alert('No camera or microphone found. Please connect a device and try again.');
                } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                    alert('Camera/microphone is being used by another application. Please close other apps and try again.');
                } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                    alert('Camera/microphone constraints cannot be satisfied. Trying with different settings...');
                    
                    // Try with less restrictive constraints
                    try {
                        const fallbackStream = await navigator.mediaDevices.getUserMedia({
                            video: cameraEnabled ? { width: 640, height: 480 } : false,
                            audio: micEnabled ? { echoCancellation: true } : false
                        });
                        localStreamRef.current = fallbackStream;
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = fallbackStream;
                        }
                        return fallbackStream;
                    } catch (fallbackError) {
                        console.error('❌ Fallback also failed:', fallbackError);
                    }
                } else {
                    alert(`Media access error: ${error.message}`);
                }
            }
            throw error;
        }
    };

    // Get screen share stream
    const getScreenShareStream = async () => {
        try {
            console.log('🖥️ Requesting screen share...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Screen sharing is not supported in this browser');
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: true // Include system audio if available
            });
            
            screenShareStreamRef.current = stream;
            
            // Handle when user stops screen sharing from browser controls
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                console.log('🖥️ Screen share ended by user');
                handleStopScreenShare();
            });
            
            console.log('✅ Got screen share stream');
            return stream;
        } catch (error) {
            console.error('❌ Error accessing screen share:', error);
            
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    alert('Screen sharing permission denied.');
                } else if (error.name === 'NotSupportedError') {
                    alert('Screen sharing is not supported in this browser.');
                } else {
                    alert(`Screen sharing error: ${error.message}`);
                }
            }
            throw error;
        }
    };

    // Create peer connection
    const createPeerConnection = () => {
        console.log('🔗 Creating peer connection...');
        
        const peerConnection = new RTCPeerConnection(iceServers);
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                console.log('🧊 Sending ICE candidate');
                socketRef.current.emit('ice-candidate', {
                    candidate: event.candidate,
                    roomId: id
                });
            }
        };
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('📡 Received remote stream');
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setIsVideoCallActive(true);
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('🔄 Connection state:', peerConnection.connectionState);
        };
        
        return peerConnection;
    };

    // Create screen share peer connection
    const createScreenSharePeerConnection = () => {
        console.log('🔗 Creating screen share peer connection...');
        
        const peerConnection = new RTCPeerConnection(iceServers);
        
        // Handle ICE candidates for screen share
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                console.log('🧊 Sending screen share ICE candidate');
                socketRef.current.emit('screen-share-ice-candidate', {
                    candidate: event.candidate,
                    roomId: id
                });
            }
        };
        
        // Handle remote screen share stream
        peerConnection.ontrack = (event) => {
            console.log('📺 Received remote screen share stream');
            if (screenShareVideoRef.current && event.streams[0]) {
                screenShareVideoRef.current.srcObject = event.streams[0];
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('🔄 Screen share connection state:', peerConnection.connectionState);
        };
        
        return peerConnection;
    };

    // Create and send offer
    const createOffer = async (targetSocketId: string) => {
        if (!peerConnectionRef.current || !localStreamRef.current) return;
        
        try {
            console.log('📤 Creating offer for:', targetSocketId);
            
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            
            socketRef.current?.emit('offer', {
                offer,
                roomId: id,
                targetSocketId
            });
        } catch (error) {
            console.error('❌ Error creating offer:', error);
        }
    };

    // Create and send screen share offer
    const createScreenShareOffer = async (targetSocketId: string) => {
        if (!screenSharePeerConnectionRef.current || !screenShareStreamRef.current) return;
        
        try {
            console.log('📤 Creating screen share offer for:', targetSocketId);
            
            const offer = await screenSharePeerConnectionRef.current.createOffer();
            await screenSharePeerConnectionRef.current.setLocalDescription(offer);
            
            socketRef.current?.emit('screen-share-offer', {
                offer,
                roomId: id,
                targetSocketId
            });
        } catch (error) {
            console.error('❌ Error creating screen share offer:', error);
        }
    };

    // Handle received offer
    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; fromSocketId: string }) => {
        if (!peerConnectionRef.current || !localStreamRef.current) return;
        
        try {
            console.log('📥 Handling offer from:', data.fromSocketId);
            
            await peerConnectionRef.current.setRemoteDescription(data.offer);
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            
            socketRef.current?.emit('answer', {
                answer,
                roomId: id,
                targetSocketId: data.fromSocketId
            });
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    };

    // Handle received screen share offer
    const handleScreenShareOffer = async (data: { offer: RTCSessionDescriptionInit; fromSocketId: string }) => {
        if (!screenSharePeerConnectionRef.current) {
            screenSharePeerConnectionRef.current = createScreenSharePeerConnection();
        }
        
        try {
            console.log('📥 Handling screen share offer from:', data.fromSocketId);
            
            await screenSharePeerConnectionRef.current.setRemoteDescription(data.offer);
            const answer = await screenSharePeerConnectionRef.current.createAnswer();
            await screenSharePeerConnectionRef.current.setLocalDescription(answer);
            
            socketRef.current?.emit('screen-share-answer', {
                answer,
                roomId: id,
                targetSocketId: data.fromSocketId
            });
        } catch (error) {
            console.error('❌ Error handling screen share offer:', error);
        }
    };
    
    // Handle received answer
    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
        if (!peerConnectionRef.current) return;
        
        try {
            console.log('✅ Handling answer');
            await peerConnectionRef.current.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    };

    // Handle received screen share answer
    const handleScreenShareAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
        if (!screenSharePeerConnectionRef.current) return;
        
        try {
            console.log('✅ Handling screen share answer');
            await screenSharePeerConnectionRef.current.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('❌ Error handling screen share answer:', error);
        }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
        if (!peerConnectionRef.current) return;
        
        try {
            console.log('🧊 Adding ICE candidate');
            await peerConnectionRef.current.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    };

    // Handle screen share ICE candidate
    const handleScreenShareIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
        if (!screenSharePeerConnectionRef.current) return;
        
        try {
            console.log('🧊 Adding screen share ICE candidate');
            await screenSharePeerConnectionRef.current.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('❌ Error adding screen share ICE candidate:', error);
        }
    };

    // Handle screen sharing toggle
    const handleScreenShareToggle = async () => {
        if (!screenSharingEnabled) {
            try {
                const stream = await getScreenShareStream();
                setScreenSharingEnabled(true);
                
                // Create screen share peer connection if needed
                if (!screenSharePeerConnectionRef.current) {
                    screenSharePeerConnectionRef.current = createScreenSharePeerConnection();
                }
                
                // Add screen share stream to peer connection
                stream.getTracks().forEach(track => {
                    screenSharePeerConnectionRef.current?.addTrack(track, stream);
                });
                
                // Notify other participants
                if (socketRef.current) {
                    socketRef.current.emit('screen-share-started', {
                        roomId: id,
                        userId: `user-${Math.random().toString(36).substring(7)}`,
                        userName: 'You'
                    });
                    
                    socketRef.current.emit('media-state-change', {
                        roomId: id,
                        mediaState: { micEnabled, cameraEnabled, screenSharingEnabled: true }
                    });
                    
                    // Create offers for all participants
                    participants.forEach(participant => {
                        createScreenShareOffer(participant.socketId);
                    });
                }
                
                // Set active screen share to current user
                setActiveScreenShare({
                    socketId: socketRef.current?.id || '',
                    userId: `user-${Math.random().toString(36).substring(7)}`,
                    userName: 'You'
                });
                
            } catch (error) {
                console.error('❌ Failed to start screen sharing:', error);
                setScreenSharingEnabled(false);
            }
        } else {
            handleStopScreenShare();
        }
    };

    // Stop screen sharing
    const handleStopScreenShare = () => {
        console.log('🛑 Stopping screen share...');
        
        // Stop screen share stream
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
        }
        
        // Close screen share peer connection
        if (screenSharePeerConnectionRef.current) {
            screenSharePeerConnectionRef.current.close();
            screenSharePeerConnectionRef.current = null;
        }
        
        setScreenSharingEnabled(false);
        setActiveScreenShare(null);
        
        // Clear screen share video
        if (screenShareVideoRef.current) {
            screenShareVideoRef.current.srcObject = null;
        }
        
        // Notify other participants
        if (socketRef.current) {
            socketRef.current.emit('screen-share-stopped', {
                roomId: id
            });
            
            socketRef.current.emit('media-state-change', {
                roomId: id,
                mediaState: { micEnabled, cameraEnabled, screenSharingEnabled: false }
            });
        }
    };

    // Initialize WebRTC when meeting starts
    useEffect(() => {
        if (meetingStarted && !socketRef.current) {
            console.log('🔌 Connecting to signaling server...');
            
            const socket = io('http://localhost:3001');
            socketRef.current = socket;

            // Connection events
            socket.on('connect', () => {
                console.log('✅ Connected to signaling server');
                setConnectionStatus('connected');
                
                // Join the meeting room
                socket.emit('join-room', {
                    roomId: id,
                    userId: `user-${Math.random().toString(36).substring(7)}`,
                    userInfo: { name: 'You' }
                });
            });

            socket.on('disconnect', () => {
                console.log('❌ Disconnected from signaling server');
                setConnectionStatus('disconnected');
            });

            // Room events
            socket.on('room-joined', (data: { users: Participant[]; roomId: string; totalUsers: number }) => {
                console.log('🚪 Joined room:', data);
                setParticipants(data.users || []);
            });

            socket.on('user-joined', async (data: Participant) => {
                console.log('👤 User joined:', data);
                setParticipants(prev => [...prev, data]);
                
                // If this is the second person, create offer
                if (localStreamRef.current && peerConnectionRef.current) {
                    await createOffer(data.socketId);
                }
                
                // If screen sharing is active, create screen share offer
                if (screenSharingEnabled && screenSharePeerConnectionRef.current) {
                    await createScreenShareOffer(data.socketId);
                }
            });

            socket.on('user-left', (data: { socketId: string; userId: string; remainingUsers: number }) => {
                console.log('👋 User left:', data);
                setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
                setIsVideoCallActive(false);
                
                // If the person who left was screen sharing, clear the screen share
                if (activeScreenShare && activeScreenShare.socketId === data.socketId) {
                    setActiveScreenShare(null);
                    if (screenShareVideoRef.current) {
                        screenShareVideoRef.current.srcObject = null;
                    }
                }
                
                // Clean up peer connection
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }
            });

            // WebRTC signaling events
            socket.on('offer', handleOffer);
            socket.on('answer', handleAnswer);
            socket.on('ice-candidate', handleIceCandidate);
            
            // Screen share signaling events
            socket.on('screen-share-offer', handleScreenShareOffer);
            socket.on('screen-share-answer', handleScreenShareAnswer);
            socket.on('screen-share-ice-candidate', handleScreenShareIceCandidate);

            // Screen share events
            socket.on('screen-share-started', (data: { socketId: string; userId: string; userName: string }) => {
                console.log('🖥️ Screen share started by:', data);
                setActiveScreenShare(data);
            });

            socket.on('screen-share-stopped', () => {
                console.log('🛑 Screen share stopped');
                setActiveScreenShare(null);
                if (screenShareVideoRef.current) {
                    screenShareVideoRef.current.srcObject = null;
                }
            });

            // Media state events
            socket.on('user-media-state-changed', (data: { socketId: string; mediaState: MediaState }) => {
                console.log('🎥 Media state changed:', data);
                setParticipants(prev => 
                    prev.map(p => 
                        p.socketId === data.socketId 
                            ? { ...p, mediaState: data.mediaState }
                            : p
                    )
                );
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [meetingStarted, id]);

    // Initialize media and peer connection when camera/mic state changes
    useEffect(() => {
        if (meetingStarted && (micEnabled || cameraEnabled)) {
            const initializeMedia = async () => {
                try {
                    // Get user media
                    const stream = await getUserMedia();
                    
                    // Create peer connection if not exists
                    if (!peerConnectionRef.current) {
                        peerConnectionRef.current = createPeerConnection();
                        
                        // Add local stream to peer connection
                        stream.getTracks().forEach(track => {
                            peerConnectionRef.current?.addTrack(track, stream);
                        });
                    }
                } catch (error) {
                    console.error('❌ Failed to initialize media:', error);
                }
            };
            
            initializeMedia();
        } else if (meetingStarted && !micEnabled && !cameraEnabled) {
            // Stop all tracks when both mic and camera are disabled
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        }
    }, [meetingStarted, micEnabled, cameraEnabled]);

    // Countdown effect
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setMeetingStarted(true);
        }
    }, [countdown]);

    // Handle mic toggle
    const handleMicToggle = async () => {
        const newMicState = !micEnabled;
        setMicEnabled(newMicState);
        
        // Update local stream
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = newMicState;
            }
        }
        
        if (socketRef.current) {
            socketRef.current.emit('media-state-change', {
                roomId: id,
                mediaState: { micEnabled: newMicState, cameraEnabled, screenSharingEnabled }
            });
        }
    };

    // Handle camera toggle
    const handleCameraToggle = async () => {
        const newCameraState = !cameraEnabled;
        setCameraEnabled(newCameraState);
        
        // Update local stream
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = newCameraState;
            }
        }
        
        if (socketRef.current) {
            socketRef.current.emit('media-state-change', {
                roomId: id,
                mediaState: { micEnabled, cameraEnabled: newCameraState, screenSharingEnabled }
            });
        }
    };

    const handleLeaveMeeting = () => {
        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Stop screen share stream
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Close peer connections
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        if (screenSharePeerConnectionRef.current) {
            screenSharePeerConnectionRef.current.close();
        }
        
        // Leave room and disconnect socket
        if (socketRef.current) {
            socketRef.current.emit('leave-room', { roomId: id });
            socketRef.current.disconnect();
        }
        
        // Redirect back to profile
        window.location.href = '/profile/user';
    };

    if (!meetingStarted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
                <div className="text-center space-y-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse"></div>
                        <h1 className="relative text-8xl font-extralight text-white mb-4">
                            {countdown}
                        </h1>
                    </div>
                    <div className="space-y-2">
                        <p className="text-2xl text-gray-300 font-light">Meeting starting in</p>
                        <p className="text-sm text-gray-500 font-mono">ID: {id}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between p-6 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                        connectionStatus === 'connected' ? 'bg-green-500' : 
                        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-gray-400 font-mono">
                        {connectionStatus === 'connected' ? 'LIVE' : connectionStatus.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">•</span>
                    <span className="text-sm text-gray-400">{id}</span>
                    {activeScreenShare && (
                        <>
                            <span className="text-sm text-gray-600">•</span>
                            <span className="text-sm text-green-400 flex items-center gap-1">
                                <span>🖥️</span>
                                {activeScreenShare.userName} is sharing
                            </span>
                        </>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className={`w-2 h-2 rounded-full ${isVideoCallActive ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <span>{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 relative flex">
                {/* Screen Share Area (takes center when active) */}
                {activeScreenShare && (
                    <div className="flex-1 p-4 relative">
                        <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-green-500/50 bg-gray-900 relative">
                            <video
                                ref={screenShareVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain bg-gray-800"
                            />
                            
                            {/* Screen share indicator */}
                            <div className="absolute top-4 left-4 bg-green-600/90 backdrop-blur-sm px-4 py-2 rounded-full">
                                <div className="flex items-center gap-2">
                                    <span>🖥️</span>
                                    <span className="text-sm text-white font-medium">
                                        {activeScreenShare.userName} &#39; s Screen
                                    </span>
                                </div>
                            </div>
                            
                            {/* Screen share controls (if you're sharing) */}
                            {activeScreenShare.socketId === socketRef.current?.id && (
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={handleStopScreenShare}
                                        className="bg-red-600/90 hover:bg-red-700/90 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium transition-all duration-200"
                                    >
                                        Stop Sharing
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Minimized participant videos during screen share */}
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            {/* Host video (minimized) */}
                            <div className="w-32 h-24 rounded-lg overflow-hidden border border-gray-600 bg-gray-800">
                                {cameraEnabled ? (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">
                                            {id.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute top-1 left-1 bg-purple-600/90 px-1 py-0.5 rounded text-xs text-white">
                                    You
                                </div>
                            </div>
                            
                            {/* Other participants (minimized) */}
                            {participants.slice(0, 3).map((participant, index) => (
                                <div key={participant.socketId} className="w-32 h-24 rounded-lg overflow-hidden border border-gray-600 bg-gray-800 relative">
                                    {participant.mediaState?.cameraEnabled ? (
                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                                            📹 {participant.userInfo?.name || `User ${index + 1}`}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                                                {participant.userId?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute top-1 left-1 bg-blue-600/90 px-1 py-0.5 rounded text-xs text-white">
                                        {participant.userInfo?.name || `User ${index + 1}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Normal Video Layout (when no screen share) */}
                {!activeScreenShare && (
                    <>
                        {/* Left Participants */}
                        <div className="w-64 p-4 space-y-4">
                            {participants.slice(0, Math.ceil(participants.length / 2)).map((participant, index) => (
                                <div key={participant.socketId} className="aspect-video rounded-xl overflow-hidden border border-gray-600 bg-gray-800">
                                    {participant.mediaState?.cameraEnabled ? (
                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400">
                                            <span>📹 {participant.userInfo?.name || `User ${index + 1}`}</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-lg font-bold text-white mb-2">
                                                {participant.userId?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <p className="text-xs text-gray-400 text-center">{participant.userInfo?.name || `User ${index + 1}`}</p>
                                        </div>
                                    )}
                                    
                                    {/* Participant status indicators */}
                                    <div className="relative">
                                        <div className="absolute -top-8 left-2 flex gap-1">
                                            <div className={`w-2 h-2 rounded-full ${
                                                participant.mediaState?.micEnabled ? 'bg-green-500' : 'bg-red-500'
                                            }`}></div>
                                            <div className={`w-2 h-2 rounded-full ${
                                                participant.mediaState?.cameraEnabled ? 'bg-green-500' : 'bg-red-500'
                                            }`}></div>
                                            {participant.mediaState?.screenSharingEnabled && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Host Video (Center - Main Area) */}
                        <div className="flex-1 p-4 relative">
                            <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-purple-500/50 bg-gray-900 relative">
                                {cameraEnabled ? (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                                        <div className="text-center space-y-6">
                                            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-2xl">
                                                {id.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xl text-gray-300 font-medium">You (Host)</p>
                                                <p className="text-gray-400">
                                                    {participants.length === 0 ? 'Waiting for others to join...' : 'Camera is off'}
                                                </p>
                                                {connectionStatus !== 'connected' && (
                                                    <p className="text-yellow-400 text-sm">
                                                        {connectionStatus === 'connecting' ? 'Connecting to server...' : 'Connection lost'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Host status badge */}
                                <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-sm px-3 py-1 rounded-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                        <span className="text-xs text-white font-medium">HOST</span>
                                    </div>
                                </div>
                                
                                {/* Host media status indicators */}
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        micEnabled ? 'bg-green-500/90' : 'bg-red-500/90'
                                    } backdrop-blur-sm`}>
                                        <span className="text-sm">
                                            {micEnabled ? '🎤' : '🔇'}
                                        </span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        cameraEnabled ? 'bg-green-500/90' : 'bg-red-500/90'
                                    } backdrop-blur-sm`}>
                                        <span className="text-sm">
                                            {cameraEnabled ? '📹' : '📷'}
                                        </span>
                                    </div>
                                    {screenSharingEnabled && (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/90 backdrop-blur-sm">
                                            <span className="text-sm">🖥️</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Participants */}
                        <div className="w-64 p-4 space-y-4">
                            {participants.slice(Math.ceil(participants.length / 2)).map((participant, index) => (
                                <div key={participant.socketId} className="aspect-video rounded-xl overflow-hidden border border-gray-600 bg-gray-800">
                                    {participant.mediaState?.cameraEnabled ? (
                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 relative">
                                            <span>📹 {participant.userInfo?.name || `User ${index + Math.ceil(participants.length / 2) + 1}`}</span>
                                            
                                            {/* Remote video element for participants */}
                                            <video
                                                ref={index === 0 ? remoteVideoRef : undefined}
                                                autoPlay
                                                playsInline
                                                className="w-full h-full object-cover absolute inset-0"
                                                style={{ display: isVideoCallActive && index === 0 ? 'block' : 'none' }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-lg font-bold text-white mb-2">
                                                {participant.userId?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <p className="text-xs text-gray-400 text-center">{participant.userInfo?.name || `User ${index + Math.ceil(participants.length / 2) + 1}`}</p>
                                        </div>
                                    )}
                                    
                                    {/* Participant status indicators */}
                                    <div className="relative">
                                        <div className="absolute -top-8 left-2 flex gap-1">
                                            <div className={`w-2 h-2 rounded-full ${
                                                participant.mediaState?.micEnabled ? 'bg-green-500' : 'bg-red-500'
                                            }`}></div>
                                            <div className={`w-2 h-2 rounded-full ${
                                                participant.mediaState?.cameraEnabled ? 'bg-green-500' : 'bg-red-500'
                                            }`}></div>
                                            {participant.mediaState?.screenSharingEnabled && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Floating video controls overlay */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="flex items-center gap-4 bg-gray-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700">
                        <button
                            onClick={handleMicToggle}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                                micEnabled 
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        >
                            <span className="text-lg">
                                {micEnabled ? '🎤' : '🔇'}
                            </span>
                        </button>

                        <button
                            onClick={handleCameraToggle}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                                cameraEnabled 
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        >
                            <span className="text-lg">
                                {cameraEnabled ? '📹' : '📷'}
                            </span>
                        </button>

                        <div className="w-px h-8 bg-gray-600"></div>

                        <button className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-all duration-200">
                            <span className="text-lg">💬</span>
                        </button>

                        <button
                            onClick={handleScreenShareToggle}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                                screenSharingEnabled 
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                            }`}
                            title={screenSharingEnabled ? 'Stop sharing screen' : 'Share screen'}
                        >
                            <span className="text-lg">🖥️</span>
                        </button>

                        <div className="w-px h-8 bg-gray-600"></div>

                        <button 
                            onClick={handleLeaveMeeting}
                            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all duration-200"
                        >
                            <span className="text-lg">📞</span>
                        </button>
                    </div>
                </div>

                {/* Participants Info Panel (Top Right) */}
                <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700 p-4 min-w-48 z-10">
                    <h3 className="text-sm font-medium text-gray-300 mb-3 text-center">
                        👥 {participants.length + 1} Total
                    </h3>
                    
                    {participants.length === 0 && connectionStatus === 'connected' && (
                        <div className="text-center py-2">
                            <p className="text-xs text-gray-500 mb-1">Share meeting ID:</p>
                            <p className="text-xs text-purple-400 font-mono bg-gray-800/50 px-2 py-1 rounded">{id}</p>
                        </div>
                    )}
                    
                    {participants.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 text-center">Active participants</div>
                            {participants.map((participant, index) => (
                                <div key={participant.socketId} className="flex items-center gap-2 p-1">
                                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                        {participant.userId?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1 truncate">
                                        {participant.userInfo?.name || `User ${index + 1}`}
                                    </span>
                                    <div className="flex gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                            participant.mediaState?.micEnabled ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                            participant.mediaState?.cameraEnabled ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        {participant.mediaState?.screenSharingEnabled && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Screen sharing status */}
                    {activeScreenShare && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className="text-xs text-green-400 text-center">
                                🖥️ Screen sharing active
                            </div>
                            <div className="text-xs text-gray-400 text-center mt-1">
                                by {activeScreenShare.userName}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}