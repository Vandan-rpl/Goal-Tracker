import React from "react";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const TeamIdeas = () => (
  <ModulePlaceholder
    moduleName="Team Ideas"
    description="Ideas shared by the people who report to you."
    status={STATUS.COMING_SOON}
  />
);

export default TeamIdeas;
