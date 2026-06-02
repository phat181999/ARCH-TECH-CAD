# RAG Training Data Sources (Nguồn Dữ Liệu Train RAG)

Tài liệu tổng hợp các liên kết tham chiếu và cổng tải dữ liệu chính thức để nạp (seed) vào hệ thống RAG (Knowledge base & Compliance rules) cho ứng dụng ARCH-TECH-CAD.

---

## 🇻🇳 1. Tiêu Chuẩn & Quy Chuẩn Xây Dựng Việt Nam (QCVN / TCVN)

Đây là dữ liệu cốt lõi để nạp vào `knowledge_chunks` và chuyển thành `building_rules` (Luật kiểm tra thiết kế tự động).

### Các quy chuẩn quan trọng nhất (Dạng PDF / Word):
1. **QCVN 03:2022/BXD** (Quy chuẩn về Phân cấp công trình & Thiết kế):
   - Quy định chiều cao phòng, phân loại công trình, diện tích tối thiểu.
2. **QCVN 06:2022/BXD** (Quy chuẩn về An toàn cháy cho nhà và công trình):
   - Quy định kích thước lối thoát nạn, cửa thoát hiểm, số lượng lối ra.
3. **QCVN 01:2021/BXD** (Quy chuẩn về Quy hoạch xây dựng):
   - Quy định khoảng lùi công trình (setback), mật độ xây dựng.
4. **TCVN 4451:2012** (Tiêu chuẩn Quốc gia về Nhà ở - Nguyên tắc thiết kế):
   - Quy định chi tiết diện tích phòng ngủ, phòng bếp, phòng vệ sinh.

### Cổng tải dữ liệu miễn phí:
* **Cổng Thông Tin Bộ Xây Dựng (MOC)**: [moc.gov.vn - Văn Bản Pháp Quy](https://moc.gov.vn/vn/pages/vanbanphapluat.aspx)
  > *Nguồn chính thống nhất của Chính phủ Việt Nam.*
* **Thư Viện Pháp Luật (Tải file Word/PDF)**: [thuvienphapluat.vn](https://thuvienphapluat.vn/)
  > *Tìm kiếm nhanh các từ khóa như "QCVN 03:2022/BXD", đăng ký tài khoản miễn phí để tải file doc/docx về máy.*
* **Trang Tra Cứu Tiêu Chuẩn Chất Lượng**: [vanban.chinhphu.vn](http://vanban.chinhphu.vn)
  > *Cơ sở dữ liệu quốc gia về văn bản pháp luật hành chính.*

---

## 📕 2. Sổ Tay Tiêu Chuẩn Thiết Kế Kiến Trúc (Neufert Architects' Data)

Cuốn sách kinh điển chứa toàn bộ kích thước nhân trắc học và tiêu chuẩn bố trí đồ nội thất trong phòng.

* **Neufert Architects' Data (Bản tiếng Anh - PDF miễn phí)**: [Archive.org - Neufert 4th Edition](https://archive.org/details/NeufertArchitectsData4thEdition)
  > *Tải file PDF trực tiếp từ thư viện mở Archive.org.*
* **Tải sách Neufert bản tiếng Việt (Chia sẻ cộng đồng)**:
  > Bạn có thể tìm kiếm từ khóa `"Neufert Tiếng Việt PDF"` trên Google Drive hoặc các trang chia sẻ kiến trúc như [Kienviet.net](https://kienviet.net/) hoặc [Vietnambuilding.vn](https://vietnambuilding.vn/) để tải bản dịch tiếng Việt của cuốn sổ tay này.

---

## 📐 3. Thư Viện Bản Vẽ CAD & Chi Tiết Cấu Cấu Tạo (CAD Block Library)

Nguồn dữ liệu để nạp vào `cad_components` phục vụ tính năng tìm kiếm Vector Block thông minh.

* **CADdetails**: [caddetails.com](https://www.caddetails.com/)
  > *Hàng ngàn chi tiết cấu tạo CAD (DWG, DXF) được vẽ chuẩn hóa theo hãng sản xuất.*
* **BiblioCAD (Thư viện lớn nhất)**: [bibliocad.com](https://www.bibliocad.com/)
  > *Kho lưu trữ block CAD khổng lồ (bàn ghế, cửa, thiết bị vệ sinh, mặt bằng mẫu).*
* **CAD Blocks Free**: [cadblocksfree.com](https://www.cadblocksfree.com/)
  > *Tải block CAD 2D/3D miễn phí ở định dạng DWG/DXF.*

---

## 🤖 4. Tập Dữ Liệu Mặt Bằng Thực Tế (Floorplan Datasets cho Machine Learning)

Nếu bạn muốn huấn luyện RAG / AI nhận dạng bố cục không gian nâng cao, đây là các bộ dữ liệu mặt bằng vector hóa lớn nhất trong giới nghiên cứu AI.

* **CubiCasa5K Dataset**: [GitHub - CubiCasa5K](https://github.com/hvertti/CubiCasa5K)
  > *Bộ dữ liệu gồm **5,000 mặt bằng nhà thực tế** đã được vector hóa chi tiết (tường, cửa đi, cửa sổ, phòng ốc).*
* **RPLAN Dataset (10,000+ Mặt bằng chung cư)**: [GitHub - RPLAN](https://github.com/zlz123456/RPLAN)
  > *Hơn 10,000 thiết kế căn hộ chung cư từ các dự án thực tế, rất phù hợp để huấn luyện AI sinh sơ đồ phòng.*
* **DeepLayout Dataset**: [GitHub - DeepLayout](https://github.com/ruiminshen/DeepLayout)
  > *Bộ dữ liệu phân tích cấu trúc mặt bằng sử dụng mạng nơ-ron học sâu.*

---

## 💡 Hướng Dẫn Cách Nạp Dữ Liệu Tải Về Vào RAG

Sau khi tải các tài liệu trên về (dạng `.txt` hoặc `.pdf`), bạn có thể sử dụng trực tiếp công cụ `seed_rag.py` đã viết:

```bash
# Ví dụ nạp tài liệu QCVN 03 vừa tải về dưới dạng văn bản:
python3 autocard/tools/seed_rag.py /path/to/qcvn_03_2022.txt --title "QCVN 03:2022/BXD" --yes

# Nếu là file PDF (yêu cầu cài pypdf trước bằng: pip install pypdf):
python3 autocard/tools/seed_rag.py /path/to/qcvn_06_2022.pdf --title "QCVN 06:2022/BXD" --yes
```
Dữ liệu sẽ tự động được chia nhỏ thành các Điều/Mục (Điều 1, Điều 2...) và lưu trực tiếp vào cơ sở dữ liệu để chatbot AI tra cứu.
