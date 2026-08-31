CREATE TABLE EmployeeHierarchy
(
    HierarchyID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    ReportingManagerID INT NOT NULL,
    HODID INT NOT NULL,
    BusinessHeadID INT NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL,
    IsCurrent BIT NOT NULL DEFAULT 1,
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,
    CONSTRAINT FK_EmployeeHierarchy_User
        FOREIGN KEY (UserID)
        REFERENCES Users(UserID),
    CONSTRAINT FK_EmployeeHierarchy_ReportingManager
        FOREIGN KEY (ReportingManagerID)
        REFERENCES Users(UserID),
    CONSTRAINT FK_EmployeeHierarchy_HOD
        FOREIGN KEY (HODID)
        REFERENCES Users(UserID),
    CONSTRAINT FK_EmployeeHierarchy_BusinessHead
        FOREIGN KEY (BusinessHeadID)
        REFERENCES Users(UserID)
);
GO