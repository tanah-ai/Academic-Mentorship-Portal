import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataLite } from '../contexts/DataLiteContext';
import { BookOpen, Users, Trophy, User, LogOut, Wifi, WifiOff } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { dataLiteMode, toggleDataLite } = useDataLite();

  return (
    <nav className="bg-msu-blue text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8" />
              <span className="font-bold text-xl">MSU AMP</span>
            </Link>
            
            {user && (
              <div className="hidden md:flex space-x-4">
                <Link to="/dashboard" className="hover:text-msu-gold transition-colors">Dashboard</Link>
                <Link to="/find-mentor" className="hover:text-msu-gold transition-colors">Find Mentor</Link>
                <Link to="/sessions" className="hover:text-msu-gold transition-colors">My Sessions</Link>
                <Link to="/leaderboard" className="hover:text-msu-gold transition-colors">Leaderboard</Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user && (
              <>
                <button
                  onClick={toggleDataLite}
                  className="flex items-center space-x-1 px-3 py-1 rounded hover:bg-white/10 transition-colors"
                  title={dataLiteMode ? "Data-Lite Mode ON" : "Data-Lite Mode OFF"}
                >
                  {dataLiteMode ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                  <span className="text-sm hidden sm:inline">Lite</span>
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-sm hidden sm:inline">{user.first_name}</span>
                  <Link to="/profile" className="hover:text-msu-gold transition-colors">
                    <User className="h-5 w-5" />
                  </Link>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center space-x-1 px-3 py-1 rounded hover:bg-white/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline">Logout</span>
                </button>
              </>
            )}

            {!user && (
              <div className="flex space-x-4">
                <Link to="/login" className="hover:text-msu-gold transition-colors">Login</Link>
                <Link to="/register" className="bg-msu-gold text-msu-blue px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
