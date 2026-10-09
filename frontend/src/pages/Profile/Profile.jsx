import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Edit3,
  Save,
  Lock,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Loader2,
  X,
} from "lucide-react";

import { fetchProfile, updateProfile } from "../../redux/slices/profileSlice";

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { profile = {}, loading = false } = useSelector(
    (state) => state.profile || {}
  );
  const { user } = useSelector((state) => state.auth || {});

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobileNo: "",
  });

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    const activeData = profile?.UserID ? profile : user;
    if (activeData) {
      setFormData({
        firstName: activeData.FirstName || activeData.firstName || "",
        lastName: activeData.LastName || activeData.lastName || "",
        email: activeData.Email || activeData.email || "",
        mobileNo: activeData.MobileNo || activeData.mobileNo || "",
      });
    }
  }, [profile, user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    dispatch(updateProfile(formData));
    setEditMode(false);
  };

  const handleCancel = () => {
    const activeData = profile?.UserID ? profile : user;
    if (activeData) {
      setFormData({
        firstName: activeData.FirstName || activeData.firstName || "",
        lastName: activeData.LastName || activeData.lastName || "",
        email: activeData.Email || activeData.email || "",
        mobileNo: activeData.MobileNo || activeData.mobileNo || "",
      });
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1976d2]" />
      </div>
    );
  }

  const currentProfile = profile?.UserID ? profile : user;
  const fullName =
    currentProfile?.FullName ||
    `${formData.firstName} ${formData.lastName}`.trim() ||
    "User Profile";

  const initials =
    `${formData.firstName?.[0] || ""}${formData.lastName?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <div className="min-h-screen bg-blue-50/30 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Profile
            </h1>
            <p className="text-sm text-slate-500">
              Manage your personal information and account settings
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/change-password")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-[#1976d2] hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-[#1976d2]/20 active:scale-[0.98]"
            >
              <Lock className="h-4 w-4 text-[#1976d2]" />
              Change Password
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
            
            {/* Sidebar Profile Info */}
            <div className="p-6 lg:col-span-4 lg:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  {currentProfile?.ProfilePhoto ? (
                    <img
                      src={currentProfile.ProfilePhoto}
                      alt={fullName}
                      className="h-28 w-28 rounded-full border-2 border-white object-cover ring-4 ring-blue-50 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-white bg-[#1976d2] font-semibold text-4xl text-white ring-4 ring-blue-50 shadow-sm">
                      {initials}
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  {fullName}
                </h2>

                <div className="mt-3 flex flex-col gap-1.5 text-xs text-slate-500">
                  <div className="inline-flex items-center justify-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-[#1976d2]" />
                    <span>{currentProfile?.Designation || "Employee"}</span>
                  </div>
                  {currentProfile?.DepartmentName && (
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#1976d2]" />
                      <span>{currentProfile.DepartmentName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="p-6 lg:col-span-8 lg:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  Personal Information
                </h3>

                {!editMode ? (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1976d2] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1976d2]/30 active:scale-[0.98]"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1976d2] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1976d2]/30 active:scale-[0.98]"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    First Name
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-[#1976d2]/70" />
                    </div>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={!editMode}
                      className="block w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-[#1976d2] focus:outline-none focus:ring-1 focus:ring-[#1976d2] disabled:bg-slate-50/80 disabled:text-slate-500 disabled:shadow-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    Last Name
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-[#1976d2]/70" />
                    </div>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={!editMode}
                      className="block w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-[#1976d2] focus:outline-none focus:ring-1 focus:ring-[#1976d2] disabled:bg-slate-50/80 disabled:text-slate-500 disabled:shadow-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-[#1976d2]/70" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!editMode}
                      className="block w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-[#1976d2] focus:outline-none focus:ring-1 focus:ring-[#1976d2] disabled:bg-slate-50/80 disabled:text-slate-500 disabled:shadow-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="mobileNo"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Phone className="h-4 w-4 text-[#1976d2]/70" />
                    </div>
                    <input
                      type="text"
                      id="mobileNo"
                      name="mobileNo"
                      value={formData.mobileNo}
                      onChange={handleChange}
                      disabled={!editMode}
                      className="block w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-[#1976d2] focus:outline-none focus:ring-1 focus:ring-[#1976d2] disabled:bg-slate-50/80 disabled:text-slate-500 disabled:shadow-none"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;