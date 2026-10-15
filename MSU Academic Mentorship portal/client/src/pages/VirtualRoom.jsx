import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { fabric } from 'fabric';
import { PenTool, Code, MessageSquare, Users, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Send, Trash2, Download, Upload } from 'lucide-react';
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
  const [code, setCode] = useState('// Start coding here...\n');
  const [whiteboardData, setWhiteboardData] = useState('');
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Whiteboard state
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);

  useEffect(() => {
    fetchSession();
    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [id]);

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
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-session', id);
    });

    newSocket.on('whiteboard-update', (data) => {
      setWhiteboardData(data.content);
      if (fabricCanvas && data.canvasData) {
        fabricCanvas.loadFromJSON(data.canvasData, () => {
          fabricCanvas.renderAll();
        });
      }
    });

    newSocket.on('code-update', (data) => {
      setCode(data.code);
    });

    newSocket.on('chat-message', (data) => {
      setMessages(prev => [...prev, data]);
    });
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

  // Initialize Fabric canvas
  const initFabricCanvas = () => {
    if (canvasRef.current && !fabricCanvas) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        backgroundColor: '#ffffff'
      });
      
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = brushColor;
      
      // Sync canvas changes via socket
      canvas.on('path:created', () => {
        const canvasData = canvas.toJSON();
        if (socket) {
          socket.emit('whiteboard-update', { 
            sessionId: id, 
            content: 'canvas updated',
            canvasData: canvasData 
          });
        }
      });

      canvas.on('object:modified', () => {
        const canvasData = canvas.toJSON();
        if (socket) {
          socket.emit('whiteboard-update', { 
            sessionId: id, 
            content: 'canvas updated',
            canvasData: canvasData 
          });
        }
      });

      setFabricCanvas(canvas);
    }
  };

  // Initialize canvas when whiteboard tab is active
  useEffect(() => {
    if (activeTab === 'whiteboard' && !fabricCanvas) {
      setTimeout(initFabricCanvas, 100);
    }
  }, [activeTab, fabricCanvas]);

  // Update brush settings
  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas.freeDrawingBrush.width = brushSize;
      fabricCanvas.freeDrawingBrush.color = brushColor;
    }
  }, [brushSize, brushColor, fabricCanvas]);

  // Whiteboard controls
  const clearCanvas = () => {
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = '#ffffff';
      const canvasData = fabricCanvas.toJSON();
      if (socket) {
        socket.emit('whiteboard-update', { 
          sessionId: id, 
          content: 'canvas cleared',
          canvasData: canvasData 
        });
      }
    }
  };

  const addText = () => {
    if (fabricCanvas) {
      const text = new fabric.IText('Double click to edit', {
        left: 100,
        top: 100,
        fontFamily: 'Arial',
        fill: brushColor,
        fontSize: 20
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      
      const canvasData = fabricCanvas.toJSON();
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
    if (fabricCanvas) {
      const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
        width: 100,
        height: 60
      });
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      
      const canvasData = fabricCanvas.toJSON();
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
    if (fabricCanvas) {
      const circle = new fabric.Circle({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
        radius: 40
      });
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
      
      const canvasData = fabricCanvas.toJSON();
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
    if (fabricCanvas) {
      const dataURL = fabricCanvas.toDataURL({
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-3 rounded-lg ${isVideoOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-3 rounded-lg ${isMicOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
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
                <div className="border-b p-2 flex items-center space-x-2 bg-gray-50">
                  <div className="flex items-center space-x-1">
                    <button
                      className="p-2 rounded bg-blue-100 text-blue-600"
                      title="Pen"
                    >
                      <PenTool className="h-4 w-4" />
                    </button>
                    <button
                      onClick={addText}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Text"
                    >
                      <span className="font-bold text-sm">T</span>
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
                  </div>
                  
                  <div className="h-6 w-px bg-gray-300"></div>
                  
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
            <h3 className="font-semibold text-gray-900">Chat</h3>
          </div>
          
          <div className="h-80 overflow-y-auto mb-4 space-y-2">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{msg.user}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex space-x-2">
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
