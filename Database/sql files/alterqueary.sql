-- User table changes
ALTER TABLE Users
ADD

DefaultPasswordFlag BIT NOT NULL DEFAULT(1),

PasswordChangedDate DATETIME NULL,

FailedLoginCount INT NOT NULL DEFAULT(0),

IsLocked BIT NOT NULL DEFAULT(0);
GO
ALTER TABLE EmployeeHierarchy
ADD

CFOID INT NULL;
GO

ALTER TABLE EmployeeHierarchy
ADD CONSTRAINT FK_EmployeeHierarchy_CFO
FOREIGN KEY (CFOID)
REFERENCES Users(UserID);
GO

CREATE UNIQUE INDEX UX_EmployeeHierarchy_Current
ON EmployeeHierarchy(UserID)
WHERE IsCurrent=1;
GO
ALTER TABLE PasswordHistory
ADD

IsDefaultPassword BIT NOT NULL DEFAULT(0),

PasswordVersion INT NOT NULL DEFAULT(1);
GO
ALTER TABLE AuditLogs
ADD

ReferenceCode VARCHAR(50) NULL,

ActionStatus VARCHAR(20) NULL,

Remarks NVARCHAR(500) NULL;
GO

-- Goal Table changes

ALTER TABLE dbo.Goals ADD
    StartDate               DATE           NULL,
    CompletionRequestedDate DATETIME       NULL,
    CompletionApprovedBy    INT            NULL,
    AchievedWeightage       DECIMAL(5,2)   NULL,
    CompletionRemark        NVARCHAR(500)  NULL;

-- Goal status changes to include Completion Submitted
DECLARE @c sysname, @sql nvarchar(400);
SELECT @c = name FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.Goals') AND definition LIKE '%GoalStatus%';
IF @c IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.Goals DROP CONSTRAINT ' + QUOTENAME(@c);
    EXEC (@sql);
END

ALTER TABLE dbo.Goals ADD CONSTRAINT CK_Goals_GoalStatus CHECK (GoalStatus IN (
  'Draft','Submitted','Manager Approved','HOD Approved','Reviewed By HOD',
  'Business Head Approved','Review By Business Head','Rejected',
  'Approved','Completion Submitted','Completed','Cancelled'));

SELECT definition FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.Goals') AND definition LIKE '%GoalStatus%';

ALTER TABLE dbo.Users ADD LockoutUntil DATETIME2 NULL;
GO