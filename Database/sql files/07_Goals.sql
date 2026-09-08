CREATE TABLE Goals
(
    GoalID BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    GoalNumber INT NOT NULL,
    GoalTitle NVARCHAR(500) NOT NULL,
    GoalDescription NVARCHAR(MAX) NULL,
    Measurability NVARCHAR(MAX) NULL,
    JointAccountability NVARCHAR(MAX) NULL,
    Weightage DECIMAL(5,2) NOT NULL,
    Priority VARCHAR(20) NOT NULL
        CHECK (Priority IN ('Low','Medium','High','Critical')),
    Timeline DATE NOT NULL,
    MeetPerformance NVARCHAR(MAX) NULL,
    ExceedPerformance NVARCHAR(MAX) NULL,
    ValidationSource NVARCHAR(MAX) NULL,
    CrossFunctionalGoal BIT NOT NULL DEFAULT 0,
    GoalCategory NVARCHAR(100) NULL,
    GoalStatus VARCHAR(50) NOT NULL
        CHECK (GoalStatus IN
        (
            'Draft',
            'Submitted',
            'HOD Approved',
            'Reviewed By HOD',
            'Business Head Approved',
            'Review By Business Head',
            'Rejected',
            'Completed',
            'Cancelled',
            'Running',
            'Approved',
            'Postpone'
        )),
    DraftVersion INT NOT NULL DEFAULT 1,
    ParentGoalID BIGINT NULL,
    SubmittedDate DATETIME NULL,
    ApprovedDate DATETIME NULL,
    CompletedDate DATETIME NULL,
    CancelledDate DATETIME NULL,
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,
    CONSTRAINT FK_Goals_User
        FOREIGN KEY (UserID)
        REFERENCES Users(UserID),
    CONSTRAINT FK_Goals_ParentGoal
        FOREIGN KEY (ParentGoalID)
        REFERENCES Goals(GoalID)
);
GO