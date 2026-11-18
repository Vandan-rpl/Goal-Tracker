// Display label for a user role. The "BusinessHead" role is shown as "CFO";
// the stored role value is unchanged (the backend still uses BusinessHead).
const ROLE_LABELS = {
  businesshead: "CFO",
  "business head": "CFO",
  business_head: "CFO",
};

export const getRoleLabel = (role) =>
  ROLE_LABELS[String(role || "").trim().toLowerCase()] || role || "";
