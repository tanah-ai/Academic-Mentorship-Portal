import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { Users, Calendar, BookOpen, TrendingUp, FileText, CheckCircle, XCircle, Clock, BarChart3, Trash2, Award, Download, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import msuLogo from '/msu-logo.png?url';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const [dashboard, setDashboard] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleForm, setModuleForm] = useState({
    module_code: '',
    module_name: '',
    faculty: '',
    level: '',
    semester: '',
    credits: '',
    description: ''
  });
  const [mentorsWithBadges, setMentorsWithBadges] = useState([]);
  const [badges, setBadges] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const certificateRef = useRef(null);

  useEffect(() => {
    if (user?.user_type !== 'admin') {
      toast.error('Access denied. Admin only.');
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (user?.user_type === 'admin' && activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, userSearch, userTypeFilter]);

  useEffect(() => {
    if (user?.user_type === 'admin' && activeTab === 'modules') {
      fetchModules();
    }
  }, [activeTab]);

  useEffect(() => {
    if (user?.user_type === 'admin' && activeTab === 'badges') {
      fetchMentorsWithBadges();
      fetchBadges();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = {};
      if (userSearch) params.search = userSearch;
      if (userTypeFilter) params.user_type = userTypeFilter;

      const response = await axios.get('/api/users', { params });
      setUsers(response.data.users);
      setUsersTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load registered users');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchModules = async () => {
    setModulesLoading(true);
    try {
      const response = await axios.get('/api/modules');
      setModules(response.data.modules);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
      toast.error('Failed to load modules');
    } finally {
      setModulesLoading(false);
    }
  };

  const fetchMentorsWithBadges = async () => {
    try {
      const response = await axios.get('/api/gamification/mentors-with-badges');
      setMentorsWithBadges(response.data.mentors);
    } catch (error) {
      console.error('Failed to fetch mentors with badges:', error);
      toast.error('Failed to load mentors');
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await axios.get('/api/gamification/badges');
      setBadges(response.data.badges);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
      toast.error('Failed to load badges');
    }
  };

  const handleModuleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/modules', moduleForm);
      toast.success('Module added successfully');
      setShowModuleForm(false);
      setModuleForm({
        module_code: '',
        module_name: '',
        faculty: '',
        level: '',
        semester: '',
        credits: '',
        description: ''
      });
      fetchModules();
    } catch (error) {
      console.error('Failed to add module:', error);
      toast.error(error.response?.data?.error || 'Failed to add module');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    
    try {
      await axios.delete(`/api/modules/${moduleId}`);
      toast.success('Module deleted successfully');
      fetchModules();
    } catch (error) {
      console.error('Failed to delete module:', error);
      toast.error('Failed to delete module');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone and will delete all their data including sessions, modules, and badges.`)) return;
    
    try {
      await axios.delete(`/api/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleAwardBadge = async () => {
    if (!selectedMentor || !selectedBadge) return;

    try {
      await axios.post('/api/gamification/award-badge', {
        user_id: selectedMentor.id,
        badge_id: selectedBadge.id
      });
      toast.success('Badge awarded successfully');
      setShowAwardModal(false);
      setSelectedMentor(null);
      setSelectedBadge(null);
      fetchMentorsWithBadges();
    } catch (error) {
      console.error('Failed to award badge:', error);
      toast.error(error.response?.data?.error || 'Failed to award badge');
    }
  };

  const handleRevokeBadge = async (userId, badgeId) => {
    if (!confirm('Are you sure you want to revoke this badge?')) return;

    try {
      await axios.delete('/api/gamification/revoke-badge', {
        data: { user_id: userId, badge_id: badgeId }
      });
      toast.success('Badge revoked successfully');
      fetchMentorsWithBadges();
    } catch (error) {
      console.error('Failed to revoke badge:', error);
      toast.error(error.response?.data?.error || 'Failed to revoke badge');
    }
  };

  const handleGenerateCertificate = async (userId) => {
    try {
      const response = await axios.get(`/api/gamification/certificate/${userId}`);
      const certificate = response.data.certificate;
      setCertificateData(certificate);
      setShowCertificateModal(true);
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      toast.error(error.response?.data?.error || 'Failed to generate certificate');
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificateRef.current) return;

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.download = `certificate-${certificateData.mentor_name.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('Certificate downloaded successfully');
    } catch (error) {
      console.error('Failed to download certificate:', error);
      toast.error('Failed to download certificate');
    }
  };

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
      console.log('Verifying:', verificationId, status, rejectionReason);
      const response = await axios.post(`/api/upload/verify/${verificationId}`, {
        status,
        rejection_reason: rejectionReason
      });
      const moduleMessage = status === 'approved' && response.data.modules_added !== undefined
        ? ` (${response.data.modules_added} eligible modules added)`
        : '';
      toast.success(`Verification ${status}${moduleMessage}`);
      fetchDashboardData();
    } catch (error) {
      console.error('Verification error:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to process verification');
    }
  };

  const generateNudges = async () => {
    try {
      const response = await axios.post('/api/analytics/generate-nudges');
      const { nudges_created, high_demand_modules } = response.data;
      
      if (nudges_created === 0 && high_demand_modules === 0) {
        toast('No nudges generated. Users need to search for mentors first (3+ searches in 7 days without booking).');
      } else {
        toast.success(`Generated ${nudges_created} nudges and identified ${high_demand_modules} high-demand modules`);
      }
    } catch (error) {
      console.error('Generate nudges error:', error);
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
      <div className="flex space-x-2 flex-wrap gap-2">
        {['overview', 'users', 'modules', 'verifications', 'analytics', 'badges'].map(tab => (
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

      {activeTab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Registered Users ({usersTotal})</h3>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, or student ID..."
                className="input-field"
              />
              <select
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value)}
                className="input-field"
              >
                <option value="">All Types</option>
                <option value="mentee">Mentee</option>
                <option value="mentor">Mentor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No registered users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Student ID</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Faculty</th>
                    <th className="px-4 py-2">Campus</th>
                    <th className="px-4 py-2">Verified</th>
                    <th className="px-4 py-2">Registered</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="text-sm">
                      <td className="px-4 py-2 font-medium text-gray-900">{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-2 text-gray-600">{u.student_id}</td>
                      <td className="px-4 py-2 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.user_type === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.user_type === 'mentor' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {u.user_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{u.faculty || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{u.campus || '—'}</td>
                      <td className="px-4 py-2">
                        {u.is_verified ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Manage Modules ({modules.length})</h3>
            </div>
            <button
              onClick={() => setShowModuleForm(!showModuleForm)}
              className="btn-primary"
            >
              {showModuleForm ? 'Cancel' : 'Add Module'}
            </button>
          </div>

          {showModuleForm && (
            <form onSubmit={handleModuleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Module Code</label>
                  <input
                    type="text"
                    value={moduleForm.module_code}
                    onChange={(e) => setModuleForm({...moduleForm, module_code: e.target.value})}
                    className="input-field"
                    placeholder="e.g., CS101"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
                  <input
                    type="text"
                    value={moduleForm.module_name}
                    onChange={(e) => setModuleForm({...moduleForm, module_name: e.target.value})}
                    className="input-field"
                    placeholder="e.g., Introduction to Computer Science"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                  <select
                    value={moduleForm.faculty}
                    onChange={(e) => setModuleForm({...moduleForm, faculty: e.target.value})}
                    className="input-field"
                    required
                  >
                    <option value="">Select Faculty</option>
                    <option value="Science and Technology">Science and Technology</option>
                    <option value="Business Sciences">Business Sciences</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Social Sciences">Social Sciences</option>
                    <option value="Arts">Arts</option>
                    <option value="Education">Education</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Medicine">Medicine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    value={moduleForm.level}
                    onChange={(e) => setModuleForm({...moduleForm, level: e.target.value})}
                    className="input-field"
                    required
                  >
                    <option value="">Select Level</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                    <option value="4">Level 4</option>
                    <option value="5">Level 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={moduleForm.semester}
                    onChange={(e) => setModuleForm({...moduleForm, semester: e.target.value})}
                    className="input-field"
                    required
                  >
                    <option value="">Select Semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                  <input
                    type="number"
                    value={moduleForm.credits}
                    onChange={(e) => setModuleForm({...moduleForm, credits: e.target.value})}
                    className="input-field"
                    placeholder="e.g., 3"
                    min="1"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({...moduleForm, description: e.target.value})}
                    className="input-field"
                    placeholder="Module description..."
                    rows="2"
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary mt-4">
                Add Module
              </button>
            </form>
          )}

          {modulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : modules.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No modules found. Add your first module above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Faculty</th>
                    <th className="px-4 py-2">Level</th>
                    <th className="px-4 py-2">Semester</th>
                    <th className="px-4 py-2">Credits</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modules.map((module) => (
                    <tr key={module.id} className="text-sm">
                      <td className="px-4 py-2 font-medium text-gray-900">{module.module_code}</td>
                      <td className="px-4 py-2 text-gray-600">{module.module_name}</td>
                      <td className="px-4 py-2 text-gray-600">{module.faculty}</td>
                      <td className="px-4 py-2 text-gray-600">Level {module.level}</td>
                      <td className="px-4 py-2 text-gray-600">Semester {module.semester}</td>
                      <td className="px-4 py-2 text-gray-600">{module.credits}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

      {activeTab === 'badges' && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Award className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Mentor Badges & Certificates</h3>
          </div>

          {mentorsWithBadges.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No verified mentors found</p>
          ) : (
            <div className="space-y-4">
              {mentorsWithBadges.map((mentor) => (
                <div key={mentor.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{mentor.first_name} {mentor.last_name}</h4>
                      <p className="text-sm text-gray-600">{mentor.student_id}</p>
                      <p className="text-sm text-gray-600">{mentor.faculty}</p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-center">
                        <p className="font-bold text-primary-600">{mentor.total_sessions}</p>
                        <p className="text-gray-600">Sessions</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-green-600">{mentor.reputation_score}</p>
                        <p className="text-gray-600">Reputation</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-purple-600">{mentor.badge_count}</p>
                        <p className="text-gray-600">Badges</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Badges Earned:</p>
                    {mentor.badges && mentor.badges.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {mentor.badges.map((badge) => (
                          <div key={badge.id} className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                            <span className="text-2xl">{badge.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-yellow-900">{badge.name}</p>
                              <p className="text-xs text-yellow-700">{badge.points} points</p>
                            </div>
                            <button
                              onClick={() => handleRevokeBadge(mentor.id, badge.id)}
                              className="text-red-500 hover:text-red-700 ml-2"
                              title="Revoke badge"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No badges earned yet</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedMentor(mentor);
                        setShowAwardModal(true);
                      }}
                      className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Award Badge</span>
                    </button>
                    <button
                      onClick={() => handleGenerateCertificate(mentor.id)}
                      className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Generate Certificate</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Award Badge Modal */}
      {showAwardModal && selectedMentor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Award Badge to {selectedMentor.first_name} {selectedMentor.last_name}</h3>
            
            {badges.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No badges available. Please create badges in the database first.</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-600">Click on a badge to select it:</p>
                  {badges.map((badge) => {
                    const hasBadge = selectedMentor.badges && selectedMentor.badges.some(b => b.id === badge.id);
                    const isSelected = selectedBadge?.id === badge.id;
                    return (
                      <button
                        key={badge.id}
                        onClick={() => setSelectedBadge(badge)}
                        disabled={hasBadge}
                        className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600' 
                            : hasBadge 
                              ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-primary-400 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-2xl">{badge.icon}</span>
                        <div className="text-left flex-1">
                          <p className="font-medium">{badge.name}</p>
                          <p className="text-sm text-gray-600">{badge.description}</p>
                          <p className="text-xs text-primary-600">{badge.points} points</p>
                        </div>
                        {isSelected && <span className="text-primary-600">✓</span>}
                        {hasBadge && <span className="ml-auto text-xs text-gray-500">Already earned</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowAwardModal(false);
                      setSelectedMentor(null);
                      setSelectedBadge(null);
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAwardBadge}
                    disabled={!selectedBadge}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Award Badge
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && certificateData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Certificate Preview</h3>
              <button
                onClick={() => {
                  setShowCertificateModal(false);
                  setCertificateData(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div ref={certificateRef} className="border-8 border-double border-yellow-600 p-8 bg-gradient-to-br from-yellow-50 to-white">
              {/* Header */}
              <div className="text-center mb-6">
                <img src={msuLogo} alt="MSU Logo" className="h-20 w-auto mx-auto mb-4" onError={(e) => e.target.style.display = 'none'} />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">CERTIFICATE OF ACHIEVEMENT</h1>
                <div className="w-64 h-1 bg-gradient-to-r from-yellow-600 to-yellow-400 mx-auto"></div>
              </div>

              {/* Content */}
              <div className="text-center mb-8">
                <p className="text-lg text-gray-700 mb-4">This is to certify that</p>
                <h2 className="text-4xl font-bold text-primary-800 mb-6" style={{ fontFamily: 'Georgia, serif' }}>
                  {certificateData.mentor_name}
                </h2>
                <p className="text-lg text-gray-700 mb-6">
                  Student ID: <span className="font-semibold">{certificateData.student_id}</span>
                </p>
                <p className="text-lg text-gray-700 mb-6">
                  Faculty of <span className="font-semibold">{certificateData.faculty}</span>
                </p>
                <p className="text-lg text-gray-700 mb-8">
                  Has successfully demonstrated excellence in mentorship by completing
                  <span className="font-bold text-primary-600 mx-2">{certificateData.total_sessions}</span>
                  mentorship sessions with a reputation score of
                  <span className="font-bold text-primary-600 mx-2">{certificateData.reputation_score}</span>
                  and earning
                  <span className="font-bold text-primary-600 mx-2">{certificateData.badges_earned}</span>
                  achievement badges.
                </p>
              </div>

              {/* Footer */}
              <div className="grid grid-cols-2 gap-8 mt-12">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Date Awarded</p>
                  <p className="font-semibold text-gray-900">{new Date(certificateData.issue_date).toLocaleDateString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Certificate ID</p>
                  <p className="font-semibold text-gray-900">{certificateData.certificate_id}</p>
                </div>
              </div>

              {/* Verification */}
              <div className="mt-8 pt-6 border-t border-gray-300 text-center">
                <p className="text-sm text-gray-600">
                  Verify this certificate at: <span className="text-primary-600 font-medium">{certificateData.verification_url}</span>
                </p>
              </div>

              {/* Decorative corners */}
              <div className="absolute top-4 left-4 text-yellow-600 text-4xl">❖</div>
              <div className="absolute top-4 right-4 text-yellow-600 text-4xl">❖</div>
              <div className="absolute bottom-4 left-4 text-yellow-600 text-4xl">❖</div>
              <div className="absolute bottom-4 right-4 text-yellow-600 text-4xl">❖</div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCertificateModal(false);
                  setCertificateData(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleDownloadCertificate}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download as Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
