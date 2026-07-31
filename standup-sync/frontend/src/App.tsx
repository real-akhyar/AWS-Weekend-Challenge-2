import { useState, useEffect, useCallback } from "react";

type Report = {
    id: string;
    createdAt: string;
    type: "daily" | "weekly";
    report: {
        summary: string;
        yesterday?: string[];
        today?: string[];
        blockers?: string[];
        weeklyOverview?: string;
        accomplishments?: string[];
        inProgress?: string[];
        blockersResolved?: string[];
        blockersActive?: string[];
        nextWeekFocus?: string[];
        teamMetrics?: Record<string, string>;
    };
    yesterdayTasks?: string[];
    todayPlan?: string[];
};

const API_BASE =
    import.meta.env.VITE_API_URL ||
    "https://n9kqyu0vb7.execute-api.us-east-1.amazonaws.com";

type Tab = "generate" | "history" | "weekly";

function App() {
    const [tab, setTab] = useState<Tab>("generate");
    const [yesterdayTasks, setYesterdayTasks] = useState("");
    const [todayPlan, setTodayPlan] = useState("");
    const [blockers, setBlockers] = useState("");
    const [teamContext, setTeamContext] = useState("");
    const [generated, setGenerated] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [weeklySummary, setWeeklySummary] = useState<Report | null>(null);
    const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(
        new Set()
    );

    const fetchReports = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reports`);
            const data = await res.json();
            setReports(data.reports || []);
        } catch {
            setReports([]);
        }
    }, []);

    useEffect(() => {
        if (tab === "history" || tab === "weekly") {
            fetchReports();
        }
    }, [tab, fetchReports]);

    const handleGenerate = async () => {
        setError("");
        setGenerated(null);
        const yList = yesterdayTasks
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        const tList = todayPlan
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        const bList = blockers
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

        if (yList.length === 0 && tList.length === 0) {
            setError("Please enter at least one task.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/reports`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    yesterdayTasks: yList,
                    todayPlan: tList,
                    blockers: bList,
                    teamContext,
                    userId: "demo-user",
                }),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || "Failed to generate report");
            }
            const data = await res.json();
            setGenerated(data);
            if (tab === "history") fetchReports();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleWeeklySummary = async () => {
        if (selectedReportIds.size < 2) {
            setError("Select at least 2 reports for a weekly summary.");
            return;
        }
        setError("");
        setWeeklySummary(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/weekly-summary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reportIds: Array.from(selectedReportIds),
                    userId: "demo-user",
                }),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || "Failed to generate weekly summary");
            }
            const data = await res.json();
            setWeeklySummary(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const toggleReportSelection = (id: string) => {
        setSelectedReportIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="container">
            <header className="header">
                <h1>StandupSync</h1>
                <p>
                    Smart standup report generator for dev teams. Paste your
                    tasks and get a structured report. Powered by AWS.
                </p>
            </header>

            <div className="tabs">
                {(["generate", "history", "weekly"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        className={`tab ${tab === t ? "active" : ""}`}
                        onClick={() => setTab(t)}
                    >
                        {t === "generate"
                            ? "Generate"
                            : t === "history"
                                ? "History"
                                : "Weekly Summary"}
                    </button>
                ))}
            </div>

            {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

            {tab === "generate" && (
                <div>
                    <div className="card">
                        <h2>What did you work on?</h2>
                        <div className="form-group">
                            <label>Team / Project Context</label>
                            <input
                                type="text"
                                value={teamContext}
                                onChange={(e) => setTeamContext(e.target.value)}
                                placeholder="e.g. Backend API team working on payment service"
                            />
                        </div>
                        <div className="form-group">
                            <label>Yesterday (One task per line)</label>
                            <textarea
                                value={yesterdayTasks}
                                onChange={(e) => setYesterdayTasks(e.target.value)}
                                placeholder="Fixed login bug in auth-service&#10;Code reviewed PR #342&#10;Updated API documentation"
                            />
                            <span className="hint">
                                Paste your git commits, Jira tickets, or notes
                            </span>
                        </div>
                        <div className="form-group">
                            <label>Today's Plan (One task per line)</label>
                            <textarea
                                value={todayPlan}
                                onChange={(e) => setTodayPlan(e.target.value)}
                                placeholder="Deploy v2.3 to staging&#10;Write integration tests for payment flow&#10;Sprint planning at 2 PM"
                            />
                        </div>
                        <div className="form-group">
                            <label>Blockers / Risks</label>
                            <textarea
                                value={blockers}
                                onChange={(e) => setBlockers(e.target.value)}
                                placeholder="Waiting on DevOps to provision staging DB&#10;Blocked by design review for PR #340"
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerate}
                            disabled={loading}
                        >
                            {loading && <span className="spinner" />}
                            {loading
                                ? "Generating..."
                                : "Generate Standup Report"}
                        </button>
                    </div>

                    {generated?.report && (
                        <div className="card">
                            <h2>
                                Your Standup Report{" "}
                                <span className="badge badge-daily">Daily</span>
                            </h2>
                            <div className="report-section">
                                <h3>Summary</h3>
                                <p>{generated.report.summary}</p>
                            </div>
                            {generated.report.yesterday &&
                                generated.report.yesterday.length > 0 && (
                                    <div className="report-section">
                                        <h3>Yesterday</h3>
                                        <ul className="report-list">
                                            {generated.report.yesterday.map(
                                                (t: string, i: number) => (
                                                    <li key={i}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {generated.report.today &&
                                generated.report.today.length > 0 && (
                                    <div className="report-section">
                                        <h3>Today's Plan</h3>
                                        <ul className="report-list">
                                            {generated.report.today.map(
                                                (t: string, i: number) => (
                                                    <li key={i}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {generated.report.blockers &&
                                generated.report.blockers.length > 0 && (
                                    <div className="report-section">
                                        <h3>Blockers</h3>
                                        <ul className="report-list">
                                            {generated.report.blockers.map(
                                                (t: string, i: number) => (
                                                    <li
                                                        key={i}
                                                        style={{ color: "var(--warning)" }}
                                                    >
                                                        {t}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            )}

            {tab === "history" && (
                <div>
                    {reports.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">📋</div>
                            <p>No reports yet. Generate your first standup!</p>
                        </div>
                    ) : (
                        reports.map((r) => (
                            <div
                                key={r.id}
                                className="report-card"
                                onClick={() =>
                                    setSelectedReport(
                                        selectedReport?.id === r.id ? null : r
                                    )
                                }
                            >
                                <span className="date">
                                    {formatDate(r.createdAt)}
                                </span>
                                <span
                                    className="badge"
                                    style={{
                                        marginLeft: 12,
                                        ...(r.type === "weekly"
                                            ? {
                                                background:
                                                    "rgba(139, 92, 246, 0.15)",
                                                color: "#8b5cf6",
                                            }
                                            : {
                                                background:
                                                    "rgba(59, 130, 246, 0.15)",
                                                color: "var(--primary)",
                                            }),
                                    }}
                                >
                                    {r.type === "weekly" ? "Weekly" : "Daily"}
                                </span>
                                <div className="summary">
                                    {r.report.summary || r.report.weeklyOverview || "No summary"}
                                </div>
                                {selectedReport?.id === r.id && (
                                    <div style={{ marginTop: 16 }}>
                                        <div className="report-section">
                                            <h3>Summary</h3>
                                            <p>
                                                {r.report.summary ||
                                                    r.report.weeklyOverview}
                                            </p>
                                        </div>
                                        {r.report.yesterday && (
                                            <div className="report-section">
                                                <h3>Yesterday</h3>
                                                <ul className="report-list">
                                                    {r.report.yesterday.map(
                                                        (t, i) => (
                                                            <li key={i}>{t}</li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        {r.report.today && (
                                            <div className="report-section">
                                                <h3>Today's Plan</h3>
                                                <ul className="report-list">
                                                    {r.report.today.map(
                                                        (t, i) => (
                                                            <li key={i}>{t}</li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        {r.report.blockers && r.report.blockers.length > 0 && (
                                            <div className="report-section">
                                                <h3>Blockers</h3>
                                                <ul className="report-list">
                                                    {r.report.blockers.map(
                                                        (t, i) => (
                                                            <li key={i} style={{ color: "var(--warning)" }}>{t}</li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {tab === "weekly" && (
                <div>
                    <div className="card">
                        <h2>Generate Weekly Sprint Summary</h2>
                        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                            Select daily reports to compile into a weekly summary
                            powered by AI.
                        </p>
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon">📊</div>
                                <p>
                                    No reports available. Generate daily
                                    standups first!
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="checkbox-list">
                                    {reports
                                        .filter((r) => r.type === "daily")
                                        .map((r) => (
                                            <label
                                                key={r.id}
                                                className={
                                                    selectedReportIds.has(r.id)
                                                        ? "checked"
                                                        : ""
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedReportIds.has(
                                                        r.id
                                                    )}
                                                    onChange={() =>
                                                        toggleReportSelection(
                                                            r.id
                                                        )
                                                    }
                                                />
                                                {formatDate(r.createdAt)}
                                            </label>
                                        ))}
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: 16 }}
                                    onClick={handleWeeklySummary}
                                    disabled={
                                        loading ||
                                        selectedReportIds.size < 2
                                    }
                                >
                                    {loading && <span className="spinner" />}
                                    {loading
                                        ? "Generating..."
                                        : `Generate Weekly Summary (${selectedReportIds.size} selected)`}
                                </button>
                            </>
                        )}
                    </div>

                    {weeklySummary?.summary && (
                        <div className="card">
                            <h2>
                                Weekly Sprint Summary{" "}
                                <span className="badge badge-weekly">
                                    Weekly
                                </span>
                            </h2>
                            <div className="report-section">
                                <h3>Overview</h3>
                                <p>{weeklySummary.summary.weeklyOverview}</p>
                            </div>
                            {weeklySummary.summary.accomplishments &&
                                weeklySummary.summary.accomplishments.length >
                                0 && (
                                    <div className="report-section">
                                        <h3>Accomplishments</h3>
                                        <ul className="report-list">
                                            {weeklySummary.summary.accomplishments.map(
                                                (t: string, i: number) => (
                                                    <li key={i}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {weeklySummary.summary.inProgress &&
                                weeklySummary.summary.inProgress.length >
                                0 && (
                                    <div className="report-section">
                                        <h3>In Progress</h3>
                                        <ul className="report-list">
                                            {weeklySummary.summary.inProgress.map(
                                                (t: string, i: number) => (
                                                    <li key={i}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {weeklySummary.summary.blockersResolved &&
                                weeklySummary.summary.blockersResolved
                                    .length > 0 && (
                                    <div className="report-section">
                                        <h3>Blockers Resolved</h3>
                                        <ul className="report-list">
                                            {weeklySummary.summary.blockersResolved.map(
                                                (t: string, i: number) => (
                                                    <li key={i} style={{ color: "var(--success)" }}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {weeklySummary.summary.blockersActive &&
                                weeklySummary.summary.blockersActive.length >
                                0 && (
                                    <div className="report-section">
                                        <h3>Active Blockers</h3>
                                        <ul className="report-list">
                                            {weeklySummary.summary.blockersActive.map(
                                                (t: string, i: number) => (
                                                    <li key={i} style={{ color: "var(--warning)" }}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {weeklySummary.summary.nextWeekFocus &&
                                weeklySummary.summary.nextWeekFocus.length >
                                0 && (
                                    <div className="report-section">
                                        <h3>Next Week Focus</h3>
                                        <ul className="report-list">
                                            {weeklySummary.summary.nextWeekFocus.map(
                                                (t: string, i: number) => (
                                                    <li key={i}>{t}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                            {weeklySummary.summary.teamMetrics &&
                                Object.keys(
                                    weeklySummary.summary.teamMetrics
                                ).length > 0 && (
                                    <div className="report-section">
                                        <h3>Team Metrics</h3>
                                        {Object.entries(
                                            weeklySummary.summary.teamMetrics
                                        ).map(([k, v]) => (
                                            <p key={k}>
                                                <strong>{k}:</strong> {v}
                                            </p>
                                        ))}
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;