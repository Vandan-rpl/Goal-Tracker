import React from "react";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const IdeaReports = () => (
  <ModulePlaceholder
    moduleName="Idea Reports"
    description="Reports and analytics for the Innovation Ideas module."
    status={STATUS.COMING_SOON}
  />
);

export default IdeaReports;
