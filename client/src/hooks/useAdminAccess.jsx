import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';

const AdminAccessContext = createContext({ loaded: false, isOwner: false, isBootstrapOwner: false, adminId: null, role: null, can: () => true });

/**
 * Loads what the signed-in admin may do (GET /admin/dashboard/me). Owner status is read from the server
 * (database-backed) on every page load; the UI never decides it. This only drives which buttons are
 * shown - the BACKEND enforces every permission. If the call fails, controls stay visible (as before)
 * and the backend still rejects anything not allowed.
 */
export const AdminAccessProvider = ({ children }) => {
  const [state, setState] = useState({ loaded: false, isOwner: false, isBootstrapOwner: false, adminId: null, role: null, permissions: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/dashboard/me')
      .then((res) => {
        const access = res?.data?.access;
        if (!cancelled && access) {
          setState({
            loaded: true,
            isOwner: !!access.is_owner, // database-backed (admins.is_owner) or bootstrap owner - decided by the server
            isBootstrapOwner: !!access.is_bootstrap_owner,
            adminId: access.admin_id ?? null,
            role: access.role,
            permissions: access.permissions || [],
          });
        } else if (!cancelled) {
          setState((s) => ({ ...s, loaded: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    loaded: state.loaded,
    isOwner: state.isOwner,
    isBootstrapOwner: state.isBootstrapOwner,
    adminId: state.adminId,
    role: state.role,
    can: (code) => (state.permissions === null ? true : state.permissions.includes(code)),
  };
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
};

export const useAdminAccess = () => useContext(AdminAccessContext);

export default useAdminAccess;
