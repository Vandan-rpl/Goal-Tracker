CREATE TABLE dbo.PasswordHistory (
    HistoryID     INT IDENTITY(1,1) PRIMARY KEY,
    UserID        INT NOT NULL,
    PasswordHash  NVARCHAR(255) NOT NULL,
    CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PasswordHistory_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE INDEX IX_PasswordHistory_User_Created
    ON dbo.PasswordHistory (UserID, CreatedAt DESC);
GO