import os
import sys
import time
import urllib.parse
import requests
from bs4 import BeautifulSoup

# Headers to bypass bot detection
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Referer': 'https://google.com'
}

def search_duckduckgo(query):
    """Searches DuckDuckGo HTML interface and returns a list of result URLs."""
    print(f"Searching DuckDuckGo for: '{query}'...")
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if not res.ok:
            print(f"Search failed with status: {res.status_code}")
            return []
        
        soup = BeautifulSoup(res.text, 'html.parser')
        links = []
        # Find results links
        for a in soup.find_all('a', class_='result__url'):
            href = a.get('href', '')
            if 'uddg=' in href:
                parsed = urllib.parse.urlparse(href)
                query_params = urllib.parse.parse_qs(parsed.query)
                actual_url = query_params.get('uddg', [None])[0]
                if actual_url:
                    links.append(actual_url)
            else:
                links.append(href)
        
        # Clean duplicates and filter down to top 3
        cleaned_links = []
        for l in links:
            if l not in cleaned_links and ('luatvietnam.vn' in l or 'thuvienphapluat.vn' in l):
                cleaned_links.append(l)
        return cleaned_links[:3]
    except Exception as e:
        print(f"Error searching DuckDuckGo: {e}")
        return []

def scrape_article(url):
    """Scrapes a legal article and converts it to markdown content."""
    print(f"Scraping URL: {url}...")
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if not res.ok:
            print(f"Failed to fetch {url} with status {res.status_code}")
            return None
        
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Remove noisy tags
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
            tag.decompose()
            
        # Common content body selectors
        body = soup.find('div', class_='content-detail') or \
               soup.find('div', id='divContentDoc') or \
               soup.find('article') or \
               soup.find('div', class_='entry-content') or \
               soup.find('div', id='content') or \
               soup.body
               
        if not body:
            print(f"Could not locate main body text for {url}")
            return None
            
        # Title
        title_tag = soup.find('h1')
        title = title_tag.text.strip() if title_tag else "Legal Article"
        
        markdown_lines = []
        markdown_lines.append(f"# {title}")
        markdown_lines.append(f"*Source: {url}*\n")
        
        # Extract headers, paragraphs, and lists
        for child in body.descendants:
            if child.name in ['h2', 'h3', 'h4']:
                text = child.get_text().strip()
                if text:
                    prefix = '#' * (int(child.name[1]) - 1) if int(child.name[1]) > 1 else '##'
                    markdown_lines.append(f"\n{prefix} {text}")
            elif child.name == 'p':
                text = child.get_text().strip()
                if text:
                    markdown_lines.append(text)
            elif child.name == 'li':
                text = child.get_text().strip()
                if text:
                    markdown_lines.append(f"- {text}")
                    
        return "\n\n".join(markdown_lines)
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def main():
    queries = [
        "site:luatvietnam.vn thủ tục cấp phép xây dựng nhà ở riêng lẻ",
        "site:thuvienphapluat.vn quy chuẩn mật độ xây dựng QCVN 01:2021/BXD",
        "site:thuvienphapluat.vn khoảng lùi công trình"
    ]
    
    all_markdowns = []
    
    for q in queries:
        urls = search_duckduckgo(q)
        print(f"Found {len(urls)} URLs to scrape.")
        for url in urls:
            md = scrape_article(url)
            if md:
                all_markdowns.append(md)
            # Delay to be polite to servers
            time.sleep(3)
            
    if not all_markdowns:
        print("No articles successfully scraped.")
        return
        
    output_path = "/Users/phatho/.gemini/antigravity/brain/18ffcf96-ec4b-4168-b41b-528973a707c2/crawled_phap_luat_xaydung.md"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# CRAWLED VIETNAMESE BUILDING LAWS & REGULATIONS\n\n")
        f.write("\n\n---\n\n".join(all_markdowns))
        
    print(f"\nSuccessfully compiled all scraped laws into: {output_path}")

if __name__ == "__main__":
    main()
