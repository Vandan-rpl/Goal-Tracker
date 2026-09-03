import React, { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../api/axios"; // Updated import to match your axios.js service path

export const AuthContext = createContext(null);

const normalizeUser = (userData = {}) => {
  const firstName = userData.firstName ?? userData.FirstName ?? "";
  const lastName = userData.lastName ?? userData.LastName ?? "";
  const fallbackFullName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const computedFullName =
    userData.fullName ||
    userData.FullName ||
    fallbackFullName ||
    userData.username ||
    userData.Username ||
    "User";

  return {
    ...userData,
    firstName,
    lastName,
    FirstName: firstName,
    LastName: lastName,
    fullName: computedFullName,
    FullName: computedFullName,
    role: userData.role || userData.Role,
    Role: userData.Role || userData.role,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(normalizeUser(parsedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // Using axiosInstance which already points to http://localhost:5000/api/v1
      const response = await axiosInstance.post("/auth/login", {
        username,
        password,
      });

      if (response.data && response.data.success) {
        const { token, ...userData } = response.data.data;
        const normalizedUser = normalizeUser(userData);

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        setUser(normalizedUser);

        return {
          success: true,
          data: response.data,
          isPasswordChanged:
            normalizedUser.IsPasswordChanged ??
            normalizedUser.isPasswordChanged,
        };
      }
      return {
        success: false,
        message: response.data?.message || "Login failed",
      };
    } catch (err) {
      return {
        success: false,
        message:
          err.message ||
          err.response?.data?.message ||
          "Invalid credentials or network error.",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

export default AuthContext;
