/**
 * ============================================================
 * Goal Tracker Management System
 * Menu Helper Utility
 * ============================================================
 */

/**
 * Sort menu by Display Order
 */
export const sortMenus = (menus = []) => {
  return [...menus].sort(
    (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
  );
};

/**
 * Build Parent-Child Menu Tree
 */
export const buildMenuTree = (menus = []) => {
  const menuMap = {};
  const roots = [];

  menus.forEach((menu) => {
    menuMap[menu.id] = {
      ...menu,
      children: [],
    };
  });

  menus.forEach((menu) => {
    if (
      menu.parentId === null ||
      menu.parentId === undefined ||
      menu.parentId === 0
    ) {
      roots.push(menuMap[menu.id]);
    } else if (menuMap[menu.parentId]) {
      menuMap[menu.parentId].children.push(menuMap[menu.id]);
    }
  });

  const recursiveSort = (items) => {
    items.sort(
      (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
    );

    items.forEach((item) => recursiveSort(item.children));
  };

  recursiveSort(roots);

  return roots;
};

/**
 * Convert Menu Tree into Flat Array
 */
export const flattenMenu = (menus = []) => {
  const result = [];

  const traverse = (items) => {
    items.forEach((item) => {
      result.push(item);

      if (item.children?.length) {
        traverse(item.children);
      }
    });
  };

  traverse(menus);

  return result;
};

/**
 * Find Menu by Id
 */
export const findMenuById = (menus = [], id) => {
  const flat = flattenMenu(menus);

  return flat.find((menu) => menu.id === id) || null;
};

/**
 * Find Menu by Route Path
 */
export const findMenuByPath = (menus = [], path = "") => {
  const flat = flattenMenu(menus);

  return (
    flat.find(
      (menu) =>
        menu.path &&
        menu.path.toLowerCase() === path.toLowerCase()
    ) || null
  );
};

/**
 * Find Parent Menu
 */
export const findParentMenu = (menus = [], parentId) => {
  if (!parentId) return null;

  return findMenuById(menus, parentId);
};

/**
 * Generate Breadcrumb
 */
export const getBreadcrumb = (menus = [], currentPath = "") => {
  const flatMenus = flattenMenu(menus);

  const currentMenu = flatMenus.find(
    (menu) =>
      menu.path &&
      menu.path.toLowerCase() === currentPath.toLowerCase()
  );

  if (!currentMenu) return [];

  const breadcrumb = [];
  let current = currentMenu;

  while (current) {
    breadcrumb.unshift({
      id: current.id,
      title: current.title,
      path: current.path,
      icon: current.icon,
    });

    current = flatMenus.find(
      (menu) => menu.id === current.parentId
    );
  }

  return breadcrumb;
};

/**
 * Search Menu
 */
export const searchMenus = (menus = [], keyword = "") => {
  if (!keyword) return menus;

  const lowerKeyword = keyword.toLowerCase();

  return flattenMenu(menus).filter(
    (menu) =>
      menu.title?.toLowerCase().includes(lowerKeyword) ||
      menu.path?.toLowerCase().includes(lowerKeyword)
  );
};

/**
 * Filter Menu By Permission
 */
export const filterMenusByPermission = (
  menus = [],
  permissions = []
) => {
  if (!permissions.length) return [];

  const hasPermission = (permission) => {
    if (!permission) return true;

    return permissions.includes(permission);
  };

  const filterRecursive = (items) => {
    return items
      .filter((item) => hasPermission(item.permission))
      .map((item) => ({
        ...item,
        children: filterRecursive(item.children || []),
      }));
  };

  return filterRecursive(menus);
};

/**
 * Find Active Menu
 */
export const getActiveMenu = (menus = [], pathname = "") => {
  return findMenuByPath(menus, pathname);
};

/**
 * Get Expanded Parent Menu IDs
 */
export const getExpandedMenuIds = (menus = [], currentPath = "") => {
  const flatMenus = flattenMenu(menus);

  const current = flatMenus.find(
    (menu) =>
      menu.path &&
      menu.path.toLowerCase() === currentPath.toLowerCase()
  );

  if (!current) return [];

  const expanded = [];

  let parentId = current.parentId;

  while (parentId) {
    expanded.push(parentId);

    const parent = flatMenus.find(
      (menu) => menu.id === parentId
    );

    parentId = parent?.parentId;
  }

  return expanded;
};

/**
 * Check if Menu Has Children
 */
export const hasChildren = (menu) => {
  return (
    Array.isArray(menu.children) &&
    menu.children.length > 0
  );
};

/**
 * Get Root Menus
 */
export const getRootMenus = (menus = []) => {
  return menus.filter(
    (menu) =>
      menu.parentId === null ||
      menu.parentId === 0 ||
      menu.parentId === undefined
  );
};