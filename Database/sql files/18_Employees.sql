CREATE TABLE Employees
(
    EmployeeID INT IDENTITY(1,1) PRIMARY KEY,

    EmployeeCode VARCHAR(20) NOT NULL UNIQUE,

    EmployeeName NVARCHAR(200) NOT NULL,

    Email NVARCHAR(150) NOT NULL UNIQUE,

    Mobile VARCHAR(20) NOT NULL UNIQUE,

    DepartmentID INT NOT NULL,

    Designation NVARCHAR(150) NOT NULL,

    Location NVARCHAR(150) NOT NULL,

    JoiningDate DATE NOT NULL,

    ReportingManagerID INT NULL,

    HODID INT NULL,

    BusinessHeadID INT NULL,

    CFOID INT NULL,

    UserRole VARCHAR(50) NOT NULL,

    EmploymentStatus VARCHAR(20) NOT NULL
        CONSTRAINT CK_Employees_Status
        CHECK (EmploymentStatus IN ('Active','Inactive')),

    Remarks NVARCHAR(500) NULL,

    IsDeleted BIT NOT NULL DEFAULT(0),

    CreatedBy INT NULL,

    CreatedDate DATETIME NOT NULL DEFAULT(GETDATE()),

    ModifiedBy INT NULL,

    ModifiedDate DATETIME NULL,

    CONSTRAINT FK_Employees_Department
        FOREIGN KEY (DepartmentID)
        REFERENCES Departments(DepartmentID),

    CONSTRAINT FK_Employees_ReportingManager
        FOREIGN KEY (ReportingManagerID)
        REFERENCES Users(UserID),

    CONSTRAINT FK_Employees_HOD
        FOREIGN KEY (HODID)
        REFERENCES Users(UserID),

    CONSTRAINT FK_Employees_BusinessHead
        FOREIGN KEY (BusinessHeadID)
        REFERENCES Users(UserID),

    CONSTRAINT FK_Employees_CFO
        FOREIGN KEY (CFOID)
        REFERENCES Users(UserID)
);
GO