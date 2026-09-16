/* Add the role-specific first-stage approval status used by Managers. */

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

ALTER TABLE dbo.Goals
ADD CONSTRAINT CK_Goals_GoalStatus
CHECK (GoalStatus IN (
    'Draft',
    'Submitted',
    'HOD Approved',
    'Manager Approved',
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
