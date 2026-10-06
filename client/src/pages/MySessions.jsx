import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { Calendar, Clock, User, MessageSquare, Star, Play } from 'lucide-react';
import toast from 'react-hot-toast';

const MySessions = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const role = user?.user_type === 'mentor' ? 'mentor' : 'mentee';
      const response = await axios.get(`/api/sessions?role=${role}&status=${filter !== 'all' ? filter : ''}`, headers);
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const updateSessionStatus = async (sessionId, status) => {
    try {
      await axios.put(`/api/sessions/${sessionId}/status`, { status });
      toast.success(`Session ${status}`);
      fetchSessions();
    } catch (error) {
      toast.error('Failed to update session');
    }
  };

  const joinSession = async (sessionId) => {
    try {
      await axios.post(`/api/sessions/${sessionId}/join`);
      toast.success('Joined session');
      window.location.href = `/session/${sessionId}`;
    } catch (error) {
      toast.error('Failed to join session');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Sessions</h1>
          <p className="text-gray-600 mt-1">Manage your mentorship sessions</p>
        </div>
        <div className="flex space-x-2">
          {['all', 'scheduled', 'in_progress', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sessions Found</h3>
          <p className="text-gray-600 mb-4">
            {filter === 'all' 
              ? "You haven't participated in any sessions yet." 
              : `No ${filter} sessions found.`}
          </p>
          <button
            onClick={() => window.location.href = '/find-mentor'}
            className="btn-primary"
          >
            Find a Mentor
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map(session => (
            <div key={session.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary-100 p-3 rounded-lg">
                      <Calendar className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{session.session_title}</h3>
                      <p className="text-gray-600 mt-1">
                        {session.module_code} - {session.module_name}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(session.scheduled_date).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>
                            {user?.user_type === 'mentor' 
                              ? `Mentee: ${session.mentee_first_name} ${session.mentee_last_name}`
                              : `Mentor: ${session.mentor_first_name} ${session.mentor_last_name}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                  <span className={`badge ${getStatusColor(session.status)}`}>
                    {session.status.replace('_', ' ')}
                  </span>
                  
                  {session.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => updateSessionStatus(session.id, 'in_progress')}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        <span className="hidden sm:inline">Start</span>
                      </button>
                      <button
                        onClick={() => joinSession(session.id)}
                        className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Join</span>
                      </button>
                    </>
                  )}

                  {session.status === 'in_progress' && (
                    <button
                      onClick={() => window.location.href = `/session/${session.id}`}
                      className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline">Continue</span>
                    </button>
                  )}

                  {session.status === 'completed' && (
                    <button
                      onClick={() => window.location.href = `/session/${session.id}`}
                      className="flex items-center space-x-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Star className="h-4 w-4" />
                      <span className="hidden sm:inline">Rate</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySessions;
