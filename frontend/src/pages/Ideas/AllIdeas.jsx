import IdeaListView from "../../components/IdeaListView/IdeaListView";
import { getAllIdeaFilterOptions, getAllIdeas } from "../../services/ideaService";

const EXTRA_FILTERS = [
  {
    param: "department",
    label: "Department",
    allLabel: "All Departments",
    getOptions: (options) => (options.departments || []).map((name) => ({ value: name, label: name })),
  },
  {
    param: "leadId",
    label: "Lead",
    allLabel: "All Leads",
    getOptions: (options) =>
      (options.leads || []).map((lead) => ({
        value: String(lead.UserID),
        label: lead.DepartmentName ? `${lead.FullName} – ${lead.DepartmentName}` : lead.FullName,
      })),
  },
];

// Every idea in the company (CFO / Admin). View only.
const AllIdeas = () => (
  <IdeaListView
    title="All Ideas"
    description="Every idea shared across the organization."
    fetchIdeas={getAllIdeas}
    fetchFilterOptions={getAllIdeaFilterOptions}
    extraFilters={EXTRA_FILTERS}
    emptyTitle="No ideas have been submitted yet."
  />
);

export default AllIdeas;
