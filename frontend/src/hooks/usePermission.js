import { useMemo } from "react";
import { useSelector } from "react-redux";

const usePermission = () => {
  const auth = useSelector((state) => state.auth);

  const user = auth?.user || {};

  const permissions = useMemo(() => {
    if (Array.isArray(user.permissions)) {
      return user.permissions;
    }

    return [];
  }, [user.permissions]);

  const role = useMemo(() => {
    return user.role || "";
  }, [user.role]);

  /**
   * Check single permission
   */
  const hasPermission = (permission) => {
    if (!permission) return false;

    return permissions.includes(permission);
  };

  /**
   * Check multiple permissions
   * Returns true if user has ANY permission
   */
  const hasAnyPermission = (permissionList = []) => {
    if (!Array.isArray(permissionList)) return false;

    return permissionList.some((permission) =>
      permissions.includes(permission)
    );
  };

  /**
   * Check multiple permissions
   * Returns true if user has ALL permissions
   */
  const hasAllPermissions = (permissionList = []) => {
    if (!Array.isArray(permissionList)) return false;

    return permissionList.every((permission) =>
      permissions.includes(permission)
    );
  };

  /**
   * Check Role
   */
  const hasRole = (roleName) => {
    if (!roleName) return false;

    return role === roleName;
  };

  /**
   * Check Multiple Roles
   */
  const hasAnyRole = (roles = []) => {
    if (!Array.isArray(roles)) return false;

    return roles.includes(role);
  };

  /**
   * Admin Shortcut
   */
  const isAdmin = role === "Admin";

  return {
    user,
    role,
    permissions,

    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    hasRole,
    hasAnyRole,

    isAdmin,
  };
};

export default usePermission;