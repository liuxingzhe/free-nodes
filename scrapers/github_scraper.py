# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 采集 GitHub 公开仓库以及 Base64 订阅源的爬虫实现。
"""

import base64
import binascii
from typing import List, Dict
from scrapers.base_scraper import BaseScraper

class GitHubScraper(BaseScraper):
    """
    GitHub 源与 Base64 订阅源采集器
    """
    def __init__(self, name: str, source_info: Dict, timeout: int = 15):
        super().__init__(name, timeout)
        self.url = source_info.get("url")
        self.type = source_info.get("type", "raw")  # 'base64' 或 'raw'

    def scrape(self) -> List[str]:
        """
        爬取源并进行解码或内容拆解
        """
        nodes = []
        html_content = self.fetch_url_content(self.url)
        if not html_content:
            return nodes

        content = html_content.strip()

        if self.type == "base64":
            # 兼容多种填充错误的 Base64 订阅处理
            try:
                # 修复可能缺失的 Base64 填充等号
                missing_padding = len(content) % 4
                if missing_padding:
                    content += '=' * (4 - missing_padding)
                
                # 替换常见网页排版带来的非标准空白符
                content = content.replace(" ", "").replace("\n", "").replace("\r", "")
                
                decoded_bytes = base64.b64decode(content, validate=False)
                decoded_str = decoded_bytes.decode('utf-8', errors='ignore')
                raw_lines = decoded_str.splitlines()
                
                for line in raw_lines:
                    line = line.strip()
                    if line:
                        nodes.append(line)
                self.logger.info(f"Base64 解码成功，共获取 {len(nodes)} 个原始节点链接")
            except (binascii.Error, UnicodeDecodeError) as e:
                self.logger.error(f"Base64 解密解码出错（尝试退回 Raw 模式解析）: {e}")
                # 发生异常尝试作为 Raw 直接按行分割
                raw_lines = content.splitlines()
                for line in raw_lines:
                    line = line.strip()
                    if line:
                        nodes.append(line)
        elif self.type in ["clash", "yaml"]:
            import yaml
            from utils.parser import clash_proxy_to_uri
            try:
                clash_data = yaml.safe_load(content)
                if isinstance(clash_data, dict) and "proxies" in clash_data:
                    yaml_count = 0
                    for proxy in clash_data["proxies"]:
                        node_uri = clash_proxy_to_uri(proxy)
                        if node_uri:
                            nodes.append(node_uri)
                            yaml_count += 1
                    self.logger.info(f"Clash YAML 解构成功，共萃取 {yaml_count} 个节点")
            except Exception as e:
                self.logger.error(f"Clash YAML 解构解码出错: {e}")
        else:
            # Raw 行分割模式
            raw_lines = content.splitlines()
            for line in raw_lines:
                line = line.strip()
                if line:
                    nodes.append(line)
            self.logger.info(f"Raw 极简文本加载成功，共获取 {len(nodes)} 个原始节点链接")

        # 做基础的节点协议前缀初步过滤
        filtered_nodes = []
        valid_prefixes = ("vmess://", "vless://", "ss://", "ssr://", "trojan://", "hysteria2://", "hy2://", "tuic://")
        for node in nodes:
            if node.startswith(valid_prefixes):
                filtered_nodes.append(node)
                
        self.logger.info(f"初步协议清洗后，符合标准的节点数: {len(filtered_nodes)}")
        return filtered_nodes
