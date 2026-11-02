IF OBJECT_ID('dbo.Projects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Projects (
        ProjectID      INT IDENTITY(1,1) NOT NULL,
        ProjectName    NVARCHAR(200)     NOT NULL,
        Description    NVARCHAR(MAX)     NULL,
        CreatedBy      INT               NOT NULL,
        CreatedDate    DATETIME          NOT NULL CONSTRAINT DF_Projects_CreatedDate DEFAULT (GETDATE()),
        ModifiedDate   DATETIME          NULL,
        IsActive       BIT               NOT NULL CONSTRAINT DF_Projects_IsActive DEFAULT (1),
        CONSTRAINT PK_Projects PRIMARY KEY (ProjectID),
        CONSTRAINT FK_Projects_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID)
    );
END
GO