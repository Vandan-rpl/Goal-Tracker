CREATE TABLE GoalHistory
(
    GoalHistoryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    GoalID BIGINT NOT NULL,
    Action VARCHAR(30) NOT NULL
        CHECK (Action IN
        (
            'Created',
            'Updated',
            'Submitted',
            'Approved',
            'Rejected',
            'Modified',
            'Cancelled',
            'Continued'
        )),
    OldValue NVARCHAR(MAX) NULL,
    NewValue NVARCHAR(MAX) NULL,
    Remarks NVARCHAR(MAX) NULL,
    PerformedBy INT NOT NULL,
    PerformedDate DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_GoalHistory_Goals
        FOREIGN KEY (GoalID)
        REFERENCES Goals(GoalID),
    CONSTRAINT FK_GoalHistory_PerformedBy
        FOREIGN KEY (PerformedBy)
        REFERENCES Users(UserID)
);
GO