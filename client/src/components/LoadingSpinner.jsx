import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ message = 'Loading blogs...' }) => {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
};

export const BlogCardSkeleton = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse flex flex-col justify-between">
      <div>
        <div className="flex gap-3 mb-4">
          <div className="h-4 bg-slate-200 rounded w-24"></div>
          <div className="h-4 bg-slate-200 rounded w-16"></div>
        </div>
        <div className="h-6 bg-slate-200 rounded w-5/6 mb-3"></div>
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-slate-100 rounded w-full"></div>
          <div className="h-4 bg-slate-100 rounded w-4/5"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-slate-200 rounded w-16"></div>
          <div className="h-6 bg-slate-200 rounded w-20"></div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
