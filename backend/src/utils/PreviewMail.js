// Mail preview: every email the app can send, with its real subject and body.
//
// Run (from the backend folder):  node src/utils/PreviewMail.js
// Then open src/utils/mail-preview.html in your browser.
//
// Nothing is sent and nothing in the database changes: it only calls the
// same template functions the mail services use. Each mail is listed with
// when it is sent, who gets it, and whether it is still in use.

require("dotenv").config(); // so links use your FRONTEND_URL
const fs = require("fs");
const path = require("path");

// ─── 1. IMPORTS ─────────────────────────────────────────────────────────────
// Auth mails have no separate HTML builder (they build and send in one go),
// so notifyService.sendEmail is swapped for a function that only captures
// { subject, html } BEFORE authMailService is required (it destructures
// sendEmail at require time). Nothing is sent.
const notifyService = require("../services/notifyService");
const { withPortalPrefix } = notifyService;
let capturedAuthMail = null;
notifyService.sendEmail = async (mail) => {
    capturedAuthMail = mail;
};
const authMailService = require("../services/authMailService");

const { TASK_MAIL_EVENTS, buildHtml: buildTaskHtml } = require("../services/taskMailService");
const { IDEA_MAIL_EVENTS, buildSubject: buildIdeaSubject, buildHtml: buildIdeaHtml } = require("../services/ideaMailService");
const { GOAL_MAIL_EVENTS, buildSubject: buildGoalSubject, buildHtml: buildGoalHtml } = require("../services/goalMailService");
const { TaskMailEvent } = require("../constants/taskConstants");
const { IdeaMailEvent } = require("../constants/ideaConstants");
const { GoalMailEvent, GoalWindow } = require("../constants/goalConstants");

// ─── 2. SETTINGS ────────────────────────────────────────────────────────────
// Set to { name: "Rahul Shah", email: "rahul@example.com" } to preview the
// TEST MODE banner and "[TEST]" subject that the *_MAIL_REDIRECT_TO settings add.
const testRecipient = null;

// Auth mails read AUTH_MAIL_REDIRECT_TO from .env; match testRecipient.
process.env.AUTH_MAIL_REDIRECT_TO = testRecipient ? testRecipient.email : "";

// How each mail is triggered (badge on each mail).
const STATUS = {
    ACTIVE: { label: "On action", color: "#1d4ed8", bg: "#dbeafe" },
    JOB: { label: "Daily job", color: "#7c3aed", bg: "#ede9fe" },
};

// ─── 3. SAMPLE DATA ─────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;

const baseTask = {
    EmployeeName: "Rahul Shah",
    TaskName: "Reconcile Q3 vendor payments & credit notes", // "&" checks escaping
    Priority: "High",
    DueDate: new Date(Date.now() + 7 * DAY),
    ResponsiblePersonName: "Rahul Shah",
    AssignedByRole: "BusinessHead",
    AssignedByName: "A. Kumar",
    CFORemarksByRole: "BusinessHead",
    CFORemarksByName: "A. Kumar",
    CFORemarks: "Please prioritise this.\nShare a summary by Friday.", // newline checks wrapping
};

const sampleIdea = {
    IdeaID: 42,
    IdeaNumber: "IDEA-0042",
    Title: "Automate vendor GST verification & reconciliation",
    Status: "Under Review",
    SubmitterName: "Rahul Shah",
    LeadName: "Priya Mehta",
    FinalApproverName: "A. Kumar",
    TimelineDays: 30,
    TargetDate: new Date(Date.now() + 30 * DAY),
};

const sampleGoal = {
    GoalID: 101,
    GoalNumber: 101,
    GoalTitle: "Cut month-end close time from 8 to 5 days",
    Quarter: "Q4-2027",
    OwnerName: "Rahul Shah",
    GoalStatus: "Approved",
};

const sampleContext = {
    remark: "Good progress.\nPlease add a cost estimate.",
    newTargetDate: new Date(Date.now() + 45 * DAY),
    previousTargetDate: new Date(Date.now() + 30 * DAY),
    requestedTargetDate: new Date(Date.now() + 60 * DAY),
    rating: 4,
    comment: "Well executed.",
    feedback: "Strong delivery this quarter.",
    quarter: "Q2",
    progressPercentage: 60,
    fiscalYear: 2027,
    weightedScore: 3.8,
    status: "Completed",
    userId: 7,
    daysLeft: 5,
    endDate: "26 Nov 2026",
};

const sampleRecipient = { name: "Priya Mehta", firstName: "Priya", email: "priya@example.com" };
const sampleAuthUser = { UserID: 7, Username: "rahul.shah", FirstName: "Rahul", LastName: "Shah", Email: "rahul@example.com" };

// ─── 4. THE MAILS ───────────────────────────────────────────────────────────
// One entry per mail (variants = the same mail with different data).
// Only mails the app actually sends (on an action or from a daily job);
// when / to describe the real trigger.

const TASK_MAILS = [
    {
        event: TaskMailEvent.ASSIGNED,
        title: "Task assigned",
        when: "CFO assigns a task (Assign Task page or All Tasks), or a project creator assigns a task in their project.",
        to: "The employee the task is assigned to",
        status: STATUS.ACTIVE,
        variants: [
            ["Personal task", { ...baseTask, ProjectName: null }],
            ["Project task", { ...baseTask, ProjectName: "Cobalt Plant Expansion" }],
        ],
    },
    {
        event: TaskMailEvent.CFO_REMARK,
        title: "Remark added on a task",
        when: "CFO (or a project's creator) adds or changes the remark on someone's task.",
        to: "The task owner",
        status: STATUS.ACTIVE,
        variants: [
            ["Personal task", { ...baseTask, ProjectName: null }],
            ["Project task", { ...baseTask, ProjectName: "Cobalt Plant Expansion" }],
        ],
    },
];

const IDEA_MAILS = [
    [IdeaMailEvent.SUBMITTED, "Idea submitted", "Employee submits an idea.", "The reporting manager they picked"],
    [IdeaMailEvent.MANAGER_APPROVED, "Approved by reporting manager", "Reporting manager approves the idea and picks the final approver.", "The final approver"],
    [IdeaMailEvent.MANAGER_REJECTED, "Rejected by reporting manager", "Reporting manager rejects the idea.", "The employee who submitted it"],
    [IdeaMailEvent.FINAL_APPROVED, "Final approval", "Final approver approves the idea.", "The employee who submitted it"],
    [IdeaMailEvent.FINAL_REJECTED, "Final rejection", "Final approver rejects the idea.", "The employee who submitted it"],
    [IdeaMailEvent.CLOSURE_REQUESTED, "Closure requested", "Employee asks to close the idea as implemented.", "The approver"],
    [IdeaMailEvent.CLOSURE_APPROVED, "Closure approved", "Approver approves the closure.", "The employee"],
    [IdeaMailEvent.CLOSURE_REJECTED, "Closure rejected", "Approver rejects the closure.", "The employee"],
    [IdeaMailEvent.EXTENSION_REQUESTED, "Extension requested", "Employee asks for a later target date.", "The approver"],
    [IdeaMailEvent.EXTENSION_APPROVED, "Extension approved", "Approver approves the new target date.", "The employee"],
    [IdeaMailEvent.EXTENSION_REJECTED, "Extension rejected", "Approver rejects the new target date.", "The employee"],
].map(([event, title, when, to]) => ({ event, title, when, to, status: STATUS.ACTIVE, variants: [["", sampleIdea]] }));

// Window reminders: 3 windows x (opens tomorrow, closes in 2 days).
const WINDOW_VARIANTS = [
    [GoalWindow.ADD_GOAL, "Add Goal", "01 Dec 2026", "07 Dec 2026"],
    [GoalWindow.MANAGER_HOD_APPROVAL, "Manager/HOD approval", "08 Dec 2026", "15 Dec 2026"],
    [GoalWindow.CFO_APPROVAL, "CFO approval", "16 Dec 2026", "31 Dec 2026"],
].flatMap(([window, name, startDate, endDate]) => [
    [`${name} – opens tomorrow`, { window, stage: "opening", startDate, endDate, targetQuarter: "Q4-2027" }],
    [`${name} – closes in 2 days`, { window, stage: "closing", startDate, endDate, targetQuarter: "Q4-2027" }],
]);

const GOAL_MAILS = [
    {
        event: GoalMailEvent.WINDOW_REMINDER,
        title: "Goal window reminder",
        when: "Daily job, 9:00 AM: the day before a window opens and 2 days before it closes. For Jan–Mar goals: Add Goal 30 Nov / 5 Dec, Manager/HOD 7 Dec / 13 Dec, CFO 15 Dec / 29 Dec.",
        to: "Add Goal: every active user except Admin. Manager/HOD: users with team members. CFO: the CFO.",
        status: STATUS.JOB,
        contextVariants: WINDOW_VARIANTS,
    },
    {
        event: GoalMailEvent.DUE_REMINDER,
        title: "Goal end date reminder",
        when: "Daily job, 9:00 AM: 5 days and 2 days before a running goal's end date.",
        to: "The goal owner",
        status: STATUS.JOB,
    },
    {
        event: GoalMailEvent.COMPLETION_REQUESTED,
        title: "Completion requested",
        when: "Employee clicks Mark complete on a goal.",
        to: "The approver (Reporting Manager / HOD, or CFO)",
        status: STATUS.ACTIVE,
    },
    {
        event: GoalMailEvent.COMPLETION_APPROVED,
        title: "Completion approved",
        when: "Approver approves the Mark complete request.",
        to: "The goal owner",
        status: STATUS.ACTIVE,
    },
    {
        event: GoalMailEvent.COMPLETION_REJECTED,
        title: "Completion rejected",
        when: "Approver rejects the Mark complete request.",
        to: "The goal owner",
        status: STATUS.ACTIVE,
    },
    {
        event: GoalMailEvent.FINAL_EVALUATION_GENERATED,
        title: "Final evaluation available",
        when: "Final Evaluation is finalized for a user.",
        to: "The employee",
        status: STATUS.ACTIVE,
    },
];

const AUTH_MAILS = [
    {
        title: "Password reset OTP",
        when: "User clicks Forgot Password and enters their username / email.",
        to: "That user",
        status: STATUS.ACTIVE,
        send: () => authMailService.sendPasswordResetOtpMail({ user: sampleAuthUser, otp: "482913", validMinutes: 10 }),
    },
    {
        title: "Password changed",
        when: "User changes or resets their password.",
        to: "That user",
        status: STATUS.ACTIVE,
        // DB-style value: server wall-clock time in the UTC fields
        send: () => authMailService.sendPasswordChangedMail({ user: sampleAuthUser, changedAt: new Date(Date.UTC(2026, 10, 17, 15, 42)) }),
    },
    {
        title: "Welcome / account created",
        when: "Admin adds a new employee (single add or Excel import).",
        to: "The new employee",
        status: STATUS.ACTIVE,
        send: () => authMailService.sendWelcomeMail({ user: sampleAuthUser, temporaryPassword: "Tmp@8kQ2&x" }), // "&" checks escaping
    },
];

// ─── 5. BUILD PREVIEWS ──────────────────────────────────────────────────────
// Every subject goes through the same portal-name prefix (and "[TEST] ")
// the real sender adds.
const finalSubject = (subject) => withPortalPrefix(testRecipient ? `[TEST] ${subject}` : subject);

const buildModules = async () => {
    const tasks = TASK_MAILS.map((mail) => ({
        ...mail,
        previews: mail.variants.map(([variant, task]) => {
            const def = TASK_MAIL_EVENTS[mail.event];
            return { variant, subject: finalSubject(def.subject(task)), html: buildTaskHtml(def, task, testRecipient) };
        }),
    }));

    const ideas = IDEA_MAILS.map((mail) => ({
        ...mail,
        previews: mail.variants.map(([variant, idea]) => {
            const def = IDEA_MAIL_EVENTS[mail.event];
            return {
                variant,
                subject: finalSubject(buildIdeaSubject(def, idea)),
                html: buildIdeaHtml(def, idea, sampleContext, sampleRecipient, testRecipient),
            };
        }),
    }));

    const goals = GOAL_MAILS.map((mail) => {
        const def = GOAL_MAIL_EVENTS[mail.event];
        const goal = def.needsGoal === false ? null : sampleGoal;
        const contexts = mail.contextVariants || [["", {}]];
        return {
            ...mail,
            previews: contexts.map(([variant, extra]) => {
                const context = { ...sampleContext, ...extra };
                return {
                    variant,
                    subject: finalSubject(buildGoalSubject(def, goal, context)),
                    html: buildGoalHtml(def, goal, context, sampleRecipient, testRecipient),
                };
            }),
        };
    });

    const auth = [];
    for (const mail of AUTH_MAILS) {
        capturedAuthMail = null;
        await mail.send();
        // Auth adds its own "[TEST] ... (for ...)" in test mode.
        auth.push({
            ...mail,
            previews: [{ variant: "", subject: withPortalPrefix(capturedAuthMail.subject), html: capturedAuthMail.html }],
        });
    }

    return [
        { name: "Goal Tracker", mails: goals },
        { name: "Task Tracker", mails: tasks },
        { name: "Innovation Ideas", mails: ideas },
        { name: "Login / Account", mails: auth },
    ];
};

// ─── 6. WRITE OUTPUT ────────────────────────────────────────────────────────
const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const badge = (status) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;color:${status.color};background:${status.bg};">${escapeHtml(status.label)}</span>`;

const renderPage = (modules) => {
    let id = 0;
    const withIds = modules.map((module) => ({
        ...module,
        mails: module.mails.map((mail) => ({ ...mail, id: `mail-${(id += 1)}` })),
    }));

    const total = withIds.reduce((sum, m) => sum + m.mails.length, 0);

    const index = withIds
        .map(
            (module) => `
        <h3 style="margin:18px 0 6px;font-size:14px;color:#2c3e82;">${escapeHtml(module.name)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#eef2f8;text-align:left;">
                <th style="padding:6px 8px;border:1px solid #d5dce5;">Mail</th>
                <th style="padding:6px 8px;border:1px solid #d5dce5;">When it is sent</th>
                <th style="padding:6px 8px;border:1px solid #d5dce5;">To</th>
                <th style="padding:6px 8px;border:1px solid #d5dce5;">Trigger</th>
            </tr>
            ${module.mails
                .map(
                    (mail) => `
            <tr>
                <td style="padding:6px 8px;border:1px solid #d5dce5;"><a href="#${mail.id}">${escapeHtml(mail.title)}</a>${mail.previews.length > 1 ? ` <span style="color:#888;">(${mail.previews.length} versions)</span>` : ""}</td>
                <td style="padding:6px 8px;border:1px solid #d5dce5;">${escapeHtml(mail.when)}</td>
                <td style="padding:6px 8px;border:1px solid #d5dce5;">${escapeHtml(mail.to)}</td>
                <td style="padding:6px 8px;border:1px solid #d5dce5;white-space:nowrap;">${badge(mail.status)}</td>
            </tr>`,
                )
                .join("")}
        </table>`,
        )
        .join("");

    const sections = withIds
        .map(
            (module) => `
    <h2 style="max-width:760px;margin:40px auto 0;font-size:18px;color:#2c3e82;">${escapeHtml(module.name)}</h2>
    ${module.mails
        .map(
            (mail) => `
    <section id="${mail.id}" style="max-width:760px;margin:16px auto;padding:20px;background:#fff;border:1px solid #ccc;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <h3 style="margin:0;font-size:16px;">${escapeHtml(mail.title)}</h3>
            ${badge(mail.status)}
        </div>
        <p style="margin:8px 0 2px;font-size:13px;color:#444;"><strong>When:</strong> ${escapeHtml(mail.when)}</p>
        <p style="margin:0 0 12px;font-size:13px;color:#444;"><strong>To:</strong> ${escapeHtml(mail.to)}</p>
        ${mail.previews
            .map(
                (p) => `
        <div style="margin-top:14px;border-top:1px dashed #ddd;padding-top:12px;">
            ${p.variant ? `<p style="margin:0 0 6px;font:12px monospace;color:#888;">${escapeHtml(p.variant)}</p>` : ""}
            <p style="margin:0 0 12px;padding:8px 10px;background:#f7f7f7;border:1px solid #e5e5e5;font-size:13px;"><strong>Subject:</strong> ${escapeHtml(p.subject)}</p>
            ${p.html}
        </div>`,
            )
            .join("")}
        <p style="margin:12px 0 0;font-size:12px;"><a href="#top">↑ Back to list</a></p>
    </section>`,
        )
        .join("")}`,
        )
        .join("");

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Mail preview</title></head>
<body style="background:#f3f3f3;font-family:Arial,sans-serif;margin:0;padding:24px 16px;">
    <div id="top" style="max-width:960px;margin:0 auto;padding:20px;background:#fff;border:1px solid #ccc;">
        <h1 style="margin:0 0 4px;font-size:20px;">GATI – all emails</h1>
        <p style="margin:0;color:#555;font-size:13px;">${total} mails the app sends, on an action or from a daily job. Generated ${escapeHtml(new Date().toLocaleString("en-GB"))}${testRecipient ? " — TEST MODE preview" : ""}. Sample data only; nothing was sent.</p>
        ${index}
    </div>
    ${sections}
</body></html>`;
};

(async () => {
    const modules = await buildModules();
    const outFile = path.join(__dirname, "mail-preview.html");
    fs.writeFileSync(outFile, renderPage(modules));
    const total = modules.reduce((sum, m) => sum + m.mails.length, 0);
    console.log(`${total} mails written to ${outFile}`);
    process.exit(0); // required services may open DB/SMTP handles that keep node alive
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
