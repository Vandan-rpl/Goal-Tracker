import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import SearchableSelect from "../../components/SearchableSelect/SearchableSelect";
import {
  createIdeaDraft,
  deleteIdeaDraft,
  getIdea,
  getIdeaApiError,
  getIdeaLeads,
  getIdeaPurposes,
  submitIdea,
  updateIdeaDraft,
} from "../../services/ideaService";
import { IDEAS_HOME_PATH } from "../../utils/ideasMenu";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 2000;

const EMPTY_FORM = {
  title: "",
  description: "",
  purpose: "",
  assignedLeadId: null,
};

const inputClass = (hasError) =>
  `w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
    hasError ? "border-red-500" : "border-slate-300"
  }`;

const toPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  purpose: form.purpose,
  assignedLeadId: form.assignedLeadId,
});

// Compared against the last saved/loaded values to detect unsaved changes.
const snapshotOf = (form) => JSON.stringify(toPayload(form));

// Save as Draft needs only a title (the backend requires one to save);
// Submit needs every field.
const validateForm = (form, { requireAll }) => {
  const errors = {};
  const title = form.title.trim();
  const description = form.description.trim();

  if (!title) {
    errors.title = requireAll ? "Title is required." : "Enter a title to save a draft.";
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title cannot exceed ${TITLE_MAX} characters.`;
  }

  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description cannot exceed ${DESCRIPTION_MAX} characters.`;
  } else if (requireAll && !description) {
    errors.description = "Description is required.";
  }

  if (requireAll && !form.purpose) {
    errors.purpose = "Purpose is required.";
  }

  if (requireAll && !form.assignedLeadId) {
    errors.assignedLeadId = "Reporting manager is required.";
  }

  return errors;
};

// Put backend validation messages under the field they refer to.
const fieldErrorsFromApi = (details) =>
  details.reduce((errors, message) => {
    const text = String(message);
    if (/^title/i.test(text)) errors.title = text;
    else if (/^description/i.test(text)) errors.description = text;
    else if (/^purpose/i.test(text)) errors.purpose = text;
    else if (/reporting manager/i.test(text)) errors.assignedLeadId = text;
    return errors;
  }, {});

const CharCounter = ({ length, max }) => (
  <span className={`text-xs ${length > max ? "text-red-600 font-semibold" : "text-slate-400"}`}>
    {length}/{max}
  </span>
);

// Share an Idea form. Opened as /ideas/edit/:ideaId it edits that Draft.
const ShareIdea = () => {
  const navigate = useNavigate();
  const { ideaId: routeIdeaId } = useParams();

  const [form, setForm] = useState(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshotOf(EMPTY_FORM));
  // The draft currently in the form. Switching the URL from /share to
  // /edit/:id after the first save doesn't reload it, since it matches.
  const [draftId, setDraftId] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  const [purposes, setPurposes] = useState([]);
  const [leads, setLeads] = useState([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState("");

  const [loadingDraft, setLoadingDraft] = useState(Boolean(routeIdeaId));
  // null | "draft" | "submit" | "delete"
  const [busy, setBusy] = useState(null);
  // null | "submit" | "delete" | "cancel"
  const [dialog, setDialog] = useState(null);

  // Opening Share an Idea from the sidebar while editing a draft starts a
  // fresh form (adjusting state during render, not in an effect).
  const [prevRouteIdeaId, setPrevRouteIdeaId] = useState(routeIdeaId);
  if (routeIdeaId !== prevRouteIdeaId) {
    setPrevRouteIdeaId(routeIdeaId);
    if (!routeIdeaId) {
      setForm(EMPTY_FORM);
      setSavedSnapshot(snapshotOf(EMPTY_FORM));
      setDraftId(null);
      setFieldErrors({});
      setApiError(null);
    }
  }

  const isEditMode = Boolean(draftId);
  const isDirty = snapshotOf(form) !== savedSnapshot;
  const isBusy = busy !== null;
  const formDisabled = isBusy || loadingDraft;

  useEffect(() => {
    let ignore = false;

    const loadLists = async () => {
      try {
        const [purposeList, leadList] = await Promise.all([getIdeaPurposes(), getIdeaLeads()]);
        if (ignore) return;
        setPurposes(purposeList || []);
        setLeads(leadList || []);
      } catch (err) {
        if (!ignore) {
          setListsError(getIdeaApiError(err, "Unable to load the purpose and reporting manager lists.").message);
        }
      } finally {
        if (!ignore) setListsLoading(false);
      }
    };

    loadLists();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!routeIdeaId) return undefined;

    const ideaId = Number(routeIdeaId);
    if (ideaId === draftId) return undefined;

    let ignore = false;

    const loadDraft = async () => {
      setLoadingDraft(true);
      try {
        const idea = await getIdea(ideaId);
        if (ignore) return;

        // CanEdit = the logged-in user's own idea, still in Draft.
        if (!idea.CanEdit) {
          toast.error(
            idea.Status !== "Draft"
              ? `${idea.IdeaNumber} is ${idea.Status} and can no longer be edited.`
              : "You can only edit your own draft ideas.",
          );
          navigate(IDEAS_HOME_PATH, { replace: true });
          return;
        }

        const loaded = {
          title: idea.Title || "",
          description: idea.Description || "",
          purpose: idea.Purpose || "",
          assignedLeadId: idea.AssignedLeadID ?? null,
        };

        setDraftId(ideaId);
        setForm(loaded);
        setSavedSnapshot(snapshotOf(loaded));
        setFieldErrors({});
        setApiError(null);
      } catch (err) {
        if (ignore) return;
        toast.error(getIdeaApiError(err, "Unable to open this idea.").message);
        navigate(IDEAS_HOME_PATH, { replace: true });
      } finally {
        if (!ignore) setLoadingDraft(false);
      }
    };

    loadDraft();
    return () => {
      ignore = true;
    };
  }, [routeIdeaId, draftId, navigate]);

  const leadOptions = useMemo(
    () =>
      leads.map((lead) => ({
        value: lead.UserID,
        label: lead.DepartmentName ? `${lead.FullName} – ${lead.DepartmentName}` : lead.FullName,
      })),
    [leads],
  );

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const rest = { ...previous };
      delete rest[field];
      return rest;
    });
  };

  const showApiError = (err, fallback) => {
    const error = getIdeaApiError(err, fallback);
    setApiError(error);
    setFieldErrors((previous) => ({ ...previous, ...fieldErrorsFromApi(error.details) }));
  };

  // Create the draft on first save, otherwise update it if anything changed.
  // Returns the draft's id.
  const persistDraft = async () => {
    const payload = toPayload(form);

    if (!draftId) {
      const idea = await createIdeaDraft(payload);
      setDraftId(idea.IdeaID);
      setSavedSnapshot(snapshotOf(form));
      // From here on the page edits this draft, so later saves update it.
      navigate(`/ideas/edit/${idea.IdeaID}`, { replace: true });
      return idea.IdeaID;
    }

    if (isDirty) {
      await updateIdeaDraft(draftId, payload);
      setSavedSnapshot(snapshotOf(form));
    }

    return draftId;
  };

  const handleSaveDraft = async () => {
    const errors = validateForm(form, { requireAll: false });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (isEditMode && !isDirty) {
      toast.info("No changes to save.");
      return;
    }

    const wasNew = !isEditMode;
    setBusy("draft");
    setApiError(null);

    try {
      await persistDraft();
      toast.success(wasNew ? "Idea saved as draft." : "Draft updated.");
    } catch (err) {
      showApiError(err, "Failed to save the draft.");
    } finally {
      setBusy(null);
    }
  };

  const handleSubmitClick = () => {
    const errors = validateForm(form, { requireAll: true });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setApiError(null);
    setDialog("submit");
  };

  const confirmSubmit = async () => {
    setBusy("submit");
    setApiError(null);

    try {
      const ideaId = await persistDraft();
      const idea = await submitIdea(ideaId);
      // Shown at the top of My Ideas.
      navigate(IDEAS_HOME_PATH, { state: { successMessage: `${idea.IdeaNumber} submitted.` } });
    } catch (err) {
      setDialog(null);
      showApiError(err, "Failed to submit the idea.");
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    setBusy("delete");
    setApiError(null);

    try {
      await deleteIdeaDraft(draftId);
      navigate(IDEAS_HOME_PATH, { state: { successMessage: "Draft deleted." } });
    } catch (err) {
      setDialog(null);
      showApiError(err, "Failed to delete the draft.");
      setBusy(null);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setDialog("cancel");
    } else {
      navigate(IDEAS_HOME_PATH);
    }
  };

  return (
    <div className="flex-1 bg-white min-h-screen p-4 sm:p-6 md:p-8 text-slate-800">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
              Innovation Ideas
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditMode ? "Edit Draft" : "Share an Idea"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Suggest an improvement to any process in the organization.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isBusy}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition shrink-0 shadow-sm disabled:opacity-50"
          >
            &larr; Back to My Ideas
          </button>
        </div>

        {/* Notice Banners */}
        {listsError && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
            <span className="text-amber-600 font-bold">⚠️</span>
            <p>{listsError} Refresh the page to try again.</p>
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-medium"
          >
            <span className="text-red-500 font-bold">✕</span>
            <div>
              <p>{apiError.message}</p>
              {apiError.details.length > 0 && apiError.details[0] !== apiError.message && (
                <ul className="mt-1 list-disc pl-5 font-normal">
                  {apiError.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {loadingDraft ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-500">
            Loading draft...
          </div>
        ) : (
          <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                Idea Details
              </h2>

              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="idea-title" className="block text-xs font-semibold text-slate-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <CharCounter length={form.title.length} max={TITLE_MAX} />
                </div>
                <input
                  id="idea-title"
                  type="text"
                  maxLength={TITLE_MAX}
                  disabled={formDisabled}
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="A short name for your idea"
                  aria-invalid={Boolean(fieldErrors.title)}
                  className={inputClass(fieldErrors.title)}
                />
                {fieldErrors.title && (
                  <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="idea-description" className="block text-xs font-semibold text-slate-700">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <CharCounter length={form.description.length} max={DESCRIPTION_MAX} />
                </div>
                <textarea
                  id="idea-description"
                  rows={8}
                  maxLength={DESCRIPTION_MAX}
                  disabled={formDisabled}
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.description)}
                  aria-describedby="idea-description-help"
                  className={`${inputClass(fieldErrors.description)} resize-y`}
                />
                {fieldErrors.description ? (
                  <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.description}</p>
                ) : (
                  <p id="idea-description-help" className="text-slate-500 text-xs mt-1">
                    Describe the current problem and your proposed improvement.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Purpose */}
                <div>
                  <label htmlFor="idea-purpose" className="block text-xs font-semibold text-slate-700 mb-1">
                    Purpose <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="idea-purpose"
                    disabled={formDisabled || listsLoading}
                    value={form.purpose}
                    onChange={(event) => updateField("purpose", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.purpose)}
                    className={inputClass(fieldErrors.purpose)}
                  >
                    <option value="">{listsLoading ? "Loading..." : "Select purpose"}</option>
                    {purposes.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.purpose && (
                    <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.purpose}</p>
                  )}
                </div>

                {/* Reporting Manager (stored as the lead) */}
                <div>
                  <label htmlFor="idea-lead" className="block text-xs font-semibold text-slate-700 mb-1">
                    Reporting Manager <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    id="idea-lead"
                    options={leadOptions}
                    value={form.assignedLeadId}
                    onChange={(value) => updateField("assignedLeadId", value)}
                    placeholder="Search by name or department"
                    disabled={formDisabled}
                    loading={listsLoading}
                    hasError={Boolean(fieldErrors.assignedLeadId)}
                    aria-invalid={Boolean(fieldErrors.assignedLeadId)}
                  />
                  {fieldErrors.assignedLeadId && (
                    <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.assignedLeadId}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    Your reporting manager will review the idea and send it for final approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => setDialog("delete")}
                  disabled={isBusy}
                  className="w-full sm:w-auto sm:mr-auto px-5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
                >
                  {busy === "delete" ? "Deleting..." : "Delete Draft"}
                </button>
              )}

              <button
                type="button"
                onClick={handleCancel}
                disabled={isBusy}
                className="w-full sm:w-auto px-5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isBusy}
                className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
              >
                {busy === "draft" ? "Saving..." : "Save as Draft"}
              </button>

              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={isBusy || listsLoading}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
              >
                {busy === "submit" ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>

      {dialog === "submit" && (
        <ConfirmDialog
          title="Submit idea?"
          message="Once submitted, the idea cannot be edited. Submit?"
          confirmLabel="Submit"
          busyLabel="Submitting..."
          tone="success"
          busy={busy === "submit"}
          onConfirm={confirmSubmit}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete draft?"
          message="This draft will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          busyLabel="Deleting..."
          tone="danger"
          busy={busy === "delete"}
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === "cancel" && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes. Leave this page without saving them?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          tone="neutral"
          onConfirm={() => navigate(IDEAS_HOME_PATH)}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default ShareIdea;
