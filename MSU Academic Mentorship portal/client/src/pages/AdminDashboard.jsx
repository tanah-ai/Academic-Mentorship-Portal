import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { Users, Calendar, BookOpen, TrendingUp, FileText, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const [dashboard, setDashboard] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user?.user_type !== 'admin') {
      toast.error('Access denied. Admin only.');
      return;
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      
      const [dashboardRes, verificationsRes] = await Promise.all([
        axios.get('/api/analytics/dashboard', headers),
        axios.get('/api/upload/pending-verifications', headers)
      ]);

      setDashboard(dashboardRes.data.dashboard);
      setPendingVerifications(verificationsRes.data.verifications);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (verificationId, status) => {
    const rejectionReason = status === 'rejected' ? prompt('Enter rejection reason:') : null;
    
    try {
      await axios.post(`/api/upload/verify/${verificationId}`, {
        status,
        rejection_reason: rejectionReason
      });
      toast.success(`Verification ${status}`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to process verification');
    }
  };

  const generateNudges = async () => {
    try {
      await axios.post('/api/analytics/generate-nudges');
      toast.success('Predictive nudges generated successfully');
    } catch (error) {
      toast.error('Failed to generate nudges');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (user?.user_type !== 'admin') {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-gray-600 mt-2">This page is for administrators only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and manage the mentorship platform</p>
        </div>
        <button
          onClick={generateNudges}
          className="btn-primary flex items-center space-x-2"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Generate Nudges</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2">
        {['overview', 'verifications', 'analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && dashboard && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.total_users}</p>
                </div>
                <Users className="h-8 w-8 text-primary-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.total_sessions?.count || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Mentors</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.active_mentors}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.total_sessions?.completed || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* High Demand Modules */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">High Demand Modules</h3>
            </div>
            {dashboard.module_demand?.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-3">
                {dashboard.module_demand.map((module, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{module.module_code} - {module.module_name}</p>
                      <p className="text-sm text-gray-600">{module.faculty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-600">{module.search_count}</p>
                      <p className="text-xs text-gray-600">searches</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            </div>
            {dashboard.recent_activity?.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {dashboard.recent_activity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                    <div className="bg-primary-100 p-2 rounded">
                      <BarChart3 className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.first_name} {activity.last_name}</span>
                        <span className="text-gray-600 ml-2">{activity.event_type.replace('_', ' ')}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'verifications' && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Pending Transcript Verifications</h3>
          </div>

          {pendingVerifications.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-gray-600">No pending verifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map(verification => (
                <div key={verification.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{verification.first_name} {verification.last_name}</h4>
                      <p className="text-sm text-gray-600">{verification.student_id}</p>
                      <p className="text-sm text-gray-600">{verification.email}</p>
                      <div className="flex items-center space-x-2 mt-2 text-sm text-gray-500">
                        <FileText className="h-4 w-4" />
                        <span>{verification.file_name}</span>
                        <span>({(verification.file_size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Uploaded: {new Date(verification.upload_date).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleVerification(verification.id, 'approved')}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleVerification(verification.id, 'rejected')}
                        className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Platform Analytics</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Session Completion Rate</h4>
              <p className="text-3xl font-bold text-blue-600">
                {dashboard.total_sessions?.count > 0 
                  ? ((dashboard.total_sessions.completed / dashboard.total_sessions.count) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Active Sessions</h4>
              <p className="text-3xl font-bold text-green-600">
                {dashboard.total_sessions?.scheduled || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
