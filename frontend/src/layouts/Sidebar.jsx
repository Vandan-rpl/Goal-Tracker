import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { selectSidebarCollapsed, toggleSidebar } from "../redux/slices/sidebarSlice";
import useAuth from "../hooks/useAuth";
import IdeasSidebarMenu from "./IdeasSidebarMenu";
import TasksSidebarMenu from "./TasksSidebarMenu";
import ProfileMenu from "../components/ProfileMenu/ProfileMenu";
import { isIdeasPath } from "../utils/ideasMenu";
import { isTasksPath } from "../utils/tasksMenu";
import { hasGoalAccess } from "../utils/goalAccess";

const Sidebar = () => {
  const { user } = useAuth();

  // On /ideas and /tasks pages that module's menu replaces the Goal Tracker
  // links below.
  const { pathname } = useLocation();
  const isActive = (path) => pathname === path;
  const isIdeasModule = isIdeasPath(pathname);
  // Without Goal Tracker access (below grade 303), shared pages like
  // Settings / Profile show the Task Tracker menu instead of goal links.
  const isTasksModule = isTasksPath(pathname) || (!hasGoalAccess(user) && !isIdeasModule);

  // Force checking role string (handling both uppercase and lowercase)
  const role = (user?.Role || user?.role || "").toUpperCase();
  const isManagerOrHOD = ["HOD", "MANAGER", "BUSINESSHEAD", "ADMIN"].includes(
    role,
  );

  const isAdmin = role === "ADMIN";

  // Collapse: the menu button pins the sidebar expanded or collapsed
  // (remembered in localStorage by sidebarSlice). It only changes on click.
  const dispatch = useDispatch();
  const collapsed = useSelector(selectSidebarCollapsed);
  const expanded = !collapsed;

  const handleToggle = () => dispatch(toggleSidebar());

  return (
    <div
      className={`relative shrink-0 h-full transition-[width] duration-200 ${collapsed ? "w-18" : "w-64"}`}
    >
    <aside
      className={`absolute inset-y-0 left-0 z-40 bg-[#2c3e82] border-r border-white/10 flex flex-col h-full select-none font-sans overflow-hidden transition-[width] duration-200 ${
        expanded
          ? "w-64"
          : // Icon-only: hide link labels and section headings.
            "w-18 [&_nav_a]:justify-center [&_nav_a]:text-[0px] [&_nav_a_svg]:mr-0 [&_nav_p]:hidden"
      }`}
    >

      {/* Menu button: toggles the sidebar between expanded and collapsed. */}
      <div className={`flex px-3 pt-3 ${expanded ? "justify-end" : "justify-center"}`}>
        <button
          type="button"
          onClick={handleToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-100 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 pt-1 pb-4 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">

        {/* The Admin only sees the Administration links, on every page. */}
        {!isAdmin && isIdeasModule ? (
          <IdeasSidebarMenu />
        ) : !isAdmin && isTasksModule ? (
          <TasksSidebarMenu />
        ) : (
        <>
        {!isAdmin && (
        <>
        {/* Core Links */}
        <p className="px-3.5 pb-1 text-[11px] font-bold text-indigo-200/80 uppercase tracking-wider">
          For Users
        </p>
        <Link
          to="/dashboard"
          className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
            isActive("/dashboard")
              ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
              : "text-indigo-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Dashboard
        </Link>

        <Link
          to="/goals"
          className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
            isActive("/goals")
              ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
              : "text-indigo-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4" />
          </svg>
          Goal Management
        </Link>

        <Link
          to="/goals/joint"
          className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
            isActive("/goals/joint")
              ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
              : "text-indigo-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m16-10a4 4 0 11-8 0 4 4 0 018 0zm2 10h2v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          Joint Goals assigned by team member
        </Link>

        {/* Management Section */}
        {isManagerOrHOD && (
          <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
            <p className="px-3.5 pb-1 text-[11px] font-bold text-indigo-200/80 uppercase tracking-wider">
              {role === "BUSINESSHEAD" ? "CFO View" : "For HOD/Reporting Manager"}
            </p>

            <Link
              to="/manager/team-management"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/manager/team-management")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Goal Review & Approval
            </Link>

            {role === "BUSINESSHEAD" && (
              <Link
                to="/cfo/all-goals"
                className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                  isActive("/cfo/all-goals")
                    ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                    : "text-indigo-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                All Goals
              </Link>
            )}

            <Link
              to="/admin/reports"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/reports")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & Analytics
            </Link>
          </div>
        )}

        </>
        )}

        {/* Administration Section */}
        {isAdmin && (
          <div className="space-y-1">
            <p className="px-3.5 pb-1 text-[11px] font-bold text-indigo-200/80 uppercase tracking-wider">
              Administration
            </p>

            <Link
              to="/admin/employees-list"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/employees-list")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              List Employees
            </Link>

            <Link
              to="/admin/add-employees"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/add-employees")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Employees
            </Link>

            <Link
              to="/admin/import-employees"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/import-employees")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Employees (Excel)
            </Link>

            {/* <Link
              to="/admin/upload-excel"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/upload-excel")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Excel
            </Link> */}

            <Link
              to="/admin/reports"
              className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive("/admin/reports")
                  ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
                  : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & Analytics
            </Link>
          </div>
        )}
        </>
        )}

      </nav>

      {/* Profile card with Logout */}
      <div className="p-3 border-t border-white/10 bg-black/10">
        <ProfileMenu compact={!expanded} />
      </div>

    </aside>
    </div>
  );
}

export default Sidebar;
