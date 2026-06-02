#!/usr/bin/env python3
"""
seed_rag.py — Seed the ARCH-TECH-CAD RAG knowledge base.

Modes:
  seed_rag.py <file.txt|file.pdf>         Chunk and upload a document as knowledge_chunks
  seed_rag.py --rules rules.json          Upload building rules from a JSON file
  seed_rag.py --chunks-json chunks.json   Upload pre-structured knowledge chunks from JSON
  seed_rag.py --components comps.json     Upload CAD component metadata from JSON
  seed_rag.py --all                       Seed everything in tools/ (all modes combined)

Examples:
  python3 seed_rag.py knowledge/qcvn_03_2022.txt --title "QCVN 03:2022/BXD" --yes
  python3 seed_rag.py --rules building_rules_seed.json --yes
  python3 seed_rag.py --components cad_components_seed.json --yes
  python3 seed_rag.py --all --yes
"""
import os
import sys
import re
import json
import argparse
from datetime import datetime


# ── HTTP helper ────────────────────────────────────────────────────────────────

def make_request(url, data=None, headers=None, method="GET"):
    import urllib.request
    import urllib.error
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            resp_data = response.read().decode("utf-8")
            return (json.loads(resp_data) if resp_data else {}), response.status
    except urllib.error.HTTPError as e:
        err_data = e.read().decode("utf-8")
        try:
            return json.loads(err_data), e.code
        except Exception:
            return {"error": err_data or e.reason}, e.code
    except Exception as e:
        return {"error": str(e)}, 500


# ── PDF reader ─────────────────────────────────────────────────────────────────

def read_pdf(file_path):
    try:
        import pypdf
    except ImportError:
        try:
            import PyPDF2 as pypdf
        except ImportError:
            print("\n[ERROR] PDF parsing requires the 'pypdf' package.")
            print("Install: pip install pypdf")
            sys.exit(1)
    try:
        reader = pypdf.PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        print(f"\n[ERROR] Failed to read PDF: {e}")
        sys.exit(1)


# ── Chunking ───────────────────────────────────────────────────────────────────

def split_large_chunk(content, chunk_size):
    if len(content) <= chunk_size:
        return [content]
    paragraphs = content.split("\n\n") if "\n\n" in content else content.split(". ")
    result, current, current_len = [], [], 0
    for p in paragraphs:
        if len(p) > chunk_size:
            if current:
                result.append("\n\n".join(current))
                current, current_len = [], 0
            for start in range(0, len(p), chunk_size):
                result.append(p[start:start + chunk_size])
        elif current_len + len(p) > chunk_size:
            result.append("\n\n".join(current))
            current, current_len = [p], len(p)
        else:
            current.append(p)
            current_len += len(p) + 2
    if current:
        result.append("\n\n".join(current))
    return result


def chunk_text(text, title, chunk_size=1500):
    """Split Vietnamese/standard building code text into semantic chunks."""
    heading_patterns = [
        r"^Chương\s+[IVXLCDM\d]+\b.*$",
        r"^Mục\s+\d+\b.*$",
        r"^Điều\s+\d+\b.*$",
        r"^Chapter\s+\d+\b.*$",
        r"^Section\s+\d+\b.*$",
        r"^Article\s+\d+\b.*$",
    ]
    major_re = re.compile("|".join(heading_patterns), re.IGNORECASE)
    numeric_re = re.compile(r"^\d+(\.\d+){1,3}\b.*$")

    lines = text.split("\n")
    chunks = []
    current_id = "General / Thông tin chung"
    current_content = []

    def save_chunk():
        if not current_content:
            return
        body = "\n".join(current_content).replace(current_id, "").strip()
        if not body:
            return
        for idx, sub in enumerate(split_large_chunk("\n".join(current_content), chunk_size)):
            sub_id = current_id if len(split_large_chunk("\n".join(current_content), chunk_size)) == 1 else f"{current_id} (Phần {idx + 1})"
            chunks.append({"document_title": title, "section_identifier": sub_id, "content": sub})

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        is_heading = bool(major_re.match(stripped))
        if not is_heading and numeric_re.match(stripped):
            if len(stripped.split()) < 12 and len(stripped) < 100:
                is_heading = True
        if is_heading:
            save_chunk()
            current_id = stripped
            current_content = [stripped]
        else:
            current_content.append(stripped)

    save_chunk()
    return chunks


# ── Auth ───────────────────────────────────────────────────────────────────────

def authenticate(base_url, email, password):
    print(f"Authenticating as {email}...")
    res, status = make_request(f"{base_url}/api/auth/login", {"email": email, "password": password}, method="POST")
    if status == 200:
        print("Login successful.")
        return res.get("token")
    print(f"Login failed (status {status}). Attempting auto-register...")
    res, status = make_request(f"{base_url}/api/auth/register", {
        "email": email, "password": password,
        "name": "RAG Seeder Admin", "org": "System Administration"
    }, method="POST")
    if status in (200, 201):
        print("Registration successful.")
        return res.get("token")
    print(f"Auto-registration failed: {res.get('error', 'Unknown error')}")
    return None


# ── Progress bar ───────────────────────────────────────────────────────────────

def progress(current, total, prefix="Uploading", length=30):
    pct = f"{100 * current / total:.1f}"
    filled = int(length * current // total)
    bar = "█" * filled + "-" * (length - filled)
    sys.stdout.write(f"\r{prefix}: |{bar}| {pct}% ({current}/{total})")
    sys.stdout.flush()
    if current == total:
        sys.stdout.write("\n")


# ── Upload helpers ─────────────────────────────────────────────────────────────

def upload_rules(rules, base_url, headers):
    print(f"\nUploading {len(rules)} building rules...")
    ok = 0
    for i, rule in enumerate(rules):
        res, status = make_request(f"{base_url}/api/rag/building-rules", rule, headers=headers, method="POST")
        if status in (200, 201):
            ok += 1
        else:
            print(f"\n[WARN] Rule {i + 1} failed: {res.get('error', status)}")
        progress(i + 1, len(rules), "Rules")
    print(f"Rules uploaded: {ok}/{len(rules)}")
    return ok


def upload_chunks(chunks, base_url, headers, source_filename=""):
    print(f"\nUploading {len(chunks)} knowledge chunks...")
    ok = 0
    for i, chunk in enumerate(chunks):
        payload = {
            "document_title": chunk["document_title"],
            "section_identifier": chunk["section_identifier"],
            "content": chunk["content"],
            "metadata": {
                "source": source_filename or chunk.get("document_title", ""),
                "chunk_index": i,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        }
        res, status = make_request(f"{base_url}/api/rag/knowledge-chunks", payload, headers=headers, method="POST")
        if status in (200, 201):
            ok += 1
        else:
            print(f"\n[WARN] Chunk {i + 1} failed: {res.get('error', status)}")
        progress(i + 1, len(chunks), "Chunks")
    print(f"Chunks uploaded: {ok}/{len(chunks)}")
    return ok


def upload_components(components, base_url, headers):
    print(f"\nUploading {len(components)} CAD components...")
    ok = 0
    for i, comp in enumerate(components):
        payload = {
            "component_name": comp.get("component_name", ""),
            "category": comp.get("category", "general"),
            "svg_representation": comp.get("svg_representation", ""),
            "geometry_data": comp.get("geometry_data") if isinstance(comp.get("geometry_data"), str) else json.dumps(comp.get("geometry_data", {})),
            "tags": comp.get("tags", []),
        }
        res, status = make_request(f"{base_url}/api/rag/components", payload, headers=headers, method="POST")
        if status in (200, 201):
            ok += 1
        else:
            print(f"\n[WARN] Component {i + 1} ({payload['component_name']}) failed: {res.get('error', status)}")
        progress(i + 1, len(components), "Components")
    print(f"Components uploaded: {ok}/{len(components)}")
    return ok


def upload_projects(projects, base_url, headers):
    print(f"\nUploading {len(projects)} floor plan projects...")
    ok = 0
    for i, proj in enumerate(projects):
        res, status = make_request(f"{base_url}/api/rag/projects", proj, headers=headers, method="POST")
        if status in (200, 201):
            ok += 1
        else:
            print(f"\n[WARN] Project {i + 1} failed: {res.get('error', status)}")
        progress(i + 1, len(projects), "Projects")
    print(f"Projects uploaded: {ok}/{len(projects)}")
    return ok


# ── Load JSON helpers ──────────────────────────────────────────────────────────

def load_json_file(path, label):
    if not os.path.exists(path):
        print(f"[ERROR] {label} file not found: {path}")
        sys.exit(1)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            print(f"[ERROR] {label} file must contain a JSON array.")
            sys.exit(1)
        print(f"Loaded {len(data)} {label.lower()} from {path}")
        return data
    except Exception as e:
        print(f"[ERROR] Failed to read {label} JSON: {e}")
        sys.exit(1)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Seed the ARCH-TECH-CAD RAG knowledge base.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("file", nargs="?", help="Text or PDF document to chunk and upload as knowledge_chunks.")
    parser.add_argument("--rules",        metavar="FILE", help="JSON file of building rules to upload.")
    parser.add_argument("--chunks-json",  metavar="FILE", help="JSON file of pre-structured knowledge chunks to upload.")
    parser.add_argument("--components",   metavar="FILE", help="JSON file of CAD component metadata to upload.")
    parser.add_argument("--projects",     metavar="FILE", help="JSON file of floor plan projects to upload.")
    parser.add_argument("--all",          action="store_true", help="Seed everything: auto-discovers building_rules_seed.json, cad_components_seed.json, and all knowledge/*.txt files in the tools/ directory.")
    parser.add_argument("--url",      default="http://localhost:8080", help="Backend base URL (default: http://localhost:8080)")
    parser.add_argument("--email",    default="admin@example.com",    help="Admin email for auth.")
    parser.add_argument("--password", default="password123",          help="Admin password.")
    parser.add_argument("--title",    help="Document title override (only for text/PDF file mode).")
    parser.add_argument("--chunk-size", type=int, default=1500, help="Max characters per chunk (default: 1500).")
    parser.add_argument("--dry-run",  action="store_true", help="Preview without uploading.")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip upload confirmation prompt.")

    args = parser.parse_args()

    tools_dir = os.path.dirname(os.path.abspath(__file__))

    # ── --all mode: discover everything ───────────────────────────────────────
    if args.all:
        args.rules      = args.rules      or os.path.join(tools_dir, "building_rules_seed.json")
        args.components = args.components or os.path.join(tools_dir, "cad_components_seed.json")
        # Auto-discover knowledge/*.txt files
        knowledge_dir = os.path.join(tools_dir, "knowledge")
        knowledge_files = sorted([
            os.path.join(knowledge_dir, f)
            for f in os.listdir(knowledge_dir)
            if f.endswith(".txt") or f.endswith(".pdf")
        ]) if os.path.isdir(knowledge_dir) else []
        if knowledge_files:
            print(f"[--all] Discovered {len(knowledge_files)} knowledge files in {knowledge_dir}")

    if not args.file and not args.rules and not args.chunks_json and not args.components and not args.projects and not (args.all and "knowledge_files" in dir()):
        parser.print_help()
        print("\n[ERROR] Provide at least one input source.")
        sys.exit(1)

    # ── Collect all data ───────────────────────────────────────────────────────
    rules_data      = load_json_file(args.rules, "Building rules") if args.rules and os.path.exists(args.rules) else []
    chunks_from_json = load_json_file(args.chunks_json, "Knowledge chunks") if args.chunks_json else []
    components_data = load_json_file(args.components, "CAD components") if args.components and os.path.exists(args.components) else []
    projects_data   = load_json_file(args.projects, "Floor plan projects") if args.projects else []

    # Parse text/PDF file
    chunks_from_file = []
    filename = ""
    files_to_chunk = []
    if args.file:
        files_to_chunk.append((args.file, args.title))
    if args.all and "knowledge_files" in dir():
        for kf in knowledge_files:
            title = os.path.splitext(os.path.basename(kf))[0].upper().replace("_", ":")
            files_to_chunk.append((kf, title))

    for filepath, title_override in files_to_chunk:
        if not os.path.exists(filepath):
            print(f"[WARN] File not found, skipping: {filepath}")
            continue
        fname = os.path.basename(filepath)
        title = title_override or os.path.splitext(fname)[0]
        print(f"Reading: {filepath} ...")
        text = read_pdf(filepath) if filepath.lower().endswith(".pdf") else open(filepath, "r", encoding="utf-8", errors="ignore").read()
        file_chunks = chunk_text(text, title, args.chunk_size)
        print(f"  → {len(file_chunks)} chunks from '{title}'")
        chunks_from_file.extend(file_chunks)
        filename = fname

    all_chunks = chunks_from_file + chunks_from_json

    # ── Dry run ────────────────────────────────────────────────────────────────
    if args.dry_run:
        print("\n=== DRY RUN PREVIEW ===")
        if rules_data:
            print(f"\nBuilding Rules ({len(rules_data)}):")
            for i, r in enumerate(rules_data[:5]):
                print(f"  [{i+1}] {r.get('rule_category')} / {r.get('target_element')} / {r.get('rule_type')}: {r.get('description', '')[:80]}")
            if len(rules_data) > 5:
                print(f"  ... and {len(rules_data) - 5} more rules.")
        if all_chunks:
            print(f"\nKnowledge Chunks ({len(all_chunks)}):")
            for i, c in enumerate(all_chunks[:5]):
                print(f"  [{i+1}] [{c['document_title']}] {c['section_identifier']}")
                print(f"      {c['content'][:100].replace(chr(10), ' ')}...")
            if len(all_chunks) > 5:
                print(f"  ... and {len(all_chunks) - 5} more chunks.")
        if components_data:
            print(f"\nCAD Components ({len(components_data)}):")
            for i, c in enumerate(components_data[:5]):
                print(f"  [{i+1}] {c['component_name']} ({c['category']}) — tags: {', '.join(c.get('tags', [])[:4])}")
            if len(components_data) > 5:
                print(f"  ... and {len(components_data) - 5} more components.")
        if projects_data:
            print(f"\nFloor Plan Projects ({len(projects_data)}):")
            for i, p in enumerate(projects_data[:3]):
                print(f"  [{i+1}] {p.get('project_name')} ({p.get('footprint_width')}×{p.get('footprint_length')}m, {p.get('room_count')} rooms)")
        total = len(rules_data) + len(all_chunks) + len(components_data) + len(projects_data)
        print(f"\nTotal items to upload: {total}")
        print("Dry-run complete. No changes made.")
        sys.exit(0)

    # ── Authenticate ───────────────────────────────────────────────────────────
    token = authenticate(args.url, args.email, args.password)
    if not token:
        print("[ERROR] Authentication failed. Exiting.")
        sys.exit(1)
    headers = {"Authorization": f"Bearer {token}"}

    # ── Confirm ────────────────────────────────────────────────────────────────
    if not args.yes:
        total = len(rules_data) + len(all_chunks) + len(components_data) + len(projects_data)
        confirm = input(f"\nUpload {total} items to {args.url}? (y/N): ")
        if confirm.lower() not in ("y", "yes"):
            print("Cancelled.")
            sys.exit(0)

    # ── Upload ─────────────────────────────────────────────────────────────────
    if rules_data:
        upload_rules(rules_data, args.url, headers)
    if all_chunks:
        upload_chunks(all_chunks, args.url, headers, filename)
    if components_data:
        upload_components(components_data, args.url, headers)
    if projects_data:
        upload_projects(projects_data, args.url, headers)

    print("\n✅ Seeding complete!")


if __name__ == "__main__":
    main()
