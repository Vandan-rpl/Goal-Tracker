export const getUniqueDepartments = (departments = [], preferredDepartmentID) => {
  const groupedDepartments = new Map();

  departments.forEach((department) => {
    const name = String(department.DepartmentName || "").trim();
    const key = name.toLocaleLowerCase();
    if (!key) return;

    const group = groupedDepartments.get(key) || [];
    group.push({ ...department, DepartmentName: name });
    groupedDepartments.set(key, group);
  });

  return Array.from(groupedDepartments.values())
    .map((group) => {
      const preferred = group.find(
        (department) =>
          String(department.DepartmentID) === String(preferredDepartmentID),
      );
      return (
        preferred ||
        group.reduce((selected, department) =>
          Number(department.DepartmentID) < Number(selected.DepartmentID)
            ? department
            : selected,
        )
      );
    })
    .sort((first, second) =>
      first.DepartmentName.localeCompare(second.DepartmentName),
    );
};