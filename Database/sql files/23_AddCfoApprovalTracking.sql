/* Add explicit CFO approval tracking and keep GoalStatus aligned with the approval workflow. */

IF COL_LENGTH('dbo.Goals', 'CFOApprovedBy') IS NULL
BEGIN
    ALTER TABLE dbo.Goals ADD CFOApprovedBy INT NULL;
END;
GO

IF COL_LENGTH('dbo.Goals', 'CFOApprovedDate') IS NULL
BEGIN
    ALTER TABLE dbo.Goals ADD CFOApprovedDate DATETIME NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Goals_CFOApprovedBy'
      AND parent_object_id = OBJECT_ID('dbo.Goals')
)
BEGIN
    ALTER TABLE dbo.Goals
    ADD CONSTRAINT FK_Goals_CFOApprovedBy
        FOREIGN KEY (CFOApprovedBy)
        REFERENCES dbo.Users(UserID);
END;
GO

DECLARE @constraintName sysname;
DECLARE @dropConstraintSql nvarchar(max);
DECLARE constraintCursor CURSOR LOCAL FAST_FORWARD FOR
SELECT cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.Goals')
  AND cc.definition LIKE '%GoalStatus%';

OPEN constraintCursor;
FETCH NEXT FROM constraintCursor INTO @constraintName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @dropConstraintSql = N'ALTER TABLE dbo.Goals DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @dropConstraintSql;
    FETCH NEXT FROM constraintCursor INTO @constraintName;
END;
CLOSE constraintCursor;
DEALLOCATE constraintCursor;
GO

ALTER TABLE dbo.Goals
ADD CONSTRAINT CK_Goals_GoalStatus
CHECK (GoalStatus IN (
    'Draft',
    'Submitted',
    'HOD Approved',
    'Reviewed By HOD',
    'Business Head Approved',
    'Review By Business Head',
    'Rejected',
    'Completed',
    'Cancelled',
    'Running',
    'Approved',
    'Postpone'
));
GO
