import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Mail, Lock, User, GraduationCap, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import msuLogo from '/msu-logo.png?url';

const Register = () => {
  const [formData, setFormData] = useState({
    student_id: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_type: 'mentee',
    faculty: '',
    campus: '',
    phone: '',
    student_level: '1',
    year_of_study: '1'
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Submitting registration:', formData);
      await register(formData);
      toast.success('Registration successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response?.data);
      
      // Handle validation errors array
      if (error.response?.data?.errors && Array.isArray(error.response?.data?.errors)) {
        const firstError = error.response.data.errors[0];
        toast.error(firstError.msg || 'Registration failed. Please check your input.');
        return;
      }
      
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      
      // Show specific error messages based on the error
      if (errorMessage.includes('Invalid MSU student ID format')) {
        toast.error('Invalid Student ID format. Use format: R + 2-digit year + 4-digit number + letter (e.g., R234567A)');
      } else if (errorMessage.includes('students.msu.ac.zw')) {
        toast.error('Registration is only available for MSU students with @students.msu.ac.zw email addresses');
      } else if (errorMessage.includes('Password must be')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('User already exists')) {
        toast.error('An account with this Student ID or email already exists. Please login instead.');
      } else if (errorMessage.includes('Mentors must be Level 2')) {
        toast.error('Mentors must be Level 2 or above. Please select a different user type or level.');
      } else if (errorMessage.includes('Too many requests')) {
        toast.error('Too many registration attempts. Please wait a few minutes and try again.');
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a few minutes before trying again.');
      } else {
        toast.error('Registration failed. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-msu-blue to-primary-800 py-12">
      <div className="max-w-2xl w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={msuLogo} alt="MSU Logo" className="h-16 w-auto" onError={(e) => { e.target.style.display = 'none'; console.error('Logo failed to load'); }} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-600 mt-2">Join MSU Academic Mentorship Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="e.g., R234567A (R + year + number + letter)"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="you@students.msu.ac.zw"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Tanatswa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Chinokwetu"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="••••••••"
                    required
                    minLength="8"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be 8+ chars with uppercase, lowercase, number, and special character</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                <select
                  name="user_type"
                  value={formData.user_type}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="mentee">Mentee (Seek Help)</option>
                  <option value="mentor">Mentor (Provide Help)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Faculty</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    name="faculty"
                    value={formData.faculty}
                    onChange={handleChange}
                    className="input-field pl-10"
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campus</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    name="campus"
                    value={formData.campus}
                    onChange={handleChange}
                    className="input-field pl-10"
                    required
                  >
                    <option value="">Select Campus</option>
                    <option value="Gweru (Senga)">Gweru (Senga)</option>
                    <option value="Zvishavane">Zvishavane</option>
                    <option value="Harare">Harare</option>
                    <option value="Kwekwe">Kwekwe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student Level</label>
                <select
                  name="student_level"
                  value={formData.student_level}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                  <option value="4">Level 4</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Mentors must be Level 2 or above</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year of Study</label>
                <select
                  name="year_of_study"
                  value={formData.year_of_study}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="+263 7XX XXX XXX"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
