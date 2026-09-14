CREATE TABLE Users
(
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeCode VARCHAR(20) NOT NULL UNIQUE,
    Username VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NULL,
    MobileNo VARCHAR(20) NULL,
    DepartmentID INT NOT NULL,
    Designation NVARCHAR(150) NULL,
    Grade NVARCHAR(50) NULL,
    Post NVARCHAR(100) NULL,
    ReportingManagerID INT NULL,
    HODID INT NULL,
    BusinessHeadID INT NULL,
    Role VARCHAR(30) NOT NULL
        CHECK (Role IN ('Employee','Manager','HOD','BusinessHead','Admin')),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL,

    CONSTRAINT FK_Users_Department
        FOREIGN KEY (DepartmentID)
        REFERENCES Departments(DepartmentID)
);
GO