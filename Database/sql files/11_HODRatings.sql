CREATE TABLE HODRatings
(
    HODRatingID BIGINT IDENTITY(1,1) PRIMARY KEY,
    GoalID BIGINT NOT NULL,
    Quarter VARCHAR(2) NOT NULL
        CHECK (Quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    Rating DECIMAL(3,1) NOT NULL
        CHECK (Rating BETWEEN 0.0 AND 5.0),
    AchievementPercentage DECIMAL(5,2) NOT NULL
        CHECK (AchievementPercentage BETWEEN 0.00 AND 100.00),
    Comments NVARCHAR(MAX) NULL,
    ReviewedBy INT NOT NULL,
    ReviewedDate DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,
    CONSTRAINT FK_HODRatings_Goals
        FOREIGN KEY (GoalID)
        REFERENCES Goals(GoalID),
    CONSTRAINT FK_HODRatings_ReviewedBy
        FOREIGN KEY (ReviewedBy)
        REFERENCES Users(UserID),
    CONSTRAINT UQ_HODRatings_Goal_Quarter
        UNIQUE (GoalID, Quarter)
);
GO