import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInAdmin, signUpAdmin, signOutAdmin, subscribeToAuthChanges } from '../firebase/auth.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Remove tokens/users cached by older versions (could contain a stale demo token)
    try {
      sessionStorage.removeItem('utsanova_auth_token');
      sessionStorage.removeItem('utsanova_admin_user');
    } catch (e) {
      // ignore
    }

    // Firebase is the single source of truth for the session. `loading` stays true until
    // Firebase has reported whether a user is signed in (prevents a login-page flash on reload).
    const unsubscribe = subscribeToAuthChanges((state) => {
      if (state.user && state.token) {
        setUser({
          uid: state.user.uid,
          email: state.user.email,
          displayName: state.user.displayName || 'Administrator',
        });
        setTokenState(state.token);
      } else {
        setUser(null);
        setTokenState(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInAdmin(email, password);
      const userObj = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || 'Administrator',
      };
      setUser(userObj);
      setTokenState(result.token);
      return result;
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, displayName) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signUpAdmin(email, password, displayName);
      const userObj = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || displayName || 'Administrator',
      };
      setUser(userObj);
      setTokenState(result.token);
      return result;
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOutAdmin();
    } finally {
      setUser(null);
      setTokenState(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        error,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
