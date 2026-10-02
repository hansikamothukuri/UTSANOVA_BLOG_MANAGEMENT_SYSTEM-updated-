import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, User, AlertCircle, ArrowLeft, KeyRound, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';

export const AdminLoginPage = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin/dashboard';

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    if (isRegisterMode && password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      if (isRegisterMode) {
        await signup(email, password, name || 'Utsanova Administrator');
        setSuccessMsg('Admin account created successfully! Redirecting...');
      } else {
        await login(email, password);
      }
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemoCredentials = () => {
    setIsRegisterMode(false);
    setEmail('admin@utsanova.com');
    setPassword('admin123');
    setLocalError('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center mb-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              U
            </div>
          </Link>
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-black text-white tracking-tight">
          UTSANOVA Admin Portal
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-400">
          Secure administrative access powered by Firebase Authentication
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-800">
          {/* Mode Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl mb-6 border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setLocalError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                !isRegisterMode
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(true);
                setLocalError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                isRegisterMode
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Admin Account
            </button>
          </div>

          {localError && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{localError}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Admin Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Hansika / Lead Admin"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Admin Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@utsanova.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Admin Password {isRegisterMode && <span className="text-slate-400 lowercase">(min 6 chars)</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Authenticating with Firebase...</span>
              ) : isRegisterMode ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Register & Sign In as Admin
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Sign In to Admin Portal
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-6 pt-6 border-t border-slate-800/90 text-center">
            <p className="text-xs text-slate-400 mb-2.5">
              Testing credentials configured in <code className="text-indigo-400 font-mono">database/seed.sql</code>:
            </p>
            <button
              type="button"
              onClick={handleFillDemoCredentials}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition-colors border border-slate-700"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              Fill Demo Admin (<span className="text-indigo-300">admin@utsanova.com</span>)
            </button>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            to="/blogs"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Public Blog Site
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
