import { useMemo, useState } from "react";
import { taskFilterControlClass } from "../TaskWorkbookFrame/TaskWorkbookFrame";

/**
 * Checkbox list of users with a search box, for picking project members.
 *
 * Props:
 *   options    [{ UserID, FullName, EmployeeCode, DepartmentName }]
 *   selected   array of UserIDs
 *   onChange(userIds)
 *   disabled
 */
export default function ProjectMemberPicker({ options = [], selected = [], onChange, disabled = false }) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((user) =>
      [user.FullName, user.EmployeeCode, user.DepartmentName].some((value) => (value || "").toLowerCase().includes(term)),
    );
  }, [options, search]);

  const selectedSet = new Set(selected);

  const toggle = (userId) =>
    onChange(selectedSet.has(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code or department"
          aria-label="Search employees"
          disabled={disabled}
          className={taskFilterControlClass}
        />
        <span className="shrink-0 text-xs text-slate-600">{selected.length} selected</span>
      </div>
      <div className="max-h-60 overflow-y-auto border border-[#cbd4e2] bg-white">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">No employees found.</p>
        ) : (
          visible.map((user) => (
            <label
              key={user.UserID}
              className="flex cursor-pointer items-center gap-2.5 border-b border-[#edf1f7] px-3 py-2 text-xs last:border-b-0 hover:bg-[#f4f6fa]"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(user.UserID)}
                onChange={() => toggle(user.UserID)}
                disabled={disabled}
                className="size-4 accent-[#2c3e82]"
              />
              <span className="font-semibold text-slate-900">{user.FullName}</span>
              <span className="text-slate-500">
                {[user.EmployeeCode, user.DepartmentName].filter(Boolean).join(" · ")}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
