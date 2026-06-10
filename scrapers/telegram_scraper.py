# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 爬取 Telegram 公开频道网页版预览（不需要 API KEY），使用 BeautifulSoup 提取消息文本中的节点。
"""

import re
from typing import List, Dict
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper

class TelegramScraper(BaseScraper):
    """
    Telegram 频道免 API 爬虫
    """
    def __init__(self, name: str, source_info: Dict, timeout: int = 20):
        super().__init__(name, timeout)
        self.channel = source_info.get("channel")
        # 直接访问 Telegram 频道的网页预览端
        self.url = f"https://t.me/s/{self.channel}"

    def scrape(self) -> List[str]:
        """
        爬网获取网页，利用 BeautifulSoup 定位消息记录节点并提取链接形式节点
        """
        nodes = []
        html_content = self.fetch_url_content(self.url)
        if not html_content:
            return nodes

        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            # Telegram 频道网页预览中，消息通常包含在带有 class="tgme_channel_message_text" 的 div 中
            message_divs = soup.find_all(class_="tgme_channel_message_text")
            
            # 正则表达式提炼协议节点
            pattern = re.compile(
                r'(vmess|vless|ss|ssr|trojan|hysteria2|hy2|tuic)://[^\s<"\']+'
            )
            
            for div in message_divs:
                # 提取纯文本
                text = div.get_text()
                # 寻找所有匹配的节点链接
                found = pattern.findall(text)
                for item in found:
                    # 正则可能捕获的是协议头，我们需要匹配完整字符串，因此在原文本里定位
                    # 或者，我们可以直接在文本中定位节点
                    pass
                
                # 更稳健的方法是利用正则表达式直接从文本分割和寻找
                matches = re.findall(r'(?:vmess|vless|ss|ssr|trojan|hysteria2|hy2|tuic)://[^\s<"\'#]+(?:#[^\s<"\']*)?', text)
                for match in matches:
                    # 清洗一些可能混入的内容尾标
                    node_link = match.strip()
                    if node_link:
                        nodes.append(node_link)
            
            self.logger.info(f"从 Telegram 网页预览中提取到 {len(nodes)} 个节点链接")
        except Exception as e:
            self.logger.error(f"解析 Telegram 频道网页版预览时发生异常: {e}")

        # 初步去重
        unique_nodes = list(set(nodes))
        self.logger.info(f"Telegram 初步去重后可用节点数: {len(unique_nodes)}")
        return unique_nodes
