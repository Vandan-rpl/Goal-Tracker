import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Bell,
  Globe,
  ChevronRight,
  LogOut,
  Shield,
  Sliders,
} from "lucide-react";
import api from "../../services/api";

// IDs from the API are numbers; <select> values are strings. Compare everything as strings.
const toId = (value) => (value === null || value === undefined ? "" : String(value));

const fullName = (person) => `${person.FirstName || ""} ${person.LastName || ""}`.trim();

const personLabel = (person) =>
  [fullName(person), person.DepartmentName, person.IsActive ? null : "inactive"].filter(Boolean).join(" · ");

/**
 * Shows the currently assigned person. "Change" opens a name search and a list of
 * eligible people (the assigned person stays in the list even if no longer eligible).
 */
const PersonPicker = ({ label, emptyLabel, people, value, assignedId, editing, onEdit, onCancel, onChange, disabled }) => {
  const [search, setSearch] = useState("");
  const current = people.find((person) => toId(person.UserID) === assignedId);
  const term = search.trim().toLowerCase();
  const options = people.filter((person) => {
    const id = toId(person.UserID);
    if (id === value) return true;
    if (!person.IsEligible && id !== assignedId) return false;
    return !term || fullName(person).toLowerCase().includes(term);
  });

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          {current ? (
            <>
              <div className="mt-1 text-sm font-semibold text-slate-900">{fullName(current)}</div>
              <div className="text-xs text-slate-500">
                {[current.Designation, current.DepartmentName, current.IsActive ? null : "inactive"]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-500">{emptyLabel}</div>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Change
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Type a name to search"
            aria-label={`Search ${label}`}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            aria-label={`New ${label}`}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">{emptyLabel}</option>
            {options.map((person) => (
              <option key={person.UserID} value={toId(person.UserID)}>
                {personLabel(person)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              onCancel();
            }}
            disabled={disabled}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

const Settings = () => {
  const navigate = useNavigate();

  const [emailNotification, setEmailNotification] = useState(true);
  const [browserNotification, setBrowserNotification] = useState(true);
  const [approvers, setApprovers] = useState([]);
  const [hierarchy, setHierarchy] = useState({ reportingManagerId: "", hodId: "" });
  // Assigned values as last loaded from the database; these stay listed even if no longer eligible.
  const [assigned, setAssigned] = useState({ reportingManagerId: "", hodId: "" });
  const [ownUserId, setOwnUserId] = useState("");
  const [editing, setEditing] = useState({ reportingManagerId: false, hodId: false });
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchySaving, setHierarchySaving] = useState(false);
  const [hierarchyMessage, setHierarchyMessage] = useState("");

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        const [profileResponse, approversResponse] = await Promise.all([
          api.get("/profile"),
          api.get("/profile/approvers"),
        ]);
        const profile = profileResponse.data?.data || {};
        const current = {
          reportingManagerId: toId(profile.ReportingManagerID),
          hodId: toId(profile.HODID),
        };
        setHierarchy(current);
        setAssigned(current);
        setOwnUserId(toId(profile.UserID));
        setApprovers(approversResponse.data?.data || []);
      } catch (error) {
        setHierarchyMessage(error.response?.data?.message || "Unable to load reporting details.");
      } finally {
        setHierarchyLoading(false);
      }
    };
    loadHierarchy();
  }, []);

  const saveHierarchy = async (event) => {
    event.preventDefault();
    setHierarchySaving(true);
    setHierarchyMessage("");
    try {
      const response = await api.put("/profile/hierarchy", hierarchy);
      const profile = response.data?.data || {};
      const current = {
        reportingManagerId: toId(profile.ReportingManagerID),
        hodId: toId(profile.HODID),
      };
      setHierarchy(current);
      setAssigned(current);
      setEditing({ reportingManagerId: false, hodId: false });
      setHierarchyMessage("Reporting details updated successfully.");
    } catch (error) {
      setHierarchyMessage(error.response?.data?.message || "Unable to update reporting details.");
    } finally {
      setHierarchySaving(false);
    }
  };

  // A user can never pick themselves.
  const selectablePeople = approvers.filter((person) => toId(person.UserID) !== ownUserId);
  const hasChanges =
    hierarchy.reportingManagerId !== assigned.reportingManagerId || hierarchy.hodId !== assigned.hodId;

  const pickerProps = (field) => ({
    people: selectablePeople,
    value: hierarchy[field],
    assignedId: assigned[field],
    editing: editing[field],
    onEdit: () => {
      setHierarchyMessage("");
      setEditing((current) => ({ ...current, [field]: true }));
    },
    onCancel: () => {
      setHierarchy((current) => ({ ...current, [field]: assigned[field] }));
      setEditing((current) => ({ ...current, [field]: false }));
    },
    onChange: (id) => setHierarchy((current) => ({ ...current, [field]: id })),
    disabled: hierarchyLoading || hierarchySaving,
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your account settings and preferences.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 w-fit"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Reporting Manager &amp; HOD</h2>
              <p className="text-xs text-slate-500 mt-1">Your current Reporting Manager and HOD. Click Change to pick someone else.</p>
            </div>
            <form onSubmit={saveHierarchy} className="p-6 space-y-4">
              <PersonPicker label="Reporting Manager" emptyLabel="Not assigned" {...pickerProps("reportingManagerId")} />
              <PersonPicker label="HOD" emptyLabel="Not assigned" {...pickerProps("hodId")} />
              {hierarchyMessage && <p role="status" className="text-sm text-slate-600">{hierarchyMessage}</p>}
              {hasChanges && (
                <button type="submit" disabled={hierarchyLoading || hierarchySaving} className="rounded-lg bg-[#1976d2] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {hierarchySaving ? "Saving…" : "Save changes"}
                </button>
              )}
            </form>
          </section>

          {/* Account Settings Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl bg-[#1976d2]/10 text-[#1976d2]"
                style={{ color: "#1976d2" }}
              >
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Account Settings
                </h2>
                <p className="text-xs text-slate-500">
                  Personal details and security options
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {/* Profile Item */}
              <button
                onClick={() => navigate("/profile")}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#1976d2]/10 group-hover:text-[#1976d2] transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-medium text-slate-900 block text-sm sm:text-base">
                      Profile
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500 block">
                      View and update your profile information
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#1976d2] transition-all" />
              </button>

              {/* Change Password Item */}
              <button
                onClick={() => navigate("/change-password")}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#1976d2]/10 group-hover:text-[#1976d2] transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-medium text-slate-900 block text-sm sm:text-base">
                      Change Password
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500 block">
                      Update your account security password
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#1976d2] transition-all" />
              </button>
            </div>
          </div>

          {/* Preferences Section */}
          {/* <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1976d2]/10 text-[#1976d2]">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900"> 
                  Preferences
                </h2>
                <p className="text-xs text-slate-500"> 
                  Manage your notification channels
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6"> */}
              {/* Email Notifications Toggle */}
              {/* <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <label
                      htmlFor="email-toggle"
                      className="font-medium text-slate-900 text-sm sm:text-base cursor-pointer block"
                    >
                      Email Notifications
                    </label>
                    <span className="text-xs sm:text-sm text-slate-500 block">
                      Receive updates via your registered email
                    </span>
                  </div>
                </div> */}

                {/* Custom Styled Switch */}
                {/* <button
                  id="email-toggle"
                  type="button"
                  role="switch"
                  aria-checked={emailNotification}
                  onClick={() => setEmailNotification(!emailNotification)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1976d2]/20 ${
                    emailNotification ? "bg-[#1976d2]" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      emailNotification ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-slate-100" /> */}

              {/* Browser Notifications Toggle */}
              {/* <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <label
                      htmlFor="browser-toggle"
                      className="font-medium text-slate-900 text-sm sm:text-base cursor-pointer block"
                    >
                      Browser Notifications
                    </label>
                    <span className="text-xs sm:text-sm text-slate-500 block">
                      Receive instant push notifications in your browser
                    </span>
                  </div>
                </div> */}

                {/* Custom Styled Switch */}
                {/* <button
                  id="browser-toggle"
                  type="button"
                  role="switch"
                  aria-checked={browserNotification}
                  onClick={() =>
                    setBrowserNotification(!browserNotification)
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1976d2]/20 ${
                    browserNotification ? "bg-[#1976d2]" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      browserNotification ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Settings;
