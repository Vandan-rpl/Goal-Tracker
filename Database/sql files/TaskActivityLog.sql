CREATE TABLE dbo.TaskActivityLog (
    LogID        INT IDENTITY(1,1) PRIMARY KEY,
    TaskID       INT NOT NULL,
    ActionBy     INT NOT NULL,
    Action       NVARCHAR(50) NOT NULL,     -- e.g. Created, Assigned, Updated, StatusChanged, CFORemarkAdded, Deleted
    OldValue     NVARCHAR(MAX) NULL,
    NewValue     NVARCHAR(MAX) NULL,
    CreatedDate  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_TaskLog_Task FOREIGN KEY (TaskID)   REFERENCES dbo.Tasks(TaskID),
    CONSTRAINT FK_TaskLog_User FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserID)
);
GO

CREATE INDEX IX_TaskLog_Task ON dbo.TaskActivityLog (TaskID, CreatedDate);
GO