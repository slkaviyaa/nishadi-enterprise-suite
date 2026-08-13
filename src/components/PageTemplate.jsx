'use client'
import React from 'react';

export default function PageTemplate({
  title,
  subtitle,
  metrics = [],
  actions,
  children // 👈 Meka thama godakma wada karana prop eka
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-gray-900 dark:text-white animate-fadeIn">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* 2. Top Metric / KPI Cards */}
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{m.label}</p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">{m.value}</p>
              </div>
              {m.icon && <div className="text-3xl opacity-80">{m.icon}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 3. Page Content (Forms, Tables, etc.) */}
      <div className="w-full">
        {children} {/* 👈 Me thiyenne page eken ena athule data tika pennana thana */}
      </div>
      
    </div>
  );
}