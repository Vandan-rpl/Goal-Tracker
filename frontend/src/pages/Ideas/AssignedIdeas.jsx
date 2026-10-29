import React from "react";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const AssignedIdeas = () => (
  <ModulePlaceholder
    moduleName="Assigned to Me"
    description="Ideas where you have been selected as the lead."
    status={STATUS.COMING_SOON}
  />
);

export default AssignedIdeas;
