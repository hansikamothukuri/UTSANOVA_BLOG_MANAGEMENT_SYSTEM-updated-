import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Globe, ShieldCheck } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                U
              </div>
              <span className="text-lg font-bold text-white tracking-tight">UTSANOVA</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Utsanova Blog Management System — empowering learners, developers, and tech leaders with insights on modern software engineering, education, and career acceleration.
            </p>
            <div className="text-xs text-slate-500 font-mono">
              UTSANOVA TECHNOLOGIES PVT. LTD.
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
              Platform Navigation
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link to="/blogs" className="hover:text-white transition-colors">
                  Published Blogs & Insights
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Admin Management Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Contact from SRS PDF */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
              Corporate Information
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                <a
                  href="https://www.about.utsanova.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  www.about.utsanova.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                <a href="mailto:hr@utsanova.com" className="hover:text-white transition-colors">
                  hr@utsanova.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} UTSANOVA TECHNOLOGIES PVT. LTD. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with React, Node.js, Express, Firebase Auth & MySQL
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
