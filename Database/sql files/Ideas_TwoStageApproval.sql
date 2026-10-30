-- ============================================================
-- Ideas: two-stage approval (reporting manager -> final approver)
-- ============================================================
-- Flow: Draft -> Submitted -> Pending Final Approval -> Active
--       -> In Implementation -> Implemented
-- Rejected at Submitted (reporting manager) or at Pending Final
-- Approval (final approver).
--
-- Changes dbo.Ideas only. Safe to re-run: every step checks
-- whether it has already been applied.
--
--   FinalApproverID   - final approver chosen by the reporting
--                       manager (link to Users, not to
--                       IdeaFinalApprovers, so it survives the
--                       approver being deactivated later)
--   TimelineDays      - already exists; added only if missing
--   ManagerActionDate - when the reporting manager approved/rejected
--   FinalActionDate   - when the final approver approved/rejected
--   RejectedStage     - 'Manager' or 'Final' for Rejected ideas
--
-- The status CHECK replaces 'Accepted' with 'Active' (existing
-- Accepted ideas become Active) and adds 'Pending Final Approval'.
-- 'Under Review' and 'On Hold' are no longer allowed.
-- ============================================================

IF COL_LENGTH(N'dbo.Ideas', N'FinalApproverID') IS NULL
BEGIN
    ALTER TABLE dbo.Ideas ADD FinalApproverID INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.Ideas', N'TimelineDays') IS NULL
BEGIN
    ALTER TABLE dbo.Ideas ADD TimelineDays INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.Ideas', N'ManagerActionDate') IS NULL
BEGIN
    ALTER TABLE dbo.Ideas ADD ManagerActionDate DATETIME2(0) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Ideas', N'FinalActionDate') IS NULL
BEGIN
    ALTER TABLE dbo.Ideas ADD FinalActionDate DATETIME2(0) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Ideas', N'RejectedStage') IS NULL
BEGIN
    ALTER TABLE dbo.Ideas ADD RejectedStage NVARCHAR(20) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Ideas_FinalApprover'
      AND parent_object_id = OBJECT_ID(N'dbo.Ideas')
)
BEGIN
    ALTER TABLE dbo.Ideas
        ADD CONSTRAINT FK_Ideas_FinalApprover
        FOREIGN KEY (FinalApproverID) REFERENCES dbo.Users(UserID);
END;
GO

-- ------------------------------------------------------------
-- Status CHECK: drop the old one (the one that still allows
-- 'Accepted' / lacks 'Pending Final Approval'). The lead and
-- remark CHECKs also mention Status but are left as they are.
-- ------------------------------------------------------------
DECLARE @dropSql NVARCHAR(MAX) = N'';

SELECT @dropSql = @dropSql
    + N'ALTER TABLE dbo.Ideas DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.Ideas')
  AND (cc.name = N'CK_Ideas_Status' OR cc.definition LIKE N'%''Accepted''%')
  AND cc.definition NOT LIKE N'%''Pending Final Approval''%';

IF @dropSql <> N''
BEGIN
    EXEC sys.sp_executesql @dropSql;
END;
GO

UPDATE dbo.Ideas
SET
    Status = N'Active',
    ModifiedDate = SYSDATETIME()
WHERE Status = N'Accepted';
GO

-- Stop with a clear message instead of a constraint error if any
-- idea still has a status the new CHECK doesn't allow.
IF EXISTS (
    SELECT 1
    FROM dbo.Ideas
    WHERE Status NOT IN (
        N'Draft', N'Submitted', N'Pending Final Approval', N'Active',
        N'In Implementation', N'Implemented', N'Rejected')
)
BEGIN
    RAISERROR(N'Some ideas have a status that is no longer allowed (e.g. Under Review / On Hold). Update them first, then re-run this script.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_Ideas_Status'
      AND parent_object_id = OBJECT_ID(N'dbo.Ideas')
)
BEGIN
    ALTER TABLE dbo.Ideas
        ADD CONSTRAINT CK_Ideas_Status CHECK (Status IN (
            N'Draft', N'Submitted', N'Pending Final Approval', N'Active',
            N'In Implementation', N'Implemented', N'Rejected'));
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Ideas_FinalApproverID'
      AND object_id = OBJECT_ID(N'dbo.Ideas')
)
BEGIN
    CREATE INDEX IX_Ideas_FinalApproverID ON dbo.Ideas (FinalApproverID, Status);
END;
GO
