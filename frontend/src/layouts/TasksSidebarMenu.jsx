import React from "react";
import { Link, useLocation } from "react-router-dom";
import useTasksAccess from "../hooks/useTasksAccess";
import {
  TASKS_MENU,
  canAccessTasksItem,
  isTasksItemActive,
} from "../utils/tasksMenu";

// Task Tracker menu items, rendered by Sidebar.jsx in place of the Goal
// Tracker links. Same link and section styling as IdeasSidebarMenu.
const TasksSidebarMenu = () => {
  const { pathname } = useLocation();
  const access = useTasksAccess();

  const items = TASKS_MENU.filter((item) => canAccessTasksItem(item, access));
  const mainItems = items.filter((item) => !item.section);
  const sections = [...new Set(items.filter((item) => item.section).map((item) => item.section))];

  const renderLink = (item) => (
    <Link
      key={item.key}
      to={item.path}
      className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
        isTasksItemActive(item, pathname)
          ? "bg-white text-[#2c3e82] shadow-lg shadow-black/20 font-semibold"
          : "text-indigo-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      <svg className="w-5 h-5 mr-3 text-current opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );

  return (
    <>
      {mainItems.map(renderLink)}

      {sections.map((section) => (
        <div key={section} className="pt-4 mt-3 border-t border-white/10 space-y-1">
          <p className="px-3.5 pb-1 text-[11px] font-bold text-indigo-200/80 uppercase tracking-wider">
            {section}
          </p>
          {items.filter((item) => item.section === section).map(renderLink)}
        </div>
      ))}
    </>
  );
};

export default TasksSidebarMenu;
