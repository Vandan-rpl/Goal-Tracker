import React from "react";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const MyIdeas = () => (
  <ModulePlaceholder
    moduleName="My Ideas"
    description="Ideas you have shared, with their current status."
    status={STATUS.COMING_SOON}
  />
);

export default MyIdeas;
