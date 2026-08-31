CREATE TABLE Notifications
(
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,

    UserId INT NOT NULL,

    Title NVARCHAR(200) NOT NULL,

    Message NVARCHAR(MAX) NOT NULL,

    NotificationType NVARCHAR(50) NOT NULL,

    ReferenceId INT NULL,

    ReferenceType NVARCHAR(50) NULL,

    IsRead BIT NOT NULL DEFAULT 0,

    ReadAt DATETIME2 NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

    CreatedBy INT NULL,

    CONSTRAINT FK_Notifications_User
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
);
GO

CREATE INDEX IX_Notifications_User
ON Notifications(UserId);

CREATE INDEX IX_Notifications_IsRead
ON Notifications(IsRead);

CREATE INDEX IX_Notifications_CreatedAt
ON Notifications(CreatedAt DESC);
GO