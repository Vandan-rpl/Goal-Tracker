CREATE TABLE dbo.GoalJointAccountability (
    JointAccountabilityID INT IDENTITY(1,1) PRIMARY KEY,
    GoalID INT NOT NULL,
    UserID INT NOT NULL,
    ContributionNote NVARCHAR(500) NULL,
    Weightage DECIMAL(5,2) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',  -- Pending / Accepted / Declined
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,
    CONSTRAINT FK_JointAccountability_Goal FOREIGN KEY (GoalID) REFERENCES dbo.Goals(GoalID) ON DELETE CASCADE,
    CONSTRAINT FK_JointAccountability_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
    CONSTRAINT CK_JointAccountability_Status CHECK (Status IN ('Pending', 'Accepted', 'Declined'))
);

-- Prevent adding the same person twice to the same goal
CREATE UNIQUE INDEX UQ_JointAccountability_Goal_User
    ON dbo.GoalJointAccountability (GoalID, UserID);