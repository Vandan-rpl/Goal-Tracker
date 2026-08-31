CREATE INDEX IX_Employees_Code
ON Employees(EmployeeCode);

CREATE INDEX IX_Employees_Email
ON Employees(Email);

CREATE INDEX IX_Employees_Department
ON Employees(DepartmentID);

CREATE INDEX IX_Employees_Status
ON Employees(EmploymentStatus);

CREATE INDEX IX_Employees_Location
ON Employees(Location);

CREATE INDEX IX_Employees_Manager
ON Employees(ReportingManagerID);

CREATE INDEX IX_Employees_HOD
ON Employees(HODID);

CREATE INDEX IX_Employees_BusinessHead
ON Employees(BusinessHeadID);

CREATE INDEX IX_Employees_CFO
ON Employees(CFOID);
GO