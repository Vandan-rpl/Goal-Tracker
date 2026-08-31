const { sql, pool, poolConnect } = require("../config/db");

/**
 * Get Sidebar Menu
 */
const getSidebarMenu = async (roleId) => {

    await poolConnect;

    const request = pool.request();

    request.input("RoleId", sql.Int, roleId);

    const query = `
        SELECT
            p.PermissionId,
            p.PermissionCode,
            p.PermissionName,
            p.ModuleName,
            p.MenuName,
            p.MenuUrl,
            p.MenuIcon,
            p.ParentPermissionId,
            p.DisplayOrder,

            rp.CanView,
            rp.CanCreate,
            rp.CanEdit,
            rp.CanDelete,
            rp.CanApprove,
            rp.CanExport

        FROM Permissions p

        INNER JOIN RolePermissions rp
            ON p.PermissionId = rp.PermissionId

        WHERE
            rp.RoleId=@RoleId
            AND p.IsActive=1
            AND p.IsMenu=1
            AND rp.CanView=1

        ORDER BY
            p.DisplayOrder,
            p.MenuName;
    `;

    const result = await request.query(query);

    return result.recordset;
};

/**
 * Get All Permissions
 */
const getPermissions = async (roleId) => {

    await poolConnect;

    const request = pool.request();

    request.input("RoleId", sql.Int, roleId);

    const result = await request.query(`
        SELECT

            p.PermissionId,
            p.PermissionCode,
            p.PermissionName,

            rp.CanView,
            rp.CanCreate,
            rp.CanEdit,
            rp.CanDelete,
            rp.CanApprove,
            rp.CanExport

        FROM Permissions p

        INNER JOIN RolePermissions rp

            ON p.PermissionId=rp.PermissionId

        WHERE rp.RoleId=@RoleId

        ORDER BY p.PermissionName;
    `);

    return result.recordset;
};

/**
 * Get Top Menu
 */
const getTopMenu = async (roleId) => {

    await poolConnect;

    const request = pool.request();

    request.input("RoleId", sql.Int, roleId);

    const result = await request.query(`
        SELECT

            PermissionId,
            MenuName,
            MenuUrl,
            MenuIcon

        FROM Permissions

        WHERE

            ParentPermissionId IS NULL
            AND IsMenu=1
            AND IsActive=1

        ORDER BY DisplayOrder;
    `);

    return result.recordset;
};

/**
 * Refresh Menu
 */
const refreshMenu = async (roleId) => {
    return await getSidebarMenu(roleId);
};

/**
 * Get Menu by User
 */
const getMenu = async (userId) => {

    await poolConnect;

    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    const result = await request.query(`

        SELECT DISTINCT

            p.PermissionId,
            p.MenuName,
            p.MenuUrl,
            p.MenuIcon,
            p.DisplayOrder

        FROM Users u

        INNER JOIN UserRoles ur

            ON u.UserId=ur.UserId

        INNER JOIN RolePermissions rp

            ON ur.RoleId=rp.RoleId

        INNER JOIN Permissions p

            ON rp.PermissionId=p.PermissionId

        WHERE

            u.UserId=@UserId
            AND p.IsActive=1
            AND p.IsMenu=1
            AND rp.CanView=1

        ORDER BY p.DisplayOrder;

    `);

    return result.recordset;
};

module.exports = {

    getSidebarMenu,

    getPermissions,

    getTopMenu,

    refreshMenu,

    getMenu

};