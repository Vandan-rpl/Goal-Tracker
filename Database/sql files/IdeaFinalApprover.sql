IF OBJECT_ID('dbo.IdeaFinalApprovers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IdeaFinalApprovers (
        IdeaFinalApproverID INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_IdeaFinalApprovers PRIMARY KEY,
        UserID       INT       NOT NULL
            CONSTRAINT FK_IdeaFinalApprovers_User REFERENCES dbo.Users(UserID),
        IsActive     BIT       NOT NULL
            CONSTRAINT DF_IdeaFinalApprovers_IsActive DEFAULT 1,
        DisplayOrder INT       NULL,
        CreatedDate  DATETIME2 NOT NULL
            CONSTRAINT DF_IdeaFinalApprovers_Created DEFAULT SYSDATETIME(),
        ModifiedDate DATETIME2 NULL,
        CONSTRAINT UQ_IdeaFinalApprovers_User UNIQUE (UserID)
    );
END
GO

