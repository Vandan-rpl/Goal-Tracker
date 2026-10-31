CREATE TABLE dbo.Tasks (
    TaskID              INT IDENTITY(1,1) PRIMARY KEY,
    UserID              INT NOT NULL,                 -- task owner
    TaskName            NVARCHAR(500) NOT NULL,
    Priority            NVARCHAR(10) NOT NULL,
    DueDate             DATE NOT NULL,
    Status              NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    CFORemarks          NVARCHAR(2000) NULL,
    CFORemarksBy        INT NULL,
    CFORemarksDate      DATETIME2 NULL,
    UserRemarks         NVARCHAR(2000) NULL,
    AssignedBy          INT NULL,                     -- NULL = self-added; set = assigned by Business Head
    AssignedDate        DATETIME2 NULL,
    CompletedDate       DATETIME2 NULL,
    IsSeenByUser        BIT NOT NULL DEFAULT 1,       -- 0 = new assignment/remark not yet opened (badge)
    IsDeleted           BIT NOT NULL DEFAULT 0,
    CreatedBy           INT NOT NULL,
    CreatedDate         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedDate        DATETIME2 NULL,
    CONSTRAINT FK_Tasks_User        FOREIGN KEY (UserID)       REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Tasks_AssignedBy  FOREIGN KEY (AssignedBy)   REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Tasks_CFORemarksBy FOREIGN KEY (CFORemarksBy) REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Tasks_CreatedBy   FOREIGN KEY (CreatedBy)    REFERENCES dbo.Users(UserID),
    CONSTRAINT CK_Tasks_Priority CHECK (Priority IN ('Low','Medium','High')),
    CONSTRAINT CK_Tasks_Status   CHECK (Status IN ('Pending','In Progress','Done'))
);
GO

CREATE INDEX IX_Tasks_User_DueDate ON dbo.Tasks (UserID, DueDate) WHERE IsDeleted = 0;
CREATE INDEX IX_Tasks_Unseen       ON dbo.Tasks (UserID) WHERE IsSeenByUser = 0 AND IsDeleted = 0;
GO
