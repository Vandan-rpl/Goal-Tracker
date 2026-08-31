CREATE TABLE QuarterlyUpdates
(
    QuarterUpdateID BIGINT IDENTITY(1,1) PRIMARY KEY,
    GoalID BIGINT NOT NULL,
    Quarter VARCHAR(2) NOT NULL
        CHECK (Quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    ProgressPercentage DECIMAL(5,2) NOT NULL,
    Achievements NVARCHAR(MAX) NULL,
    Challenges NVARCHAR(MAX) NULL,
    EvidenceFile NVARCHAR(500) NULL,
    EmployeeComment NVARCHAR(MAX) NULL,
    SubmittedDate DATETIME NOT NULL DEFAULT GETDATE(),
    Status VARCHAR(30) NOT NULL
        CHECK (Status IN
        (
            'Draft',
            'Submitted',
            'Reviewed',
            'Approved',
            'Rejected'
        )),
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,
    CONSTRAINT FK_QuarterlyUpdates_Goals
        FOREIGN KEY (GoalID)
        REFERENCES Goals(GoalID)
);
GO