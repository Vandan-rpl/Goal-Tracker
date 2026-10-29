CREATE TABLE dbo.Ideas (
        IdeaID            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Ideas PRIMARY KEY,
 
        -- Display number, e.g. IDEA-0001 (generated automatically)
        IdeaNumber AS (CONCAT('IDEA-',
                       REPLICATE('0', 4 - LEN(IdeaID)), IdeaID)) PERSISTED,
 
        UserID            INT               NOT NULL,   -- submitter (link to Users)
        Title             NVARCHAR(200)     NOT NULL,
        Description       NVARCHAR(4000)    NOT NULL,
        Purpose           NVARCHAR(100)     NOT NULL,   -- value from the frontend dropdown
        AssignedLeadID    INT               NULL,       -- lead chosen at submission (link to Users)
        TimelineDays      INT               NULL,       -- days needed, entered by the lead
        TimelineSetDate   DATETIME2(0)      NULL,       -- when the lead entered the timeline
        TargetDate AS (DATEADD(DAY, TimelineDays, CAST(TimelineSetDate AS DATE))) PERSISTED,  -- auto: due date
        Remarks           NVARCHAR(1000)    NULL,       -- latest remark (history in IdeaActivityLog)
 
        Status            NVARCHAR(30)      NOT NULL CONSTRAINT DF_Ideas_Status DEFAULT (N'Draft'),
        SubmittedDate     DATETIME2(0)      NULL,
        ReviewedBy        INT               NULL,       -- reviewer (link to Users)
        ReviewedDate      DATETIME2(0)      NULL,
        ImplementedDate   DATETIME2(0)      NULL,
 
        CreatedDate       DATETIME2(0)      NOT NULL CONSTRAINT DF_Ideas_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate      DATETIME2(0)      NULL,
 
        CONSTRAINT CK_Ideas_Status CHECK (Status IN (
            N'Draft', N'Submitted', N'Under Review',
            N'Accepted', N'Rejected', N'On Hold',
            N'In Implementation', N'Implemented')),
 
        -- A lead must be assigned before the idea leaves Draft
        CONSTRAINT CK_Ideas_LeadRequired CHECK (
            Status = N'Draft' OR AssignedLeadID IS NOT NULL),
 
        CONSTRAINT CK_Ideas_TimelineDays CHECK (TimelineDays IS NULL OR TimelineDays > 0),
 
        -- Remark is mandatory for Rejected and On Hold
        CONSTRAINT CK_Ideas_RemarkRequired CHECK (
            Status NOT IN (N'Rejected', N'On Hold')
            OR (Remarks IS NOT NULL AND LEN(LTRIM(RTRIM(Remarks))) > 0)),
 
        CONSTRAINT FK_Ideas_User         FOREIGN KEY (UserID)         REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Ideas_AssignedLead FOREIGN KEY (AssignedLeadID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Ideas_ReviewedBy   FOREIGN KEY (ReviewedBy)     REFERENCES dbo.Users(UserID)
    );
 
    CREATE UNIQUE INDEX UX_Ideas_IdeaNumber     ON dbo.Ideas (IdeaNumber);
    CREATE INDEX        IX_Ideas_UserID         ON dbo.Ideas (UserID, Status);
    CREATE INDEX        IX_Ideas_Status         ON dbo.Ideas (Status);
    CREATE INDEX        IX_Ideas_AssignedLeadID ON dbo.Ideas (AssignedLeadID) WHERE AssignedLeadID IS NOT NULL;