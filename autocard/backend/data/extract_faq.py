#!/usr/bin/env python3
import re, os

base = '/Users/phatho/.gemini/antigravity/brain/4e12c0d1-3094-4238-8eae-e01ed75ec03e/.system_generated/steps'
output = '/Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/data/faq_batch2.md'

files_info = {
    '2': ('Xây nhà trên đất nông nghiệp, cần thủ tục gì', 'https://luatsuhcm.com/xaydung/Xay-nha-tren-dat-nong-nghiep-can-thu-tuc-gi-70.html'),
    '3': ('Kế hoạch sử dụng đất chi tiết của xã', 'https://luatsuhcm.com/xaydung/Ke-hoach-su-dung-dat-chi-tiet-cua-xa-69.html'),
    '4': ('Nội dung quy hoạch chi tiết xây dựng đô thị', 'https://luatsuhcm.com/xaydung/Noi-dung-quy-hoach-chi-tiet-xay-dung-do-thi-68.html'),
    '5': ('Thủ tục xin phép xây dựng nhà kiên cố', 'https://luatsuhcm.com/xaydung/Thu-tuc-xin-phep-xay-dung-nha-kien-co-67.html'),
    '6': ('Đất quy hoạch công trình xây dựng được không?', 'https://luatsuhcm.com/xaydung/Dat-quy-hoach-cong-trinh-xay-dung-duoc-khong-66.html'),
    '7': ('Chi phí xin giấy phép xây dựng', 'https://luatsuhcm.com/xaydung/Chi-phi-xin-giay-phep-xay-dung-65.html'),
    '8': ('Mức phạt xây dựng nhà trái phép', 'https://luatsuhcm.com/xaydung/Muc-phat-xay-dung-nha-trai-phep-64.html'),
    '9': ('Cam kết hỗ trợ đền bù xây dựng', 'https://luatsuhcm.com/xaydung/Cam-ket-ho-tro-den-bu-xay-dung-63.html'),
    '16': ('Quy định về phí xây dựng nhà ở', 'https://luatsuhcm.com/xaydung/Quy-dinh-ve-phi-xay-dung-nha-o-25.html'),
    '17': ('Về việc xây dựng ban công', 'https://luatsuhcm.com/xaydung/Ve-viec-xay-dung-ban-cong-24.html'),
    '18': ('Xin phép xây dựng nhà', 'https://luatsuhcm.com/xaydung/Xin-phep-xay-dung-nha-23.html'),
    '19': ('Hồ sơ thiết kế, dự toán xây dựng công trình', 'https://luatsuhcm.com/xaydung/Ho-so-thiet-ke-du-toan-xay-dung-cong-trinh-22.html'),
    '20': ('Thi tuyển thiết kế kiến trúc công trình xây dựng', 'https://luatsuhcm.com/xaydung/Thi-tuyen-thiet-ke-kien-truc-cong-trinh-xay-dung-20.html'),
}

results = []

for step_dir, (title, url) in files_info.items():
    filepath = os.path.join(base, step_dir, 'content.md')
    if not os.path.exists(filepath):
        print(f'MISSING: {filepath}')
        continue
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    last_breadcrumb = -1
    for i, line in enumerate(lines):
        if 'Hỏi đáp luật xây dựng' in line:
            last_breadcrumb = i
    
    if last_breadcrumb == -1:
        print(f'NO BREADCRUMB: {step_dir} - {title}')
        continue
    
    end_line = len(lines)
    for i in range(last_breadcrumb, len(lines)):
        if '## Thông tin liên hệ' in lines[i]:
            end_line = i
            break
    
    content_end = end_line
    for i in range(last_breadcrumb + 1, end_line):
        if lines[i].startswith('### [') and 'luatsuhcm.com' in lines[i]:
            content_end = i
            break
    
    article_lines = lines[last_breadcrumb+1:content_end]
    
    clean_lines = []
    for line in article_lines:
        stripped = line.strip()
        if not clean_lines and not stripped:
            continue
        if stripped.startswith('[') and stripped.endswith(')') and 'luatsuhcm.com' in stripped:
            continue
        if re.match(r'^\d+\.\s*\[', stripped) and 'luatsuhcm.com' in stripped:
            continue
        clean_lines.append(line.rstrip())
    
    while clean_lines and not clean_lines[-1].strip():
        clean_lines.pop()
    
    article = '\n'.join(clean_lines)
    print(f'Step {step_dir}: {title} -> {len(clean_lines)} lines')
    results.append((title, url, article))

# Write output
os.makedirs(os.path.dirname(output), exist_ok=True)
with open(output, 'w') as f:
    f.write('# FAQ Batch 2 - Hỏi đáp luật xây dựng\n\n')
    f.write(f'Nguồn: luatsuhcm.com\n')
    f.write(f'Tổng số bài: {len(results)}\n\n')
    
    for title, url, article in results:
        f.write(f'## {title}\n')
        f.write(f'Source: {url}\n\n')
        f.write(f'{article}\n\n')
        f.write('---\n\n')

print(f'\nTotal articles: {len(results)}')
print(f'Output: {output}')
