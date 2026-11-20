-- Task Tracker > Projects: the people (besides the CFO / Business Head, who
-- always can) allowed to create and run projects. Managed by Admin on the
-- Settings page. Removing someone sets IsActive = 0; adding them again
-- reactivates the same row (UserID is unique).
IF OBJECT_ID('dbo.ProjectCreators', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectCreators (
        ProjectCreatorID INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ProjectCreators PRIMARY KEY,
        UserID       INT       NOT NULL
            CONSTRAINT FK_ProjectCreators_User REFERENCES dbo.Users(UserID),
        IsActive     BIT       NOT NULL
            CONSTRAINT DF_ProjectCreators_IsActive DEFAULT 1,
        CreatedDate  DATETIME2 NOT NULL
            CONSTRAINT DF_ProjectCreators_Created DEFAULT SYSDATETIME(),
        ModifiedDate DATETIME2 NULL,
        CONSTRAINT UQ_ProjectCreators_User UNIQUE (UserID)
    );
END
GO
