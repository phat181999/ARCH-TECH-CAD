import os
import re
from pypdf import PdfReader

def clean_text(text):
    """Clean extraction noise from PDF page text."""
    # Remove repeated page numbers, headers, footers
    text = re.sub(r'\bTrang\s+\d+\b', '', text, flags=re.IGNORECASE)
    # Normalize multiple whitespace characters
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def convert_pdf_to_md(pdf_path, md_path):
    print(f"Converting {os.path.basename(pdf_path)} -> {os.path.basename(md_path)}...")
    try:
        reader = PdfReader(pdf_path)
        markdown_content = []
        doc_title = os.path.splitext(os.path.basename(pdf_path))[0]
        
        markdown_content.append(f"# TÀI LIỆU DỊCH: {doc_title}\n")
        markdown_content.append(f"*Nguồn file gốc: {os.path.basename(pdf_path)}*\n")
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                cleaned = clean_text(text)
                if cleaned:
                    markdown_content.append(f"\n## Tầng/Trang {i+1}\n")
                    markdown_content.append(cleaned)
                    
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(markdown_content))
        print(f"Completed conversion: {md_path}")
    except Exception as e:
        print(f"Error converting {pdf_path}: {e}")

def main():
    docs_dir = "/Users/phatho/Projects/Personal/ARCH-TECH-CAD/rag-doc/docs"
    permit_dir = "/Users/phatho/Projects/Personal/ARCH-TECH-CAD/rag-doc/permit_and_licensing"
    cad_dir = "/Users/phatho/Projects/Personal/ARCH-TECH-CAD/rag-doc/cad_drawing"
    
    # 1. Map decisions to permit_and_licensing
    decisions = [
        "BXD_940-QD-BXD_17062026.pdf",
        "BXD_942-QD-BXD_17062026.pdf",
        "BXD_974-QD-BXD_22062026.pdf",
        "BXD_975-QD-BXD_22062026.pdf"
    ]
    
    for dec in decisions:
        pdf_path = os.path.join(docs_dir, dec)
        if os.path.exists(pdf_path):
            md_name = dec.replace(".pdf", ".md")
            md_path = os.path.join(permit_dir, md_name)
            convert_pdf_to_md(pdf_path, md_path)
        else:
            print(f"Warning: File {pdf_path} not found.")
            
    # 2. Map autocad giáo trình to cad_drawing
    autocad_pdf = "Giao-Trinh-AutoCad-2D-co-ban-khong-bai-tap-4.pdf"
    autocad_path = os.path.join(docs_dir, autocad_pdf)
    if os.path.exists(autocad_path):
        md_path = os.path.join(cad_dir, "Giao-Trinh-AutoCad-2D.md")
        convert_pdf_to_md(autocad_path, md_path)
    else:
        print(f"Warning: File {autocad_path} not found.")

if __name__ == "__main__":
    main()
