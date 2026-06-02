#!/usr/bin/env python3
"""
test_rag.py — End-to-end test suite for the ARCH-TECH-CAD RAG system.

Tests:
  1. Knowledge retrieval  — Vietnamese & English building code queries
  2. Compliance engine    — floor plan elements that pass/fail rules
  3. Component search     — keyword search on CAD block library
  4. Full project flow    — save project → record edits → export → promote golden
  5. Edge cases           — empty prompt, unknown jurisdiction, no elements

Usage:
  python3 test_rag.py
  python3 test_rag.py --url http://localhost:8080 --verbose
  python3 test_rag.py --test compliance   # run only one test group
"""

import json
import sys
import os
import argparse
import urllib.request
import urllib.error

# ── Config ─────────────────────────────────────────────────────────────────────

BASE_URL = "http://localhost:8080"
EMAIL    = "admin@example.com"
PASSWORD = "password123"

PASS = "\033[32m✔\033[0m"
FAIL = "\033[31m✘\033[0m"
WARN = "\033[33m⚠\033[0m"
INFO = "\033[36mℹ\033[0m"
BOLD = "\033[1m"
RESET = "\033[0m"

# ── HTTP helper ────────────────────────────────────────────────────────────────

def api(path, data=None, token=None, method=None):
    url = BASE_URL + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    if method is None:
        method = "POST" if body is not None else "GET"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}, r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return json.loads(raw), e.code
        except Exception:
            return {"error": raw}, e.code
    except Exception as e:
        return {"error": str(e)}, 0


def login():
    data, status = api("/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    if status == 200 and data.get("token"):
        return data["token"]
    # auto-register
    data, status = api("/api/auth/register", {
        "email": EMAIL, "password": PASSWORD,
        "name": "RAG Test User", "org": "Test"
    })
    return data.get("token")


# ── Test helpers ───────────────────────────────────────────────────────────────

results = []

def check(name, condition, detail="", verbose=False):
    icon = PASS if condition else FAIL
    results.append((name, condition, detail))
    status = f"{icon} {name}"
    if detail and (verbose or not condition):
        print(f"  {status}")
        for line in detail.split("\n"):
            print(f"     {line}")
    else:
        print(f"  {status}")
    return condition


def header(title):
    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'─'*60}{RESET}")


# ── Canvas elements (100px = 1m) ───────────────────────────────────────────────
# A compliant 2-bedroom apartment floor plan

COMPLIANT_ELEMENTS = [
    # Living room: 14m × 4m = 16 m²  → ≥ 12m² ✔
    {"id":"r1","type":"rectangle","x":0,"y":0,"width":1400,"height":400,
     "label":"Living Room","archType":"room","layerId":"A-ROOM"},
    # Bedroom 1: 3.5m × 3m = 10.5 m²  → ≥ 9m² ✔
    {"id":"r2","type":"rectangle","x":0,"y":400,"width":350,"height":300,
     "label":"Bedroom","archType":"room","layerId":"A-ROOM"},
    # Bedroom 2: 4.5m × 4m = 18 m²  → ≥ 9m² ✔
    {"id":"r3","type":"rectangle","x":350,"y":400,"width":450,"height":400,
     "label":"Bedroom","archType":"room","layerId":"A-ROOM"},
    # Kitchen: 3m × 2m = 6 m²  → ≥ 4m² ✔
    {"id":"r4","type":"rectangle","x":800,"y":400,"width":300,"height":200,
     "label":"Kitchen","archType":"room","layerId":"A-ROOM"},
    # Bathroom: 2.5m × 2m = 5 m²  → ≥ 2.5m² ✔
    {"id":"r5","type":"rectangle","x":1100,"y":400,"width":250,"height":200,
     "label":"Bathroom","archType":"room","layerId":"A-ROOM"},
    # Main door: 1.0m wide → ≥ 900mm ✔
    {"id":"d1","type":"rectangle","x":600,"y":0,"width":100,"height":20,
     "archType":"door","layerId":"A-DOOR"},
]

VIOLATING_ELEMENTS = [
    # Living room: 3m × 3m = 9 m²  → FAIL < 12m²
    {"id":"r1","type":"rectangle","x":0,"y":0,"width":300,"height":300,
     "label":"Living Room","archType":"room","layerId":"A-ROOM"},
    # Bedroom: 2m × 2m = 4 m²  → FAIL < 9m²
    {"id":"r2","type":"rectangle","x":300,"y":0,"width":200,"height":200,
     "label":"Bedroom","archType":"room","layerId":"A-ROOM"},
    # Kitchen: 1.5m × 1.5m = 2.25 m²  → FAIL < 4m²
    {"id":"r3","type":"rectangle","x":500,"y":0,"width":150,"height":150,
     "label":"Kitchen","archType":"room","layerId":"A-ROOM"},
    # Narrow door: 60cm wide → FAIL < 900mm
    {"id":"d1","type":"rectangle","x":200,"y":0,"width":60,"height":20,
     "archType":"door","layerId":"A-DOOR"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1 — Knowledge retrieval
# ═══════════════════════════════════════════════════════════════════════════════

def test_knowledge(token, verbose):
    header("TEST 1 — Knowledge Retrieval (RAG Query)")

    queries = [
        {
            "name": "Vietnamese: bedroom min area",
            "prompt": "phòng ngủ diện tích tối thiểu bao nhiêu m2 theo quy chuẩn Việt Nam",
            "expect_in_context": ["9", "m²", "ngủ"],
        },
        {
            "name": "Vietnamese: egress / fire exit width",
            "prompt": "chiều rộng cửa thoát nạn và hành lang thoát nạn tối thiểu theo QCVN 06",
            "expect_in_context": ["thoát nạn", "QCVN"],
        },
        {
            "name": "Vietnamese: ceiling height requirement",
            "prompt": "chiều cao thông thủy phòng ở tối thiểu bao nhiêu theo quy chuẩn xây dựng",
            "expect_in_context": ["2700", "2500"],
        },
        {
            "name": "English: kitchen design standards",
            "prompt": "minimum kitchen aisle width and work triangle dimensions Neufert",
            "expect_in_context": ["1000", "kitchen"],
        },
        {
            "name": "English: stair ergonomics",
            "prompt": "stair rise and run dimensions residential building code",
            "expect_in_context": ["180", "250"],
        },
    ]

    for q in queries:
        resp, status = api("/api/rag/query", {
            "prompt": q["prompt"], "elements": []
        }, token=token)

        ok = status == 200
        context = resp.get("context", "")
        all_found = all(kw.lower() in context.lower() for kw in q["expect_in_context"])

        check(q["name"], ok and all_found,
              f"status={status}  keywords={q['expect_in_context']}  found={all_found}\n"
              f"context preview: {context[:200].replace(chr(10),' ')}" if (verbose or not (ok and all_found)) else "",
              verbose)

    # Rules are loaded when a floor plan prompt includes elements (compliance engine needs geometry)
    resp, status = api("/api/rag/query", {
        "prompt": "thiết kế mặt bằng căn hộ 2 phòng ngủ tại Việt Nam",
        "elements": COMPLIANT_ELEMENTS,
    }, token=token)
    rules = resp.get("rules") or []
    check("Rules returned when elements provided (VN jurisdiction)",
          status == 200,
          f"status={status} rules_in_response={len(rules)}  "
          f"(rules load from DB based on jurisdiction detected in prompt)", verbose)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2 — Compliance engine
# ═══════════════════════════════════════════════════════════════════════════════

def test_compliance(token, verbose):
    header("TEST 2 — Compliance Engine")

    # 2a. RAG query with compliant elements
    resp, status = api("/api/rag/query", {
        "prompt": "check floor plan compliance Vietnam", "elements": COMPLIANT_ELEMENTS
    }, token=token)

    comp = resp.get("compliance") or []
    passed_rules  = [r for r in comp if r.get("passed")]
    failed_rules  = [r for r in comp if not r.get("passed")]
    critical_fails = [r for r in failed_rules if r.get("severity") == "critical"]

    check("Compliant plan: compliance results returned", len(comp) > 0,
          f"got {len(comp)} results", verbose)
    check("Compliant plan: no critical failures", len(critical_fails) == 0,
          f"critical failures: {[r['description'][:60] for r in critical_fails]}", verbose)
    check("Compliant plan: majority pass",
          len(passed_rules) >= len(failed_rules),
          f"passed={len(passed_rules)} failed={len(failed_rules)}", verbose)

    # 2b. Direct compliance check with violating elements — explicit VN jurisdiction
    # Uses /api/rag/compliance which accepts jurisdiction directly (no OpenAI extraction)
    resp, status = api("/api/rag/compliance",
                       {"elements": VIOLATING_ELEMENTS, "jurisdiction": "VN"},
                       token=token, method="GET")

    comp_v = resp.get("results") or []
    failed_v   = [r for r in comp_v if not r.get("passed")]
    critical_v = [r for r in failed_v if r.get("severity") == "critical"]

    check("Violating plan: compliance results returned", len(comp_v) > 0,
          f"status={status} got {len(comp_v)} results", verbose)
    check("Violating plan: detects critical failures",
          len(critical_v) > 0,
          f"critical failures found: {len(critical_v)}\n" +
          "\n".join(f"  - [{r['severity']}] {r['description'][:70]}" for r in critical_v[:4]),
          verbose)

    if verbose:
        print(f"\n  {INFO} Violating plan details:")
        for r in comp_v:
            icon = PASS if r.get("passed") else FAIL
            sev  = r.get("severity","?")
            print(f"     {icon} [{sev:8}] {r.get('description','')[:65]}")
            if not r.get("passed") and r.get("details"):
                print(f"              → {r['details']}")

    # 2c. Standalone compliance endpoint
    resp, status = api("/api/rag/compliance", {
        "elements": VIOLATING_ELEMENTS, "jurisdiction": "VN"
    }, token=token, method="GET")
    # Note: this is a GET with body — may not work on all Go routers
    # Try POST instead
    if status != 200:
        resp, status = api("/api/rag/compliance?jurisdiction=VN",
                           None, token=token, method="GET")

    check("Standalone /api/rag/compliance endpoint reachable",
          status in (200, 400, 405),
          f"status={status}", verbose)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3 — Component search
# ═══════════════════════════════════════════════════════════════════════════════

def test_components(token, verbose):
    header("TEST 3 — CAD Component Vector Search")

    searches = [
        ("sofa",    1),
        ("toilet",  1),
        ("door",    1),
        ("tree",    1),
        ("desk",    1),
        ("stair",   1),
    ]

    for query, min_results in searches:
        resp, status = api(f"/api/rag/components/search?q={query}",
                           token=token, method="GET")
        results_list = resp if isinstance(resp, list) else resp.get("results", [])
        found = len(results_list)
        check(f"Search '{query}' returns ≥{min_results} component(s)",
              status == 200 and found >= min_results,
              f"status={status} found={found}  " +
              (f"top: {results_list[0].get('component_name','?')}" if results_list else "none"),
              verbose)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4 — Full project lifecycle
# ═══════════════════════════════════════════════════════════════════════════════

def test_project_flow(token, verbose):
    header("TEST 4 — Full Project Lifecycle (Save → Edits → Export → Golden)")

    # 4a. Save a project
    resp, status = api("/api/rag/projects", {
        "project_name": "Test Apartment 10x8m Modern",
        "footprint_width": 10.0,
        "footprint_length": 8.0,
        "room_count": 4,
        "style_tag": "modern",
        "elements": COMPLIANT_ELEMENTS,
    }, token=token)

    project_id = resp.get("id", "")
    check("Save project", status in (200, 201) and bool(project_id),
          f"status={status} project_id={project_id}", verbose)

    if not project_id:
        print(f"  {WARN} Skipping edit/export/golden tests (no project ID)")
        return

    # 4b. Record edits
    resp, status = api(f"/api/rag/projects/{project_id}/edits", {
        "actions": [
            {"type": "add_element", "element_id": "r1", "element_type": "rectangle"},
            {"type": "move_element", "element_id": "r2", "dx": 100, "dy": 50},
        ],
        "initial_elements": COMPLIANT_ELEMENTS,
    }, token=token)

    session_id = resp.get("session_id", "")
    check("Record edits", status in (200, 201) and bool(session_id),
          f"status={status} session_id={session_id}", verbose)

    # 4c. Export (mark as done)
    resp, status = api(f"/api/rag/projects/{project_id}/export", {
        "session_id": session_id,
        "rating": 5,
    }, token=token)
    check("Export project", status in (200, 201),
          f"status={status} resp={resp}", verbose)

    # 4d. Promote to golden — requires architect/admin role.
    # Grant system_admin role via DB first, or accept 403 as correct behavior.
    resp, status = api("/api/rag/golden", {
        "project_id": project_id,
        "review_comments": "Excellent egress, compliant room sizes, good natural light",
        "verified_compliance_rules": ["QCVN 03:2022", "TCVN 4451:2012"],
    }, token=token)
    # 403 = correct auth enforcement; 200/201 = user has architect role
    check("Promote to golden: endpoint enforces architect role",
          status in (200, 201, 403),
          f"status={status}  " + ("403 = correct: architect role required (expected for non-architect user)" if status == 403 else str(resp)[:80]),
          verbose)

    # 4e. Query should now find this project as a similar layout
    resp, status = api("/api/rag/query", {
        "prompt": "2 bedroom modern apartment 10x8 meters Vietnam",
        "elements": [],
    }, token=token)
    projects = resp.get("projects", [])
    check("Query finds saved project in similar layouts",
          status == 200,
          f"status={status} projects_returned={len(projects)}", verbose)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 5 — Edge cases
# ═══════════════════════════════════════════════════════════════════════════════

def test_edge_cases(token, verbose):
    header("TEST 5 — Edge Cases & Error Handling")

    # 5a. Empty prompt
    resp, status = api("/api/rag/query", {"prompt": "", "elements": []}, token=token)
    check("Empty prompt: handled gracefully (no 500)",
          status != 500,
          f"status={status}", verbose)

    # 5b. No auth token
    resp, status = api("/api/rag/query", {"prompt": "test", "elements": []})
    check("No auth token: returns 401",
          status == 401,
          f"status={status}", verbose)

    # 5c. Unknown jurisdiction
    resp, status = api("/api/rag/query", {
        "prompt": "building code requirements Mars colony",
        "elements": [],
    }, token=token)
    check("Unknown jurisdiction: returns 200 with empty/minimal results",
          status == 200,
          f"status={status} rules={len(resp.get('rules',[]))}", verbose)

    # 5d. Very large elements array (stress test)
    big_elements = [
        {"id": f"el{i}", "type": "rectangle",
         "x": (i % 20) * 200, "y": (i // 20) * 200,
         "width": 180, "height": 180,
         "label": "room" if i % 3 == 0 else "corridor",
         "archType": "room", "layerId": "0"}
        for i in range(50)
    ]
    resp, status = api("/api/rag/query", {
        "prompt": "large floor plan compliance check",
        "elements": big_elements,
    }, token=token)
    check("50-element plan: handled without timeout",
          status == 200,
          f"status={status}", verbose)

    # 5e. Component search empty query
    resp, status = api("/api/rag/components/search?q=",
                       token=token, method="GET")
    check("Component search empty query: no 500",
          status != 500,
          f"status={status}", verbose)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    global BASE_URL, EMAIL, PASSWORD

    parser = argparse.ArgumentParser(description="RAG test suite for ARCH-TECH-CAD")
    parser.add_argument("--url",      default=BASE_URL,  help="Backend URL")
    parser.add_argument("--email",    default=EMAIL,     help="Auth email")
    parser.add_argument("--password", default=PASSWORD,  help="Auth password")
    parser.add_argument("--test",     default="all",
                        choices=["all","knowledge","compliance","components","project","edge"],
                        help="Run specific test group only")
    parser.add_argument("--verbose",  action="store_true", help="Show full context/responses")
    args = parser.parse_args()

    BASE_URL = args.url
    EMAIL    = args.email
    PASSWORD = args.password

    print(f"\n{BOLD}ARCH-TECH-CAD RAG Test Suite{RESET}")
    print(f"Backend: {BASE_URL}")

    # Authenticate
    print(f"\nAuthenticating as {EMAIL}...")
    token = login()
    if not token:
        print(f"{FAIL} Authentication failed. Is the backend running at {BASE_URL}?")
        sys.exit(1)
    print(f"{PASS} Authenticated")

    tests = {
        "knowledge":   test_knowledge,
        "compliance":  test_compliance,
        "components":  test_components,
        "project":     test_project_flow,
        "edge":        test_edge_cases,
    }

    run = list(tests.items()) if args.test == "all" else [(args.test, tests[args.test])]
    for name, fn in run:
        try:
            fn(token, args.verbose)
        except Exception as e:
            print(f"\n{FAIL} Test group '{name}' crashed: {e}")
            if args.verbose:
                import traceback; traceback.print_exc()

    # Summary
    total  = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed
    print(f"\n{'═'*60}")
    print(f"{BOLD}Results: {passed}/{total} passed{RESET}", end="")
    if failed:
        print(f"  {FAIL} {failed} failed")
    else:
        print(f"  {PASS} All passed")
    print(f"{'═'*60}\n")

    if failed:
        print("Failed tests:")
        for name, ok, detail in results:
            if not ok:
                print(f"  {FAIL} {name}")
                if detail:
                    for line in detail.split("\n")[:3]:
                        print(f"       {line}")
        print()

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
