import React from "react";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const AllIdeas = () => (
  <ModulePlaceholder
    moduleName="All Ideas"
    description="Every idea shared across the organization."
    status={STATUS.COMING_SOON}
  />
);

export default AllIdeas;
