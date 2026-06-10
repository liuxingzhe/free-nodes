# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 通用和个性化网页/博客采集器。能够针对特定博文列表（如优雅数字派等网站），提取最新文章进行多级递归，转换解析出其中的 Clash YAML、Base64 或纯文本节点。
"""

import re
import yaml
import json
import base64
from typing import List, Dict, Optional
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper

class WebScraper(BaseScraper):
    """
    通用和个性化网页/博客端复合采集器
    """
    def __init__(self, name: str, source_info: Dict, timeout: int = 20):
        super().__init__(name, timeout)
        self.url = source_info.get("url")
        # 递归深度，默认 2 表示会提取文章列表页里的最新具体日志
        self.depth = source_info.get("depth", 2)

    def extract_nodes_from_text(self, text: str) -> List[str]:
        """
        利用标准协议头正则表达式在任意文本中抽离节点链接
        """
        pattern = r'(?:vmess|vless|ss|ssr|trojan|hysteria2|hy2|tuic)://[^\s<"\'#]+(?:#[^\s<"\']*)?'
        return re.findall(pattern, text)

    def extract_subs_from_html(self, html_content: str, base_domain: str) -> List[str]:
        """
        利用 BeautifulSoup 抽取所有的 a 标签链接
        """
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            links = []
            for a in soup.find_all('a', href=True):
                href = a['href'].strip()
                if not href:
                    continue
                
                # 处理相对网路路径
                if href.startswith('//'):
                    href = f"https:{href}"
                elif href.startswith('/'):
                    href = f"https://{base_domain}{href}"
                elif not href.startswith('http'):
                    continue
                
                links.append(href)
            return list(set(links))
        except Exception as e:
            self.logger.error(f"提取 HTML 链接时异常: {e}")
            return []

    def fetch_sub_content_and_extract(self, sub_url: str) -> List[str]:
        """
        请求单个可能为 Clash.yaml / base64 订阅的 URL 并进行强力解构，反向重建原生 URI
        """
        self.logger.info(f"正在进行多核解构抓取源: {sub_url}")
        content = self.fetch_url_content(sub_url)
        if not content:
            return []

        nodes = []

        # 1. 尝试直接从文本中获取原生协议
        raw_nodes = self.extract_nodes_from_text(content)
        if raw_nodes:
            self.logger.info(f"直接发现 {len(raw_nodes)} 个节点链接")
            nodes.extend(raw_nodes)

        # 2. 尝试是否是 Base64 订阅
        try:
            cleaned = content.replace(" ", "").replace("\n", "").replace("\r", "")
            missing_padding = len(cleaned) % 4
            if missing_padding:
                cleaned += '=' * (4 - missing_padding)
            decoded = base64.b64decode(cleaned, validate=False).decode('utf-8', errors='ignore')
            b64_nodes = self.extract_nodes_from_text(decoded)
            if b64_nodes:
                self.logger.info(f"Base64 订阅解码成功，释放 {len(b64_nodes)} 个节点")
                nodes.extend(b64_nodes)
        except Exception:
            pass

        # 3. 尝试是否是 YAML / Clash 配置。若是则反向重建原生连接
        try:
            clash_data = yaml.safe_load(content)
            if isinstance(clash_data, dict) and "proxies" in clash_data:
                yaml_count = 0
                for proxy in clash_data["proxies"]:
                    node_uri = self.clash_proxy_to_uri(proxy)
                    if node_uri:
                        nodes.append(node_uri)
                        yaml_count += 1
                if yaml_count > 0:
                    self.logger.info(f"Clash YAML 解构还原成功，吐出 {yaml_count} 个代理节点")
        except Exception:
            pass

        return nodes

    def clash_proxy_to_uri(self, p: Dict) -> Optional[str]:
        """
        把 Clash 字典转换回标准的客户端协议连接 URI 格式
        """
        try:
            ptype = str(p.get("type", "")).lower()
            server = p.get("server")
            port = p.get("port")
            name = p.get("name", "Node")
            if not server or not port:
                return None
            
            hash_part = f"#{name}"

            if ptype in ["ss", "shadowsocks"]:
                cipher = p.get("cipher") or p.get("cipher_type")
                password = p.get("password")
                if cipher and password:
                    credential = base64.b64encode(f"{cipher}:{password}".encode()).decode()
                    return f"ss://{credential}@{server}:{port}{hash_part}"
            
            elif ptype == "trojan":
                password = p.get("password")
                if password:
                    return f"trojan://{password}@{server}:{port}{hash_part}"
            
            elif ptype == "vmess":
                uuid = p.get("uuid")
                if uuid:
                    v_meta = {
                        "v": "2",
                        "ps": name,
                        "add": server,
                        "port": str(port),
                        "id": uuid,
                        "aid": "0",
                        "net": p.get("network", "tcp"),
                        "type": "none",
                        "host": p.get("ws-opts", {}).get("headers", {}).get("Host") or p.get("servername", ""),
                        "path": p.get("ws-opts", {}).get("path", "/"),
                        "tls": "tls" if p.get("tls") else ""
                    }
                    b64_json = base64.b64encode(json.dumps(v_meta).encode()).decode()
                    return f"vmess://{b64_json}"
            
            elif ptype == "vless":
                uuid = p.get("uuid")
                if uuid:
                    tls = "security=tls" if p.get("tls") else ""
                    return f"vless://{uuid}@{server}:{port}?{tls}{hash_part}"
            
            elif ptype in ["hysteria2", "hy2"]:
                password = p.get("password") or p.get("auth") or p.get("auth_str")
                if password:
                    return f"hysteria2://{password}@{server}:{port}{hash_part}"

        except Exception:
            pass
        return None

    def scrape(self) -> List[str]:
        """
        主爬取执行循环：
        """
        nodes = []
        html = self.fetch_url_content(self.url)
        if not html:
            return nodes

        parsed_uri = urlparse(self.url)
        base_domain = parsed_uri.netloc

        # 1. 提取当前页面所有的原生节点
        direct_nodes = self.extract_nodes_from_text(html)
        if direct_nodes:
            self.logger.info(f"在主页面上查找到 {len(direct_nodes)} 个原生格式节点")
            nodes.extend(direct_nodes)

        # 2. 爬取当前页面中的所有超链接
        all_links = self.extract_subs_from_html(html, base_domain)

        sub_links = []
        detail_links = []

        for link in all_links:
            # 过滤不需要的网页链接
            if any(x in link for x in ["wp-content", "wp-includes", "wp-json", "wp-admin", "tag/", "category/"]):
                continue

            # 检测是否可能是直接订阅链接
            if any(x in link for x in [".yaml", ".yml", ".txt", "sub/", "subscribe", "/sub?", "clash"]):
                sub_links.append(link)
            # 是否是 WordPress 或通用博客的文章详情链接 (支持数字ID、/posts/或/post/路径、或者以 `.html` 结尾包含年份等特征，例如 https://yoyapai.com/519，或者 freeclashnode 的 /posts/2026/06/xxx.html)
            elif re.search(r'/\d+$', link) or re.search(r'/posts?/\d+', link) or re.search(r'/article/\d+', link) or ".html" in link or "/5" in link:
                detail_links.append(link)

        # 3. 如果深度 depth >= 2，对文章列表详情页进行抽检式抓取
        if self.depth >= 2 and detail_links:
            self.logger.info(f"探测到可能具备具体订阅链接的文章列表: 共 {len(detail_links)} 个")
            
            # 对博客文章 URL 数字倒序排序，匹配往往最大的是最新文章
            def extract_digits(url_str):
                digits = "".join(re.findall(r"\d+", url_str))
                return int(digits) if digits else 0

            sorted_details = sorted(detail_links, key=extract_digits, reverse=True)
            candidate_details = sorted_details[:3] # 取最新 3 篇文章

            for detail_url in candidate_details:
                self.logger.info(f"深入最新博文二级探索: {detail_url}")
                d_html = self.fetch_url_content(detail_url)
                if not d_html:
                    continue

                # 提取博文内部的原生节点
                art_nodes = self.extract_nodes_from_text(d_html)
                if art_nodes:
                    self.logger.info(f"在二级博文页面上匹配到 {len(art_nodes)} 个原生节点")
                    nodes.extend(art_nodes)

                # 提取博文内部的隐藏订阅链接
                art_links = self.extract_subs_from_html(d_html, base_domain)
                for a_link in art_links:
                    if any(x in a_link for x in [".yaml", ".yml", ".txt", "sub/", "subscribe", "/sub?", "clash"]):
                        if a_link not in sub_links:
                            sub_links.append(a_link)

        # 4. 去重过滤收集的订阅链接，前 5 位高效抓取
        self.logger.info(f"汇总整理博文发布的高净值可用订阅源共 {len(sub_links)} 个，开始高精度并行抓取转换...")
        sub_links = list(set(sub_links))
        
        for sub_url in sub_links[:5]:
            try:
                sub_nodes = self.fetch_sub_content_and_extract(sub_url)
                if sub_nodes:
                    nodes.extend(sub_nodes)
            except Exception as e:
                self.logger.error(f"处理订阅源 {sub_url} 时报错: {e}")

        # 清洗并整理符合标准的最终节点列表
        filtered_nodes = []
        valid_prefixes = ("vmess://", "vless://", "ss://", "ssr://", "trojan://", "hysteria2://", "hy2://", "tuic://")
        for node in nodes:
            if node.startswith(valid_prefixes):
                filtered_nodes.append(node)
        
        unique_nodes = list(set(filtered_nodes))
        self.logger.info(f"【爬虫结果摘要】于当前网站中总计萃取有效独立节点 {len(unique_nodes)} 个")
        return unique_nodes
