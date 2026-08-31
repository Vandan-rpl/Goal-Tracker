CREATE VIEW vwEmployeeMaster
AS

SELECT

E.EmployeeID,
E.EmployeeCode,
E.EmployeeName,
E.Email,
E.Mobile,

D.DepartmentName,

E.Designation,

E.Location,

E.JoiningDate,

RM.Username AS ReportingManager,

HOD.Username AS HOD,

BH.Username AS BusinessHead,

CFO.Username AS CFO,

E.UserRole,

E.EmploymentStatus,

E.Remarks

FROM Employees E

INNER JOIN Departments D
ON D.DepartmentID=E.DepartmentID

LEFT JOIN Users RM
ON RM.UserID=E.ReportingManagerID

LEFT JOIN Users HOD
ON HOD.UserID=E.HODID

LEFT JOIN Users BH
ON BH.UserID=E.BusinessHeadID

LEFT JOIN Users CFO
ON CFO.UserID=E.CFOID

WHERE E.IsDeleted=0;
GO