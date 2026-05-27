# AutoCAD AI Drawing Gap Assessment and Remediation Plan

## 1. Muc tieu tai lieu / Document Purpose

**VI**

Tai lieu nay mo ta van de hien tai cua tinh nang AI drawing trong `autocard`, phan tich nguyen nhan goc, chi ra khoang cach giua ket qua hien co va ky vong nguoi dung, va de xuat lo trinh khac phuc theo muc do uu tien.

**EN**

This document describes the current problems in the `autocard` AI drawing feature, analyzes root causes, identifies the gap between the current output and the expected result, and proposes a prioritized remediation roadmap.

## 2. Pham vi / Scope

**VI**

Pham vi cua tai lieu bao gom:

- Backend AI generation flow trong `autocard/backend/handlers/ai_handler.go`
- Frontend AI import and rendering flow trong `autocard/frontend`
- Hanh vi hien tai khi nguoi dung nhap prompt de tao mat bang hoac ban ve kien truc

Pham vi khong bao gom:

- Toan bo `editor/`
- He thong BIM/3D nang cao
- OCR, image-to-CAD, hoac CAD reconstruction tu anh mau

**EN**

This document covers:

- The backend AI generation flow in `autocard/backend/handlers/ai_handler.go`
- The frontend AI import and rendering flow in `autocard/frontend`
- The current behavior when users submit prompts to generate floor plans or architectural drawings

This document does not cover:

- The broader `editor/` workspace
- Advanced BIM or 3D authoring features
- OCR, image-to-CAD, or reconstruction from reference images

## 3. Hien trang van de / Current Problem Statement

**VI**

Tinh nang AI drawing da duoc implement, nhung ket qua hien tai khong dat muc ky vong cua nguoi dung. Trong thuc te, he thong co xu huong:

- Tao ra ket qua rat don gian, chi gom mot vai line/shape co ban
- Khong tai hien duoc cau truc mat bang kien truc giong cac ban ve mau
- Trong mot so truong hop, nguoi dung chi nhin thay mot duong line hoac rat it doi tuong co y nghia

Ky vong cua nguoi dung la he thong co the tao ban ve co to chuc tot hon, gan voi floor plan thuc te, bao gom:

- Tuong ngoai va vach ngan
- Cua di va cua so
- Phong va nhan phong
- Kich thuoc, grid, hatch, va bo cuc ban ve ro rang
- Kha nang tien can chat luong hinh anh/ban ve nhu cac screenshot tham chieu

**EN**

The AI drawing feature has been implemented, but the current output does not meet user expectations. In practice, the system tends to:

- Generate very simple results with only a few basic lines or shapes
- Fail to reproduce architectural floor-plan structure similar to the reference drawings
- In some cases, show only a single line or a very small number of meaningful objects

The expected behavior is for the system to generate a more structured plan, closer to a practical architectural floor plan, including:

- Outer walls and internal partitions
- Doors and windows
- Rooms and room labels
- Dimensions, grid axes, hatch patterns, and a readable plan layout
- Quality closer to the referenced screenshots

## 4. Bang chung quan sat duoc / Observed Evidence

**VI**

Qua kiem tra codebase hien tai:

- Backend co mot deterministic path cho prompt house/rectangular house trong `ai_handler.go`
- Path nay co the tao `hatch`, `arc`, `dimension`, `text`, `line`, va mot so metadata kien truc
- Neu prompt khong match deterministic rule, request se di qua generic AI generation flow
- Generic AI system prompt hien chi yeu cau model sinh `rectangle`, `circle`, `line`, va `text`
- Frontend service co parse `data.elements` va map vao `DrawingElement[]`
- Frontend 2D/3D rendering hien ho tro khong dong deu cho cac primitive nang cao, dac biet trong mot so view chi render subset cua element types

**EN**

From the current codebase inspection:

- The backend has a deterministic path for house/rectangular-house prompts in `ai_handler.go`
- That path can generate `hatch`, `arc`, `dimension`, `text`, `line`, and some architectural metadata
- If the prompt does not match the deterministic rules, the request falls back to the generic AI generation flow
- The generic AI system prompt currently asks the model to generate only `rectangle`, `circle`, `line`, and `text`
- The frontend service parses `data.elements` and maps them into `DrawingElement[]`
- Frontend 2D/3D rendering support is uneven for advanced primitives, and some views render only a subset of element types

## 5. Nguyen nhan goc / Root Causes

### 5.1 Prompt and generator mismatch / Lech giua prompt va bo sinh

**VI**

Van de lon nhat la ky vong cua nguoi dung dang o muc "architectural CAD plan", trong khi generic AI prompt hien tai chi huong model sinh bo primitive do hoa co ban. Nghia la:

- Model khong duoc yeu cau tao cau truc kien truc day du
- Model khong duoc yeu cau tao semantics nhu room topology, host wall, opening logic, circulation, furniture placement, hay dimension strategy
- Model dang tra ve "drawing primitives", khong phai "architectural plan model"

**EN**

The largest issue is a mismatch between the user's expectation of an "architectural CAD plan" and the current generic AI prompt, which only asks for basic drawing primitives. In other words:

- The model is not asked to build a complete architectural structure
- The model is not asked to produce semantics such as room topology, host walls, opening logic, circulation, furniture placement, or dimension strategy
- The output is a set of drawing primitives, not an architectural plan model

### 5.2 Deterministic path qua hep / Deterministic path is too narrow

**VI**

Path deterministic hien tai chi hoat dong tot voi mot tap prompt hep, chu yeu la rectangular house co dimensions ro rang va mo ta ngan. Mot so tu khoa nhu `kitchen`, `bathroom`, `office`, `detailed`, hoac prompt dai hon nguong dang lam request roi sang generic path.

Ket qua la:

- Prompt rat de "truot" khoi path tot nhat
- Prompt thuc te cua nguoi dung thuong bi dua vao generic path kem on dinh hon

**EN**

The current deterministic path works only for a narrow class of prompts, mainly short rectangular-house requests with explicit dimensions. Keywords such as `kitchen`, `bathroom`, `office`, `detailed`, or simply a longer prompt can divert the request into the generic path.

As a result:

- Prompts easily miss the strongest generation path
- Real user prompts often end up in the less reliable generic path

### 5.3 Frontend rendering support chua day du / Frontend rendering support is incomplete

**VI**

Ngay ca khi backend tra ve element phong phu hon, mot phan giao dien hien tai van co nguy co:

- Bo qua primitive nang cao
- Tinh bounds/center khong dua tren day du tat ca element types
- Render khong dong nhat giua 2D, paper space, va 3D preview

Neu renderer khong ve `arc`, `hatch`, `dimension`, hoac khong dung `plan` payload mot cach nhat quan, nguoi dung se thay ket qua ngho nan du backend da tra ve nhieu du lieu hon.

**EN**

Even when the backend returns richer elements, parts of the current frontend still risk:

- Ignoring advanced primitives
- Computing bounds and centering without accounting for all element types
- Rendering inconsistently across 2D view, paper space, and 3D preview

If the renderer does not properly display `arc`, `hatch`, `dimension`, or does not use the `plan` payload consistently, the user can still see a poor result even when the backend produced more data.

### 5.4 Khong co lop trung gian kien truc / Missing architectural intermediate model

**VI**

He thong hien tai tron hai cach tiep can:

- Deterministic generator tao plan co semantics
- Generic AI generator tao primitives truc tiep

Thieu mot lop trung gian thong nhat de:

- Chuyen natural language thanh structured architectural intent
- Validate intent
- Sinh drawing tu intent do mot cach on dinh

**EN**

The system currently mixes two approaches:

- A deterministic generator that creates a semantic plan
- A generic AI generator that directly emits primitives

What is missing is a unified intermediate layer to:

- Convert natural language into structured architectural intent
- Validate that intent
- Generate drawing output from that intent in a stable way

## 6. Khoang cach so voi ky vong / Gap Versus Expected Output

**VI**

So voi screenshot tham chieu, he thong hien tai con thieu cac nang luc sau:

- Bo tri phong hop ly theo cong nang
- Chieu day tuong, logic vach ngan, va opening placement ro rang
- Ky hieu cua, swing, va cua so dung quy uoc
- Hatch, dimension chains, grid, va text placement co tinh CAD hon
- Furniture va sanitary fixtures de tang kha nang doc ban ve
- Kha nang tao mot ban ve co mat do thong tin trung binh den cao

**EN**

Compared with the reference screenshots, the current system still lacks:

- Functional room layout planning
- Clear wall thickness, partition logic, and opening placement
- Proper door symbols, swing conventions, and window representation
- CAD-like hatch, dimension chains, grid, and text placement
- Furniture and sanitary fixtures to improve readability
- The ability to produce a medium- to high-density architectural drawing

## 7. Tac dong nghiep vu / Business and Product Impact

**VI**

Neu khong khac phuc, tinh nang AI drawing co nguy co:

- Lam nguoi dung mat niem tin vi ket qua khong giong demo expectation
- Tang so lan prompt-thu-lai nhung van khong ra duoc ket qua tot
- Gay nham lan rang AI "hong" trong khi van de thuc te nam o generator va renderer
- Lam cham qua trinh mo rong sang image-assisted design hoac architectural automation

**EN**

If left unresolved, the AI drawing feature risks:

- Losing user trust because the output does not match demo expectations
- Increasing repeated prompt attempts without meaningful improvement
- Making the feature appear broken even when the underlying issue is generator and renderer design
- Slowing future expansion into image-assisted design or architectural automation

## 8. Huong khac phuc de xuat / Proposed Remediation

### 8.1 Muc tieu ky thuat / Technical Target

**VI**

Can chuyen he thong tu mo hinh "AI ve primitive truc tiep" sang mo hinh "AI/logic tao architectural plan structure truoc, sau do render ra CAD primitives".

**EN**

The system should move from "AI directly draws primitives" to "AI and/or deterministic logic first create an architectural plan structure, then render that structure into CAD primitives."

### 8.2 Huong giai quyet cot loi / Core Solution Direction

**VI**

Huong khac phuc de xuat gom 4 nhom:

1. Mo rong structured plan generator
2. Giam su phu thuoc vao generic primitive-only prompt
3. Chuan hoa frontend rendering cho element types kien truc
4. Them test va observability cho AI generation flow

**EN**

The proposed remediation has four major streams:

1. Expand the structured plan generator
2. Reduce dependence on the generic primitive-only prompt
3. Standardize frontend rendering for architectural element types
4. Add tests and observability for the AI generation flow

## 9. Phuong an thuc hien / Delivery Approaches

### Phuong an A - Fix nhe tren generator hien tai / Option A - Incremental fix on current generator

**VI**

Mo rong deterministic path hien co de cover nhieu prompt hon, them room templates, va dam bao frontend render du element types dang co.

**EN**

Extend the current deterministic path to cover more prompts, add room templates, and ensure the frontend renders the element types already being returned.

**Danh gia / Assessment**

- Uu diem: nhanh nhat, rui ro thap nhat
- Nhuoc diem: gioi han ve kha nang mo rong, van kho dat chat luong cao nhu screenshot

### Phuong an B - Hybrid structured planner / Option B - Hybrid structured planner

**VI**

Dung AI de parse prompt thanh mot `architectural intent schema`, sau do cho deterministic engine sinh plan, openings, dimensions, va drawing primitives.

**EN**

Use AI to parse the prompt into an `architectural intent schema`, then let a deterministic engine generate the plan, openings, dimensions, and drawing primitives.

**Danh gia / Assessment**

- Uu diem: on dinh hon, mo rong duoc, phu hop voi CAD
- Nhuoc diem: can them schema, validation, va orchestration logic

### Phuong an C - AI-to-primitives nang cao / Option C - Advanced AI-to-primitives

**VI**

Tiep tuc de model sinh truc tiep toan bo ban ve nhung viet lai prompt, schema, validation, va retry logic manh hon.

**EN**

Continue to let the model directly generate the full drawing, but redesign the prompt, schema, validation, and retry logic more aggressively.

**Danh gia / Assessment**

- Uu diem: nhanh de thu nghiem
- Nhuoc diem: kho on dinh, kho kiem soat chat luong, va de hong khi prompt thay doi

### Khuyen nghi / Recommendation

**VI**

Khuyen nghi chon **Phuong an B - Hybrid structured planner**. Day la diem can bang tot nhat giua toc do trien khai, do on dinh, va kha nang dat chat luong gan voi ban ve kien truc thuc te.

**EN**

The recommended path is **Option B - Hybrid structured planner**. It provides the best balance among delivery speed, stability, and the ability to approach practical architectural drawing quality.

## 10. Ke hoach trien khai theo phase / Phased Implementation Plan

### Phase 1 - On dinh hoa output hien tai / Stabilize current output

**VI**

Muc tieu:

- Bao dam prompt nha o co kich thuoc ro rang luon di vao path co cau truc tot nhat
- Frontend render duoc day du cac primitive dang duoc backend tra ve

Cong viec chinh:

- Dieu chinh `parsePlanRequest` de giam false fallback sang generic path
- Relax rule phan loai prompt "detailed"
- Bo sung renderer cho `arc`, `hatch`, `dimension` o 2D va paper space neu con thieu
- Chuan hoa tinh bounds/centering cho tat ca element types lien quan
- Them regression tests cho prompt house co 1-2 bedroom, living room, dimensions

Priority: `P0`

**EN**

Goal:

- Ensure house prompts with explicit dimensions consistently use the strongest structured path
- Ensure the frontend renders the primitives already returned by the backend

Key work:

- Adjust `parsePlanRequest` to reduce false fallbacks into the generic path
- Relax the current "detailed prompt" routing rules
- Add or complete rendering for `arc`, `hatch`, and `dimension` in 2D and paper space
- Standardize bounds and centering across all relevant element types
- Add regression tests for 1-2 bedroom house prompts with living room and dimensions

Priority: `P0`

### Phase 2 - Bo sung planner co cau truc / Add structured planner capability

**VI**

Muc tieu:

- Chuyen prompt thanh structured architectural intent
- Sinh plan on dinh hon cho phong khach, phong ngu, bep, ve sinh, va circulation co ban

Cong viec chinh:

- Dinh nghia `architectural intent schema`
- Tao parser AI hoac rule-based de dua prompt ve schema nay
- Viet validation layer cho dimensions, room counts, adjacency, va opening constraints
- Viet deterministic layout generator dua tren schema
- Sinh `plan` payload truoc, sau do render sang elements

Priority: `P1`

**EN**

Goal:

- Convert prompts into a structured architectural intent
- Generate more stable plans for living room, bedroom, kitchen, toilet, and basic circulation

Key work:

- Define an `architectural intent schema`
- Build an AI-assisted or rule-based parser into that schema
- Add validation for dimensions, room counts, adjacency, and opening constraints
- Build a deterministic layout generator on top of the schema
- Generate the `plan` payload first, then render it into drawing elements

Priority: `P1`

### Phase 3 - Nang cap chat luong ban ve / Improve drawing fidelity

**VI**

Muc tieu:

- Dua output den gan hon voi ban ve kien truc tham chieu

Cong viec chinh:

- Them furniture blocks va sanitary fixtures
- Cai thien text placement, room labels, and dimension chains
- Them wall hierarchy, room hatch standards, va opening symbols tot hon
- Tinh toan bo cuc plan de tang readability

Priority: `P2`

**EN**

Goal:

- Bring the output closer to the architectural reference drawings

Key work:

- Add furniture blocks and sanitary fixtures
- Improve text placement, room labels, and dimension chains
- Improve wall hierarchy, room hatch standards, and opening symbols
- Refine overall plan layout for readability

Priority: `P2`

### Phase 4 - Mo rong nang luc AI / Expand AI capabilities

**VI**

Muc tieu:

- Mo rong tu text-only generation sang richer assisted workflows

Cong viec chinh:

- Prompt refinement suggestions cho nguoi dung
- Multi-turn clarification flow
- Image-assisted reference interpretation trong phase sau
- Scoring va quality gates truoc khi tra ket qua ra frontend

Priority: `P3`

**EN**

Goal:

- Expand beyond text-only generation into richer assisted workflows

Key work:

- Prompt refinement suggestions for users
- Multi-turn clarification flow
- Image-assisted reference interpretation in a later phase
- Scoring and quality gates before returning output to the frontend

Priority: `P3`

## 11. Muc do uu tien tong hop / Priority Summary

**VI**

- `P0`: Sua routing prompt va renderer de tranh ket qua "chi co mot line" hoac output qua ngheo
- `P1`: Xay dung structured planner schema + deterministic layout engine
- `P2`: Nang cap fidelity va kha nang doc ban ve
- `P3`: Mo rong AI workflow va reference-aware generation

**EN**

- `P0`: Fix prompt routing and rendering so the system no longer collapses into "only a line" or very poor output
- `P1`: Build the structured planner schema and deterministic layout engine
- `P2`: Improve drawing fidelity and readability
- `P3`: Expand AI workflow and reference-aware generation

## 12. Rui ro va phu thuoc / Risks and Dependencies

**VI**

Rui ro chinh:

- Neu chi sua prompt ma khong sua renderer, ket qua van co the xau
- Neu chi sua renderer ma khong thay bo sinh plan, output van ngheo ve mat kien truc
- Neu de AI sinh primitives truc tiep qua nhieu, chat luong se kho on dinh

Phu thuoc chinh:

- Dinh nghia ro `DrawingElement` contracts
- Dong bo giua backend `elements`, `plan`, va frontend rendering
- Test coverage cho cac prompt quan trong

**EN**

Main risks:

- If only the prompt is fixed but rendering is not, the result can still look poor
- If only rendering is fixed but the plan generator is not improved, the output will remain architecturally weak
- If direct AI-to-primitives generation remains dominant, quality will stay unstable

Main dependencies:

- Clear `DrawingElement` contracts
- Consistency between backend `elements`, `plan`, and frontend rendering
- Test coverage for important prompt categories

## 13. Tieu chi hoan thanh / Success Criteria

**VI**

Tinh nang duoc xem la dat muc chap nhan khi:

- Prompt nha o co kich thuoc ro rang khong con roi vao output ngheo
- Nguoi dung khong con gap truong hop "chi thay mot line" voi nhung prompt hop le
- 2D va paper space render day du `line`, `text`, `arc`, `hatch`, `dimension`, `rectangle`, `circle`
- He thong tao duoc floor plan co phong, tuong, cua, cua so, va kich thuoc co y nghia
- Chat luong output on dinh tren mot tap prompt regression da duoc dinh nghia

**EN**

The feature should be considered acceptable when:

- House prompts with explicit dimensions no longer collapse into poor output
- Users no longer encounter "only a line" for valid prompts
- 2D and paper space fully render `line`, `text`, `arc`, `hatch`, `dimension`, `rectangle`, and `circle`
- The system can generate a floor plan with meaningful rooms, walls, doors, windows, and dimensions
- Output quality is stable across a defined regression prompt set

## 14. Ket luan / Conclusion

**VI**

Van de hien tai khong nen duoc xem la loi prompt don le cua nguoi dung, ma la mot gap thiet ke trong toan bo AI drawing pipeline. He thong hien chua co cau truc phu hop de bien ky vong "architectural plan" thanh output CAD on dinh. Huong khac phuc dung la tang tinh co cau truc cua planner, giam phu thuoc vao primitive-only generation, va dong bo renderer voi du lieu kien truc ma backend tra ve.

**EN**

The current issue should not be treated as a simple user-prompt problem. It is a design gap across the AI drawing pipeline. The system does not yet have the right structure to translate "architectural plan" expectations into stable CAD output. The correct fix is to increase planner structure, reduce dependence on primitive-only generation, and align rendering with the architectural data already produced by the backend.
