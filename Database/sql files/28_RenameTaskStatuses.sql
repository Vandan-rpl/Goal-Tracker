-- ============================================================
-- Rename task statuses to match the app (commit dd2d9de):
--   Pending -> Not Started,  Done -> Completed,  new: Started.
-- Without this, assigning or adding a task fails with
--   "The INSERT statement conflicted with the CHECK constraint CK_Tasks_Status".
-- Safe to run more than once.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 1. Drop the old check constraint.
IF OBJECT_ID('dbo.CK_Tasks_Status', 'C') IS NOT NULL
    ALTER TABLE dbo.Tasks DROP CONSTRAINT CK_Tasks_Status;

-- 2. Drop the Status default ('Pending'); its name is system-generated.
DECLARE @df SYSNAME = (
    SELECT dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Tasks')
      AND c.name = 'Status'
);
IF @df IS NOT NULL
    EXEC('ALTER TABLE dbo.Tasks DROP CONSTRAINT [' + @df + ']');

-- 3. Move existing rows to the new names.
UPDATE dbo.Tasks SET Status = 'Not Started' WHERE Status = 'Pending';
UPDATE dbo.Tasks SET Status = 'Completed'   WHERE Status = 'Done';

-- 4. New default and check constraint.
ALTER TABLE dbo.Tasks ADD CONSTRAINT DF_Tasks_Status DEFAULT 'Not Started' FOR Status;
ALTER TABLE dbo.Tasks ADD CONSTRAINT CK_Tasks_Status
    CHECK (Status IN ('Not Started', 'Started', 'In Progress', 'Completed'));

COMMIT TRANSACTION;
GO

-- Check: should list only the four new statuses.
SELECT Status, COUNT(*) AS Tasks FROM dbo.Tasks GROUP BY Status;
GO
