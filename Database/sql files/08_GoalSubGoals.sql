CREATE TABLE GoalSubGoals
(
    SubGoalID BIGINT IDENTITY(1,1) PRIMARY KEY,
    GoalID BIGINT NOT NULL,
    SubGoalNo INT NOT NULL,
    SubGoalTitle NVARCHAR(500) NOT NULL,
    SubGoalDescription NVARCHAR(MAX) NULL,
    Weightage DECIMAL(5,2) NOT NULL,
    Target NVARCHAR(MAX) NULL,
    Status VARCHAR(30) NOT NULL
        CHECK (Status IN
        (
            'Pending',
            'In Progress',
            'Completed',
            'Cancelled'
        )),
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_GoalSubGoals_Goals
        FOREIGN KEY (GoalID)
        REFERENCES Goals(GoalID)
);
GO