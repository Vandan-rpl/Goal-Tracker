import IdeaListView from "../../components/IdeaListView/IdeaListView";
import { getTeamIdeaFilterOptions, getTeamIdeas } from "../../services/ideaService";

const EXTRA_FILTERS = [
  {
    param: "memberId",
    label: "Team Member",
    allLabel: "All Team Members",
    getOptions: (options) =>
      (options.members || []).map((member) => ({
        value: String(member.UserID),
        label: member.DepartmentName ? `${member.FullName} – ${member.DepartmentName}` : member.FullName,
      })),
  },
];

// Ideas submitted by the viewer's direct reports. View only.
const TeamIdeas = () => (
  <IdeaListView
    title="Team Ideas"
    description="Ideas submitted by the people who report to you."
    fetchIdeas={getTeamIdeas}
    fetchFilterOptions={getTeamIdeaFilterOptions}
    extraFilters={EXTRA_FILTERS}
    emptyTitle="No ideas have been submitted by your team yet."
  />
);

export default TeamIdeas;
