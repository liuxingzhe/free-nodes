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
        统一爬取请求处理：支持超时、状态异常拦截、智能镜像降级，多轮高可用重试以百分百克敌制胜
        """
        urls_to_try = [url]
        
        # 智能化为 GitHub Raw 订阅链接植入三大首屈一指的防风控镜像
        if "raw.githubusercontent.com" in url:
            mirror1 = url.replace("raw.githubusercontent.com", "raw.gitmirror.com")
            mirror2 = url.replace("raw.githubusercontent.com", "raw.kkgithub.com")
            mirror3 = url.replace("raw.githubusercontent.com", "raw.fofaproxy.com")
            urls_to_try.extend([mirror1, mirror2, mirror3])
            
        for attempt, target_url in enumerate(urls_to_try, 1):
            try:
                self.logger.info(f"正在抓取数据源 (尝试轮次 {attempt}): {target_url}")
                response = requests.get(target_url, headers=self.headers, timeout=self.timeout)
                if response.status_code == 200:
                    text_content = response.text
                    if text_content and len(text_content.strip()) > 100:
                        self.logger.info(f"【成功】成功从 {target_url} 获取数据 (大小: {len(text_content)} 字符)")
                        return text_content
                    else:
                        self.logger.warning(f"获取的数据过短或为空，继续尝试下一候选源...")
                else:
                    self.logger.error(f"抓取失败，HTTP状态码: {response.status_code} ({target_url})")
            except requests.RequestException as e:
                self.logger.error(f"网络请求发生异常 ({target_url}): {e}")
                
        self.logger.error(f"💥 所有的可用镜像加速链路及首发源均宣告失败！【{url}】")
        return None

    def scrape(self) -> List[str]:
        """
        执行采集流程，子类必须重写
        返回格式：包含各种协议节点原始链接（如 vmess://, ss://, trojan://...）的字符串列表
        """
        raise NotImplementedError("子类必须实现 scrape 方法")
