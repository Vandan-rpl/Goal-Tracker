CREATE TABLE dbo.GoalCarryForwardHistory (
    HistoryID INT IDENTITY(1,1) PRIMARY KEY,
    GoalID INT NOT NULL,
    FromQuarter NVARCHAR(20) NOT NULL,
    ToQuarter NVARCHAR(20) NOT NULL,
    ProgressAtCarryForward DECIMAL(5,2) NOT NULL,
    CarriedForwardDate DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_CarryForwardHistory_Goal FOREIGN KEY (GoalID) REFERENCES dbo.Goals(GoalID) ON DELETE CASCADE
);