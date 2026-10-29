import React from "react";
import { useParams } from "react-router-dom";
import ModulePlaceholder, { STATUS } from "../../components/ModulePlaceholder/ModulePlaceholder";

// Share an Idea form. Opened with an :ideaId it edits that Draft.
const ShareIdea = () => {
  const { ideaId } = useParams();

  return (
    <ModulePlaceholder
      moduleName={ideaId ? "Edit Draft" : "Share an Idea"}
      description={
        ideaId
          ? `Editing draft idea #${ideaId}.`
          : "Share an idea or suggestion to improve any process in the organization."
      }
      status={STATUS.COMING_SOON}
    />
  );
};

export default ShareIdea;
