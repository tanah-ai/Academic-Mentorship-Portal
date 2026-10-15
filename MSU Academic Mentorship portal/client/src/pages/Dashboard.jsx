import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { BookOpen, Users, Calendar, Trophy, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };

      // Fetch user stats
      const statsResponse = await axios.get('/api/gamification/stats/' + user.id, headers);
      setStats(statsResponse.data.stats);

      // Fetch recent sessions
      const sessionsResponse = await axios.get('/api/sessions?limit=5', headers);
      setRecentSessions(sessionsResponse.data.sessions);

      // Fetch nudges
      const nudgesResponse = await axios.get('/api/analytics/predictive-nudges', headers);
      setNudges(nudgesResponse.data.nudges);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissNudge = async (nudgeId) => {
    try {
      await axios.put(`/api/analytics/nudges/${nudgeId}/dismiss`);
      setNudges(nudges.filter(n => n.id !== nudgeId));
      toast.success('Nudge dismissed');
    } catch (error) {
      toast.error('Failed to dismiss nudge');
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
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.first_name}!</h1>
          <p className="text-gray-600 mt-1">Your academic mentorship dashboard</p>
        </div>
        {dataLiteMode && (
          <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
            <Clock className="h-4 w-4" />
            <span>Data-Lite Mode Active</span>
          </div>
        )}
      </div>

      {/* Predictive Nudges */}
      {nudges.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Personalized Recommendations</h3>
          </div>
          <div className="space-y-2">
            {nudges.map(nudge => (
              <div key={nudge.id} className="flex items-start justify-between bg-white rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{nudge.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{nudge.module_code}</p>
                </div>
                <button
                  onClick={() => dismissNudge(nudge.id)}
                  className="text-gray-400 hover:text-gray-600 ml-4"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_sessions || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reputation Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.reputation_score || 0}</p>
            </div>
            <Trophy className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Badges Earned</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.badge_count || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.average_rating?.toFixed(1) || '0.0'}</p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={() => navigate('/find-mentor')}
          className="card w-full text-left cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Find a Mentor</h3>
              <p className="text-sm text-gray-600">Get help with your modules</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/sessions')}
          className="card w-full text-left cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">My Sessions</h3>
              <p className="text-sm text-gray-600">View upcoming sessions</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          className="card w-full text-left cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Leaderboard</h3>
              <p className="text-sm text-gray-600">Top mentors this week</p>
            </div>
          </div>
        </button>
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No sessions yet. Start by finding a mentor!</p>
        ) : (
          <div className="space-y-3">
            {recentSessions.slice(0, 5).map(session => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{session.session_title}</h3>
                  <p className="text-sm text-gray-600">{session.module_code} - {session.module_name}</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${
                    session.status === 'completed' ? 'bg-green-100 text-green-800' :
                    session.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
