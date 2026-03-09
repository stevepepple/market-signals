import { NavLink } from "react-router-dom";

export default function Nav({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200 dark:bg-gray-950/80 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 mr-4">
            Market Signals
          </span>
          <NavLink to="/" className={linkClass}>Dashboard</NavLink>
          <NavLink to="/portfolio" className={linkClass}>Portfolio</NavLink>
          <NavLink to="/approach" className={linkClass}>Investment Approach</NavLink>
        </div>
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}
