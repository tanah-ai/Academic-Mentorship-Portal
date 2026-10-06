import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Mail, Lock, User, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import msuLogo from '/msu-logo.png?url';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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
      const user = await login(formData.email, formData.password, formData.role);
      
      // Frontend validation - check if selected role matches actual user type
      if (formData.role === 'admin' && user.user_type !== 'admin') {
        toast.error('Access denied. You are not registered as an admin.');
        setLoading(false);
        return;
      }
      if (formData.role === 'user' && user.user_type === 'admin') {
        toast.error('Access denied. Admins must use the admin login option.');
        setLoading(false);
        return;
      }
      
      toast.success('Login successful!');
      
      // Redirect based on user_type
      if (user.user_type === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      
      // Show specific error messages based on the error
      if (errorMessage.includes('Invalid credentials')) {
        toast.error('Invalid email or password. Please check your credentials and try again.');
      } else if (errorMessage.includes('locked')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('attempts remaining')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Too many authentication attempts')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Access denied')) {
        toast.error(errorMessage);
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a few minutes before trying again.');
      } else if (error.response?.status === 423) {
        toast.error(errorMessage);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-msu-blue to-primary-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={msuLogo} alt="MSU Logo" className="h-16 w-auto" onError={(e) => { e.target.style.display = 'none'; console.error('Logo failed to load'); }} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
            <p className="text-gray-600 mt-2">Sign in to MSU Academic Mentorship Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Login As</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  name="role"
                  value="user"
                  onClick={() => setFormData({ ...formData, role: 'user' })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    formData.role === 'user'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <User className="h-5 w-5" />
                  <span className="font-medium">User</span>
                </button>
                <button
                  type="button"
                  name="role"
                  value="admin"
                  onClick={() => setFormData({ ...formData, role: 'admin' })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    formData.role === 'admin'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  <span className="font-medium">Admin</span>
                </button>
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
                  placeholder="you@example.com"
                  required
                />
              </div>
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
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
