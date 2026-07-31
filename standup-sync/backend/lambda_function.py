import json
import uuid
from datetime import datetime, timezone

import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table = dynamodb.Table("standup-reports")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def _categorize(tasks):
    completed, in_progress = [], []
    for t in tasks:
        t_lower = t.lower().strip()
        if any(kw in t_lower for kw in ["done", "completed", "finished", "merged", "deployed", "fixed", "resolved", "shipped"]):
            completed.append(t)
        elif any(kw in t_lower for kw in ["start", "begin", "in progress", "working on", "review"]):
            in_progress.append(t)
        else:
            completed.append(t)
    return completed, in_progress


def _generate_summary(yesterday, today, blockers):
    completed, in_progress = _categorize(yesterday + today)
    parts = []
    if completed:
        parts.append(f"Completed {len(completed)} tasks")
    if in_progress:
        parts.append(f"{len(in_progress)} items in progress")
    if blockers:
        parts.append(f"{len(blockers)} blockers flagged")
    if not parts:
        return "Standup update for today."
    return " | ".join(parts) + "."


def handle_options():
    return _response(200, {"message": "OK"})


def handle_generate_report(body):
    yesterday_tasks = body.get("yesterdayTasks", [])
    today_plan = body.get("todayPlan", [])
    blockers = body.get("blockers", [])
    team_context = body.get("teamContext", "")

    completed_yesterday, progress_yesterday = _categorize(yesterday_tasks)
    completed_today, progress_today = _categorize(today_plan)

    summary = _generate_summary(yesterday_tasks, today_plan, blockers)
    report = {
        "summary": summary,
        "yesterday": yesterday_tasks if yesterday_tasks else ["No tasks logged"],
        "today": today_plan if today_plan else ["Plan not yet defined"],
        "blockers": blockers if blockers else ["None"],
    }

    report_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {
        "id": report_id,
        "userId": body.get("userId", "anonymous"),
        "report": report,
        "yesterdayTasks": yesterday_tasks,
        "todayPlan": today_plan,
        "blockers": blockers,
        "teamContext": team_context,
        "createdAt": timestamp,
        "type": "daily",
    }

    table.put_item(Item=item)

    return _response(201, {"id": report_id, "report": report, "createdAt": timestamp})


def handle_list_reports(query_params=None):
    if query_params is None:
        query_params = {}
    limit = min(int(query_params.get("limit", 20)), 100)
    result = table.scan(Limit=limit)
    items = sorted(result.get("Items", []), key=lambda x: x.get("createdAt", ""), reverse=True)
    return _response(200, {"reports": items, "count": len(items)})


def handle_get_report(report_id):
    result = table.get_item(Key={"id": report_id})
    item = result.get("Item")
    if not item:
        return _response(404, {"error": "Report not found"})
    return _response(200, item)


def handle_weekly_summary(body):
    report_ids = body.get("reportIds", [])
    if len(report_ids) < 2:
        return _response(400, {"error": "At least 2 report IDs are required for a weekly summary"})

    reports = []
    for rid in report_ids:
        result = table.get_item(Key={"id": rid})
        item = result.get("Item")
        if item:
            reports.append(item)

    if len(reports) < 2:
        return _response(400, {"error": "Fewer than 2 valid reports found"})

    all_tasks = []
    all_blockers = []
    for r in reports:
        all_tasks.extend(r.get("yesterdayTasks", []))
        all_tasks.extend(r.get("todayPlan", []))
        all_blockers.extend(r.get("blockers", []))

    unique_tasks = list(dict.fromkeys([t for t in all_tasks if t and t not in ("None",)]))
    unique_blockers = list(dict.fromkeys([b for b in all_blockers if b and b not in ("None",)]))

    total_tasks = len(unique_tasks)
    total_reports = len(reports)
    avg_per_day = total_tasks / total_reports if total_reports else 0

    closed_blockers = []
    active_blockers = []
    for b in unique_blockers:
        b_lower = b.lower()
        if any(kw in b_lower for kw in ["resolved", "fixed", "done", "completed", "cleared"]):
            closed_blockers.append(b)
        else:
            active_blockers.append(b)

    summary = {
        "weeklyOverview": f"Weekly sprint review covering {total_reports} daily standups. {total_tasks} unique tasks tracked with {len(unique_blockers)} blockers identified.",
        "accomplishments": unique_tasks[:8],
        "inProgress": [] if total_tasks <= 8 else unique_tasks[8:],
        "blockersResolved": closed_blockers if closed_blockers else ["No blockers resolved this week"],
        "blockersActive": active_blockers if active_blockers else ["No active blockers"],
        "nextWeekFocus": unique_tasks[-3:] if len(unique_tasks) >= 3 else unique_tasks,
        "teamMetrics": {
            "totalTasksCompleted": str(total_tasks),
            "avgTasksPerDay": str(round(avg_per_day, 1)),
            "blockerResolutionRate": f"{round((len(closed_blockers) / len(unique_blockers) * 100) if unique_blockers else 100)}%",
        },
    }

    report_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {
        "id": report_id,
        "userId": body.get("userId", "anonymous"),
        "report": summary,
        "sourceReportIds": report_ids,
        "createdAt": timestamp,
        "type": "weekly",
    }

    table.put_item(Item=item)
    return _response(201, {"id": report_id, "summary": summary, "createdAt": timestamp})


def lambda_handler(event, context):
    http_method = event.get("requestContext", {}).get("http", {}).get("method", "")
    raw_path = event.get("requestContext", {}).get("http", {}).get("path", "")
    query_params = event.get("queryStringParameters") or {}

    if http_method == "OPTIONS":
        return handle_options()

    try:
        body = json.loads(event.get("body", "{}")) if event.get("body") else {}
    except json.JSONDecodeError:
        body = {}

    try:
        if http_method == "POST" and raw_path == "/reports":
            return handle_generate_report(body)
        elif http_method == "POST" and raw_path == "/weekly-summary":
            return handle_weekly_summary(body)
        elif http_method == "GET" and raw_path == "/reports":
            return handle_list_reports(query_params)
        elif http_method == "GET" and raw_path.startswith("/reports/"):
            report_id = raw_path.split("/")[-1]
            return handle_get_report(report_id)
        else:
            return _response(404, {
                "error": f"Route not found: {http_method} {raw_path}",
                "availableRoutes": ["POST /reports", "GET /reports", "GET /reports/{id}", "POST /weekly-summary"],
            })
    except Exception as e:
        print(f"Error: {str(e)}")
        return _response(500, {"error": str(e)})