import React from "react";
import { useParams } from "react-router-dom";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

const IdeaDetails = () => {
  const { ideaId } = useParams();

  return (
    <ModulePlaceholder
      moduleName="Idea Details"
      description={`Full details and status timeline for idea #${ideaId}.`}
      status={STATUS.COMING_SOON}
    />
  );
};

export default IdeaDetails;
