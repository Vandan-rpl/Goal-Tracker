IF OBJECT_ID('dbo.ProjectMembers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectMembers (
        ProjectMemberID INT IDENTITY(1,1) NOT NULL,
        ProjectID       INT      NOT NULL,
        UserID          INT      NOT NULL,
        AddedBy         INT      NOT NULL,
        AddedDate       DATETIME NOT NULL CONSTRAINT DF_ProjectMembers_AddedDate DEFAULT (GETDATE()),
        IsActive        BIT      NOT NULL CONSTRAINT DF_ProjectMembers_IsActive DEFAULT (1),
        RemovedDate     DATETIME NULL,
        CONSTRAINT PK_ProjectMembers PRIMARY KEY (ProjectMemberID),
        CONSTRAINT FK_ProjectMembers_Project FOREIGN KEY (ProjectID) REFERENCES dbo.Projects(ProjectID),
        CONSTRAINT FK_ProjectMembers_User    FOREIGN KEY (UserID)    REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_ProjectMembers_AddedBy FOREIGN KEY (AddedBy)   REFERENCES dbo.Users(UserID),
        CONSTRAINT UQ_ProjectMembers_Project_User UNIQUE (ProjectID, UserID)
    );
END
GO