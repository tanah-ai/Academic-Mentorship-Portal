import { useState, useEffect } from 'react';
import { useDataLite } from '../contexts/DataLiteContext';
import axios from 'axios';
import { Trophy, Medal, Award, TrendingUp, Crown } from 'lucide-react';

const Leaderboard = () => {
  const { dataLiteMode } = useDataLite();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [facultyFilter, setFacultyFilter] = useState('');

  useEffect(() => {
    fetchLeaderboard();
  }, [facultyFilter]);

  const fetchLeaderboard = async () => {
    try {
      const headers = {
        headers: {
          'X-Data-Lite': dataLiteMode.toString()
        }
      };
      const params = facultyFilter ? { faculty: facultyFilter } : {};
      const response = await axios.get('/api/gamification/leaderboard', { 
        params,
        ...headers 
      });
      setLeaderboard(response.data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-600">#{index + 1}</span>;
    }
  };

  const getRankBackground = (index) => {
    switch (index) {
      case 0:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200';
      case 1:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
      case 2:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200';
      default:
        return 'bg-white border-gray-200';
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mentor Leaderboard</h1>
        <p className="text-gray-600 mt-1">Top performing mentors on the platform</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Faculty</label>
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Faculties</option>
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
          <div className="flex items-center space-x-2 text-gray-600">
            <TrendingUp className="h-5 w-5" />
            <span>{leaderboard.length} mentors ranked</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Mentors Yet</h3>
          <p className="text-gray-600">Be the first to become a verified mentor!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((mentor, index) => (
            <div
              key={mentor.id}
              className={`card border-2 ${getRankBackground(index)} hover:shadow-lg transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12">
                    {getRankIcon(index)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {mentor.first_name} {mentor.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{mentor.student_id}</p>
                    <p className="text-sm text-gray-500">{mentor.faculty}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-8">
                  <div className="text-center">
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <Trophy className="h-5 w-5" />
                      <span className="text-2xl font-bold">{mentor.reputation_score}</span>
                    </div>
                    <p className="text-xs text-gray-600">Reputation</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center space-x-1 text-blue-600">
                      <Award className="h-5 w-5" />
                      <span className="text-2xl font-bold">{mentor.total_sessions}</span>
                    </div>
                    <p className="text-xs text-gray-600">Sessions</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center space-x-1 text-purple-600">
                      <Medal className="h-5 w-5" />
                      <span className="text-2xl font-bold">{mentor.badge_count}</span>
                    </div>
                    <p className="text-xs text-gray-600">Badges</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">How Rankings Work</h3>
            <p className="text-sm text-blue-800 mt-2">
              Mentors are ranked based on their reputation score, which is calculated from:
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1">
              <li>• Session completions and positive feedback</li>
              <li>• Quality of mentorship (ratings from mentees)</li>
              <li>• Badge achievements and consistency</li>
              <li>• Variety of modules mentored</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
