import React from "react";
import { Link, useLocation } from "react-router-dom";
import useIdeasAccess from "../hooks/useIdeasAccess";
import {
  IDEAS_MENU,
  canAccessIdeasItem,
  isIdeasItemActive,
} from "../utils/ideasMenu";

// Innovation Ideas menu items, rendered by Sidebar.jsx in place of the
// Goal Tracker links. Uses the same link and section styling.
const IdeasSidebarMenu = () => {
  const { pathname } = useLocation();
  const access = useIdeasAccess();

  const items = IDEAS_MENU.filter((item) => canAccessIdeasItem(item, access));
  const mainItems = items.filter((item) => !item.section);
  const sections = [...new Set(items.filter((item) => item.section).map((item) => item.section))];

  const renderLink = (item) => (
    <Link
      key={item.key}
      to={item.path}
      className={`flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
        isIdeasItemActive(item, pathname)
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
      <p className="px-3.5 pb-1 text-[11px] font-bold text-indigo-200/80 uppercase tracking-wider">
        For Users
      </p>
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

export default IdeasSidebarMenu;
