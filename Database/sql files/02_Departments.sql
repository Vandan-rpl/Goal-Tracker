CREATE TABLE Departments
(
    DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentCode VARCHAR(20) NOT NULL,
    DepartmentName NVARCHAR(150) NOT NULL,
    BusinessUnit NVARCHAR(150) NULL,
    DepartmentHead VARCHAR(20) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NULL
);
GO