import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { User, Mail, Phone, MapPin, GraduationCap, Award, Upload, Shield, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, setUser } = useAuth();
  const { dataLiteMode } = useDataLite();
  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);
  const [badges, setBadges] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    faculty: '',
    campus: '',
    phone: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const response = await axios.get('/api/users/profile', headers);
      setProfile(response.data.user);
      setModules(response.data.modules);
      setBadges(response.data.badges);
      setFormData({
        first_name: response.data.user.first_name,
        last_name: response.data.user.last_name,
        faculty: response.data.user.faculty,
        campus: response.data.user.campus,
        phone: response.data.user.phone
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const fetchVerificationStatus = async () => {
    try {
      const response = await axios.get('/api/upload/verification-status');
      setVerificationStatus(response.data.verification);
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    }
  };

  useEffect(() => {
    if (user?.user_type === 'mentor') {
      fetchVerificationStatus();
    }
  }, [user]);

  const handleUpdate = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      await axios.put('/api/users/profile', formData, headers);
      setEditing(false);
      fetchProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleTranscriptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('transcript', file);

    setUploadingTranscript(true);
    try {
      const response = await axios.post('/api/upload/transcript', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Data-Lite': dataLiteMode.toString()
        }
      });
      toast.success('Transcript uploaded successfully');
      fetchVerificationStatus();
    } catch (error) {
      toast.error('Failed to upload transcript');
    } finally {
      setUploadingTranscript(false);
    }
  };

  const addModule = async () => {
    const moduleCode = prompt('Enter module code (e.g., CS101):');
    const grade = prompt('Enter your grade (e.g., A, B+, etc.):');
    const semester = prompt('Enter semester completed (e.g., Semester 1):');
    const year = prompt('Enter year completed (e.g., 2023):');

    if (!moduleCode || !grade || !semester || !year) {
      toast.error('All fields are required');
      return;
    }

    try {
      await axios.post('/api/modules/user-modules', {
        module_code: moduleCode,
        grade,
        semester_completed: semester,
        year_completed: parseInt(year)
      });
      toast.success('Module added successfully');
      fetchProfile();
    } catch (error) {
      toast.error('Failed to add module');
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 mt-1">Manage your account and mentorship information</p>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-primary-100 p-4 rounded-full">
              <User className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-gray-600">{profile.student_id}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`badge ${
                  profile.is_mentor_verified 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {profile.is_mentor_verified ? 'Verified Mentor' : 'Pending Verification'}
                </span>
                <span className="badge bg-blue-100 text-blue-800">
                  {profile.user_type}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="btn-secondary"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty</label>
              <select
                value={formData.faculty}
                onChange={(e) => setFormData({...formData, faculty: e.target.value})}
                className="input-field"
              >
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Campus</label>
              <select
                value={formData.campus}
                onChange={(e) => setFormData({...formData, campus: e.target.value})}
                className="input-field"
              >
                <option value="Gweru (Senga)">Gweru (Senga)</option>
                <option value="Zvishavane">Zvishavane</option>
                <option value="Harare">Harare</option>
                <option value="Kwekwe">Kwekwe</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <button onClick={handleUpdate} className="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Faculty</p>
                <p className="font-medium">{profile.faculty}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Campus</p>
                <p className="font-medium">{profile.campus}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{profile.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mentor Verification Section */}
      {user?.user_type === 'mentor' && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Mentor Verification</h3>
          </div>

          {verificationStatus ? (
            <div className={`p-4 rounded-lg ${
              verificationStatus.verification_status === 'approved' 
                ? 'bg-green-50 border border-green-200' 
                : verificationStatus.verification_status === 'rejected'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center space-x-2">
                {verificationStatus.verification_status === 'approved' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {verificationStatus.verification_status === 'rejected' && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                {verificationStatus.verification_status === 'pending' && (
                  <Award className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {verificationStatus.verification_status.charAt(0).toUpperCase() + 
                   verificationStatus.verification_status.slice(1)}
                </span>
              </div>
              {verificationStatus.rejection_reason && (
                <p className="text-sm text-gray-600 mt-2">{verificationStatus.rejection_reason}</p>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Upload your academic transcript to become a verified mentor</p>
              <input
                type="file"
                onChange={handleTranscriptUpload}
                accept=".pdf,.doc,.docx"
                className="hidden"
                id="transcript-upload"
              />
              <label
                htmlFor="transcript-upload"
                className="btn-primary cursor-pointer inline-block"
              >
                {uploadingTranscript ? 'Uploading...' : 'Upload Transcript'}
              </label>
            </div>
          )}
        </div>
      )}

      {/* Modules Section */}
      {user?.user_type === 'mentor' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">My Expertise</h3>
            </div>
            <button onClick={addModule} className="btn-secondary">
              Add Module
            </button>
          </div>

          {modules.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No modules added yet</p>
          ) : (
            <div className="grid gap-3">
              {modules.map(module => (
                <div key={module.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{module.module_code} - {module.module_name}</p>
                    <p className="text-sm text-gray-600">Grade: {module.grade}</p>
                  </div>
                  <span className={`badge ${
                    module.is_verified 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {module.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Badges Section */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Award className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">My Badges</h3>
        </div>

        {badges.length === 0 ? (
          <p className="text-gray-600 text-center py-4">No badges earned yet. Complete sessions to earn badges!</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badges.map(badge => (
              <div key={badge.id} className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg">
                <div className="text-3xl mb-2">{badge.icon}</div>
                <h4 className="font-medium text-sm">{badge.name}</h4>
                <p className="text-xs text-gray-600 mt-1">{badge.points} points</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
