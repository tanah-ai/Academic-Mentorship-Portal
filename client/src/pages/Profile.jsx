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
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [availableModules, setAvailableModules] = useState([]);
  const [moduleForm, setModuleForm] = useState({
    module_code: '',
    grade: '',
    semester_completed: '',
    year_completed: ''
  });
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    email: '',
    faculty: '',
    campus: '',
    phone: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user?.user_type === 'mentor') {
      fetchAvailableModules();
    }
  }, [user]);

  const fetchAvailableModules = async () => {
    try {
      const response = await axios.get('/api/modules');
      setAvailableModules(response.data.modules);
    } catch (error) {
      console.error('Failed to load modules:', error);
      toast.error('Failed to load module catalogue');
    }
  };

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
        student_id: response.data.user.student_id,
        first_name: response.data.user.first_name,
        last_name: response.data.user.last_name,
        email: response.data.user.email,
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
      console.log('Sending profile update:', formData);
      const response = await axios.put('/api/users/profile', formData, headers);
      console.log('Profile update response:', response.data);
      setEditing(false);
      fetchProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to update profile';
      toast.error(errorMessage);
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

  const addModule = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/modules/user-modules', {
        ...moduleForm,
        year_completed: parseInt(moduleForm.year_completed, 10)
      });
      toast.success('Module added successfully');
      setModuleForm({
        module_code: '',
        grade: '',
        semester_completed: '',
        year_completed: ''
      });
      setShowModuleForm(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add module');
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
              <input
                type="text"
                value={formData.student_id}
                onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                className="input-field"
                placeholder="e.g., R234567A"
              />
              <p className="text-xs text-gray-500 mt-1">Format: R + year + number + letter (e.g., R234567A)</p>
            </div>
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Must be a valid MSU student email (@students.msu.ac.zw)</p>
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
              <input
                type="file"
                onChange={handleTranscriptUpload}
                accept=".pdf,.doc,.docx"
                className="hidden"
                id="replace-transcript-upload"
              />
              <label
                htmlFor="replace-transcript-upload"
                className="btn-secondary cursor-pointer inline-block mt-4"
              >
                {uploadingTranscript ? 'Uploading...' : 'Replace Transcript'}
              </label>
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
            <button onClick={() => setShowModuleForm(!showModuleForm)} className="btn-secondary">
              {showModuleForm ? 'Cancel' : 'Add Module'}
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Add each module you can teach. Transcript approval verifies you as a mentor; these modules tell mentees what help you provide.
          </p>

          {showModuleForm && (
            <form onSubmit={addModule} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Module</label>
                <select
                  value={moduleForm.module_code}
                  onChange={(e) => setModuleForm({ ...moduleForm, module_code: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select a module</option>
                  {availableModules
                    .filter(module => !modules.some(existing => existing.module_code === module.module_code))
                    .map(module => (
                      <option key={module.id} value={module.module_code}>
                        {module.module_code} - {module.module_name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                <select
                  value={moduleForm.grade}
                  onChange={(e) => setModuleForm({ ...moduleForm, grade: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select grade</option>
                  <option value="A">Distinction</option>
                  <option value="2.1">2.1</option>
                  <option value="2.2">2.2</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester completed</label>
                <select
                  value={moduleForm.semester_completed}
                  onChange={(e) => setModuleForm({ ...moduleForm, semester_completed: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select semester</option>
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year completed</label>
                <input
                  type="number"
                  min="2000"
                  max={new Date().getFullYear()}
                  value={moduleForm.year_completed}
                  onChange={(e) => setModuleForm({ ...moduleForm, year_completed: e.target.value })}
                  className="input-field"
                  placeholder="2026"
                  required
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn-primary">Save Module</button>
              </div>
            </form>
          )}

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
