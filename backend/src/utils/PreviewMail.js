// Run: node previewMails.js  → then open mail-preview.html in your browser.
// Nothing is sent and no event is triggered; it only calls the template functions.

require("dotenv").config(); // so link helpers pick up your base URL, if they read env
const fs = require("fs");
const path = require("path");

// ─── 1. IMPORTS ─────────────────────────────────────────────────────────────
const { TASK_MAIL_EVENTS, buildHtml: buildTaskHtml } = require("../services/taskMailService");
const { IDEA_MAIL_EVENTS, buildSubject: buildIdeaSubject, buildHtml: buildIdeaHtml } = require("../services/ideaMailService");
const { GOAL_MAIL_EVENTS, buildSubject: buildGoalSubject, buildHtml: buildGoalHtml } = require("../services/goalMailService");

// Auth mails (TESTING ONLY): authMailService has no separate HTML builder; it
// builds and sends in one go. So swap notifyService.sendEmail for a function
// that only captures { to, subject, html }, BEFORE requiring authMailService
// (it destructures sendEmail at require time). Nothing is sent.
const notifyService = require("../services/notifyService");
let capturedAuthMail = null;
notifyService.sendEmail = async (mail) => { capturedAuthMail = mail; };
const authMailService = require("../services/authMailService");

// ─── 2. SAMPLE DATA ─────────────────────────────────────────────────────────
// Field names must match what your DB returns, or rows will show up blank.

const baseTask = {
    EmployeeName: "Rahul Shah",
    TaskName: "Reconcile Q3 vendor payments & credit notes", // "&" checks escaping
    Priority: "High",
    DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ResponsiblePersonName: "Priya Mehta",
    AssignedByRole: "CFO",          // CHANGE: use a role value your DB actually stores
    AssignedByName: "A. Kumar",
    CFORemarksByRole: "CFO",
    CFORemarksByName: "A. Kumar",
    CFORemarks: "Please prioritise this.\nShare a summary by Friday.", // newline checks wrapping
};

const sampleTasks = {
    "with project": { ...baseTask, ProjectName: "Cobalt Plant Expansion" },
    "without project": { ...baseTask, ProjectName: null },
};

const sampleIdeas = {
    "default": {
        IdeaID: 42,
        IdeaNumber: "IDEA-0042",
        Title: "Automate vendor GST verification & reconciliation",
        Status: "Under Review",
        SubmitterName: "Rahul Shah",
        LeadName: "Priya Mehta",
        FinalApproverName: "A. Kumar",
        TimelineDays: 30,
        TargetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
};

// Event-specific values passed to the idea/goal builders as `context`
const sampleContext = {
    remark: "Good progress.\nPlease add a cost estimate.",
    newTargetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    previousTargetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    requestedTargetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    rating: 4,
    comment: "Well executed.",
    feedback: "Strong delivery this quarter.",
    quarter: "Q2",
    progressPercentage: 60,
    fiscalYear: 2026,
    weightedScore: 3.8,
    status: "Completed",
    userId: 7,
};

const sampleGoals = {
    "default": {
        GoalID: 101,
        GoalNumber: 101,
        GoalTitle: "Cut month-end close time from 8 to 5 days",
        Quarter: "Q2",
        OwnerName: "Rahul Shah",
        GoalStatus: "In Progress",
    },
};

const sampleRecipient = { name: "Priya Mehta", firstName: "Priya", email: "priya@example.com", label: "reporting manager" };

// Set to { name: "Rahul Shah", email: "rahul@example.com", label: "submitter" } to preview TEST MODE banners
const testRecipient = null;

// Auth mails: same banner rule. They read AUTH_MAIL_REDIRECT_TO from .env,
// so override it here to match testRecipient.
process.env.AUTH_MAIL_REDIRECT_TO = testRecipient ? testRecipient.email : "";

const sampleAuthUser = { UserID: 7, Username: "rahul.shah", FirstName: "Rahul", LastName: "Shah", Email: "rahul@example.com" };

// Each entry calls a real authMailService send function (captured, not sent).
const AUTH_MAILS = {
    PASSWORD_RESET_OTP: () =>
        authMailService.sendPasswordResetOtpMail({ user: sampleAuthUser, otp: "482913", validMinutes: 10 }),
    PASSWORD_CHANGED: () =>
        // DB-style value: server wall-clock time in the UTC fields (see formatServerDateTime)
        authMailService.sendPasswordChangedMail({ user: sampleAuthUser, changedAt: new Date(Date.UTC(2026, 10, 17, 15, 42)) }),
    WELCOME: () =>
        authMailService.sendWelcomeMail({ user: sampleAuthUser, temporaryPassword: "Tmp@8kQ2&x" }), // "&" checks escaping
};

const buildAuthPreviews = async () => {
    const previews = [];
    for (const [event, send] of Object.entries(AUTH_MAILS)) {
        capturedAuthMail = null;
        await send();
        previews.push({
            label: `Auth / ${event} / default`,
            subject: capturedAuthMail.subject,
            html: capturedAuthMail.html,
        });
    }
    return previews;
};

// ─── 3. BUILD PREVIEWS ──────────────────────────────────────────────────────
// render(def, data) must return { subject, html }; each module's builders take different args.
const fromEvents = (moduleName, events, samples, render) =>
    Object.entries(events).flatMap(([event, def]) =>
        Object.entries(samples).map(([variant, data]) => ({
            label: `${moduleName} / ${event} / ${variant}`,
            ...render(def, data),
        }))
    );

const previews = [
    ...fromEvents("Tasks", TASK_MAIL_EVENTS, sampleTasks, (def, task) => ({
        subject: def.subject(task),
        html: buildTaskHtml(def, task, testRecipient),
    })),
    ...fromEvents("Ideas", IDEA_MAIL_EVENTS, sampleIdeas, (def, idea) => ({
        subject: buildIdeaSubject(def, idea),
        html: buildIdeaHtml(def, idea, sampleContext, sampleRecipient, testRecipient),
    })),
    ...fromEvents("Goals", GOAL_MAIL_EVENTS, sampleGoals, (def, goal) => {
        const g = def.needsGoal === false ? null : goal; // e.g. FINAL_EVALUATION_GENERATED has no goal
        return {
            subject: buildGoalSubject(def, g, sampleContext),
            html: buildGoalHtml(def, g, sampleContext, sampleRecipient, testRecipient),
        };
    }),
];

// ─── 4. WRITE OUTPUT ────────────────────────────────────────────────────────
(async () => {
    previews.push(...(await buildAuthPreviews()));

    let output = `<html><head><meta charset="utf-8"><title>Mail preview</title></head><body style="background:#f3f3f3;">`;

    for (const p of previews) {
        output += `
    <section style="max-width:700px;margin:24px auto;padding:20px;background:#fff;border:1px solid #ccc;">
        <p style="font:12px monospace;color:#888;margin:0 0 8px;">${p.label}</p>
        <p style="margin:0 0 16px;"><strong>Subject:</strong> ${p.subject}</p>
        ${p.html}
    </section>`;
    }

    output += "</body></html>";

    const outFile = path.join(__dirname, "mail-preview.html");
    fs.writeFileSync(outFile, output);
    console.log(`${previews.length} mails written to ${outFile}`);
    process.exit(0); // required services may open DB/SMTP handles that keep node alive
})().catch((err) => {
    console.error(err);
    process.exit(1);
});