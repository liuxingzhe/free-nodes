# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 爬虫基类，定义采集流程接口和通用的下载请求处理逻辑。
"""

import logging
import requests
from typing import List, Optional

# 配置规范化日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class BaseScraper:
    """
    免费代理采集器基类
    """
    def __init__(self, name: str, timeout: int = 15):
        self.name = name
        self.timeout = timeout
        self.logger = logging.getLogger(f"Scraper.{name}")
        self.headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/114.0.0.0 Safari/537.36'
            )
        }

    def fetch_url_content(self, url: str) -> Optional[str]:
        """
        统一爬取请求处理，支持超时、状态异常拦截及日志告警
        """
        try:
            self.logger.info(f"正在抓取数据源: {url}")
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            if response.status_code == 200:
                return response.text
            else:
                self.logger.error(f"抓取失败，HTTP状态码: {response.status_code}")
                return None
        except requests.RequestException as e:
            self.logger.error(f"网络请求发生异常: {e}")
            return None

    def scrape(self) -> List[str]:
        """
        执行采集流程，子类必须重写
        返回格式：包含各种协议节点原始链接（如 vmess://, ss://, trojan://...）的字符串列表
        """
        raise NotImplementedError("子类必须实现 scrape 方法")
