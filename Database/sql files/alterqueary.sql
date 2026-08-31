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