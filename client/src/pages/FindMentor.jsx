import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { Search, User, Star, Calendar, Clock, Award } from 'lucide-react';
import toast from 'react-hot-toast';

const FindMentor = () => {
  const { user } = useAuth();
  const { dataLiteMode } = useDataLite();
  const navigate = useNavigate();
  const [moduleCode, setModuleCode] = useState('');
  const [modules, setModules] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const response = await axios.get('/api/modules', headers);
      setModules(response.data.modules);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    }
  };

  const handleSearch = async () => {
    if (!moduleCode) {
      toast.error('Please select a module');
      return;
    }

    setLoading(true);
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const response = await axios.post('/api/matching/find-mentor', 
        { module_code: moduleCode }, 
        headers
      );
      setMentors(response.data.mentors);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to find mentors');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!moduleCode) {
      toast.error('Please select a module');
      return;
    }

    setAutoMatching(true);
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const response = await axios.post('/api/matching/auto-match', 
        { module_code: moduleCode }, 
        headers
      );
      
      toast.success('Best mentor found!');
      // Create session with the matched mentor
      await createSession(response.data.mentor.id);
    } catch (error) {
      toast.error(
        error.response?.status === 404
          ? 'No verified mentor has declared this module as an area of expertise yet.'
          : error.response?.data?.error || 'Auto-match failed'
      );
    } finally {
      setAutoMatching(false);
    }
  };

  const createSession = async (mentorId) => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      
      // Get module ID
      const module = modules.find(m => m.module_code === moduleCode);
      if (!module) {
        toast.error('The selected module is no longer available. Please select it again.');
        return;
      }
      
      const response = await axios.post('/api/sessions', {
        mentor_id: mentorId,
        module_id: module.id,
        session_title: `Help with ${moduleCode}`,
        description: 'I need help understanding concepts in this module',
        scheduled_date: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        duration_minutes: 60
      }, headers);

      toast.success('Session created successfully!');
      navigate(`/session/${response.data.session.id}`);
    } catch (error) {
      toast.error('Failed to create session');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Find a Mentor</h1>
        <p className="text-gray-600 mt-1">Connect with verified high-performing peers</p>
      </div>

      {/* Search Section */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Module</label>
            <select
              value={moduleCode}
              onChange={(e) => setModuleCode(e.target.value)}
              className="input-field"
            >
              <option value="">Choose a module...</option>
              {modules.map(module => (
                <option key={module.id} value={module.module_code}>
                  {module.module_code} - {module.module_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
            <button
              onClick={handleAutoMatch}
              disabled={autoMatching}
              className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
            >
              <Award className="h-4 w-4" />
              <span>{autoMatching ? 'Matching...' : 'Auto-Match'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {mentors.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Available Mentors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentors.map(mentor => (
              <div key={mentor.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start space-x-4">
                  <div className="bg-primary-100 p-3 rounded-full">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {mentor.first_name} {mentor.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{mentor.faculty}</p>
                    <p className="text-sm text-gray-500">{mentor.campus}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{mentor.reputation_score}</span>
                    <span className="text-gray-600">Reputation</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{mentor.total_sessions}</span>
                    <span className="text-gray-600">Sessions</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Award className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{mentor.grade}</span>
                    <span className="text-gray-600">Grade</span>
                  </div>
                </div>

                <button
                  onClick={() => createSession(mentor.id)}
                  className="w-full btn-primary mt-4"
                >
                  Book Session
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mentors.length === 0 && moduleCode && !loading && (
        <div className="card text-center py-8">
          <p className="text-gray-600">
            No verified mentor has declared {moduleCode} as an area of expertise yet. Try another module or ask an approved mentor to add it under My Profile.
          </p>
        </div>
      )}
    </div>
  );
};

export default FindMentor;
