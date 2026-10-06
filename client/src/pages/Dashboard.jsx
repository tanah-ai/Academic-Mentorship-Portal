import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { BookOpen, Users, Calendar, Trophy, AlertCircle, TrendingUp, Clock, Upload, CheckCircle, XCircle, FileText, Award, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import msuLogo from '/msu-logo.png?url';

const Dashboard = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState([]);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const certificateRef = useRef(null);

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

      // Fetch user badges
      const badgesResponse = await axios.get('/api/gamification/user-badges', headers);
      setUserBadges(badgesResponse.data.badges);

      if (user?.user_type === 'mentor') {
        const verificationResponse = await axios.get('/api/upload/verification-status');
        setVerificationStatus(verificationResponse.data.verification);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('transcript', file);
    setUploadingTranscript(true);

    try {
      await axios.post('/api/upload/transcript', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const response = await axios.get('/api/upload/verification-status');
      setVerificationStatus(response.data.verification);
      toast.success('Transcript uploaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload transcript');
    } finally {
      setUploadingTranscript(false);
      event.target.value = '';
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

  const handleViewCertificate = async () => {
    try {
      const response = await axios.get(`/api/gamification/certificate/${user.id}`);
      setCertificateData(response.data.certificate);
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
      link.download = `certificate-${user.first_name}-${user.last_name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('Certificate downloaded successfully');
    } catch (error) {
      console.error('Failed to download certificate:', error);
      toast.error('Failed to download certificate');
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

      {user?.user_type === 'mentor' && (
        <div className="card border-l-4 border-primary-600">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Mentor verification</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload your academic transcript so an administrator can confirm your eligibility to teach mentees.
              </p>
            </div>
            {user.is_mentor_verified && (
              <CheckCircle className="h-7 w-7 text-green-600 flex-shrink-0" />
            )}
          </div>

          {user.is_mentor_verified || verificationStatus?.verification_status === 'approved' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
              Your mentor account is verified. You can now teach mentees.
            </div>
          ) : verificationStatus?.verification_status === 'pending' ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              Your transcript is under review. You will be able to teach mentees after approval.
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              {verificationStatus?.verification_status === 'rejected' && (
                <p className="text-sm text-red-700 mb-3">
                  Your previous transcript was rejected{verificationStatus.rejection_reason ? `: ${verificationStatus.rejection_reason}` : '.'} Upload a new copy to try again.
                </p>
              )}
              <label htmlFor="dashboard-transcript-upload" className="btn-primary cursor-pointer inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {uploadingTranscript ? 'Uploading...' : 'Upload Transcript'}
              </label>
              <input
                id="dashboard-transcript-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleTranscriptUpload}
                disabled={uploadingTranscript}
                className="hidden"
              />
              <p className="text-xs text-gray-600 mt-2">PDF, DOC, or DOCX, maximum 5 MB.</p>
            </div>
          )}
        </div>
      )}

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
          onClick={() => navigate(user?.user_type === 'mentor' ? '/profile' : '/find-mentor')}
          className="card w-full text-left cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              {user?.user_type === 'mentor' ? (
                <FileText className="h-6 w-6 text-blue-600" />
              ) : (
                <BookOpen className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {user?.user_type === 'mentor' ? 'Manage Expertise' : 'Find a Mentor'}
              </h3>
              <p className="text-sm text-gray-600">
                {user?.user_type === 'mentor' ? 'Add modules you can teach' : 'Get help with your modules'}
              </p>
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

      {/* Badges Section */}
      {user?.user_type === 'mentor' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900">My Badges</h2>
            </div>
            {userBadges.length > 0 && (
              <button
                onClick={handleViewCertificate}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>View Certificate</span>
              </button>
            )}
          </div>
          {userBadges.length === 0 ? (
            <div className="text-center py-8">
              <Award className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600">No badges earned yet. Keep mentoring to earn badges!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {userBadges.map(badge => (
                <div key={badge.id} className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <span className="text-4xl mb-2 block">{badge.icon}</span>
                  <h3 className="font-semibold text-gray-900 mb-1">{badge.name}</h3>
                  <p className="text-xs text-gray-600 mb-2">{badge.description}</p>
                  <p className="text-sm font-bold text-primary-600">{badge.points} points</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Earned: {new Date(badge.earned_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && certificateData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Your Achievement Certificate</h3>
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

export default Dashboard;
