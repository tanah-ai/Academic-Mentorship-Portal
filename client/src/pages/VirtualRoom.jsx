import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { fabric } from 'fabric';
import { PenTool, Code, MessageSquare, Users, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Send, Trash2, Download, Upload, Monitor, MonitorOff, Undo, Redo, Eraser, Minus, Type, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

const VirtualRoom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('whiteboard');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [code, setCode] = useState('// Start coding here...');
  const [loading, setLoading] = useState(true);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const fabricCanvas = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [whiteboardData, setWhiteboardData] = useState('');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [currentTool, setCurrentTool] = useState('pen');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    fetchSession();
    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (fabricCanvas.current) {
        fabricCanvas.current.dispose();
      }
    };
  }, [id]);

  // Listen for mentee-joined event (for mentor)
  useEffect(() => {
    if (socket) {
      socket.on('mentee-joined', (data) => {
        console.log('Mentee joined session:', data);
        // Refresh session data to update mentee_joined status
        fetchSession();
      });
    }
  }, [socket]);

  const fetchSession = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const response = await fetch(`/api/sessions/${id}`, headers);
      const data = await response.json();
      setSession(data.session);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const initSocket = () => {
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-session', id);
    });

    newSocket.on('whiteboard-update', (data) => {
      setWhiteboardData(data.data);
    });

    newSocket.on('code-update', (data) => {
      setCode(data.code);
    });

    newSocket.on('chat-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    newSocket.on('file-shared', (data) => {
      setSharedFiles(prev => [...prev, data]);
    });

    newSocket.on('reaction', (data) => {
      setReactions(prev => [...prev, { ...data, id: Date.now() }]);
      // Remove reaction after 3 seconds
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== Date.now()));
      }, 3000);
    });

    // WebRTC signaling
    newSocket.on('offer', async (data) => {
      try {
        console.log('Received offer');
        
        // Create peer connection if it doesn't exist
        if (!peerConnectionRef.current) {
          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
          
          peerConnectionRef.current = pc;
          
          // Handle remote stream
          pc.ontrack = (event) => {
            console.log('Received remote track');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(e => console.log('Play error:', e));
              setRemoteStream(event.streams[0]);
            }
          };
          
          // Handle ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log('Sending ICE candidate');
              newSocket.emit('ice-candidate', { sessionId: id, candidate: event.candidate });
            }
          };
          
          // Add local stream if it exists
          if (localStream) {
            localStream.getTracks().forEach(track => {
              pc.addTrack(track, localStream);
            });
          }
        }
        
        const pc = peerConnectionRef.current;
        
        // Check if we already have a remote description
        if (pc.remoteDescription) {
          console.log('Already have remote description, ignoring duplicate offer');
          return;
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('answer', { sessionId: id, answer });
        console.log('Sent answer');
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    newSocket.on('answer', async (data) => {
      try {
        console.log('Received answer');
        const pc = peerConnectionRef.current;
        if (pc) {
          // Check if we already have a remote description
          if (pc.remoteDescription) {
            console.log('Already have remote description, ignoring duplicate answer');
            return;
          }
          
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('Set remote description from answer');
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    newSocket.on('ice-candidate', async (data) => {
      try {
        console.log('Received ICE candidate');
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('Added ICE candidate');
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    // Handle request for offer from mentee
    newSocket.on('request-offer', async (data) => {
      try {
        console.log('Received request-offer');
        // Only mentor should respond to offer requests
        if (user?.user_type === 'mentor' && peerConnectionRef.current) {
          console.log('Resending offer to mentee');
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          newSocket.emit('offer', { sessionId: id, offer });
        }
      } catch (error) {
        console.error('Error handling request-offer:', error);
      }
    });
  };

  // WebRTC functions
  const startVideo = async () => {
    try {
      console.log('Starting video for:', user?.user_type);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsVideoOn(true);
      setIsMicOn(true);
      
      // Only mentor creates peer connection and sends offer
      // Mentee waits for offer before creating peer connection
      if (user?.user_type === 'mentor' && !peerConnectionRef.current) {
        console.log('Creating peer connection for mentor');
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        
        peerConnectionRef.current = pc;
        
        // Add local stream to peer connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // Handle remote stream
        pc.ontrack = (event) => {
          console.log('Mentor received remote track');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch(e => console.log('Play error:', e));
            setRemoteStream(event.streams[0]);
          }
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            console.log('Mentor sending ICE candidate');
            socketRef.current.emit('ice-candidate', { sessionId: id, candidate: event.candidate });
          }
        };
        
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('offer', { sessionId: id, offer });
        console.log('Mentor sent offer');
      } else if (user?.user_type === 'mentee') {
        console.log('Mentee started video, requesting offer from mentor');
        // Request mentor to send offer
        if (socketRef.current) {
          socketRef.current.emit('request-offer', { sessionId: id });
        }
      }
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const stopVideo = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsVideoOn(false);
    setIsMicOn(false);
  };

  const toggleVideo = () => {
    if (isVideoOn) {
      stopVideo();
    } else {
      startVideo();
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        
        // Remove screen track from peer connection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          senders.forEach(sender => {
            if (sender.track && sender.track.kind === 'video' && sender.track !== localStream?.getVideoTracks()[0]) {
              peerConnectionRef.current.removeTrack(sender);
            }
          });
        }
        
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false
        });
        
        setScreenStream(stream);
        
        // Add screen track to peer connection
        if (peerConnectionRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            peerConnectionRef.current.addTrack(videoTrack, stream);
          }
        }
        
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
        
        // Handle user clicking "Stop sharing" in browser
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to share screen');
    }
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socket) {
      socket.emit('code-update', { sessionId: id, code: newCode });
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      user: user?.first_name,
      text: newMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, message]);
    
    if (socket) {
      socket.emit('chat-message', { sessionId: id, message });
    }

    setNewMessage('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', id);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/upload/session-file', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Data-Lite': dataLiteMode.toString()
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        const fileData = {
          id: Date.now(),
          user: user?.first_name,
          fileName: file.name,
          fileUrl: data.fileUrl,
          fileSize: file.size,
          timestamp: new Date().toISOString()
        };
        
        setSharedFiles(prev => [...prev, fileData]);
        
        if (socket) {
          socket.emit('file-shared', { sessionId: id, file: fileData });
        }
        
        toast.success('File shared successfully');
      } else {
        toast.error(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload file');
    }
  };

  const sendReaction = (emoji) => {
    if (socket) {
      socket.emit('reaction', { 
        sessionId: id, 
        emoji: emoji,
        user: user?.first_name 
      });
      setShowEmojiPicker(false);
    }
  };

  // Initialize Fabric canvas
  const initFabricCanvas = () => {
    if (canvasRef.current && !fabricCanvas.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        backgroundColor: '#ffffff'
      });
      
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = brushColor;
      
      // Save initial state for undo/redo
      saveHistory(canvas);

      canvas.on('path:created', (e) => {
        const canvasData = canvas.toJSON();
        if (socket) {
          socket.emit('whiteboard-update', { 
            sessionId: id, 
            content: 'drawing',
            canvasData: canvasData 
          });
        }
        saveHistory(canvas);
      });

      canvas.on('object:added', () => {
        saveHistory(canvas);
      });

      canvas.on('object:modified', () => {
        saveHistory(canvas);
      });

      fabricCanvas.current = canvas;
    }
  };

  const saveHistory = (canvas) => {
    if (!canvas) return;
    const json = canvas.toJSON();
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(json);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndex > 0 && fabricCanvas.current) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      fabricCanvas.current.loadFromJSON(history[newIndex], () => {
        fabricCanvas.current.renderAll();
        if (socket) {
          socket.emit('whiteboard-update', { 
            sessionId: id, 
            content: 'undo',
            canvasData: history[newIndex] 
          });
        }
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && fabricCanvas.current) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      fabricCanvas.current.loadFromJSON(history[newIndex], () => {
        fabricCanvas.current.renderAll();
        if (socket) {
          socket.emit('whiteboard-update', { 
            sessionId: id, 
            content: 'redo',
            canvasData: history[newIndex] 
          });
        }
      });
    }
  };

  // Initialize canvas when whiteboard tab is active
  useEffect(() => {
    if (activeTab === 'whiteboard' && !fabricCanvas.current) {
      setTimeout(initFabricCanvas, 100);
    }
  }, [activeTab]);

  // Update brush settings
  useEffect(() => {
    if (fabricCanvas.current) {
      fabricCanvas.current.freeDrawingBrush.width = brushSize;
      fabricCanvas.current.freeDrawingBrush.color = brushColor;
    }
  }, [brushSize, brushColor]);

  // Whiteboard controls
  const clearCanvas = () => {
    if (fabricCanvas.current) {
      fabricCanvas.current.clear();
      fabricCanvas.current.backgroundColor = '#ffffff';
      const canvasData = fabricCanvas.current.toJSON();
      saveHistory(fabricCanvas.current);
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'canvas cleared',
          canvasData: canvasData 
        });
      }
    }
  };

  const setTool = (tool) => {
    setCurrentTool(tool);
    if (fabricCanvas.current) {
      if (tool === 'pen') {
        fabricCanvas.current.isDrawingMode = true;
        fabricCanvas.current.freeDrawingBrush.width = brushSize;
        fabricCanvas.current.freeDrawingBrush.color = brushColor;
      } else if (tool === 'eraser') {
        fabricCanvas.current.isDrawingMode = true;
        fabricCanvas.current.freeDrawingBrush.width = brushSize * 3;
        fabricCanvas.current.freeDrawingBrush.color = '#ffffff';
      } else {
        fabricCanvas.current.isDrawingMode = false;
      }
    }
  };

  const addLine = () => {
    if (fabricCanvas.current) {
      const line = new fabric.Line([50, 50, 200, 50], {
        stroke: brushColor,
        strokeWidth: brushSize,
        selectable: true
      });
      fabricCanvas.current.add(line);
      fabricCanvas.current.setActiveObject(line);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'line added',
          canvasData: canvasData 
        });
      }
    }
  };

  const addArrow = () => {
    if (fabricCanvas.current) {
      const line = new fabric.Line([50, 50, 200, 50], {
        stroke: brushColor,
        strokeWidth: brushSize,
        selectable: true
      });
      
      const triangle = new fabric.Triangle({
        width: 20,
        height: 20,
        fill: brushColor,
        left: 200,
        top: 40,
        selectable: false
      });
      
      const group = new fabric.Group([line, triangle], {
        selectable: true
      });
      
      fabricCanvas.current.add(group);
      fabricCanvas.current.setActiveObject(group);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'arrow added',
          canvasData: canvasData 
        });
      }
    }
  };

  const addTriangle = () => {
    if (fabricCanvas.current) {
      const triangle = new fabric.Triangle({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: brushSize,
        width: 80,
        height: 80,
        selectable: true
      });
      fabricCanvas.current.add(triangle);
      fabricCanvas.current.setActiveObject(triangle);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'triangle added',
          canvasData: canvasData 
        });
      }
    }
  };

  const addText = () => {
    if (fabricCanvas.current) {
      const text = new fabric.IText('Double click to edit', {
        left: 100,
        top: 100,
        fontFamily: 'Arial',
        fill: brushColor,
        fontSize: 20
      });
      fabricCanvas.current.add(text);
      fabricCanvas.current.setActiveObject(text);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'text added',
          canvasData: canvasData 
        });
      }
    }
  };

  const addRectangle = () => {
    if (fabricCanvas.current) {
      const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: brushSize,
        width: 100,
        height: 60
      });
      fabricCanvas.current.add(rect);
      fabricCanvas.current.setActiveObject(rect);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'rectangle added',
          canvasData: canvasData 
        });
      }
    }
  };

  const addCircle = () => {
    if (fabricCanvas.current) {
      const circle = new fabric.Circle({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: brushSize,
        radius: 40
      });
      fabricCanvas.current.add(circle);
      fabricCanvas.current.setActiveObject(circle);
      saveHistory(fabricCanvas.current);
      
      const canvasData = fabricCanvas.current.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'circle added',
          canvasData: canvasData 
        });
      }
    }
  };

  const downloadCanvas = () => {
    if (fabricCanvas.current) {
      const dataURL = fabricCanvas.current.toDataURL({
        format: 'png',
        quality: 1
      });
      const link = document.createElement('a');
      link.download = `whiteboard-${id}-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const endSession = async () => {
    try {
      await fetch(`/api/sessions/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Lite': dataLiteMode.toString()
        },
        body: JSON.stringify({ status: 'completed' })
      });
      
      // Check for badges
      await fetch('/api/gamification/check-badges', {
        method: 'POST',
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      });

      toast.success('Session completed!');
      window.location.href = '/sessions';
    } catch (error) {
      toast.error('Failed to end session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Session not found</h2>
      </div>
    );
  }

  // Mentee: Check if session is in progress and mentee has joined
  if (user?.user_type === 'mentee') {
    if (session.status !== 'in_progress') {
      return (
        <div className="card text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Waiting for mentor to start the session</h2>
          <p className="text-gray-600 mt-2">You will be notified when the session begins</p>
        </div>
      );
    }
    if (!session.mentee_joined) {
      return (
        <div className="card text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Session is in progress!</h2>
          <p className="text-gray-600 mt-2 mb-4">Your mentor has started the session. Click the button below to join.</p>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/sessions/${id}/join`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Data-Lite': dataLiteMode.toString()
                  }
                });
                const data = await response.json();
                if (data.success) {
                  toast.success('Joined session successfully!');
                  window.location.reload();
                } else {
                  toast.error(data.error || 'Failed to join session');
                }
              } catch (error) {
                console.error('Join error:', error);
                toast.error('Failed to join session');
              }
            }}
            className="btn-primary"
          >
            Join Session
          </button>
        </div>
      );
    }
  }

  // Mentor: Check if session is in progress
  if (user?.user_type === 'mentor' && session.status !== 'in_progress') {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Session not started yet</h2>
        <p className="text-gray-600 mt-2">Start the session to begin the mentorship session</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{session.session_title}</h1>
            <p className="text-gray-600">{session.module_code} - {session.module_name}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`badge ${
              session.status === 'in_progress' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {session.status.replace('_', ' ')}
            </span>
            {session.status === 'in_progress' && (
              <button
                onClick={endSession}
                className="btn-secondary"
              >
                End Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video/Audio Controls */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Local Video */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <span className="text-white text-sm">Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              You
            </div>
          </div>
          
          {/* Remote Video */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <span className="text-white text-sm">Waiting for {user?.user_type === 'mentor' ? 'mentee' : 'mentor'}...</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              {user?.user_type === 'mentor' ? 'Mentee' : 'Mentor'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-lg ${isVideoOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
              title="Toggle Video"
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleMic}
              className={`p-3 rounded-lg ${isMicOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
              title="Toggle Microphone"
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-lg ${isScreenSharing ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}
              title="Share Screen"
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-3 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                title="Reactions"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-2 grid grid-cols-4 gap-2">
                  {['👍', '👏', '❤️', '🎉', '😊', '🤔', '👋', '✅'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="text-2xl hover:bg-gray-100 rounded p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <Users className="h-5 w-5" />
            <span>2 participants</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Collaboration Tools */}
        <div className="lg:col-span-2 card">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setActiveTab('whiteboard')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                activeTab === 'whiteboard' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <PenTool className="h-4 w-4" />
              <span>Whiteboard</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                activeTab === 'code' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Code className="h-4 w-4" />
              <span>Code Editor</span>
            </button>
          </div>

              <div className="h-96 border rounded-lg overflow-hidden">
            {activeTab === 'whiteboard' ? (
              <div className="h-full bg-white">
                {/* Whiteboard Controls */}
                <div className="border-b p-2 flex items-center space-x-2 bg-gray-50 flex-wrap gap-2">
                  {/* Drawing Tools */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setTool('pen')}
                      className={`p-2 rounded ${currentTool === 'pen' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200'}`}
                      title="Pen"
                    >
                      <PenTool className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setTool('eraser')}
                      className={`p-2 rounded ${currentTool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200'}`}
                      title="Eraser"
                    >
                      <Eraser className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  {/* Shapes */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={addLine}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Line"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={addArrow}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Arrow"
                    >
                      ➤
                    </button>
                    <button
                      onClick={addRectangle}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Rectangle"
                    >
                      <div className="w-4 h-3 border-2 border-current"></div>
                    </button>
                    <button
                      onClick={addCircle}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Circle"
                    >
                      <div className="w-4 h-4 border-2 border-current rounded-full"></div>
                    </button>
                    <button
                      onClick={addTriangle}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Triangle"
                    >
                      ▲
                    </button>
                    <button
                      onClick={addText}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Text"
                    >
                      <Type className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  {/* Undo/Redo */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={undo}
                      disabled={historyIndex <= 0}
                      className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo"
                    >
                      <Undo className="h-4 w-4" />
                    </button>
                    <button
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                      className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Redo"
                    >
                      <Redo className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  {/* Color & Size */}
                  <div className="flex items-center space-x-1">
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                      title="Brush Color"
                    />
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-20"
                      title="Brush Size"
                    />
                    <span className="text-xs text-gray-600">{brushSize}px</span>
                  </div>
                  
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={clearCanvas}
                      className="p-2 rounded hover:bg-red-100 text-red-600"
                      title="Clear Canvas"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadCanvas}
                      className="p-2 rounded hover:bg-green-100 text-green-600"
                      title="Download Canvas"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Canvas Area */}
                <div className="h-[calc(100%-52px)] bg-white">
                  <canvas 
                    ref={canvasRef}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <Editor
                height="384px"
                defaultLanguage="javascript"
                value={code}
                onChange={handleCodeChange}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Chat & Files</h3>
          </div>
          
          <div className="h-80 overflow-y-auto mb-4 space-y-2">
            {messages.length === 0 && sharedFiles.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages or files yet</p>
            ) : (
              <>
                {sharedFiles.map(file => (
                  <div key={file.id} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-blue-700">{file.user}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(file.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Paperclip className="h-4 w-4 text-blue-600" />
                      <a 
                        href={file.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {file.fileName}
                      </a>
                      <span className="text-xs text-gray-500">
                        ({(file.fileSize / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </div>
                ))}
                {messages.map(msg => (
                  <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{msg.user}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{msg.text}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex space-x-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => document.getElementById('file-upload').click()}
              className="p-2 rounded hover:bg-gray-100 text-gray-600"
              title="Share File"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="input-field flex-1"
            />
            <button
              onClick={sendMessage}
              className="btn-primary"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualRoom;
