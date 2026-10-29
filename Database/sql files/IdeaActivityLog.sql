CREATE TABLE dbo.IdeaActivityLog (
        LogID        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IdeaActivityLog PRIMARY KEY,
        IdeaID       INT               NOT NULL,
        ActionBy     INT               NOT NULL,    -- link to Users
        Action       NVARCHAR(50)      NOT NULL,    -- e.g. Submitted, Lead Assigned, Rejected
        FromStatus   NVARCHAR(30)      NULL,
        ToStatus     NVARCHAR(30)      NULL,
        Remark       NVARCHAR(1000)    NULL,
        ActionDate   DATETIME2(0)      NOT NULL CONSTRAINT DF_IdeaActivityLog_ActionDate DEFAULT (SYSDATETIME()),
 
        CONSTRAINT FK_IdeaActivityLog_Idea     FOREIGN KEY (IdeaID)   REFERENCES dbo.Ideas(IdeaID) ON DELETE CASCADE,
        CONSTRAINT FK_IdeaActivityLog_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserID)
    );
 
    CREATE INDEX IX_IdeaActivityLog_IdeaID ON dbo.IdeaActivityLog (IdeaID, ActionDate);