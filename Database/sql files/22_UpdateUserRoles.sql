-- Allow the manager levels used by the employee hierarchy.
DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

SELECT TOP 1 @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.tables t ON t.object_id = cc.parent_object_id
WHERE t.name = 'Users'
  AND cc.definition LIKE '%Role%';

IF @constraintName IS NOT NULL
BEGIN
  SET @sql = N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
  EXEC sys.sp_executesql @sql;
END;

ALTER TABLE dbo.Users
ADD CONSTRAINT CK_Users_Role
CHECK (Role IN ('Employee', 'Assistant Manager', 'Manager', 'Senior Manager', 'HOD', 'BusinessHead', 'Admin'));
GO
