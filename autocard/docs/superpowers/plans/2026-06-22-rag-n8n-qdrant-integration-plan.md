# Kế hoạch tích hợp RAG (n8n + Qdrant) cho ARCH-TECH CAD
### Hệ thống kiểm tra quy chuẩn thiết kế (TCVN) tự động bằng AI

Kế hoạch này hướng dẫn tích hợp dịch vụ n8n và cơ sở dữ liệu Vector Qdrant sẵn có trong dự án để triển khai hệ thống **RAG (Retrieval-Augmented Generation)** nhằm kiểm tra quy chuẩn xây dựng Việt Nam (TCVN) cho bản vẽ CAD hiện tại.

---

## 📐 Kiến trúc tích hợp Hệ thống

```
                    ┌────────────────────────┐
                    │  React Frontend (UI)   │
                    └───────────┬────────────┘
                                │ (POST /api/ai/compliance)
                                ▼
                    ┌────────────────────────┐
                    │    Go Backend server   │
                    └───────────┬────────────┘
                                │ (Forward Webhook)
                                ▼
┌──────────────┐    ┌────────────────────────┐
│  Qdrant DB   │◄───┤    n8n Webhook Node    │
│ (Vector DB)  │    └───────────┬────────────┘
└──────────────┘                │ (RAG Prompt Assembly)
                                ▼
                    ┌────────────────────────┐
                    │      OpenAI / Gemini   │
                    └────────────────────────┘
```

---

## 🛠️ Kế hoạch triển khai Chi tiết

### Phase 1: Cấu hình Hạ tầng & Ingestion Workflow (n8n)
*Mục tiêu: Đưa dữ liệu quy chuẩn xây dựng (TCVN) và thư viện Block nội thất vào Qdrant.*

1. **Khởi động Dịch vụ**:
   - Do Qdrant và n8n cùng chạy trong mạng docker-network nội bộ (`n8n-network`), n8n có thể gọi trực tiếp sang Qdrant qua hostname `qdrant:6333` mà không cần public cổng của Qdrant ra ngoài internet.
   - Khởi chạy docker-compose:
     ```bash
     cd n8n-deployment && docker-compose up -d
     ```
2. **Cấu hình Workflow n8n Ingest**:
   - Tạo một workflow trong n8n nhận nhiệm vụ crawl/đọc file `knowledge-base.html` (chứa tài liệu TCVN sẵn có trong thư mục `n8n-deployment`).
   - Sử dụng Node **HTML Parser** hoặc **Markdown Parser** trong n8n để trích xuất văn bản.
   - Sử dụng Node **Recursive Character Text Splitter** để chia nhỏ văn bản (chunk size: 1000, overlap: 200).
   - Sử dụng Node **OpenAI / Gemini Embeddings** để mã hóa chunk thành Vector.
   - Ghi kết quả vào Qdrant dưới collection đặt tên là `building_codes`.
   - **Mở rộng (Thư viện Nội thất)**: Ingest danh sách linh kiện nội thất 3D (Sofa, Bed, Table, Toilet...) kèm mô tả văn bản vào collection `furniture_catalog` trong Qdrant để phục vụ Phase 6.

---

### Phase 2: n8n Query Webhook Workflow
*Mục tiêu: Tạo cổng API tiếp nhận câu hỏi quy chuẩn xây dựng từ app, truy vấn Qdrant và trả về kết quả phân tích.*

Tạo workflow thứ 2 trong n8n làm **RAG Query Webhook**:
1. **Webhook Node (POST)**:
   - Tiếp nhận dữ liệu đầu vào: `{ query: string, elements: DrawingElement[] }`.
2. **Retrieve Context (Qdrant Node)**:
   - Dùng Qdrant Node truy vấn tìm các chunks tài liệu TCVN có độ tương đồng ngữ nghĩa cao nhất với `query`.
3. **Assemble Prompt**:
   - Sử dụng Node **AI Agent / Chain** để dựng Prompt tổng hợp gửi sang LLM (OpenAI/Gemini):
     ```
     Bạn là Trợ lý Thiết kế Kiến trúc Chuyên nghiệp tại Việt Nam.
     Dưới đây là sơ đồ bản vẽ kiến trúc định dạng JSON hiện tại:
     ${elements}

     Dưới đây là các tài liệu Quy chuẩn Xây dựng Việt Nam (TCVN) liên quan được truy vấn từ Database:
     ${context}

     Hãy phân tích xem bản vẽ hiện tại có vi phạm quy chuẩn nào không (Ví dụ: kích thước cửa thoát hiểm, độ dày tường, diện tích phòng ngủ tối thiểu).
     Trả về kết quả dưới định dạng JSON:
     {
       "compliant": false,
       "violations": [
         {
           "elementId": "door_001",
           "description": "Chiều rộng cửa đi thoát hiểm hiện tại là 800mm, vi phạm TCVN 4319 yêu cầu tối thiểu 900mm",
           "suggestedFix": { "width": 900 }
         }
       ],
       "summary": "Phát hiện 1 lỗi vi phạm quy chuẩn cửa đi."
     }
     ```
4. **Respond to Webhook**: Trả về dữ liệu JSON có cấu trúc trên cho Go Backend.

---

### Phase 3: Go Backend API Wrapper
*Mục tiêu: Đăng ký API trung gian để Frontend React gọi lên.*

#### [MODIFY] [main.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/main.go)
- Thêm route `POST /api/ai/compliance` gọi đến một handler mới.

#### [NEW] [compliance_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/compliance_handler.go)
- Đọc `elements` từ JSON body của request.
- Gọi chuyển tiếp (forward) dữ liệu sang webhook của n8n (ví dụ: `http://localhost:5678/webhook/rag-compliance`).
- Nhận phản hồi JSON từ n8n và trả về trực tiếp cho Frontend.

---

### Phase 4: Frontend React UI Integration
*Mục tiêu: Cung cấp nút bấm "Kiểm tra quy chuẩn" cho kiến trúc sư.*

#### [MODIFY] [AIAssistantPanel.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/panels/AIAssistantPanel.tsx)
- Thêm tab hoặc nút bấm **"Kiểm tra Quy chuẩn TCVN"**.
- Khi bấm nút, gửi toàn bộ `elements` hiện tại trong Canvas lên `POST /api/ai/compliance`.
- Hiển thị danh sách các lỗi vi phạm (`violations`) dạng danh sách cảnh báo màu đỏ/cam cực kỳ trực quan kèm mã element bị lỗi.
- Cung cấp nút **"Tự động sửa lỗi (Auto-Fix)"** kế bên mỗi lỗi vi phạm. Khi bấm, dispatches `updateElement` trong Zustand store để áp dụng các thay đổi đề xuất (ví dụ sửa `width` của cửa từ `80` thành `90`), tự động cập nhật cả bản vẽ 2D lẫn mô hình 3D ngay lập tức.

---

### Phase 5: Điều phối Dựng hình 2D ↔ 3D AI qua n8n (Orchestration)
*Mục tiêu: Di chuyển logic phân tích prompt và dựng hình AI từ Go backend sang n8n để dễ dàng cấu hình.*

1. **Webhook Nhận Dữ Liệu 2D**:
   - Đăng ký một webhook Node trong n8n: `POST /webhook/ai-2d-to-3d`.
   - Tiếp nhận danh sách `DrawingElement[]` hiện tại.
2. **Triệu gọi LLM Node (n8n Anthropic / OpenAI Node)**:
   - Thay vì hardcode prompt trong Go backend, ta thiết kế prompt trong n8n UI, hướng dẫn LLM phân tích bố cục hình học 2D để trích xuất thành đối tượng BIM 3D.
   - LLM trả về cấu trúc dữ liệu JSON định dạng `BIMResult`.
3. **Go Backend Forwarding**:
   - Sửa đổi worker trong `drawing_analyzer.go` hoặc API endpoint tương ứng để chuyển tiếp (forward) yêu cầu phân tích sang n8n Webhook thay vì gọi trực tiếp sang Anthropic API. điều này giúp dễ dàng đổi LLM (ví dụ: GPT-4o, Gemini 1.5 Pro) và tinh chỉnh Prompt chỉ với vài cú click trên n8n.

---

### Phase 6: So khớp Linh kiện 3D bằng Qdrant (Semantic Block Mapping)
*Mục tiêu: Tự động đổi tên block 2D thô sơ (như `INSERT` block từ file DXF) thành linh kiện 3D phù hợp nhờ Qdrant.*

1. **Semantic Search trên Qdrant**:
   - Khi chạy chuyển đổi 2D sang 3D qua n8n (ở Phase 5), với mỗi block nội thất phát hiện được (ví dụ block mang tên `A$C103` hay `Ghe_Sofa_Nho`):
     - n8n gọi OpenAI/Gemini Embeddings để tạo Vector cho tên và các thuộc tính của block đó.
     - Thực hiện câu lệnh tìm kiếm Vector trên Qdrant (collection `furniture_catalog`) để tìm linh kiện 3D tương đương (như `sofa`, `chair`, `bed`, `toilet`).
2. **Mapping Kết quả**:
   - Thay thế mã block thô sơ bằng tên block 3D tiêu chuẩn trước khi trả về `BIMResult`.
   - Khi render trong Three.js, `BimModelRenderer.tsx` sẽ nhận được mã block chính xác và hiển thị mesh 3D tương ứng thay vì một hình hộp chữ nhật trống.

---

## 📐 Kế hoạch Xác minh & Kiểm thử (Verification Plan)

### Automated Tests
1. **Kiểm tra biên dịch**:
   ```bash
   cd autocard/frontend && npx tsc --noEmit
   cd autocard/backend && go build ./...
   ```

### Manual Verification
1. Vẽ một bức tường có cửa đi rộng `800mm` trong canvas 2D.
2. Bấm nút **"Kiểm tra Quy chuẩn TCVN"** ở AI Panel.
3. Xác minh UI hiển thị cảnh báo đỏ: *Cửa đi thoát hiểm `door_xxx` rộng 800mm nhỏ hơn quy chuẩn tối thiểu 900mm*.
4. Bấm nút **"Sửa lỗi"** trên UI -> Kiểm tra chiều rộng cửa trên 2D và 3D lập tức cập nhật thành `900mm`.
